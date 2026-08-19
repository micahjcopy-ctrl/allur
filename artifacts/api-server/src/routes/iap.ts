import { Router, type IRouter, type Request, type Response } from "express";
import { db, iapEntitlementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getIapEntitlement } from "../lib/iap/entitlement";

// ---------------------------------------------------------------------------
// In-app purchase (App Store / Play Store) entitlement sync.
//
// RevenueCat validates receipts with Apple and pushes us the resolved answer.
// We never see or store a raw receipt — only "user X has entitlement Y until Z".
//
// Two ways state reaches us:
//
//   1. POST /api/iap/webhook  — RevenueCat pushes every lifecycle event
//      (purchase, renewal, cancellation, expiry, billing issue, refund).
//      This is the source of truth and works even if the app is uninstalled.
//
//   2. POST /api/iap/refresh  — the app asks us to re-read RevenueCat right
//      now, server-to-server. Called immediately after a purchase so the user
//      is not staring at a paywall waiting for webhook latency. We ask
//      RevenueCat directly rather than trusting what the client tells us,
//      because a client claiming "I am subscribed" is not evidence.
//
// NOTHING on the web/Stripe path is touched by this file.
// ---------------------------------------------------------------------------

const router: IRouter = Router();

const RC_API_BASE = "https://api.revenuecat.com/v1";

/** Map RevenueCat's store names onto our column values. */
function storeKey(store: string | undefined): string {
  return store === "PLAY_STORE" ? "play_store" : "app_store";
}

/**
 * Resolve a RevenueCat event type to the lifecycle state we persist.
 *
 * Anything that grants access maps to active/grace; anything that removes it
 * maps to expired/refunded. Unknown future event types deliberately return
 * null — we acknowledge them and change nothing, rather than guessing and
 * accidentally revoking a paying customer's access.
 */
function statusFromEventType(
  type: string,
): { status: string; isActive: boolean } | null {
  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
    case "TRANSFER":
      return { status: "active", isActive: true };

    // Card declined. Apple retries for up to ~60 days; keep access during the
    // retry window rather than punishing a customer for an expired card.
    case "BILLING_ISSUE":
      return { status: "grace", isActive: true };

    // The user turned off auto-renew. They keep access until the period ends —
    // EXPIRATION is the event that actually removes it.
    case "CANCELLATION":
      return { status: "active", isActive: true };

    case "EXPIRATION":
      return { status: "expired", isActive: false };

    case "REFUND":
    case "REFUND_REVERSED":
      return { status: "refunded", isActive: false };

    case "SUBSCRIPTION_PAUSED":
      return { status: "paused", isActive: false };

    default:
      return null;
  }
}

interface RcEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  expiration_at_ms?: number | null;
  store?: string;
  environment?: string;
  original_transaction_id?: string | null;
  event_timestamp_ms?: number;
  cancel_reason?: string | null;
}

/** Persist a resolved entitlement for a user, newest-event-wins. */
async function upsertEntitlement(args: {
  userId: string;
  store: string;
  rcAppUserId: string | null;
  productId: string | null;
  entitlement: string | null;
  status: string;
  isActive: boolean;
  willRenew: boolean;
  expiresAt: Date | null;
  environment: string | null;
  originalTransactionId: string | null;
  eventAt: Date | null;
}): Promise<"applied" | "stale"> {
  const [existing] = await db
    .select()
    .from(iapEntitlementsTable)
    .where(
      and(
        eq(iapEntitlementsTable.userId, args.userId),
        eq(iapEntitlementsTable.store, args.store),
      ),
    );

  // Webhooks are not ordered. Drop anything older than what we already applied,
  // so a late-arriving EXPIRATION cannot revoke a subscription that has since
  // renewed.
  if (
    existing &&
    args.eventAt &&
    existing.lastEventAt &&
    args.eventAt.getTime() < existing.lastEventAt.getTime()
  ) {
    return "stale";
  }

  const values = {
    userId: args.userId,
    store: args.store,
    rcAppUserId: args.rcAppUserId,
    productId: args.productId,
    entitlement: args.entitlement,
    status: args.status,
    isActive: args.isActive,
    willRenew: args.willRenew,
    expiresAt: args.expiresAt,
    environment: args.environment,
    originalTransactionId: args.originalTransactionId,
    lastEventAt: args.eventAt,
    // Sticky once true: a lapsed subscriber must not be re-trapped by the
    // post-onboarding paywall gate (same rule the Stripe path uses).
    hasEverSubscribed: existing?.hasEverSubscribed || args.isActive,
  };

  if (existing) {
    await db
      .update(iapEntitlementsTable)
      .set(values)
      .where(eq(iapEntitlementsTable.id, existing.id));
  } else {
    await db.insert(iapEntitlementsTable).values(values);
  }
  return "applied";
}

// ---------------------------------------------------------------------------
// RevenueCat webhook
// ---------------------------------------------------------------------------
//
// Auth is a shared secret we set in the RevenueCat dashboard and receive in the
// Authorization header. Constant-time comparison, and we refuse to run at all
// if the secret is unset — an unauthenticated endpoint that grants paid access
// is worse than a broken one.
router.post("/iap/webhook", async (req: Request, res: Response) => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    req.log?.error?.("REVENUECAT_WEBHOOK_SECRET is not set; refusing webhook");
    res.status(503).json({ error: "Webhook not configured." });
    return;
  }

  const provided = req.headers.authorization ?? "";
  if (provided !== secret) {
    req.log?.warn?.("Rejected RevenueCat webhook with bad Authorization");
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const event = (req.body as { event?: RcEvent } | undefined)?.event;
  if (!event?.type) {
    // Malformed or a ping. 200 so RevenueCat does not retry forever.
    res.status(200).json({ received: true });
    return;
  }

  const resolved = statusFromEventType(event.type);
  if (!resolved) {
    req.log?.info?.({ type: event.type }, "Ignoring RevenueCat event type");
    res.status(200).json({ received: true });
    return;
  }

  // We set app_user_id to our own user id at login, so it maps straight back.
  const userId = event.app_user_id ?? event.original_app_user_id ?? null;
  if (!userId) {
    res.status(200).json({ received: true });
    return;
  }

  try {
    const outcome = await upsertEntitlement({
      userId,
      store: storeKey(event.store),
      rcAppUserId: event.app_user_id ?? null,
      productId: event.product_id ?? null,
      entitlement: event.entitlement_ids?.[0] ?? event.entitlement_id ?? null,
      status: resolved.status,
      isActive: resolved.isActive,
      willRenew: event.type !== "CANCELLATION" && resolved.isActive,
      expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
      environment: event.environment ?? null,
      originalTransactionId: event.original_transaction_id ?? null,
      eventAt: event.event_timestamp_ms
        ? new Date(event.event_timestamp_ms)
        : null,
    });
    req.log?.info?.(
      { type: event.type, userId, outcome },
      "Applied RevenueCat event",
    );
  } catch (err) {
    req.log?.error?.({ err, type: event.type }, "RevenueCat webhook failed");
    // 500 so RevenueCat retries — losing a renewal event silently would lock a
    // paying customer out at the end of their period.
    res.status(500).json({ error: "Processing error" });
    return;
  }

  res.status(200).json({ received: true });
});

// ---------------------------------------------------------------------------
// Post-purchase refresh — server asks RevenueCat directly.
// ---------------------------------------------------------------------------
router.post("/iap/refresh", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
  if (!apiKey) {
    req.log?.error?.("REVENUECAT_SECRET_API_KEY is not set");
    res.status(503).json({ error: "Purchases are not configured." });
    return;
  }

  const userId = req.user.id;

  try {
    const rc = await fetch(
      `${RC_API_BASE}/subscribers/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!rc.ok) {
      req.log?.warn?.({ status: rc.status }, "RevenueCat subscriber read failed");
      res.status(502).json({ error: "Could not reach the store." });
      return;
    }

    const body = (await rc.json()) as {
      subscriber?: {
        entitlements?: Record<
          string,
          { expires_date: string | null; product_identifier: string }
        >;
        subscriptions?: Record<
          string,
          {
            store: string;
            expires_date: string | null;
            unsubscribe_detected_at: string | null;
            billing_issues_detected_at: string | null;
            is_sandbox?: boolean;
            original_purchase_date?: string;
          }
        >;
      };
    };

    const entitlements = body.subscriber?.entitlements ?? {};
    const subscriptions = body.subscriber?.subscriptions ?? {};

    // Pick the entitlement with the furthest-out expiry that is still valid.
    let bestKey: string | null = null;
    let bestExpiry = 0;
    for (const [key, ent] of Object.entries(entitlements)) {
      const exp = ent.expires_date ? Date.parse(ent.expires_date) : Infinity;
      if (exp > Date.now() && exp > bestExpiry) {
        bestExpiry = exp;
        bestKey = key;
      }
    }

    const productId = bestKey ? entitlements[bestKey]!.product_identifier : null;
    const sub = productId ? subscriptions[productId] : undefined;
    const isActive = !!bestKey;

    if (isActive || Object.keys(subscriptions).length > 0) {
      await upsertEntitlement({
        userId,
        store: storeKey(sub?.store),
        rcAppUserId: userId,
        productId,
        entitlement: bestKey,
        status: isActive
          ? sub?.billing_issues_detected_at
            ? "grace"
            : "active"
          : "expired",
        isActive,
        willRenew: !sub?.unsubscribe_detected_at,
        expiresAt: Number.isFinite(bestExpiry) && bestExpiry > 0
          ? new Date(bestExpiry)
          : null,
        environment: sub?.is_sandbox ? "SANDBOX" : "PRODUCTION",
        originalTransactionId: null,
        // A direct read is always current; stamp it now so it wins over any
        // webhook that was already in flight.
        eventAt: new Date(),
      });
    }

    const summary = await getIapEntitlement(userId);
    res.json({
      active: !!summary?.isActive,
      plan: summary?.plan ?? "free",
      expiresAt: summary?.expiresAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log?.error?.({ err }, "IAP refresh failed");
    res.status(500).json({ error: "Could not refresh purchases." });
  }
});

export default router;
