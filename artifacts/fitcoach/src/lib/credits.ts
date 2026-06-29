// Shared client helpers for the server-authoritative credit system.
//
// Credit spends are enforced server-side inside the gated coach/vision
// endpoints. When a free user's balance for a given action is exhausted the
// endpoint responds with HTTP 402 and a JSON body of { error, type }. The
// client uses `hasCredit()` as a pre-flight UX gate, but must still treat a 402
// as the authoritative "out of credits" signal (e.g. the cached balance was
// stale, or another tab spent the last one).

export const OUT_OF_CREDITS_STATUS = 402;
// Free-tier users hitting a credit-gated endpoint get a 403 with
// { type: "needs_subscription" }.
export const NEEDS_SUBSCRIPTION_STATUS = 403;

type CreditKind = "coaching requests" | "photo logs" | "body scans";

export function outOfCreditsToast(kind: CreditKind) {
  return {
    variant: "destructive" as const,
    title: "Out of credits",
    description: `You've used all your ${kind} this month. Upgrade to Premium in Account for unlimited access.`,
  };
}

/** Shown when a Free user tries to use a credit-gated feature. */
export function needsSubscriptionToast() {
  return {
    variant: "destructive" as const,
    title: "Subscribe to unlock",
    description:
      "This is part of ALLUR Base ($12.99/mo). Reactivate in Account to use your AI coach, plan updates, and tracking.",
  };
}
