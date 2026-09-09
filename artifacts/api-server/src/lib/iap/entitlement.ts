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
 * SANDBOX rows never grant access in production: a sandbox receipt is free to
 * mint on any device with a test Apple ID, so honouring one outside of a test
 * build would be an open door to unlimited free Premium.
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

    const allowSandbox = process.env.NODE_ENV !== "production";
    const usable = rows.filter(
      (r) => allowSandbox || r.environment !== "SANDBOX",
    );
    if (usable.length === 0) return null;

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
