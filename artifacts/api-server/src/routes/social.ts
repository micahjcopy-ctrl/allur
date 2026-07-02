import crypto from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  usersTable,
  friendshipsTable,
  squadInvitesTable,
  pointsEventsTable,
  duelsTable,
  squadNotificationsTable,
  pushSubscriptionsTable,
  premiumGrantsTable,
  referralsTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getUserPlan } from "../lib/credits";
import { sendPushToUser, vapidPublicKey, pushConfigured } from "../lib/push";

/* ===========================================================================
   Squad — friends, Reps (adherence points), Momentum (adaptive streak),
   duels, and the in-app notification center.

   Design rules (see ALLUR gamification plan):
   - Reps reward adherence to YOUR plan, with hard per-day caps (anti-grind).
   - All awards happen here, server-side, so scores can't be spoofed.
   - No guilt: Momentum "bends" instead of breaking; copy stays coach-voice.
   =========================================================================== */

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Reps catalog — the only event types the server will award.
// ---------------------------------------------------------------------------
const REP_CATALOG: Record<string, { points: number; dailyCap: number }> = {
  workout: { points: 50, dailyCap: 2 },
  meal: { points: 10, dailyCap: 3 },
  protein: { points: 15, dailyCap: 1 },
  checkin: { points: 25, dailyCap: 1 },
  coach_reply: { points: 5, dailyCap: 2 },
};

const WEEKLY_TARGET = 600; // solo weekly challenge target
const WEEKLY_BONUS = 150;
const DUEL_WIN_REPS = 100;

// One-time activation quests → bonus Reps the first time each is completed.
// Stored as points_events with type `quest:<key>` so the "once ever" guard is a
// simple existence check.
const QUEST_CATALOG: Record<string, { points: number; label: string }> = {
  tour_complete: { points: 25, label: "Take the tour" },
  first_meal: { points: 30, label: "Log your first meal" },
  first_workout: { points: 50, label: "Finish your first workout" },
  first_scan: { points: 40, label: "Run your first body-composition scan" },
  first_friend: { points: 25, label: "Add your first friend" },
};

const REFERRAL_REWARD_DAYS = 30;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Resolve the client-claimed local day, falling back to server UTC. Clamped to
// ±1 day of server time so a crafted client can't back-fill history.
function resolveDay(claimed: unknown): string {
  const serverDay = new Date().toISOString().slice(0, 10);
  if (typeof claimed !== "string" || !DAY_RE.test(claimed)) return serverDay;
  const diff = Math.abs(new Date(claimed + "T00:00:00Z").getTime() - new Date(serverDay + "T00:00:00Z").getTime());
  return diff <= 26 * 60 * 60 * 1000 ? claimed : serverDay;
}

// Monday-start ISO week window for a YYYY-MM-DD day, as day-strings (inclusive).
function weekWindow(day: string): { start: string; end: string } {
  const d = new Date(day + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dow);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function requireAuth(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated." });
    return null;
  }
  return req.user.id;
}

async function friendIdsOf(userId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(friendshipsTable)
    .where(or(eq(friendshipsTable.userId, userId), eq(friendshipsTable.friendId, userId)));
  return rows.map((r) => (r.userId === userId ? r.friendId : r.userId));
}

const PUSH_TITLES: Record<string, string> = {
  respect: "Respect 👊",
  friend_joined: "Squad up",
  duel_started: "You've been challenged ⚔️",
  duel_won: "Duel won 🏆",
  duel_lost: "Duel finished",
  weekly_bonus: "Weekly challenge complete 💪",
};

async function notify(userId: string, type: string, body: string, actorId?: string) {
  await db.insert(squadNotificationsTable).values({ userId, type, body, actorId: actorId ?? null });
  // Mirror to Web Push (best-effort; awaited so serverless doesn't kill it).
  await sendPushToUser(userId, { title: PUSH_TITLES[type] ?? "ALLUR", body });
}

function displayName(u: { username: string | null; firstName: string | null; email: string | null }): string {
  return u.username || u.firstName || (u.email ? u.email.split("@")[0] : "A friend");
}

// Sum of Reps for a set of users between two day-strings (inclusive).
async function repsByUser(userIds: string[], start: string, end: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  const rows = await db
    .select({
      userId: pointsEventsTable.userId,
      total: sql<number>`coalesce(sum(${pointsEventsTable.points}), 0)`,
    })
    .from(pointsEventsTable)
    .where(
      and(
        inArray(pointsEventsTable.userId, userIds),
        gte(pointsEventsTable.day, start),
        lte(pointsEventsTable.day, end),
      ),
    )
    .groupBy(pointsEventsTable.userId);
  for (const r of rows) out.set(r.userId, Number(r.total));
  return out;
}

// ---------------------------------------------------------------------------
// Momentum — weeks on plan. A week counts with 3+ active days OR 150+ Reps.
// One quiet week bends (survives); two in a row resets. Never guilt.
// ---------------------------------------------------------------------------
async function computeMomentum(userId: string, today: string) {
  const since = new Date(today + "T00:00:00Z");
  since.setUTCDate(since.getUTCDate() - 7 * 26);
  const rows = await db
    .select({ day: pointsEventsTable.day, points: pointsEventsTable.points })
    .from(pointsEventsTable)
    .where(and(eq(pointsEventsTable.userId, userId), gte(pointsEventsTable.day, since.toISOString().slice(0, 10))));

  const weeks = new Map<string, { reps: number; days: Set<string> }>();
  for (const r of rows) {
    const key = weekWindow(r.day).start;
    const w = weeks.get(key) ?? { reps: 0, days: new Set<string>() };
    w.reps += r.points;
    w.days.add(r.day);
    weeks.set(key, w);
  }

  const qualifies = (key: string) => {
    const w = weeks.get(key);
    return !!w && (w.days.size >= 3 || w.reps >= 150);
  };

  const thisWeek = weekWindow(today).start;
  let cursor = thisWeek;
  let count = 0;
  let flexUsed = false;
  // The current (in-progress) week counts if it already qualifies; otherwise it
  // neither adds nor breaks — we start judging from last completed week.
  if (qualifies(cursor)) count += 1;
  for (let i = 0; i < 26; i++) {
    const prev = new Date(cursor + "T00:00:00Z");
    prev.setUTCDate(prev.getUTCDate() - 7);
    cursor = prev.toISOString().slice(0, 10);
    if (qualifies(cursor)) {
      count += 1;
    } else if (!flexUsed && count > 0) {
      flexUsed = true; // one quiet week bends, doesn't break
    } else {
      break;
    }
  }

  const currentWeekReps = weeks.get(thisWeek)?.reps ?? 0;
  return {
    weeks: count,
    state: count === 0 ? "starting" : currentWeekReps > 0 ? "active" : "bent",
    currentWeekReps,
  };
}

// Finalize any of my duels that have expired: score, pick winner, award, notify.
async function settleExpiredDuels(userId: string) {
  const now = new Date();
  const expired = await db
    .select()
    .from(duelsTable)
    .where(
      and(
        eq(duelsTable.status, "active"),
        lte(duelsTable.endAt, now),
        or(eq(duelsTable.challengerId, userId), eq(duelsTable.opponentId, userId)),
      ),
    );

  for (const duel of expired) {
    const start = duel.startAt.toISOString().slice(0, 10);
    const end = duel.endAt.toISOString().slice(0, 10);
    const scores = await repsByUser([duel.challengerId, duel.opponentId], start, end);
    const a = scores.get(duel.challengerId) ?? 0;
    const b = scores.get(duel.opponentId) ?? 0;
    const winnerId = a === b ? null : a > b ? duel.challengerId : duel.opponentId;
    await db.update(duelsTable).set({ status: "finished", winnerId }).where(eq(duelsTable.id, duel.id));

    const [users, loserId] = [
      await db
        .select()
        .from(usersTable)
        .where(inArray(usersTable.id, [duel.challengerId, duel.opponentId])),
      winnerId === duel.challengerId ? duel.opponentId : duel.challengerId,
    ];
    const nameOf = (id: string) => {
      const u = users.find((x) => x.id === id);
      return u ? displayName(u) : "Your rival";
    };
    if (winnerId) {
      await db.insert(pointsEventsTable).values({
        userId: winnerId,
        type: "duel_win",
        points: DUEL_WIN_REPS,
        day: end,
      });
      await notify(winnerId, "duel_won", `You won the duel against ${nameOf(loserId)} — +${DUEL_WIN_REPS} Reps 🏆`, loserId);
      await notify(loserId, "duel_lost", `${nameOf(winnerId)} took this week's duel. Rematch?`, winnerId);
    } else {
      await notify(duel.challengerId, "duel_lost", `Dead heat with ${nameOf(duel.opponentId)} — nobody blinked. Rematch?`, duel.opponentId);
      await notify(duel.opponentId, "duel_lost", `Dead heat with ${nameOf(duel.challengerId)} — nobody blinked. Rematch?`, duel.challengerId);
    }
  }
}

// Grant (or extend) a Premium entitlement by N days. Stacks on top of any
// remaining time so multiple rewards add up.
async function grantPremiumDays(userId: string, days: number) {
  const [existing] = await db
    .select()
    .from(premiumGrantsTable)
    .where(eq(premiumGrantsTable.userId, userId));
  const base = existing && existing.until.getTime() > Date.now() ? existing.until.getTime() : Date.now();
  const until = new Date(base + days * 24 * 60 * 60 * 1000);
  await db
    .insert(premiumGrantsTable)
    .values({ userId, until, source: "referral" })
    .onConflictDoUpdate({ target: premiumGrantsTable.userId, set: { until, updatedAt: new Date() } });
}

// Complete any of my referrals (either side) whose referred user has started a
// trial. Idempotent: rewards both people once, then marks the row rewarded.
async function settleReferrals(userId: string) {
  const rows = await db
    .select()
    .from(referralsTable)
    .where(
      and(
        eq(referralsTable.status, "pending"),
        or(eq(referralsTable.referrerId, userId), eq(referralsTable.referredId, userId)),
      ),
    );
  for (const r of rows) {
    // "Started a trial" = the referred user is no longer on the free plan.
    const referredPlan = await getUserPlan(r.referredId);
    if (referredPlan === "free") continue;
    await db
      .update(referralsTable)
      .set({ status: "rewarded", rewardedAt: new Date() })
      .where(eq(referralsTable.referredId, r.referredId));
    await grantPremiumDays(r.referrerId, REFERRAL_REWARD_DAYS);
    await grantPremiumDays(r.referredId, REFERRAL_REWARD_DAYS);
    const users = await db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.id, [r.referrerId, r.referredId]));
    const nameOf = (id: string) => {
      const u = users.find((x) => x.id === id);
      return u ? displayName(u) : "a friend";
    };
    await notify(r.referrerId, "friend_joined", `${nameOf(r.referredId)} started their trial — you both just earned a free month of Premium. 🎁`, r.referredId);
    await notify(r.referredId, "friend_joined", `Welcome gift unlocked: a free month of Premium, on ${nameOf(r.referrerId)}. 🎁`, r.referrerId);
  }
}

// Completed one-time quest keys for a user.
async function completedQuests(userId: string): Promise<string[]> {
  const rows = await db
    .select({ type: pointsEventsTable.type })
    .from(pointsEventsTable)
    .where(and(eq(pointsEventsTable.userId, userId), sql`${pointsEventsTable.type} like 'quest:%'`));
  return rows.map((r) => r.type.slice("quest:".length));
}

// ---------------------------------------------------------------------------
// GET /squad/overview — everything the Squad tab needs in one call.
// ---------------------------------------------------------------------------
router.get("/squad/overview", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const today = resolveDay(req.query.day);
  const { start: weekStart, end: weekEnd } = weekWindow(today);
  const plan = await getUserPlan(userId);

  await settleExpiredDuels(userId);
  await settleReferrals(userId);

  // invite code (create once)
  let [invite] = await db.select().from(squadInvitesTable).where(eq(squadInvitesTable.userId, userId));
  if (!invite) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    [invite] = await db.insert(squadInvitesTable).values({ code, userId }).returning();
  }

  const fids = await friendIdsOf(userId);
  const friendUsers = fids.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, fids))
    : [];
  const weekScores = await repsByUser([userId, ...fids], weekStart, weekEnd);

  // respect given today (for button state)
  const respectsToday = await db
    .select({ userId: squadNotificationsTable.userId })
    .from(squadNotificationsTable)
    .where(
      and(
        eq(squadNotificationsTable.actorId, userId),
        eq(squadNotificationsTable.type, "respect"),
        gte(squadNotificationsTable.createdAt, new Date(today + "T00:00:00Z")),
      ),
    );
  const respectedToday = new Set(respectsToday.map((r) => r.userId));

  const momentum = await computeMomentum(userId, today);

  const myWeekReps = weekScores.get(userId) ?? 0;
  const soloChallenge = {
    target: WEEKLY_TARGET,
    current: myWeekReps,
    bonus: WEEKLY_BONUS,
    done: myWeekReps >= WEEKLY_TARGET,
  };

  const duels = await db
    .select()
    .from(duelsTable)
    .where(or(eq(duelsTable.challengerId, userId), eq(duelsTable.opponentId, userId)))
    .orderBy(desc(duelsTable.createdAt))
    .limit(10);
  const duelScores = await Promise.all(
    duels.map(async (d) => {
      const s = await repsByUser(
        [d.challengerId, d.opponentId],
        d.startAt.toISOString().slice(0, 10),
        d.endAt.toISOString().slice(0, 10),
      );
      return {
        id: d.id,
        status: d.status,
        winnerId: d.winnerId,
        challengerId: d.challengerId,
        opponentId: d.opponentId,
        endAt: d.endAt.toISOString(),
        challengerReps: s.get(d.challengerId) ?? 0,
        opponentReps: s.get(d.opponentId) ?? 0,
      };
    }),
  );

  const notifications = await db
    .select()
    .from(squadNotificationsTable)
    .where(eq(squadNotificationsTable.userId, userId))
    .orderBy(desc(squadNotificationsTable.createdAt))
    .limit(20);

  res.json({
    plan,
    inviteCode: invite.code,
    reps: { week: myWeekReps },
    momentum,
    soloChallenge,
    friends: friendUsers.map((u) => ({
      id: u.id,
      name: displayName(u),
      weekReps: weekScores.get(u.id) ?? 0,
      respectedToday: respectedToday.has(u.id),
    })),
    duels: duelScores,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      body: n.body,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount: notifications.filter((n) => !n.readAt).length,
    quests: await completedQuests(userId),
  });
});

// ---------------------------------------------------------------------------
// POST /squad/quest { key } — award a one-time activation-quest bonus.
// ---------------------------------------------------------------------------
router.post("/squad/quest", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const key = typeof req.body?.key === "string" ? req.body.key : "";
  const quest = QUEST_CATALOG[key];
  if (!quest) {
    res.status(400).json({ error: "Unknown quest." });
    return;
  }
  const type = `quest:${key}`;
  const [already] = await db
    .select()
    .from(pointsEventsTable)
    .where(and(eq(pointsEventsTable.userId, userId), eq(pointsEventsTable.type, type)))
    .limit(1);
  if (already) {
    res.json({ awarded: 0, alreadyDone: true });
    return;
  }
  await db.insert(pointsEventsTable).values({ userId, type, points: quest.points, day: resolveDay(req.body?.day) });
  res.json({ awarded: quest.points, alreadyDone: false });
});

// ---------------------------------------------------------------------------
// Referral loop — give a month, get a month.
// ---------------------------------------------------------------------------
router.get("/referral/status", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  await settleReferrals(userId);

  let [invite] = await db.select().from(squadInvitesTable).where(eq(squadInvitesTable.userId, userId));
  if (!invite) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    [invite] = await db.insert(squadInvitesTable).values({ code, userId }).returning();
  }

  const mine = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, userId));
  const rewarded = mine.filter((r) => r.status === "rewarded").length;
  const pending = mine.filter((r) => r.status === "pending").length;

  const [grant] = await db.select().from(premiumGrantsTable).where(eq(premiumGrantsTable.userId, userId));
  const premiumUntil = grant && grant.until.getTime() > Date.now() ? grant.until.toISOString() : null;

  res.json({
    code: invite.code,
    joined: rewarded,
    pending,
    monthsEarned: rewarded, // one referral = one free month
    rewardDays: REFERRAL_REWARD_DAYS,
    premiumUntil,
  });
});

// POST /referral/claim { code } — attribute a freshly-signed-up user to a
// referrer (and auto-friend them). Safe to call repeatedly; only the first
// attribution sticks.
router.post("/referral/claim", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
  if (!code) {
    res.status(400).json({ error: "Missing code." });
    return;
  }
  // Already referred? No-op.
  const [existing] = await db.select().from(referralsTable).where(eq(referralsTable.referredId, userId));
  if (existing) {
    res.json({ success: true, already: true });
    return;
  }
  const [invite] = await db.select().from(squadInvitesTable).where(eq(squadInvitesTable.code, code));
  if (!invite || invite.userId === userId) {
    res.json({ success: false });
    return;
  }
  await db.insert(referralsTable).values({ referredId: userId, referrerId: invite.userId, status: "pending" });
  // Auto-friend the two (ordered pair, ignore if already friends).
  const [a, b] = [userId, invite.userId].sort();
  const friends = await db
    .select()
    .from(friendshipsTable)
    .where(and(eq(friendshipsTable.userId, a), eq(friendshipsTable.friendId, b)));
  if (friends.length === 0) {
    await db.insert(friendshipsTable).values({ userId: a, friendId: b });
  }
  // Settle immediately in case the user already subscribed before claiming.
  await settleReferrals(userId);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /squad/points-event { type, day? } — award Reps with per-day caps.
// ---------------------------------------------------------------------------
router.post("/squad/points-event", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const type = typeof req.body?.type === "string" ? req.body.type : "";
  const entry = REP_CATALOG[type];
  if (!entry) {
    res.status(400).json({ error: "Unknown event type." });
    return;
  }
  const day = resolveDay(req.body?.day);

  const existing = await db
    .select({ n: sql<number>`count(*)` })
    .from(pointsEventsTable)
    .where(
      and(eq(pointsEventsTable.userId, userId), eq(pointsEventsTable.type, type), eq(pointsEventsTable.day, day)),
    );
  if (Number(existing[0]?.n ?? 0) >= entry.dailyCap) {
    res.json({ awarded: 0, capped: true });
    return;
  }

  await db.insert(pointsEventsTable).values({ userId, type, points: entry.points, day });

  // Weekly solo-challenge bonus: first time this week crossing the target.
  const { start, end } = weekWindow(day);
  const weekTotal = (await repsByUser([userId], start, end)).get(userId) ?? 0;
  let bonus = 0;
  if (weekTotal >= WEEKLY_TARGET) {
    const [alreadyBonused] = await db
      .select()
      .from(pointsEventsTable)
      .where(
        and(
          eq(pointsEventsTable.userId, userId),
          eq(pointsEventsTable.type, "weekly_bonus"),
          gte(pointsEventsTable.day, start),
          lte(pointsEventsTable.day, end),
        ),
      );
    if (!alreadyBonused) {
      bonus = WEEKLY_BONUS;
      await db.insert(pointsEventsTable).values({ userId, type: "weekly_bonus", points: WEEKLY_BONUS, day });
      await notify(userId, "weekly_bonus", `Weekly challenge complete — +${WEEKLY_BONUS} bonus Reps. The system noticed. 💪`);
    }
  }

  res.json({ awarded: entry.points, bonus, capped: false, weekReps: weekTotal + bonus });
});

// ---------------------------------------------------------------------------
// POST /squad/invite/accept { code } — become friends via invite code.
// ---------------------------------------------------------------------------
router.post("/squad/invite/accept", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
  if (!code) {
    res.status(400).json({ error: "Enter an invite code." });
    return;
  }
  const [invite] = await db.select().from(squadInvitesTable).where(eq(squadInvitesTable.code, code));
  if (!invite) {
    res.status(404).json({ error: "That invite code doesn't exist." });
    return;
  }
  if (invite.userId === userId) {
    res.status(400).json({ error: "That's your own code — send it to a friend instead." });
    return;
  }
  // Store the pair once, ordered, so the unique index holds both directions.
  const [a, b] = [userId, invite.userId].sort();
  const already = await db
    .select()
    .from(friendshipsTable)
    .where(and(eq(friendshipsTable.userId, a), eq(friendshipsTable.friendId, b)));
  if (already.length > 0) {
    res.status(409).json({ error: "You're already training together." });
    return;
  }
  await db.insert(friendshipsTable).values({ userId: a, friendId: b });

  const users = await db.select().from(usersTable).where(inArray(usersTable.id, [userId, invite.userId]));
  const nameOf = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? displayName(u) : "A friend";
  };
  await notify(invite.userId, "friend_joined", `${nameOf(userId)} joined your squad. 👊`, userId);
  await notify(userId, "friend_joined", `You're now training with ${nameOf(invite.userId)}.`, invite.userId);

  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /squad/respect { friendId } — one per friend per day.
// ---------------------------------------------------------------------------
router.post("/squad/respect", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const friendId = typeof req.body?.friendId === "string" ? req.body.friendId : "";
  const fids = await friendIdsOf(userId);
  if (!fids.includes(friendId)) {
    res.status(403).json({ error: "You can only send Respect to friends." });
    return;
  }
  const today = resolveDay(req.body?.day);
  const dup = await db
    .select()
    .from(squadNotificationsTable)
    .where(
      and(
        eq(squadNotificationsTable.userId, friendId),
        eq(squadNotificationsTable.actorId, userId),
        eq(squadNotificationsTable.type, "respect"),
        gte(squadNotificationsTable.createdAt, new Date(today + "T00:00:00Z")),
      ),
    );
  if (dup.length > 0) {
    res.json({ success: true, already: true });
    return;
  }
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  await notify(friendId, "respect", `${me ? displayName(me) : "A friend"} sent you Respect. 👊`, userId);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /squad/duel { friendId } — start a 7-day duel. Base: 1 active. Premium: ∞.
// ---------------------------------------------------------------------------
router.post("/squad/duel", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const plan = await getUserPlan(userId);
  if (plan === "free") {
    res.status(403).json({ error: "Duels are part of ALLUR Base. Start your free trial to compete." });
    return;
  }

  const friendId = typeof req.body?.friendId === "string" ? req.body.friendId : "";
  const fids = await friendIdsOf(userId);
  if (!fids.includes(friendId)) {
    res.status(403).json({ error: "You can only duel friends." });
    return;
  }

  await settleExpiredDuels(userId);
  const actives = await db
    .select()
    .from(duelsTable)
    .where(
      and(
        eq(duelsTable.status, "active"),
        or(eq(duelsTable.challengerId, userId), eq(duelsTable.opponentId, userId)),
      ),
    );
  if (plan !== "premium" && actives.length >= 1) {
    res.status(402).json({
      error: "Base includes one duel at a time. Go Premium for unlimited duels.",
      upgrade: true,
    });
    return;
  }
  if (actives.some((d) => d.challengerId === friendId || d.opponentId === friendId)) {
    res.status(409).json({ error: "You already have an active duel with this friend." });
    return;
  }

  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [duel] = await db
    .insert(duelsTable)
    .values({ challengerId: userId, opponentId: friendId, startAt, endAt })
    .returning();

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  await notify(
    friendId,
    "duel_started",
    `${me ? displayName(me) : "A friend"} challenged you to a 7-day duel. Most Reps wins. ⚔️`,
    userId,
  );

  res.json({ success: true, duelId: duel.id, endAt: endAt.toISOString() });
});

// ---------------------------------------------------------------------------
// Web Push: public key + subscribe/unsubscribe.
// ---------------------------------------------------------------------------
router.get("/squad/push/public-key", (_req: Request, res: Response) => {
  const key = vapidPublicKey();
  res.json({ key, enabled: !!key });
});

router.post("/squad/push/subscribe", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  const p256dh = typeof req.body?.keys?.p256dh === "string" ? req.body.keys.p256dh : "";
  const auth = typeof req.body?.keys?.auth === "string" ? req.body.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    res.status(400).json({ error: "Invalid subscription." });
    return;
  }
  await db
    .insert(pushSubscriptionsTable)
    .values({ endpoint, userId, p256dh, auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { userId, p256dh, auth },
    });
  res.json({ success: true });
});

router.post("/squad/push/unsubscribe", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  if (endpoint) {
    await db
      .delete(pushSubscriptionsTable)
      .where(and(eq(pushSubscriptionsTable.endpoint, endpoint), eq(pushSubscriptionsTable.userId, userId)));
  }
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /cron/weekly-recap — Monday recap push to every subscribed user.
// Triggered by Vercel Cron. Guarded by CRON_SECRET when configured.
// ---------------------------------------------------------------------------
router.get("/cron/weekly-recap", async (req: Request, res: Response) => {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization ?? "";
  const fromVercelCron = (req.headers["user-agent"] ?? "").includes("vercel-cron");
  if (secret ? authHeader !== `Bearer ${secret}` : !fromVercelCron) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  if (!pushConfigured()) {
    res.json({ sent: 0, reason: "push not configured" });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  // Last completed week (the recap covers the week that just ended).
  const thisWeek = weekWindow(today);
  const lastWeekEndDate = new Date(thisWeek.start + "T00:00:00Z");
  lastWeekEndDate.setUTCDate(lastWeekEndDate.getUTCDate() - 1);
  const lastWeek = weekWindow(lastWeekEndDate.toISOString().slice(0, 10));

  const subs = await db
    .select({ userId: pushSubscriptionsTable.userId })
    .from(pushSubscriptionsTable)
    .groupBy(pushSubscriptionsTable.userId);
  let sent = 0;
  for (const { userId } of subs) {
    const reps = (await repsByUser([userId], lastWeek.start, lastWeek.end)).get(userId) ?? 0;
    const momentum = await computeMomentum(userId, today);
    const body =
      reps > 0
        ? `Last week: ${reps} Reps · Momentum ${momentum.weeks}w. This week's challenge is live — first session sets the tone.`
        : `New week, clean slate. Your plan is ready — one session today starts the Momentum.`;
    await sendPushToUser(userId, { title: "Your week with ALLUR", body });
    sent += 1;
  }
  res.json({ sent });
});

// ---------------------------------------------------------------------------
// POST /squad/notifications/read — mark all as read.
// ---------------------------------------------------------------------------
router.post("/squad/notifications/read", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  await db
    .update(squadNotificationsTable)
    .set({ readAt: new Date() })
    .where(and(eq(squadNotificationsTable.userId, userId), isNull(squadNotificationsTable.readAt)));
  res.json({ success: true });
});

export default router;
