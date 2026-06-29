import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import type { UserPlan } from "../credits";
import { isAdminUserId } from "../admin";

// Stripe subscription statuses that grant access (trialing counts — the 14-day
// Base trial is full access).
const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export interface SubscriptionSummary {
  plan: UserPlan;
  /** Raw Stripe status of the highest active subscription, or null. */
  status: string | null;
  /** ISO timestamp the trial ends, if currently trialing. */
  trialEnd: string | null;
  /** ISO timestamp the current period ends (when access lapses if canceled). */
  currentPeriodEnd: string | null;
  /** True when the active subscription is set to cancel at period end. */
  cancelAtPeriodEnd: boolean;
  /**
   * True if the user has EVER had a subscription (any status, incl. canceled).
   * Drives the "force payment after onboarding" gate: a user with no history is
   * a brand-new signup who must start a trial; a lapsed user is not re-gated.
   */
  hasEverSubscribed: boolean;
}

interface SubRow {
  plan_tag: string | null;
  status: string;
  trial_end: Date | string | null;
  current_period_end: Date | string | null;
  cancel_at_period_end: boolean | null;
}

/**
 * Load every subscription for the user's Stripe customer, tagged with the
 * product's `metadata.plan` ("base" | "premium"). Newest first.
 */
async function loadSubscriptions(customerId: string): Promise<SubRow[]> {
  const result = await db.execute(sql`
    SELECT
      p.metadata->>'plan' AS plan_tag,
      s.status AS status,
      s.trial_end AS trial_end,
      s.current_period_end AS current_period_end,
      s.cancel_at_period_end AS cancel_at_period_end
    FROM stripe.subscriptions s
    JOIN stripe.subscription_items si ON si.subscription = s.id
    JOIN stripe.prices pr ON si.price = pr.id
    JOIN stripe.products p ON pr.product = p.id
    WHERE s.customer = ${customerId}
    ORDER BY s.created DESC
  `);
  return result.rows as unknown as SubRow[];
}

function tierFromTag(tag: string | null): UserPlan {
  if (tag === "premium") return "premium";
  if (tag === "base") return "base";
  // Untagged legacy products default to premium (the original single tier was
  // "ALLUR Premium"); a missing tag should never silently downgrade a payer.
  return "premium";
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Resolve a user's plan from their Stripe subscription state.
 *
 * premium (active premium sub) > base (active base sub) > free. Active means an
 * active-equivalent status (active / trialing / past_due).
 *
 * Defensive by design: any failure resolves to "free" so no one is granted paid
 * usage by accident.
 */
export async function getUserPlanFromStripe(userId: string): Promise<UserPlan> {
  try {
    const summary = await getSubscriptionSummary(userId);
    return summary.plan;
  } catch {
    return "free";
  }
}

/**
 * Full subscription summary for the user (plan + status + trial/cancel info +
 * whether they've ever subscribed). Used by GET /me/subscription and the
 * onboarding paywall gate.
 */
export async function getSubscriptionSummary(
  userId: string,
): Promise<SubscriptionSummary> {
  const empty: SubscriptionSummary = {
    plan: "free",
    status: null,
    trialEnd: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    hasEverSubscribed: false,
  };

  // Admins (Repl owner + ADMIN_EMAILS allowlist) get a synthetic Premium
  // summary: unlimited access and, because hasEverSubscribed is true, no
  // post-onboarding paywall. They have no real Stripe subscription to manage.
  if (await isAdminUserId(userId)) {
    return {
      plan: "premium",
      status: "active",
      trialEnd: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      hasEverSubscribed: true,
    };
  }

  try {
    const [user] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const customerId = user?.stripeCustomerId;
    if (!customerId) return empty;

    const subs = await loadSubscriptions(customerId);
    if (subs.length === 0) return empty;

    const hasEverSubscribed = true;
    const active = subs.filter((s) =>
      (ACTIVE_STATUSES as readonly string[]).includes(s.status),
    );

    // Highest active tier wins.
    const premium = active.find((s) => tierFromTag(s.plan_tag) === "premium");
    const base = active.find((s) => tierFromTag(s.plan_tag) === "base");
    const chosen = premium ?? base ?? null;

    if (!chosen) {
      return { ...empty, hasEverSubscribed };
    }

    return {
      plan: tierFromTag(chosen.plan_tag),
      status: chosen.status,
      trialEnd: toIso(chosen.trial_end),
      currentPeriodEnd: toIso(chosen.current_period_end),
      cancelAtPeriodEnd: !!chosen.cancel_at_period_end,
      hasEverSubscribed,
    };
  } catch {
    return empty;
  }
}
