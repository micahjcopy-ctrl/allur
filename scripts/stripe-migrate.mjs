// Build-time Stripe schema migration.
//
// stripe-replit-sync reads its migration .sql files relative to its own package
// dir, which works here (running from node_modules during the Vercel build) but
// NOT inside the bundled serverless function. So we create the `stripe.*` mirror
// tables at build time, against the production database. Fail-soft: never breaks
// the build (billing just stays disabled until the DB/keys are present).
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
  console.log("[stripe-migrate] No DATABASE_URL; skipping Stripe schema migration.");
  process.exit(0);
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.log("[stripe-migrate] No STRIPE_SECRET_KEY; skipping Stripe schema migration.");
  process.exit(0);
}

try {
  const { runMigrations } = require("stripe-replit-sync");
  await runMigrations({ databaseUrl: url });
  console.log("[stripe-migrate] Stripe schema migrations applied.");
} catch (err) {
  console.error("[stripe-migrate] Non-fatal: failed to apply Stripe migrations:", err?.message || err);
}
process.exit(0);
