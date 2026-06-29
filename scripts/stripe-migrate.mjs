// Build-time Stripe setup: create the `stripe.*` mirror tables AND backfill the
// current Stripe data (products, prices, customers, subscriptions, ...).
//
// Why at build time: stripe-replit-sync reads its migration .sql files relative
// to its own package dir (works here in node_modules, not in a bundled
// serverless function), and a full backfill is a long async job that a Vercel
// serverless function can't reliably finish in the background (it's frozen once
// the HTTP response is sent). Doing both here, against the production DB, means
// the tables exist and are populated before the app serves traffic; webhooks
// keep them fresh afterward. Fail-soft: never breaks the build.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
  console.log("[stripe-migrate] No DATABASE_URL; skipping Stripe setup.");
  process.exit(0);
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.log("[stripe-migrate] No STRIPE_SECRET_KEY; skipping Stripe setup.");
  process.exit(0);
}

try {
  const { runMigrations, StripeSync } = require("stripe-replit-sync");

  await runMigrations({ databaseUrl: url });
  console.log("[stripe-migrate] Stripe schema migrations applied.");

  const sync = new StripeSync({
    poolConfig: { connectionString: url },
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  });

  // MUST pass { object: "all" } — with no args the internal switch no-ops.
  await sync.syncBackfill({ object: "all" });
  console.log("[stripe-migrate] Stripe data backfill complete.");
} catch (err) {
  console.error("[stripe-migrate] Non-fatal: Stripe setup failed:", err?.message || err);
}
process.exit(0);
