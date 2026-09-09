import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import type { UserPlan } from "../credits";
import { isAdminUserId } from "../admin";
import { isCompedUserId } from "../comped";
import { getIapEntitlement } from "../iap/entitlement";

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

  // Comped users (COMPED_EMAILS allowlist) get the same synthetic Premium
  // summary as admins — unlimited access and, because hasEverSubscribed is
  // true, no post-onboarding paywall. They have no real Stripe subscription.
  if (await isCompedUserId(userId)) {
    return {
      plan: "premium",
      status: "active",
      trialEnd: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      hasEverSubscribed: true,
    };
  }

  // App Store / Play Store subscribers. Checked BEFORE Stripe because a user
  // who bought in the iOS app has no Stripe customer at all — the Stripe branch
  // below would return `empty` and hard-paywall a paying customer.
  //
  // This block is the entire iOS payment integration as far as the rest of the
  // app is concerned. Every downstream consumer — the post-onboarding paywall
  // gate, the credit guard, the Account screen, every feature lock — reads this
  // same SubscriptionSummary and cannot tell which store paid for it. Nothing
  // else needed changing, and nothing about the web experience did.
  const iap = await getIapEntitlement(userId);
  if (iap?.isActive) {
    return {
      plan: iap.plan,
      // Surfaced verbatim so the Account screen can say "manage this in the App
      // Store" rather than offering a Stripe cancel button that would 404.
      status: iap.store === "play_store" ? "play_store" : "app_store",
      trialEnd: null,
      currentPeriodEnd: iap.expiresAt ? iap.expiresAt.toISOString() : null,
      cancelAtPeriodEnd: !iap.willRenew,
      hasEverSubscribed: true,
    };
  }

  try {
    const [user] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const customerId = user?.stripeCustomerId;
    // A lapsed store subscriber still counts as "has ever subscribed", so the
    // post-onboarding gate does not re-trap them (same rule as lapsed Stripe).
    if (!customerId) {
      return iap?.hasEverSubscribed
        ? { ...empty, hasEverSubscribed: true }
        : empty;
    }

    const subs = await loadSubscriptions(customerId);
    if (subs.length === 0) {
      return iap?.hasEverSubscribed
        ? { ...empty, hasEverSubscribed: true }
        : empty;
    }

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
    // Stripe unreachable. Preserve the store subscriber's history so a Stripe
    // outage cannot hard-paywall an App Store customer who has never touched it.
    return iap?.hasEverSubscribed
      ? { ...empty, hasEverSubscribed: true }
      : empty;
  }
}
