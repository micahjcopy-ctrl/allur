import React from "react";
import { useLocation } from "wouter";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFitCoach } from "@/context/FitCoachContext";
import { useAccount } from "@/context/AuthContext";
import { useLogoutAccount } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  startCheckout,
  cancelSubscription,
  PLAN_PRICES,
  TRIAL_DAYS,
  BASE_MONTHLY_CREDITS,
  type PlanTag,
} from "@/lib/subscription";
import { Check, Star, Zap, User, LogOut, Loader2, Scale } from "lucide-react";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Account() {
  const { profile, setWeightUnit, plan, isPremium, subscription, refreshCredits, refreshSubscription } =
    useFitCoach();
  const { authUser, refreshAuth } = useAccount();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const logoutMut = useLogoutAccount();
  const [busyPlan, setBusyPlan] = React.useState<PlanTag | null>(null);
  const [canceling, setCanceling] = React.useState(false);

  // Handle the redirect back from Stripe Checkout (?checkout=success|cancel).
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    if (!checkout) return;
    if (checkout === "success") {
      toast({
        title: "Subscription active",
        description: "You're all set. Enjoy full access to ALLUR!",
      });
      refreshCredits();
      refreshSubscription();
    } else if (checkout === "cancel") {
      toast({
        title: "Checkout canceled",
        description: "No charge was made. You can subscribe anytime.",
      });
    }
    // Strip the query param so a reload doesn't re-trigger the toast.
    window.history.replaceState({}, "", apiBase() + "/account");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckout = async (target: PlanTag) => {
    setBusyPlan(target);
    try {
      await startCheckout(target);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Checkout failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
      setBusyPlan(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancel your subscription? You'll keep access until the end of your billing period.")) {
      return;
    }
    setCanceling(true);
    try {
      await cancelSubscription();
      await refreshSubscription();
      toast({
        title: "Subscription canceled",
        description: "You'll keep access until your current period ends.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't cancel",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setCanceling(false);
    }
  };

  const handleUnitChange = (unit: "kg" | "lb") => {
    if (unit === profile.weightUnit) return;
    setWeightUnit(unit);
    toast({
      title: `Switched to ${unit}`,
      description: "Your bodyweight and all logged entries were converted.",
    });
  };

  const handleLogout = async () => {
    try {
      await logoutMut.mutateAsync();
      await refreshAuth();
    } catch {
      toast({ title: "Logout failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const displayName = authUser?.username || profile.name || "User";
  const trialEnd = formatDate(subscription?.trialEnd ?? null);
  const periodEnd = formatDate(subscription?.currentPeriodEnd ?? null);
  const isTrialing = subscription?.status === "trialing";
  const cancelAtPeriodEnd = subscription?.cancelAtPeriodEnd ?? false;

  const baseFeatures = [
    `${BASE_MONTHLY_CREDITS.coaching} AI coaching requests / mo`,
    `${BASE_MONTHLY_CREDITS.photo} meal photo logs / mo`,
    `${BASE_MONTHLY_CREDITS.bodyScan} AI physique scans / mo`,
    "Full training plan + AI plan updates",
  ];

  return (
    <MobileLayout>
      <div className="p-6 space-y-8">
        <header className="pt-2">
          <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        </header>

        <div className="flex items-center gap-4 p-4 rounded-2xl bg-secondary/50 border border-border">
          <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold text-2xl border border-primary/30">
            {displayName[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h2 className="font-bold text-xl">{displayName}</h2>
            <p className="text-sm text-muted-foreground">{authUser?.email || profile.experience || "Athlete"}</p>
          </div>
        </div>

        <section className="space-y-4">
          <h3 className="font-bold text-lg px-1">Subscription</h3>

          {/* PREMIUM */}
          {plan === "premium" && (
            <Card className="border-primary bg-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap className="w-16 h-16" />
              </div>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" /> Premium
                  </CardTitle>
                  <Badge variant="outline" className="border-primary text-primary font-bold">CURRENT</Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">{PLAN_PRICES.premium} / month</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm mt-2 mb-4">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Unlimited AI coaching</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Unlimited meal logs & physique scans</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> Everything in Base</li>
                </ul>
                {cancelAtPeriodEnd ? (
                  <p className="text-sm text-muted-foreground">
                    Cancels on {periodEnd ?? "your billing date"}. You keep access until then.
                  </p>
                ) : (
                  <Button
                    onClick={handleCancel}
                    disabled={canceling}
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {canceling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Cancel subscription
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* BASE */}
          {plan === "base" && (
            <>
              <Card className="border-primary bg-primary/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Zap className="w-16 h-16" />
                </div>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" /> Base
                    </CardTitle>
                    <Badge variant="outline" className="border-primary text-primary font-bold">CURRENT</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">{PLAN_PRICES.base} / month</p>
                  {isTrialing && trialEnd && (
                    <p className="text-sm text-primary font-medium mt-1">Free trial ends {trialEnd}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm mt-2 mb-4">
                    {baseFeatures.map((f) => (
                      <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> {f}</li>
                    ))}
                  </ul>
                  {cancelAtPeriodEnd ? (
                    <p className="text-sm text-muted-foreground">
                      Cancels on {periodEnd ?? "your billing date"}. You keep access until then.
                    </p>
                  ) : (
                    <Button
                      onClick={handleCancel}
                      disabled={canceling}
                      variant="ghost"
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {canceling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Cancel subscription
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Upgrade to Premium */}
              <Card className="border-border bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" /> Premium
                  </CardTitle>
                  <p className="text-muted-foreground text-sm mt-1">{PLAN_PRICES.premium} / month</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm mt-2 mb-6">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-muted-foreground" /> Unlimited AI coaching</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-muted-foreground" /> Unlimited meal logs & physique scans</li>
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-muted-foreground" /> No monthly limits</li>
                  </ul>
                  <Button
                    onClick={() => handleCheckout("premium")}
                    disabled={busyPlan !== null}
                    className="w-full font-bold bg-white text-black hover:bg-white/90"
                  >
                    {busyPlan === "premium" ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting checkout…</>
                    ) : (
                      "Upgrade to Premium"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {/* FREE (lapsed / never subscribed) */}
          {plan === "free" && (
            <>
              <Card className="border-border bg-card/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Star className="w-16 h-16" />
                </div>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl">Free</CardTitle>
                    <Badge variant="outline" className="border-muted-foreground text-muted-foreground font-bold">CURRENT</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">Your data is saved, but coaching is locked</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm mt-2">
                    <li className="flex items-center gap-2"><Check className="w-4 h-4 text-muted-foreground" /> View your saved plan & progress</li>
                    <li className="flex items-center gap-2 text-muted-foreground"><Star className="w-4 h-4" /> AI coach, plan updates & tracking locked</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Reactivate Base */}
              <Card className="border-primary bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" /> Base
                  </CardTitle>
                  <p className="text-muted-foreground text-sm mt-1">{PLAN_PRICES.base} / month</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm mt-2 mb-6">
                    {baseFeatures.map((f) => (
                      <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> {f}</li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleCheckout("base")}
                    disabled={busyPlan !== null}
                    className="w-full font-bold"
                  >
                    {busyPlan === "base" ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting checkout…</>
                    ) : subscription?.hasEverSubscribed ? (
                      "Reactivate Base"
                    ) : (
                      `Start ${TRIAL_DAYS}-day free trial`
                    )}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </section>

        <section className="space-y-2 pb-8">
          <h3 className="font-bold text-lg px-1 mt-6 mb-2">Settings</h3>
          <Button
            variant="ghost"
            onClick={() => navigate("/settings")}
            className="w-full justify-start h-14 rounded-xl border border-transparent hover:border-border hover:bg-secondary/50"
          >
            <User className="w-5 h-5 mr-3 text-muted-foreground" /> Profile Settings
          </Button>
          <div className="w-full flex items-center justify-between h-14 px-4 rounded-xl border border-transparent">
            <span className="flex items-center text-sm font-medium">
              <Scale className="w-5 h-5 mr-3 text-muted-foreground" /> Weight Units
            </span>
            <div className="flex items-center rounded-full bg-secondary/60 p-1">
              {(["kg", "lb"] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => handleUnitChange(unit)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                    profile.weightUnit === unit
                      ? "bg-primary text-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            disabled={logoutMut.isPending}
            className="w-full justify-start h-14 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {logoutMut.isPending ? (
              <Loader2 className="w-5 h-5 mr-3 animate-spin" />
            ) : (
              <LogOut className="w-5 h-5 mr-3" />
            )}{" "}
            Log Out
          </Button>
        </section>
      </div>
    </MobileLayout>
  );
}
