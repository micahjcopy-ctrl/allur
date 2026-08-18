// Client helpers for the ALLUR subscription tiers.
//
// Stripe checkout/cancel endpoints are plain Express routes (not in the OpenAPI
// spec), so they're called with raw fetch here. Plan reads (credits +
// subscription summary) go through the generated hooks in FitCoachContext.

import { apiFetch } from "@/lib/apiOrigin";

export type PlanTag = "base" | "premium";
export type BillingInterval = "monthly" | "annual";

// Fallback display prices. The paywall fetches live amounts from Stripe via
// fetchPlanPrices() so the shown price always matches what Stripe charges;
// these are only used if that fetch fails.
export const PLAN_PRICES: Record<PlanTag, string> = {
  base: "$10.99",
  premium: "$29.99",
};

export const ANNUAL_PRICE = "$69";
export const ANNUAL_PER_MONTH = "$5.75";

export interface PlanPrice {
  id: string;
  amount: number; // cents
}
export interface PlanPrices {
  monthly: PlanPrice | null;
  annual: PlanPrice | null;
  currency: string;
}

/** Live Base pricing from Stripe (monthly + annual). Null on failure. */
export async function fetchPlanPrices(): Promise<PlanPrices | null> {
  try {
    const res = await apiFetch(`/api/stripe/plan-prices`, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as PlanPrices;
  } catch {
    return null;
  }
}

/** Format cents as a dollar string, dropping the .00 on whole amounts. */
export function fmtPrice(cents: number, currency = "usd"): string {
  const sym = currency.toLowerCase() === "usd" ? "$" : "";
  const v = cents / 100;
  return sym + (Number.isInteger(v) ? v.toString() : v.toFixed(2));
}

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
export async function startCheckout(plan: PlanTag, interval: BillingInterval = "monthly"): Promise<void> {
  const res = await apiFetch(`/api/stripe/checkout`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, interval }),
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
  const res = await apiFetch(`/api/stripe/cancel`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Couldn't cancel right now.");
  }
}
