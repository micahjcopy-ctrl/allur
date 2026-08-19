// ---------------------------------------------------------------------------
// iap.ts — Apple / Google in-app purchases, native only.
//
// Read this before changing anything here:
//
//   Apple Guideline 3.1.1 requires that digital content unlocked inside an iOS
//   app is bought with In-App Purchase. Sending an iOS user to Stripe Checkout
//   is the single most reliable way to get rejected. So on native we buy
//   through the store; on web we keep using Stripe, unchanged.
//
//   Every function below is a no-op on web. `isNative()` is false in the
//   browser and in the installed PWA, so nothing in this file can affect the
//   web app even if it is imported there. The RevenueCat SDK is dynamically
//   imported so the web bundle never downloads it.
//
//   The client is NEVER the authority on whether someone has paid. After a
//   purchase we ask our own server to re-read RevenueCat server-to-server
//   (POST /api/iap/refresh) and we trust that answer. A client that says
//   "I'm subscribed" is a claim, not proof.
//
// Product identifiers must match App Store Connect exactly. Prices are set in
// App Store Connect, not here — Apple shows the user their own local currency,
// so we display the store's price string rather than a hardcoded "$10.99".
// ---------------------------------------------------------------------------

import { isNative } from "./native";
import { apiFetch } from "./apiOrigin";

/** RevenueCat entitlement identifier that grants paid access. */
export const ENTITLEMENT_ID = "base";

/** Offering identifier configured in the RevenueCat dashboard. */
export const OFFERING_ID = "default";

export type IapInterval = "monthly" | "annual";

/** Store product ids — must match App Store Connect exactly. */
export const IAP_PRODUCTS: Record<IapInterval, string> = {
  monthly: "com.getallur.app.base.monthly",
  annual: "com.getallur.app.base.annual",
};

export interface IapPackage {
  interval: IapInterval;
  /** Localised price string straight from the store, e.g. "$10.99", "£8.99". */
  priceString: string;
  /** Raw price for computing "per month" copy on the annual option. */
  price: number;
  currencyCode: string;
  /** Opaque handle passed back to purchasePackage(). */
  raw: unknown;
}

export interface IapOfferings {
  monthly: IapPackage | null;
  annual: IapPackage | null;
}

export type PurchaseOutcome =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

let configured = false;

/**
 * True when a RevenueCat key was baked in at build time.
 *
 * ⚠️ This is a COMPILE-TIME constant. Vite statically replaces
 * `import.meta.env.VITE_REVENUECAT_IOS_KEY` with its literal value, so when the
 * variable is unset this whole expression folds to `false` and every branch
 * guarded by it is dead-code-eliminated from the bundle.
 *
 * That is exactly what we want for the web build — zero purchase code ships to
 * the browser. It is also a loaded gun for the native build: a native binary
 * compiled WITHOUT this variable would silently contain no purchase path at
 * all, fall through to Stripe Checkout, and be rejected under Guideline 3.1.1
 * with no way to tell from the source that anything was wrong.
 *
 * Two guards stop that from shipping:
 *   1. vite.config.ts refuses to build with VITE_NATIVE_BUILD=1 unless the key
 *      is present (the real fix — it fails the build).
 *   2. Paywall.tsx branches on `isNative()`, never on this, when deciding
 *      whether to show the Stripe button — so even a mis-built binary shows an
 *      error state rather than a web checkout button.
 */
export function iapConfigured(): boolean {
  return !!import.meta.env.VITE_REVENUECAT_IOS_KEY;
}

/** True when in-app purchases are usable (native shell + a configured key). */
export function iapAvailable(): boolean {
  return isNative() && iapConfigured();
}

/**
 * Configure the SDK and bind it to our user id.
 *
 * The RevenueCat "app user id" is set to OUR user id, which is what makes the
 * webhook able to map a purchase back to an account without any extra lookup.
 * Safe to call repeatedly; only the first call configures.
 */
export async function initIap(userId: string): Promise<void> {
  if (!iapAvailable()) return;
  try {
    const { Purchases, LOG_LEVEL } = await import(
      "@revenuecat/purchases-capacitor"
    );
    if (!configured) {
      await Purchases.setLogLevel({
        level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR,
      });
      await Purchases.configure({
        apiKey: import.meta.env.VITE_REVENUECAT_IOS_KEY as string,
        appUserID: userId,
      });
      configured = true;
    } else {
      await Purchases.logIn({ appUserID: userId });
    }
  } catch {
    // Never let purchase plumbing break app start. The paywall degrades to
    // "purchases unavailable" copy rather than a white screen.
  }
}

/** Detach the store identity at sign-out so the next user starts clean. */
export async function resetIap(): Promise<void> {
  if (!iapAvailable() || !configured) return;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.logOut();
  } catch {
    /* non-fatal */
  }
}

/** Fetch the live store products. Returns nulls if the store is unreachable. */
export async function loadOfferings(): Promise<IapOfferings> {
  const none: IapOfferings = { monthly: null, annual: null };
  if (!iapAvailable()) return none;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { current } = await Purchases.getOfferings();
    if (!current) return none;

    const map = (pkg: unknown): IapPackage | null => {
      const p = pkg as
        | {
            product?: {
              identifier?: string;
              priceString?: string;
              price?: number;
              currencyCode?: string;
            };
          }
        | undefined;
      const id = p?.product?.identifier;
      if (!id) return null;
      const interval: IapInterval | null =
        id === IAP_PRODUCTS.annual
          ? "annual"
          : id === IAP_PRODUCTS.monthly
            ? "monthly"
            : null;
      if (!interval) return null;
      return {
        interval,
        priceString: p!.product!.priceString ?? "",
        price: p!.product!.price ?? 0,
        currencyCode: p!.product!.currencyCode ?? "USD",
        raw: pkg,
      };
    };

    const out = { ...none };
    for (const pkg of current.availablePackages ?? []) {
      const m = map(pkg);
      if (m) out[m.interval] = m;
    }
    return out;
  } catch {
    return none;
  }
}

/** Ask our server to re-read the store and update the entitlement. */
async function syncEntitlement(): Promise<void> {
  try {
    await apiFetch("/api/iap/refresh", { method: "POST" });
  } catch {
    // The webhook is the durable path; this is only a latency optimisation.
  }
}

/**
 * Buy a package. Resolves once OUR SERVER has confirmed the entitlement, so the
 * caller can immediately re-read the subscription summary and let the user in.
 */
export async function purchasePackage(pkg: IapPackage): Promise<PurchaseOutcome> {
  if (!iapAvailable()) {
    return { ok: false, cancelled: false, message: "Purchases aren't available." };
  }
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const result = await Purchases.purchasePackage({
      aPackage: pkg.raw as never,
    });
    const active = result.customerInfo?.entitlements?.active ?? {};
    if (!active[ENTITLEMENT_ID]) {
      return {
        ok: false,
        cancelled: false,
        message: "The purchase didn't complete. You have not been charged.",
      };
    }
    await syncEntitlement();
    return { ok: true };
  } catch (err) {
    // RevenueCat sets userCancelled on a dismissed Apple sheet. That is not an
    // error and must not raise a scary toast.
    const e = err as { code?: string | number; userCancelled?: boolean; message?: string };
    if (e?.userCancelled || String(e?.code) === "1") {
      return { ok: false, cancelled: true };
    }
    return {
      ok: false,
      cancelled: false,
      message: e?.message || "Couldn't complete the purchase. Please try again.",
    };
  }
}

/**
 * Restore Purchases.
 *
 * Apple REQUIRES this for any app selling auto-renewing subscriptions — an app
 * without it gets rejected under 3.1.1. It is also the fix for a real user
 * problem: same Apple ID, new phone, or a reinstall.
 */
export async function restorePurchases(): Promise<PurchaseOutcome> {
  if (!iapAvailable()) {
    return { ok: false, cancelled: false, message: "Purchases aren't available." };
  }
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.restorePurchases();
    const active = customerInfo?.entitlements?.active ?? {};
    if (!active[ENTITLEMENT_ID]) {
      return {
        ok: false,
        cancelled: false,
        message: "No previous purchase was found for this Apple ID.",
      };
    }
    await syncEntitlement();
    return { ok: true };
  } catch (err) {
    const e = err as { message?: string };
    return {
      ok: false,
      cancelled: false,
      message: e?.message || "Couldn't restore purchases.",
    };
  }
}

/**
 * Deep-link to the store's own subscription management screen.
 *
 * Apple does not allow us to cancel a StoreKit subscription ourselves — only
 * the user can, from Settings. Sending them there is the required behaviour.
 */
export async function openStoreSubscriptionSettings(): Promise<void> {
  const generic = "https://apps.apple.com/account/subscriptions";

  // Gated on iapAvailable() — a COMPILE-TIME constant — rather than isNative(),
  // so the RevenueCat SDK import below is eliminated from the web bundle
  // entirely. A runtime `if (!isNative()) return` would still leave the dynamic
  // import in the graph and ship ~18 kB of purchase SDK to every browser user
  // who can never reach it.
  //
  // The web path still works: someone who subscribed on their iPhone and then
  // signs in on the website gets Apple's generic subscription management page,
  // which is the correct destination for them anyway.
  if (iapAvailable()) {
    try {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const { customerInfo } = await Purchases.getCustomerInfo();
      const url = customerInfo?.managementURL;
      if (url) {
        window.open(url, "_system");
        return;
      }
    } catch {
      /* fall through to the generic deep link */
    }
    window.open(generic, "_system");
    return;
  }

  window.open(generic, "_blank", "noopener,noreferrer");
}
