import { and, eq, gt, sql } from "drizzle-orm";
import { db, userCreditsTable, premiumGrantsTable } from "@workspace/db";
import { isAdminUserId } from "./admin";

/**
 * Server-authoritative usage credits.
 *
 * Credits used to live in the client-persisted blob, which meant a crafted
 * client could grant itself unlimited usage. They are now stored in
 * `userCreditsTable` and only ever mutated here, inside the auth-gated coach /
 * vision endpoints, so the limits are enforced server-side.
 */

export type CreditType = "coaching" | "photo" | "bodyScan";
export type UserPlan = "free" | "base" | "premium";

export interface CreditBalance {
  coaching: number;
  photo: number;
  bodyScan: number;
}

export interface CreditState {
  plan: UserPlan;
  credits: CreditBalance;
  periodStart: string;
}

// Base-tier ($12.99/mo) monthly grants. Free users cannot spend these at all
// (the gated endpoints block them outright), so the stored balance is only ever
// consumed by Base subscribers; Premium ($29.99/mo) bypasses the decrement
// entirely. These are deliberately generous since Base is a paid plan.
export const BASE_MONTHLY_CREDITS: CreditBalance = {
  coaching: 50,
  photo: 150,
  bodyScan: 20,
};

// The monthly grant applied on init / reset. Tracks the Base allotment so a
// subscriber always refills to the paid limits.
const MONTHLY_GRANT: CreditBalance = BASE_MONTHLY_CREDITS;

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Premium status seam. Reads the user's active Stripe subscription, with two
 * exceptions that always resolve to "premium": the Repl owner and any email on
 * the ADMIN_EMAILS allowlist (see lib/admin.ts) — admins get unlimited usage
 * and bypass the paywall. Kept as a single choke point so every credit decision
 * agrees.
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  if (await isAdminUserId(userId)) return "premium";
  // Referral reward: an active Premium grant (outside Stripe) counts as premium.
  try {
    const [grant] = await db
      .select()
      .from(premiumGrantsTable)
      .where(eq(premiumGrantsTable.userId, userId))
      .limit(1);
    if (grant && grant.until.getTime() > Date.now()) return "premium";
  } catch {
    /* grants table missing / transient — fall through to Stripe */
  }
  try {
    const { getUserPlanFromStripe } = await import("./stripe/plan");
    return await getUserPlanFromStripe(userId);
  } catch {
    // Stripe wiring not present yet (or transient failure): default to free so
    // we never accidentally grant unlimited usage.
    return "free";
  }
}

async function getOrInitRow(userId: string) {
  const existing = await db
    .select()
    .from(userCreditsTable)
    .where(eq(userCreditsTable.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(userCreditsTable)
    .values({
      userId,
      coaching: MONTHLY_GRANT.coaching,
      photo: MONTHLY_GRANT.photo,
      bodyScan: MONTHLY_GRANT.bodyScan,
      periodStart: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];

  // Lost the insert race — read the row the other request created.
  const again = await db
    .select()
    .from(userCreditsTable)
    .where(eq(userCreditsTable.userId, userId))
    .limit(1);
  return again[0]!;
}

/** Refill to free defaults if the 30-day period has elapsed. */
async function applyMonthlyReset(row: typeof userCreditsTable.$inferSelect) {
  const age = Date.now() - new Date(row.periodStart).getTime();
  if (age < PERIOD_MS) return row;
  const updated = await db
    .update(userCreditsTable)
    .set({
      coaching: MONTHLY_GRANT.coaching,
      photo: MONTHLY_GRANT.photo,
      bodyScan: MONTHLY_GRANT.bodyScan,
      periodStart: new Date(),
    })
    .where(eq(userCreditsTable.userId, row.userId))
    .returning();
  return updated[0] ?? row;
}

function toBalance(row: typeof userCreditsTable.$inferSelect): CreditBalance {
  return { coaching: row.coaching, photo: row.photo, bodyScan: row.bodyScan };
}

/** Current balance + plan for the user (applies a monthly reset if due). */
export async function getCreditState(userId: string): Promise<CreditState> {
  const plan = await getUserPlan(userId);
  const row = await applyMonthlyReset(await getOrInitRow(userId));
  return {
    plan,
    credits: toBalance(row),
    periodStart: new Date(row.periodStart).toISOString(),
  };
}

export interface SpendResult {
  ok: boolean;
  plan: UserPlan;
  credits: CreditBalance;
}

/**
 * Atomically spend one credit of the given type. Premium subscribers and the
 * owner are never decremented (unlimited). Returns ok=false when the free-tier
 * balance for that type is exhausted, so callers can return HTTP 402.
 */
export async function spendCredit(
  userId: string,
  type: CreditType,
): Promise<SpendResult> {
  const plan = await getUserPlan(userId);
  const row = await applyMonthlyReset(await getOrInitRow(userId));

  // Premium ($29.99) is unlimited — never decremented.
  if (plan === "premium") {
    return { ok: true, plan, credits: toBalance(row) };
  }

  // Free users have no access to credit-gated features at all. The caller
  // (requireCredit) turns this into a 403 "needs_subscription" prompt.
  if (plan === "free") {
    return { ok: false, plan, credits: toBalance(row) };
  }

  // Base ($12.99): spend one credit of this type.
  const column = userCreditsTable[type];
  const updated = await db
    .update(userCreditsTable)
    .set({ [type]: sql`${column} - 1` })
    .where(and(eq(userCreditsTable.userId, userId), gt(column, 0)))
    .returning();

  if (!updated[0]) {
    return { ok: false, plan, credits: toBalance(row) };
  }
  return { ok: true, plan, credits: toBalance(updated[0]) };
}

/** Give a credit back (used when a paid call fails after the spend). */
export async function refundCredit(
  userId: string,
  type: CreditType,
): Promise<void> {
  const plan = await getUserPlan(userId);
  // Only Base subscribers ever have a credit decremented; nothing to refund for
  // unlimited Premium or for Free (which can't spend in the first place).
  if (plan !== "base") return;
  const column = userCreditsTable[type];
  await db
    .update(userCreditsTable)
    .set({ [type]: sql`${column} + 1` })
    .where(eq(userCreditsTable.userId, userId));
}
