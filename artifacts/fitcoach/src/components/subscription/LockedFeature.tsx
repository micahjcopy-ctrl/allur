import React from "react";
import { Lock, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { startCheckout, PLAN_PRICES, TRIAL_DAYS } from "@/lib/subscription";
import { useFitCoach } from "@/context/FitCoachContext";

interface LockedFeatureProps {
  title: string;
  description: string;
}

/**
 * Full-bleed lock shown to Free users in place of a credit-gated feature
 * (AI Coach, macro tracking, etc.). Prompts a resubscribe to ALLUR Base.
 */
export function LockedFeature({ title, description }: LockedFeatureProps) {
  const { subscription } = useFitCoach();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const everSubscribed = subscription?.hasEverSubscribed ?? false;

  const onSubscribe = async () => {
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
    <div className="flex flex-col items-center justify-center text-center px-8 py-16">
      <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-6">
        <Lock className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-xs mb-8">{description}</p>

      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 text-left mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg">ALLUR Base</span>
        </div>
        <p className="text-3xl font-bold mb-1">
          {PLAN_PRICES.base}
          <span className="text-base font-medium text-muted-foreground"> / month</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {everSubscribed
            ? "Reactivate to unlock your AI coach, plan updates, and macro tracking."
            : `Includes a ${TRIAL_DAYS}-day free trial. Cancel anytime.`}
        </p>
      </div>

      <Button
        onClick={onSubscribe}
        disabled={loading}
        className="w-full max-w-sm rounded-full h-14 text-lg font-bold"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Starting checkout…
          </>
        ) : everSubscribed ? (
          "Reactivate ALLUR Base"
        ) : (
          "Start my free trial"
        )}
      </Button>
    </div>
  );
}
