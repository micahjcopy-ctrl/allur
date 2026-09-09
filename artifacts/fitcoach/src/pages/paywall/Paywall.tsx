import React from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFitCoach } from "@/context/FitCoachContext";
import {
  startCheckout,
  fetchPlanPrices,
  fmtPrice,
  PLAN_PRICES,
  ANNUAL_PRICE,
  ANNUAL_PER_MONTH,
  type BillingInterval,
  type PlanPrices,
} from "@/lib/subscription";
import { isNative } from "@/lib/native";
import {
  iapAvailable,
  loadOfferings,
  purchasePackage,
  restorePurchases,
  type IapOfferings,
} from "@/lib/iap";

/**
 * Mandatory payment screen shown immediately after onboarding for brand-new
 * users (no subscription history). Hard paywall: pay now, no free trial.
 * Two options — annual (best value) and monthly.
 *
 * Two purchase paths, one screen:
 *
 *   WEB  — Stripe Checkout. Prices fetched live from Stripe. Unchanged.
 *   NATIVE — Apple In-App Purchase, because Guideline 3.1.1 requires it for
 *            digital content unlocked inside the app. Prices come from the
 *            store (already localised), never from our own strings.
 *
 * The gate itself is identical either way: this screen is shown by the same
 * check in App.tsx, and access is granted by the same server-side subscription
 * summary. Only the button's behaviour differs.
 */
export default function Paywall() {
  const { toast } = useToast();
  const { refreshSubscription } = useFitCoach();
  const [loading, setLoading] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [interval, setInterval] = React.useState<BillingInterval>("annual");
  const [prices, setPrices] = React.useState<PlanPrices | null>(null);
  const [offerings, setOfferings] = React.useState<IapOfferings | null>(null);

  // `onDevice` gates the STRIPE path and is a runtime check, deliberately.
  // `native` (which also requires a build-time key) gates the IAP path.
  //
  // They are separate so that a native binary built without a RevenueCat key
  // — where the IAP code has been compiled away — still cannot fall through to
  // Stripe Checkout. On device, Stripe is never an option, working IAP or not.
  const onDevice = isNative();
  const native = iapAvailable();
  const misconfigured = onDevice && !native;

  React.useEffect(() => {
    let alive = true;
    if (native) {
      // Store products carry their own localised price strings, so we never
      // show a US dollar amount to someone who will be charged in euros.
      loadOfferings().then((o) => {
        if (alive) setOfferings(o);
      });
    } else {
      fetchPlanPrices().then((p) => {
        if (alive) setPrices(p);
      });
    }
    return () => {
      alive = false;
    };
  }, [native]);

  const currency = prices?.currency ?? "usd";
  const monthlyStr = native
    ? (offerings?.monthly?.priceString ?? PLAN_PRICES.base)
    : prices?.monthly
      ? fmtPrice(prices.monthly.amount, currency)
      : PLAN_PRICES.base;
  const annualStr = native
    ? (offerings?.annual?.priceString ?? ANNUAL_PRICE)
    : prices?.annual
      ? fmtPrice(prices.annual.amount, currency)
      : ANNUAL_PRICE;
  const annualPerMonth = native
    ? offerings?.annual
      ? fmtPrice(Math.round((offerings.annual.price * 100) / 12), offerings.annual.currencyCode)
      : ANNUAL_PER_MONTH
    : prices?.annual
      ? fmtPrice(Math.round(prices.annual.amount / 12), currency)
      : ANNUAL_PER_MONTH;
  const hasAnnual = native ? (offerings ? !!offerings.annual : true) : prices ? !!prices.annual : true;
  const savePct = native
    ? offerings?.annual && offerings?.monthly
      ? Math.round((1 - offerings.annual.price / (offerings.monthly.price * 12)) * 100)
      : 48
    : prices?.annual && prices?.monthly
      ? Math.round((1 - prices.annual.amount / (prices.monthly.amount * 12)) * 100)
      : 48;

  // If annual isn't available, force monthly.
  React.useEffect(() => {
    if (native) {
      if (offerings && !offerings.annual && interval === "annual") setInterval("monthly");
      return;
    }
    if (prices && !prices.annual && interval === "annual") setInterval("monthly");
  }, [native, offerings, prices, interval]);

  const onStart = async () => {
    // A native build with no purchase path must fail loudly, never silently
    // hand the user to a web checkout Apple does not permit.
    if (misconfigured) {
      toast({
        variant: "destructive",
        title: "Purchases unavailable",
        description: "Please update to the latest version of ALLUR.",
      });
      return;
    }

    setLoading(true);

    if (native) {
      const pkg = interval === "annual" ? offerings?.annual : offerings?.monthly;
      if (!pkg) {
        toast({
          variant: "destructive",
          title: "Store unavailable",
          description: "Couldn't reach the App Store. Check your connection and try again.",
        });
        setLoading(false);
        return;
      }
      const outcome = await purchasePackage(pkg);
      if (outcome.ok) {
        // The server has already confirmed the entitlement; re-reading the
        // summary is what drops the gate and lets the user through.
        await refreshSubscription();
        toast({ title: "You're in", description: "Welcome to ALLUR." });
        return;
      }
      // A dismissed Apple sheet is not an error — say nothing.
      if (!outcome.cancelled) {
        toast({
          variant: "destructive",
          title: "Purchase didn't complete",
          description: outcome.message,
        });
      }
      setLoading(false);
      return;
    }

    try {
      await startCheckout("base", interval);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't start checkout",
        description: err instanceof Error ? err.message : "Please try again.",
      });
      setLoading(false);
    }
  };

  /**
   * Apple requires a Restore Purchases control on any screen selling an
   * auto-renewing subscription (3.1.1). It is also the fix for the real case:
   * same Apple ID, new phone.
   */
  const onRestore = async () => {
    setRestoring(true);
    const outcome = await restorePurchases();
    if (outcome.ok) {
      await refreshSubscription();
      toast({ title: "Purchases restored" });
      return;
    }
    toast({
      variant: "destructive",
      title: "Nothing to restore",
      description: outcome.cancelled ? "Cancelled." : outcome.message,
    });
    setRestoring(false);
  };

  const ctaLabel =
    interval === "annual" ? `Start ALLUR — ${annualStr}/year` : `Start ALLUR — ${monthlyStr}/month`;

  return (
    <div className="w-full min-h-screen max-w-md mx-auto flex flex-col px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col"
      >
        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            Are you ready to make the change this time?
          </h1>
          <p className="text-muted-foreground mb-2">
            You've started before — maybe more than once. That's not a willpower problem. It's what
            happens when the plan can't bend when your week does.
          </p>
          <p className="text-foreground font-semibold mb-8">
            This time, it bends first — your plan is built and waiting.
          </p>

          <div className="space-y-3 mb-6">
            {hasAnnual && (
              <button
                type="button"
                onClick={() => setInterval("annual")}
                className={`relative w-full text-left rounded-2xl border-2 p-4 flex items-center justify-between transition-colors ${
                  interval === "annual"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className="absolute -top-2.5 left-4 bg-primary text-primary-foreground text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full">
                  BEST VALUE · SAVE {savePct}%
                </span>
                <div>
                  <p className="font-bold">Annual</p>
                  <p className="text-xs text-muted-foreground">{annualStr} billed yearly</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{annualPerMonth}</p>
                  <p className="text-xs text-muted-foreground">/mo</p>
                </div>
              </button>
            )}
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              className={`w-full text-left rounded-2xl border-2 p-4 flex items-center justify-between transition-colors ${
                interval === "monthly"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div>
                <p className="font-bold">Monthly</p>
                <p className="text-xs text-muted-foreground">billed monthly</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">{monthlyStr}</p>
                <p className="text-xs text-muted-foreground">/mo</p>
              </div>
            </button>
          </div>

          <ul className="space-y-2.5 text-sm mb-2">
            {[
              "Your personalized AI training plan",
              "Unlimited-feel AI coaching (text & voice)",
              "Progress photos + AI physique scans",
              "Meal-photo macro tracking",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary shrink-0" /> {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            onClick={onStart}
            disabled={loading}
            className="w-full rounded-full h-14 text-lg font-bold shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />{" "}
                {native ? "Contacting the App Store…" : "Starting checkout…"}
              </>
            ) : (
              ctaLabel
            )}
          </Button>

          {native ? (
            <>
              {/*
                Apple requires an auto-renewing subscription paywall to state
                the length, the price per period, that it auto-renews, and how
                to cancel — and to link Terms and Privacy from the same screen.
                Missing any of these is a metadata rejection.
              */}
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                {interval === "annual"
                  ? `${annualStr} per year`
                  : `${monthlyStr} per month`}
                , billed through your Apple ID. Renews automatically unless
                turned off at least 24 hours before the period ends. Manage or
                cancel anytime in your Apple ID settings.
              </p>
              <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <button
                  type="button"
                  onClick={onRestore}
                  disabled={restoring}
                  className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                >
                  {restoring ? "Restoring…" : "Restore purchases"}
                </button>
                <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
                  Terms
                </a>
                <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                  Privacy
                </a>
              </div>
            </>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Billed today. Cancel anytime in two taps from Account settings.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
