import { getUncachableStripeClient } from "./stripeClient";

/**
 * Seed the ALLUR subscription products + monthly prices in Stripe.
 *
 * Two tiers:
 *  - ALLUR Base    $12.99/mo (14-day trial handled at checkout) — full app.
 *  - ALLUR Premium $29.99/mo — removes usage limits (unlimited).
 *
 * Idempotent: skips creation if a product with the same name already exists.
 * Run with: pnpm --filter @workspace/scripts run seed-stripe
 */

interface PlanSeed {
  name: string;
  description: string;
  plan: "base" | "premium";
  unitAmount: number; // cents
}

const PLANS: PlanSeed[] = [
  {
    name: "ALLUR Base",
    description:
      "Your full AI fitness coach: training plans, AI coaching, progress photos, body scans, and macro tracking.",
    plan: "base",
    unitAmount: 1299, // $12.99
  },
  {
    name: "ALLUR Premium",
    description: "Everything in Base, with unlimited AI coaching, photo logs, and body scans.",
    plan: "premium",
    unitAmount: 2999, // $29.99
  },
];

async function seedPlan(seed: PlanSeed) {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.search({
    query: `name:'${seed.name}' AND active:'true'`,
  });

  if (existing.data.length > 0) {
    const product = existing.data[0]!;
    console.log(`${seed.name} already exists: ${product.id}`);
    // Ensure the plan metadata is set (older products may predate it).
    if (product.metadata?.["plan"] !== seed.plan) {
      await stripe.products.update(product.id, { metadata: { plan: seed.plan } });
      console.log(`  updated metadata.plan = ${seed.plan}`);
    }
    const prices = await stripe.prices.list({ product: product.id, active: true });
    prices.data.forEach((p) => console.log(`  price: ${p.id} (${p.unit_amount} ${p.currency})`));
    return;
  }

  const product = await stripe.products.create({
    name: seed.name,
    description: seed.description,
    metadata: { plan: seed.plan },
  });
  console.log(`Created product: ${product.name} (${product.id})`);

  const monthly = await stripe.prices.create({
    product: product.id,
    unit_amount: seed.unitAmount,
    currency: "usd",
    recurring: { interval: "month" },
  });
  console.log(
    `Created monthly price: $${(seed.unitAmount / 100).toFixed(2)}/month (${monthly.id})`,
  );
}

async function createProducts() {
  try {
    for (const seed of PLANS) {
      await seedPlan(seed);
    }
    console.log("Done. Webhooks will sync these to the database automatically.");
  } catch (error) {
    console.error("Error creating products:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

createProducts();
