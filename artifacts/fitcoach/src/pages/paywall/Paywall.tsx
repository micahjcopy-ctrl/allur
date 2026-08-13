import React from "react";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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

/**
 * Mandatory payment screen shown immediately after onboarding for brand-new
 * users (no Stripe subscription history). Hard paywall: pay now, no free trial.
 * Two options — annual (best value) and monthly. Prices are fetched live from
 * Stripe so what we show always matches what we charge.
 */
export default function Paywall() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [interval, setInterval] = React.useState<BillingInterval>("annual");
  const [prices, setPrices] = React.useState<PlanPrices | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetchPlanPrices().then((p) => {
      if (alive) setPrices(p);
    });
    return () => {
      alive = false;
    };
  }, []);

  const currency = prices?.currency ?? "usd";
  const monthlyStr = prices?.monthly ? fmtPrice(prices.monthly.amount, currency) : PLAN_PRICES.base;
  const annualStr = prices?.annual ? fmtPrice(prices.annual.amount, currency) : ANNUAL_PRICE;
  const annualPerMonth = prices?.annual
    ? fmtPrice(Math.round(prices.annual.amount / 12), currency)
    : ANNUAL_PER_MONTH;
  const hasAnnual = prices ? !!prices.annual : true;
  const savePct =
    prices?.annual && prices?.monthly
      ? Math.round((1 - prices.annual.amount / (prices.monthly.amount * 12)) * 100)
      : 48;

  // If annual isn't available, force monthly.
  React.useEffect(() => {
    if (prices && !prices.annual && interval === "annual") setInterval("monthly");
  }, [prices, interval]);

  const onStart = async () => {
    setLoading(true);
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
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Starting checkout…
              </>
            ) : (
              ctaLabel
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Billed today. Cancel anytime in two taps from Account settings.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
