// Shared client helpers for the server-authoritative credit system.
//
// Credit spends are enforced server-side inside the gated coach/vision
// endpoints. When a free user's balance for a given action is exhausted the
// endpoint responds with HTTP 402 and a JSON body of { error, type }. The
// client uses `hasCredit()` as a pre-flight UX gate, but must still treat a 402
// as the authoritative "out of credits" signal (e.g. the cached balance was
// stale, or another tab spent the last one).

import { isNative } from "@/lib/native";
import { PLAN_PRICES } from "@/lib/subscription";

export const OUT_OF_CREDITS_STATUS = 402;
// Free-tier users hitting a credit-gated endpoint get a 403 with
// { type: "needs_subscription" }.
export const NEEDS_SUBSCRIPTION_STATUS = 403;

// User-facing label for the exhausted bucket, dropped into the toast copy.
// The server tracks three buckets (coaching / photo / bodyScan) but the photo
// bucket is spent by two different features, so it has two labels — a meal
// photo and a goal-photo enhancement should not both read "photo logs".
type CreditKind =
  | "coaching requests"
  | "photo logs"
  | "meal logs"
  | "photo enhancements"
  | "body scans";

export function outOfCreditsToast(kind: CreditKind) {
  // Premium is a Stripe-only tier; on device (StoreKit) it is not for sale, so
  // the upsell would point at a purchase the app cannot make (Guideline 3.1.1).
  const upsell = isNative()
    ? "Your allowance resets at the start of your next billing month."
    : "Upgrade to Premium in Account for unlimited access.";
  return {
    variant: "destructive" as const,
    title: "Out of credits",
    description: `You've used all your ${kind} this month. ${upsell}`,
  };
}

/** Shown when a Free user tries to use a credit-gated feature. */
export function needsSubscriptionToast() {
  return {
    variant: "destructive" as const,
    title: "Subscribe to unlock",
    description:
      `This is part of ALLUR Base (${PLAN_PRICES.base}/mo). Reactivate in Account to use your AI coach, plan updates, and tracking.`,
  };
}
