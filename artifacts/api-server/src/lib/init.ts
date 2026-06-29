import { runMigrations } from "stripe-replit-sync";
import { logger } from "./logger";
import { getStripeSync, isStripeConfigured } from "./stripe/stripeClient";
import { publicBaseUrl } from "./appUrl";

let stripeInitPromise: Promise<void> | null = null;

/**
 * One-time, idempotent Stripe initialization (data sync).
 *
 * The `stripe.*` mirror-table SCHEMA is created at BUILD time (see
 * scripts/stripe-migrate.mjs / the vercel-build step), because stripe-replit-sync
 * reads its migration .sql files relative to its own dir and those files don't
 * reliably survive bundling into a serverless function. Here at runtime we only:
 *   - kick off a best-effort data backfill (non-blocking) to populate the tables,
 *   - on Replit, register a managed webhook (off Replit you configure it manually).
 *
 * As a fallback, if the schema somehow isn't present we still TRY runMigrations,
 * but its failure must NOT abort the backfill, so it's isolated in its own catch.
 *
 * Safe to call on every cold start / first request: the work runs at most once
 * per process. Fail-soft: if Stripe or the DB isn't reachable, the rest of the
 * API still runs (everyone defaults to the Free plan).
 */
export function ensureStripeInitialized(): Promise<void> {
  if (stripeInitPromise) return stripeInitPromise;
  stripeInitPromise = (async () => {
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) {
      logger.warn("DATABASE_URL not set; skipping Stripe init");
      return;
    }
    if (!isStripeConfigured()) {
      logger.warn("STRIPE_SECRET_KEY not set; skipping Stripe init (billing disabled)");
      return;
    }
    try {
      // Best-effort schema fallback. Isolated so a missing-migrations error
      // (e.g. .sql files not bundled) never blocks the data backfill below.
      try {
        await runMigrations({ databaseUrl });
      } catch (err) {
        logger.warn(
          { err: (err as Error)?.message },
          "runMigrations failed at runtime (expected on serverless; schema is created at build time)",
        );
      }

      const stripeSync = await getStripeSync();

      // Replit-only managed webhook. Off Replit, set up the webhook manually.
      const isReplit = !!process.env["REPLIT_DOMAINS"];
      if (isReplit) {
        const base = publicBaseUrl();
        if (base) {
          await stripeSync.findOrCreateManagedWebhook(`${base}/api/stripe/webhook`);
        }
      }

      // syncBackfill MUST be called with { object: "all" }.
      stripeSync
        .syncBackfill({ object: "all" })
        .then(() => logger.info("Stripe data synced"))
        .catch((err) => logger.error({ err }, "Stripe backfill failed"));

      logger.info("Stripe initialized");
    } catch (err) {
      logger.error({ err }, "Stripe initialization failed; continuing without it");
    }
  })();
  return stripeInitPromise;
}
