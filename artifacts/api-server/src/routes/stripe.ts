import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../lib/stripe/stripeClient";
import { publicBaseUrlFor } from "../lib/appUrl";

const router: IRouter = Router();

const TRIAL_DAYS = 14;

type PlanTag = "base" | "premium";

/**
 * Web base URL for checkout redirects. The fitcoach app is served under / on the
 * same origin as the API, so the public origin (APP_URL / VERCEL_URL / the
 * incoming host) is the right base.
 */
function webBaseUrl(req: Request): string {
  return publicBaseUrlFor(req);
}

/** Resolve the cheapest active recurring price id for a plan tag. */
async function resolvePriceId(plan: PlanTag): Promise<string | null> {
  const legacyName = plan === "premium" ? "ALLUR Premium" : "ALLUR Base";
  const result = await db.execute(sql`
    SELECT pr.id as price_id
    FROM stripe.prices pr
    JOIN stripe.products p ON pr.product = p.id
    WHERE p.active = true
      AND pr.active = true
      AND (p.metadata->>'plan' = ${plan} OR p.name = ${legacyName})
    ORDER BY pr.unit_amount ASC
    LIMIT 1
  `);
  const row = result.rows[0] as { price_id: string } | undefined;
  return row?.price_id ?? null;
}

// Public pricing for a plan (so the client can render price/trial without
// hardcoding ids). Defaults to the Base plan.
router.get("/stripe/plan-price", async (req: Request, res: Response) => {
  const plan = (req.query["plan"] === "premium" ? "premium" : "base") as PlanTag;
  try {
    const legacyName = plan === "premium" ? "ALLUR Premium" : "ALLUR Base";
    const result = await db.execute(sql`
      SELECT pr.id as price_id, pr.unit_amount, pr.currency
      FROM stripe.prices pr
      JOIN stripe.products p ON pr.product = p.id
      WHERE p.active = true
        AND pr.active = true
        AND (p.metadata->>'plan' = ${plan} OR p.name = ${legacyName})
      ORDER BY pr.unit_amount ASC
      LIMIT 1
    `);
    const row = result.rows[0] as
      | { price_id: string; unit_amount: number; currency: string }
      | undefined;
    if (!row) {
      res.status(404).json({ error: "That plan is not available yet." });
      return;
    }
    res.json({
      priceId: row.price_id,
      unitAmount: row.unit_amount,
      currency: row.currency,
      trialDays: plan === "base" ? TRIAL_DAYS : 0,
    });
  } catch {
    res.status(500).json({ error: "Couldn't load the plan." });
  }
});

// Backwards-compatible alias for the old premium-price endpoint.
router.get("/stripe/premium-price", async (_req: Request, res: Response) => {
  try {
    const priceId = await resolvePriceId("premium");
    if (!priceId) {
      res.status(404).json({ error: "Premium plan is not available yet." });
      return;
    }
    res.json({ priceId });
  } catch {
    res.status(500).json({ error: "Couldn't load the Premium plan." });
  }
});

// Start a subscription checkout for the authenticated user. Creates a Stripe
// customer on first checkout and stores its id on the user row. Base includes a
// 14-day free trial but still requires a card up front (payment_method_collection
// = always), so access lapses to Free cleanly when the trial ends unpaid.
router.post("/stripe/checkout", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please sign in to subscribe." });
    return;
  }

  const requested = (req.body as { plan?: unknown } | undefined)?.plan;
  const plan: PlanTag = requested === "premium" ? "premium" : "base";

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }

    const stripe = await getUncachableStripeClient();

    const priceId = await resolvePriceId(plan);
    if (!priceId) {
      res.status(404).json({ error: "That plan is not available yet." });
      return;
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db
        .update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.id, user.id));
    }

    const base = webBaseUrl(req);

    // Only offer the trial to brand-new subscribers — never to someone who has
    // subscribed before (prevents re-trialing after a cancel).
    let isFirstSubscription = true;
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, limit: 1, status: "all" });
      isFirstSubscription = subs.data.length === 0;
    } catch {
      isFirstSubscription = true;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Always collect a card, even during the trial, so billing is seamless.
      payment_method_collection: "always",
      ...(plan === "base" && isFirstSubscription
        ? { subscription_data: { trial_period_days: TRIAL_DAYS } }
        : {}),
      success_url: `${base}/account?checkout=success`,
      cancel_url: `${base}/account?checkout=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "stripe checkout failed");
    res.status(500).json({ error: "Couldn't start checkout. Please try again." });
  }
});

// Cancel the authenticated user's active subscription at period end. Keeps
// access through the paid-for period, then lapses to Free. Idempotent.
router.post("/stripe/cancel", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please sign in." });
    return;
  }

  try {
    const [user] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id));
    const customerId = user?.stripeCustomerId;
    if (!customerId) {
      res.status(404).json({ error: "No active subscription to cancel." });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const active = subs.data.find(
      (s) => s.status === "active" || s.status === "trialing" || s.status === "past_due",
    );
    if (!active) {
      res.status(404).json({ error: "No active subscription to cancel." });
      return;
    }

    const updated = await stripe.subscriptions.update(active.id, {
      cancel_at_period_end: true,
    });

    res.json({
      success: true,
      cancelAtPeriodEnd: updated.cancel_at_period_end,
    });
  } catch (err) {
    req.log.error({ err }, "stripe cancel failed");
    res.status(500).json({ error: "Couldn't cancel right now. Please try again." });
  }
});

export default router;
