import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  db,
  usersTable,
  userFitnessStateTable,
  userCreditsTable,
  type User,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetAdminStatusResponse,
  ListAdminUsersResponse,
  GetAdminUserDetailResponse,
  UpdateAdminUserBody,
  SendUserReminderResponse,
} from "@workspace/api-zod";
import { sendGmail } from "../lib/gmail.js";
import { isOwnerId, isAdminEmail } from "../lib/admin.js";

const router: IRouter = Router();

function resolveAdmin(req: Request): { isOwner: boolean; isAdmin: boolean } {
  if (!req.isAuthenticated()) return { isOwner: false, isAdmin: false };
  const isOwner = isOwnerId(req.user.id);
  const isAllowlisted = isAdminEmail(req.user.email);
  return { isOwner, isAdmin: isOwner || isAllowlisted };
}

// Gate every management endpoint behind the same owner/allowlist check used by
// the status route. No client-supplied identity is ever trusted.
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  if (!resolveAdmin(req).isAdmin) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

router.get("/admin/status", (req: Request, res: Response) => {
  const { isAdmin, isOwner } = resolveAdmin(req);
  res.json(GetAdminStatusResponse.parse({ isAdmin, isOwner }));
});

// ---- Shapes of the persisted fitness-state blob we care about here. The blob
// is owned by the web client; we read it defensively and never assume a field
// is present (older saves predate some fields).

interface StoredCredits {
  coaching: number;
  photo: number;
  bodyScan: number;
}

interface StoredWeightLog {
  weight?: number;
  date?: string;
}

interface StoredPhysiqueAnalysis {
  bodyFatEstimate?: number;
  date?: string;
}

interface StoredState {
  onboardingComplete?: boolean;
  goal?: string | null;
  profile?: { name?: string } & Record<string, unknown>;
  credits?: StoredCredits;
  workoutPlan?: unknown[];
  programMeta?: Record<string, unknown> | null;
  prs?: unknown[];
  weightLogs?: StoredWeightLog[];
  progressPhotos?: unknown[];
  physiqueAnalyses?: StoredPhysiqueAnalysis[];
}

const asState = (raw: unknown): StoredState =>
  raw && typeof raw === "object" ? (raw as StoredState) : {};

// Credits now live in their own server-authoritative table, joined per user.
// Returns null when the user has no credits row yet (never used a gated call).
const rowCredits = (r: {
  coaching: number | null;
  photo: number | null;
  bodyScan: number | null;
}): StoredCredits | null =>
  r.coaching === null || r.photo === null || r.bodyScan === null
    ? null
    : { coaching: r.coaching, photo: r.photo, bodyScan: r.bodyScan };

function latestWeight(state: StoredState): number | null {
  const logs = state.weightLogs ?? [];
  if (logs.length === 0) return null;
  const sorted = [...logs].sort((a, b) =>
    (a.date ?? "").localeCompare(b.date ?? ""),
  );
  const last = sorted[sorted.length - 1];
  return typeof last.weight === "number" ? last.weight : null;
}

function latestBodyFat(state: StoredState): number | null {
  const analyses = state.physiqueAnalyses ?? [];
  if (analyses.length === 0) return null;
  const last = analyses[analyses.length - 1];
  return typeof last.bodyFatEstimate === "number" ? last.bodyFatEstimate : null;
}

function buildSummary(
  user: User,
  rawState: unknown,
  updatedAt: Date | null,
  credits: StoredCredits | null,
) {
  const state = asState(rawState);
  // Prefer the onboarding profile name; fall back to the name already stored on
  // the account (OIDC first/last name) so members who never finished onboarding
  // still show a real name instead of just an email.
  const accountName = [user.firstName, user.lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  const name = state.profile?.name?.trim() || accountName || "";
  return {
    id: user.id,
    email: user.email ?? null,
    username: user.username ?? null,
    name,
    goal: state.goal ?? null,
    onboardingComplete: state.onboardingComplete ?? false,
    planDays: Array.isArray(state.workoutPlan) ? state.workoutPlan.length : 0,
    credits,
    createdAt: user.createdAt.toISOString(),
    lastActive: updatedAt ? updatedAt.toISOString() : null,
    photoCount: Array.isArray(state.progressPhotos)
      ? state.progressPhotos.length
      : 0,
    prCount: Array.isArray(state.prs) ? state.prs.length : 0,
    weightLogCount: Array.isArray(state.weightLogs)
      ? state.weightLogs.length
      : 0,
    latestWeight: latestWeight(state),
    bodyFat: latestBodyFat(state),
  };
}

// List every account with a compact fitness summary. We read each user's state
// blob server-side and project only small summary fields — progress-photo data
// URLs are never sent to the client.
router.get(
  "/admin/users",
  requireAdmin,
  async (_req: Request, res: Response) => {
    const rows = await db
      .select({
        user: usersTable,
        state: userFitnessStateTable.state,
        updatedAt: userFitnessStateTable.updatedAt,
        coaching: userCreditsTable.coaching,
        photo: userCreditsTable.photo,
        bodyScan: userCreditsTable.bodyScan,
      })
      .from(usersTable)
      .leftJoin(
        userFitnessStateTable,
        eq(usersTable.id, userFitnessStateTable.userId),
      )
      .leftJoin(
        userCreditsTable,
        eq(usersTable.id, userCreditsTable.userId),
      );

    const summaries = rows.map((r) =>
      buildSummary(r.user, r.state, r.updatedAt, rowCredits(r)),
    );

    // Dedupe by email so a person who has both a password account and a
    // "Sign in with Replit" account under the same email is shown once. We keep
    // the most complete record (finished onboarding > has a plan > has credits,
    // then the most recently created). Rows with no email can't be matched, so
    // each is kept as its own entry.
    const score = (u: (typeof summaries)[number]) =>
      (u.onboardingComplete ? 4 : 0) +
      (u.planDays > 0 ? 2 : 0) +
      (u.credits ? 1 : 0);
    const byEmail = new Map<string, (typeof summaries)[number]>();
    const withoutEmail: typeof summaries = [];
    for (const u of summaries) {
      const key = u.email?.toLowerCase();
      if (!key) {
        withoutEmail.push(u);
        continue;
      }
      const existing = byEmail.get(key);
      if (
        !existing ||
        score(u) > score(existing) ||
        (score(u) === score(existing) && u.createdAt > existing.createdAt)
      ) {
        byEmail.set(key, u);
      }
    }

    const users = [...byEmail.values(), ...withoutEmail].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    res.json(ListAdminUsersResponse.parse({ users }));
  },
);

async function loadDetail(userId: string) {
  const [row] = await db
    .select({
      user: usersTable,
      state: userFitnessStateTable.state,
      updatedAt: userFitnessStateTable.updatedAt,
      coaching: userCreditsTable.coaching,
      photo: userCreditsTable.photo,
      bodyScan: userCreditsTable.bodyScan,
    })
    .from(usersTable)
    .leftJoin(
      userFitnessStateTable,
      eq(usersTable.id, userFitnessStateTable.userId),
    )
    .leftJoin(
      userCreditsTable,
      eq(usersTable.id, userCreditsTable.userId),
    )
    .where(eq(usersTable.id, userId));

  if (!row) return null;

  const state = asState(row.state);
  // Strip the heavy base64 photo payloads — keep only metadata for the UI.
  const progressPhotos = Array.isArray(state.progressPhotos)
    ? state.progressPhotos.map((p) => {
        const photo = (p ?? {}) as Record<string, unknown>;
        return {
          week: photo.week ?? null,
          date: photo.date ?? null,
          angle: photo.angle ?? null,
        };
      })
    : [];

  return {
    summary: buildSummary(row.user, row.state, row.updatedAt, rowCredits(row)),
    profile: state.profile ?? null,
    plan: Array.isArray(state.workoutPlan)
      ? (state.workoutPlan as Record<string, unknown>[])
      : [],
    programMeta: state.programMeta ?? null,
    prs: Array.isArray(state.prs) ? (state.prs as Record<string, unknown>[]) : [],
    weightLogs: Array.isArray(state.weightLogs)
      ? (state.weightLogs as unknown as Record<string, unknown>[])
      : [],
    progressPhotos,
  };
}

router.get(
  "/admin/users/:userId",
  requireAdmin,
  async (req: Request, res: Response) => {
    const userId = String(req.params.userId);
    const detail = await loadDetail(userId);
    if (!detail) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json(GetAdminUserDetailResponse.parse({ user: detail }));
  },
);

// Update a user's credits and/or goal by merging into their stored state blob.
router.patch(
  "/admin/users/:userId",
  requireAdmin,
  async (req: Request, res: Response) => {
    const userId = String(req.params.userId);
    const parsed = UpdateAdminUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!existing) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const [stateRow] = await db
      .select()
      .from(userFitnessStateTable)
      .where(eq(userFitnessStateTable.userId, userId));
    if (!stateRow) {
      res
        .status(400)
        .json({ error: "This user has no saved data to edit yet." });
      return;
    }

    const state = asState(stateRow.state);
    const next: StoredState = { ...state };
    if (parsed.data.goal !== undefined) {
      next.goal = parsed.data.goal;
    }

    await db
      .update(userFitnessStateTable)
      .set({ state: next, updatedAt: new Date() })
      .where(eq(userFitnessStateTable.userId, userId));

    // Credits are server-authoritative and live in their own table — write them
    // there (upserting a row if the user has never used a gated call) rather
    // than into the state blob.
    if (parsed.data.credits) {
      await db
        .insert(userCreditsTable)
        .values({
          userId,
          coaching: parsed.data.credits.coaching,
          photo: parsed.data.credits.photo,
          bodyScan: parsed.data.credits.bodyScan,
          periodStart: new Date(),
        })
        .onConflictDoUpdate({
          target: userCreditsTable.userId,
          set: {
            coaching: parsed.data.credits.coaching,
            photo: parsed.data.credits.photo,
            bodyScan: parsed.data.credits.bodyScan,
          },
        });
    }

    req.log.info(
      { targetUserId: userId },
      "admin updated user fitness state",
    );

    const detail = await loadDetail(userId);
    res.json(GetAdminUserDetailResponse.parse({ user: detail }));
  },
);

// Best-effort public URL for the app so the email can link the member straight
// back in. Behind Replit's proxy the forwarded headers carry the real host.
function appOrigin(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host");
  if (host) return `${proto}://${host}`;
  const domain = (process.env.REPLIT_DOMAINS ?? "").split(",")[0]?.trim();
  return domain ? `https://${domain}` : "";
}

function reminderEmail(name: string, link: string) {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const cta = link
    ? `<p style="margin:24px 0;"><a href="${link}" style="background:#e8e9eb;color:#111;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Finish my setup</a></p>`
    : "";
  const ctaText = link ? `\nFinish setting up: ${link}\n` : "";
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;line-height:1.5;">
  <h2 style="margin:0 0 12px;">Your ALLUR plan is waiting</h2>
  <p>${greeting}</p>
  <p>You're one step away from your personalized training plan. It only takes a couple of minutes to finish setting up your profile so your coach can build the right program for you.</p>
  ${cta}
  <p style="color:#666;font-size:13px;">Strong. Modern. Refined. — The ALLUR team</p>
</div>`;
  const text = `${greeting}

You're one step away from your personalized ALLUR training plan. It only takes a couple of minutes to finish setting up your profile so your coach can build the right program for you.
${ctaText}
Strong. Modern. Refined. — The ALLUR team`;
  return { html, text };
}

// One-tap nudge: email a member (typically one who never finished onboarding) a
// reminder to come back and complete setup. Sent from the connected Gmail
// account via the connectors proxy.
router.post(
  "/admin/users/:userId/remind",
  requireAdmin,
  async (req: Request, res: Response) => {
    const userId = String(req.params.userId);

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const to = user.email?.trim();
    if (!to) {
      res
        .status(400)
        .json({ error: "This member has no email address on file." });
      return;
    }

    const name = [user.firstName, user.lastName]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(" ");
    const { html, text } = reminderEmail(name, appOrigin(req));

    try {
      await sendGmail({
        to,
        subject: "Finish setting up your ALLUR plan",
        html,
        text,
      });
    } catch (err) {
      req.log.error({ err, targetUserId: userId }, "reminder email failed");
      res.status(502).json({
        error: "Could not send the email. Check the Gmail connection.",
      });
      return;
    }

    req.log.info({ targetUserId: userId }, "admin sent onboarding reminder");
    res.json(SendUserReminderResponse.parse({ success: true, sentTo: to }));
  },
);

export default router;
