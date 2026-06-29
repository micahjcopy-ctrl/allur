import React from "react";
import { motion } from "framer-motion";
import { Check, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { startCheckout, PLAN_PRICES, TRIAL_DAYS } from "@/lib/subscription";

/**
 * Mandatory payment screen shown immediately after onboarding for brand-new
 * users (no Stripe subscription history). Starts the 14-day Base trial, which
 * requires a card up front via Stripe Checkout.
 */
export default function Paywall() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const onStart = async () => {
    setLoading(true);
    try {
      await startCheckout("base");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't start checkout",
        description: err instanceof Error ? err.message : "Please try again.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen max-w-md mx-auto flex flex-col px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col"
      >
        <div className="flex-1 flex flex-col justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-6">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Your plan is ready
          </h1>
          <p className="text-muted-foreground mb-8">
            Start your {TRIAL_DAYS}-day free trial to unlock your AI coach, training
            plan, progress scans, and macro tracking. You won't be charged until
            the trial ends.
          </p>

          <div className="bg-card border border-primary/40 rounded-3xl p-6 mb-8">
            <div className="flex items-baseline justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="font-bold text-lg">ALLUR Base</span>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{PLAN_PRICES.base}</p>
                <p className="text-xs text-muted-foreground">/ month after trial</p>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm">
              {[
                "Personalized AI training plan",
                "Unlimited-feel AI coaching (text & voice)",
                "Progress photos + AI physique scans",
                "Meal photo macro tracking",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>
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
              `Start ${TRIAL_DAYS}-day free trial`
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {TRIAL_DAYS} days free, then {PLAN_PRICES.base}/mo. Cancel anytime in
            Account settings.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
