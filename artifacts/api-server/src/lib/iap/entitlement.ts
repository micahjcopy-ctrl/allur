import { db, iapEntitlementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { UserPlan } from "../credits";

// ---------------------------------------------------------------------------
// In-app purchase entitlement reads.
//
// This module answers exactly one question for the rest of the server: "does
// this user have paid access from an App Store / Play Store subscription?"
//
// It is deliberately read-only and total — every failure path returns "no
// entitlement" rather than throwing, because it is called from the subscription
// summary that gates the whole app. A database blip must degrade to the Stripe
// answer, never to a 500 that locks a paying user out of their own account.
// ---------------------------------------------------------------------------

/** Statuses that grant access right now. Grace period counts — Apple is still
 *  retrying the card, and cutting a paying customer off mid-retry is worse than
 *  carrying them for a few days. Mirrors "past_due" on the Stripe side. */
const ACTIVE_IAP_STATUSES = new Set(["active", "grace"]);

export interface IapEntitlementSummary {
  plan: UserPlan;
  status: string;
  isActive: boolean;
  hasEverSubscribed: boolean;
  expiresAt: Date | null;
  willRenew: boolean;
  store: string;
}

/** Map a RevenueCat entitlement identifier onto our plan tiers. */
function planFromEntitlement(entitlement: string | null): UserPlan {
  if (entitlement === "premium") return "premium";
  if (entitlement === "base") return "base";
  return "base";
}

/**
 * The user's current store entitlement, or null if they have none.
 *
 * SANDBOX rows count. They used to be ignored whenever NODE_ENV=production,
 * on the theory that a sandbox receipt is "free Premium". That theory broke
 * the two flows that matter most before launch:
 *
 *   - TestFlight builds buy in the SANDBOX environment. Every purchase test
 *     in NATIVE_SETUP §5 hit production Vercel, was recorded, and was then
 *     filtered out here — the paywall never dropped.
 *   - App Review tests in-app purchases in the SANDBOX environment against
 *     the production backend. A purchase that completes but does not unlock
 *     the app is a Guideline 2.1 rejection.
 *
 * The exposure is small and bounded: only Sandbox Tester Apple IDs created
 * in THIS team's App Store Connect (or invited TestFlight testers) can make
 * sandbox purchases for this app at all, and sandbox subscriptions renew on
 * an accelerated clock (a month is 5 minutes, a year is 1 hour) and stop
 * renewing after a handful of cycles — so the `expiresAt` check below ends
 * the access within an hour or so on its own, even if the EXPIRATION webhook
 * is missed.
 */
export async function getIapEntitlement(
  userId: string,
): Promise<IapEntitlementSummary | null> {
  try {
    const rows = await db
      .select()
      .from(iapEntitlementsTable)
      .where(eq(iapEntitlementsTable.userId, userId));

    if (rows.length === 0) return null;

    const usable = rows;

    // Prefer a currently-active row; otherwise fall back to the most recently
    // updated one so `hasEverSubscribed` still reflects a lapsed subscriber.
    const active = usable.find(
      (r) => r.isActive && ACTIVE_IAP_STATUSES.has(r.status),
    );
    const row =
      active ??
      [...usable].sort(
        (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
      )[0]!;

    const isActive = !!active;

    // Belt and braces: even if a webhook left isActive true, an elapsed expiry
    // wins. Clock skew between us and Apple is small; a stale row is not.
    const notExpired =
      !row.expiresAt || row.expiresAt.getTime() > Date.now() - 60_000;

    return {
      plan: isActive && notExpired ? planFromEntitlement(row.entitlement) : "free",
      status: row.status,
      isActive: isActive && notExpired,
      hasEverSubscribed: usable.some((r) => r.hasEverSubscribed),
      expiresAt: row.expiresAt ?? null,
      willRenew: row.willRenew,
      store: row.store,
    };
  } catch {
    // Never let a store lookup break the subscription summary.
    return null;
  }
}

/** True if the user currently has paid access from a store subscription. */
export async function hasActiveIapEntitlement(userId: string): Promise<boolean> {
  const ent = await getIapEntitlement(userId);
  return !!ent?.isActive;
}

/** Look up the owning user for a RevenueCat app_user_id. */
export async function findUserIdByRcAppUserId(
  rcAppUserId: string,
): Promise<string | null> {
  try {
    const [row] = await db
      .select({ userId: iapEntitlementsTable.userId })
      .from(iapEntitlementsTable)
      .where(eq(iapEntitlementsTable.rcAppUserId, rcAppUserId));
    return row?.userId ?? null;
  } catch {
    return null;
  }
}

/** Existing row for this user + store, if any. */
export async function findEntitlementRow(userId: string, store: string) {
  try {
    const [row] = await db
      .select()
      .from(iapEntitlementsTable)
      .where(
        and(
          eq(iapEntitlementsTable.userId, userId),
          eq(iapEntitlementsTable.store, store),
        ),
      );
    return row ?? null;
  } catch {
    return null;
  }
}
