import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";
import { logger } from "../logger";

/**
 * Stripe credentials, host-agnostic.
 *
 * Originally these came from Replit's connector API. Off Replit we read them
 * directly from env:
 *   - STRIPE_SECRET_KEY      (required for any Stripe feature)
 *   - STRIPE_WEBHOOK_SECRET  (required to verify incoming webhooks)
 *
 * Nothing throws at import time; callers handle the "not configured" case so the
 * rest of the API keeps working when billing is disabled.
 */
export function getStripeSecretKey(): string | undefined {
  return process.env["STRIPE_SECRET_KEY"] || undefined;
}

export function getStripeWebhookSecret(): string | undefined {
  return process.env["STRIPE_WEBHOOK_SECRET"] || undefined;
}

export function isStripeConfigured(): boolean {
  return !!getStripeSecretKey();
}

function requireSecretKey(): string {
  const key = getStripeSecretKey();
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to enable Stripe billing.",
    );
  }
  return key;
}

/**
 * Returns a fresh authenticated Stripe client.
 * Not cached -- reads env on every call so rotated keys are picked up.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  return new Stripe(requireSecretKey());
}

/**
 * Returns a fresh StripeSync instance for webhook processing and data sync.
 */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const secretKey = requireSecretKey();
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    logger.warn(
      "STRIPE_WEBHOOK_SECRET is not set; webhook signature verification will fail until it is configured.",
    );
  }

  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
  });
}
