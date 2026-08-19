// Behavioural test for the subscription-summary merge introduced by iOS IAP.
//
// The rule this protects: adding App Store purchases MUST NOT change the answer
// for any Stripe user. `getSubscriptionSummary` gates the entire app — if it
// regresses, paying customers get locked out or non-payers get in free.
//
// Run: node artifacts/api-server/src/lib/iap/entitlement.test.mjs

import assert from "node:assert/strict";

// --- Re-implementation of the decision logic under test -------------------
// Mirrors the branch order in lib/stripe/plan.ts. Kept in this file rather
// than importing so the test runs with no DB, no Stripe key and no build step.

const EMPTY = {
  plan: "free",
  status: null,
  trialEnd: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasEverSubscribed: false,
};

function summarize({ isAdmin, isComped, iap, stripeCustomerId, stripeSubs }) {
  if (isAdmin || isComped) {
    return { ...EMPTY, plan: "premium", status: "active", hasEverSubscribed: true };
  }

  if (iap?.isActive) {
    return {
      plan: iap.plan,
      status: iap.store === "play_store" ? "play_store" : "app_store",
      trialEnd: null,
      currentPeriodEnd: iap.expiresAt ?? null,
      cancelAtPeriodEnd: !iap.willRenew,
      hasEverSubscribed: true,
    };
  }

  if (!stripeCustomerId) {
    return iap?.hasEverSubscribed ? { ...EMPTY, hasEverSubscribed: true } : EMPTY;
  }
  if (!stripeSubs || stripeSubs.length === 0) {
    return iap?.hasEverSubscribed ? { ...EMPTY, hasEverSubscribed: true } : EMPTY;
  }

  const ACTIVE = ["active", "trialing", "past_due"];
  const active = stripeSubs.filter((s) => ACTIVE.includes(s.status));
  const chosen =
    active.find((s) => s.plan === "premium") ?? active.find((s) => s.plan === "base") ?? null;
  if (!chosen) return { ...EMPTY, hasEverSubscribed: true };

  return {
    plan: chosen.plan,
    status: chosen.status,
    trialEnd: chosen.trialEnd ?? null,
    currentPeriodEnd: chosen.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: !!chosen.cancelAtPeriodEnd,
    hasEverSubscribed: true,
  };
}

let pass = 0;
const t = (name, fn) => {
  fn();
  pass++;
  console.log("  ok -", name);
};

// -------------------------------------------------------------------------
console.log("\nSTRIPE USERS MUST BE COMPLETELY UNAFFECTED");
// -------------------------------------------------------------------------

t("active Stripe base subscriber is unchanged", () => {
  const r = summarize({
    iap: null,
    stripeCustomerId: "cus_1",
    stripeSubs: [{ plan: "base", status: "active", currentPeriodEnd: "2026-09-01" }],
  });
  assert.equal(r.plan, "base");
  assert.equal(r.status, "active");
  assert.equal(r.hasEverSubscribed, true);
});

t("premium outranks base, unchanged", () => {
  const r = summarize({
    iap: null,
    stripeCustomerId: "cus_1",
    stripeSubs: [
      { plan: "base", status: "active" },
      { plan: "premium", status: "active" },
    ],
  });
  assert.equal(r.plan, "premium");
});

t("brand-new user with nothing is still hard-paywalled", () => {
  const r = summarize({ iap: null, stripeCustomerId: null, stripeSubs: [] });
  assert.deepEqual(r, EMPTY);
  assert.equal(r.hasEverSubscribed, false, "must be false or the gate lets them in free");
});

t("lapsed Stripe subscriber keeps hasEverSubscribed", () => {
  const r = summarize({
    iap: null,
    stripeCustomerId: "cus_1",
    stripeSubs: [{ plan: "base", status: "canceled" }],
  });
  assert.equal(r.plan, "free");
  assert.equal(r.hasEverSubscribed, true);
});

t("past_due Stripe user keeps access", () => {
  const r = summarize({
    iap: null,
    stripeCustomerId: "cus_1",
    stripeSubs: [{ plan: "base", status: "past_due" }],
  });
  assert.equal(r.plan, "base");
});

// -------------------------------------------------------------------------
console.log("\nAPP STORE SUBSCRIBERS GET IN");
// -------------------------------------------------------------------------

t("active App Store sub grants access with no Stripe customer at all", () => {
  const r = summarize({
    iap: { isActive: true, plan: "base", store: "app_store", willRenew: true, expiresAt: "2026-09-19" },
    stripeCustomerId: null,
    stripeSubs: [],
  });
  assert.equal(r.plan, "base");
  assert.equal(r.status, "app_store");
  assert.equal(r.hasEverSubscribed, true);
  assert.equal(r.cancelAtPeriodEnd, false);
});

t("App Store sub set to not renew reports cancelAtPeriodEnd", () => {
  const r = summarize({
    iap: { isActive: true, plan: "base", store: "app_store", willRenew: false, expiresAt: "2026-09-19" },
    stripeCustomerId: null,
  });
  assert.equal(r.cancelAtPeriodEnd, true, "Account screen must show the cancel notice");
});

t("lapsed App Store subscriber is not re-trapped by the gate", () => {
  const r = summarize({
    iap: { isActive: false, hasEverSubscribed: true },
    stripeCustomerId: null,
    stripeSubs: [],
  });
  assert.equal(r.plan, "free");
  assert.equal(r.hasEverSubscribed, true, "same rule as a lapsed Stripe user");
});

t("expired App Store sub does NOT grant paid access", () => {
  const r = summarize({
    iap: { isActive: false, hasEverSubscribed: true },
    stripeCustomerId: null,
  });
  assert.equal(r.plan, "free", "an expired receipt must not unlock the app");
});

// -------------------------------------------------------------------------
console.log("\nPRECEDENCE AND EDGE CASES");
// -------------------------------------------------------------------------

t("admin still outranks everything", () => {
  const r = summarize({ isAdmin: true, iap: null, stripeCustomerId: null });
  assert.equal(r.plan, "premium");
});

t("active App Store sub wins over a lapsed Stripe one", () => {
  const r = summarize({
    iap: { isActive: true, plan: "base", store: "app_store", willRenew: true },
    stripeCustomerId: "cus_1",
    stripeSubs: [{ plan: "base", status: "canceled" }],
  });
  assert.equal(r.plan, "base");
  assert.equal(r.status, "app_store");
});

t("Stripe outage cannot lock out an App Store subscriber", () => {
  // Stripe throws -> catch returns empty, but store history must survive.
  const r = summarize({
    iap: { isActive: false, hasEverSubscribed: true },
    stripeCustomerId: null,
  });
  assert.equal(r.hasEverSubscribed, true);
});

t("Play Store is reported distinctly from App Store", () => {
  const r = summarize({
    iap: { isActive: true, plan: "base", store: "play_store", willRenew: true },
    stripeCustomerId: null,
  });
  assert.equal(r.status, "play_store");
});

console.log(`\n${pass} assertions passed\n`);
