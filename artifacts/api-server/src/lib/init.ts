import { runMigrations } from "stripe-replit-sync";
import { logger } from "./logger";
import { getStripeSync, isStripeConfigured } from "./stripe/stripeClient";
import { publicBaseUrl } from "./appUrl";

let stripeInitPromise: Promise<void> | null = null;

/**
 * One-time, idempotent Stripe initialization.
 *
 * - Creates/updates the `stripe.*` mirror tables (runMigrations) so the
 *   plan/price lookups in routes work.
 * - Kicks off a best-effort data backfill (non-blocking).
 * - On Replit, registers a managed webhook; off Replit you configure the
 *   webhook manually in the Stripe dashboard (APP_URL/api/stripe/webhook).
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
      await runMigrations({ databaseUrl });

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
