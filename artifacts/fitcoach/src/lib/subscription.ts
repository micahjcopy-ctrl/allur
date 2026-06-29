// Client helpers for the ALLUR subscription tiers.
//
// Stripe checkout/cancel endpoints are plain Express routes (not in the OpenAPI
// spec), so they're called with raw fetch here. Plan reads (credits +
// subscription summary) go through the generated hooks in FitCoachContext.

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

export type PlanTag = "base" | "premium";

export const PLAN_PRICES: Record<PlanTag, string> = {
  base: "$12.99",
  premium: "$29.99",
};

export const TRIAL_DAYS = 14;

// Mirrors BASE_MONTHLY_CREDITS in the server's credits.ts — keep in lockstep.
// Used only for display copy on the Account / paywall screens.
export const BASE_MONTHLY_CREDITS = {
  coaching: 50,
  photo: 150,
  bodyScan: 20,
} as const;

/**
 * Start a Stripe Checkout session for the given plan and redirect the browser
 * to it. Throws with a user-facing message on failure.
 */
export async function startCheckout(plan: PlanTag): Promise<void> {
  const res = await fetch(`${apiBase()}/api/stripe/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Couldn't start checkout.");
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Checkout session was not created.");
  window.location.href = data.url;
}

/** Cancel the active subscription at period end. Throws on failure. */
export async function cancelSubscription(): Promise<void> {
  const res = await fetch(`${apiBase()}/api/stripe/cancel`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Couldn't cancel right now.");
  }
}
