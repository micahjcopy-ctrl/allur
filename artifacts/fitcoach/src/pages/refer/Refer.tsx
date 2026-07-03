import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Gift, Copy, Share2, Check, ChevronLeft, Sparkles, Users, Loader2 } from "lucide-react";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");
const APP_URL = "https://allur-mauve.vercel.app";

interface ReferralStatus {
  code: string;
  joined: number;
  pending: number;
  monthsEarned: number;
  rewardDays: number;
  premiumUntil: string | null;
}

export default function Refer() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [data, setData] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await fetch(`${apiBase()}/api/referral/status`, { credentials: "include" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setData((await res.json()) as ReferralStatus);
    } catch {
      // Without the status we don't have the user's personal code — sharing a
      // bare link would silently lose them their referral credit. Be honest.
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = data ? `${APP_URL}/?ref=${data.code}` : APP_URL;
  const message = data
    ? `I'm using ALLUR — an AI fitness coach that actually adapts to your life. Use my link and we BOTH get a free month of Premium: ${link}`
    : "";

  const share = async () => {
    if (!data) return;
    // Native share sheet on mobile; clipboard fallback on desktop.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "ALLUR",
          text: message,
          url: link,
        });
        return;
      } catch {
        /* user cancelled or unsupported — fall through to copy */
      }
    }
    void copy();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Invite copied", description: "Paste it to anyone — you both get a free month." });
    } catch {
      toast({ title: `Your code: ${data?.code ?? ""}`, description: link });
    }
  };

  return (
    <MobileLayout>
      <div className="p-6 space-y-6">
        <button
          type="button"
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -ml-1"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {/* Hero — the no-brainer pitch */}
        <div className="text-center space-y-3 pt-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold leading-tight">
            Give a month.
            <br />
            <span className="text-primary">Get a month.</span>
          </h1>
          <p className="text-muted-foreground max-w-xs mx-auto">
            Every friend who starts their trial with your link gets a free month of Premium — and so do you.
            No cap. Refer 12 friends, get a free year.
          </p>
        </div>

        {/* Value framing */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-around text-center">
            <div>
              <p className="text-2xl font-bold text-primary">Free</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">for your friend</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-2xl font-bold text-primary">1 month</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Premium for you</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-2xl font-bold text-primary">$29.99</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">value each</p>
            </div>
          </CardContent>
        </Card>

        {/* Share */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : loadFailed || !data ? (
          <div className="rounded-2xl border border-border bg-secondary/40 p-5 text-center space-y-3">
            <p className="text-sm font-semibold">Couldn't load your invite code</p>
            <p className="text-xs text-muted-foreground">
              Sharing without your personal code wouldn't count toward your free months, so let's fix this first.
            </p>
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="h-10 px-6 rounded-full bg-primary text-primary-foreground text-sm font-bold"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void share()}
              className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg inline-flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" /> Share your invite
            </button>
            <button
              type="button"
              onClick={() => void copy()}
              className="w-full flex items-center justify-between rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3"
            >
              <span className="font-mono font-bold tracking-widest">{data?.code}</span>
              <span className="text-xs text-primary font-medium flex items-center gap-1">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </span>
            </button>
          </div>
        )}

        {/* Your rewards */}
        {data && (
          <Card className="border-border bg-card/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Your rewards
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-secondary/40 py-3">
                  <p className="text-2xl font-bold">{data.joined}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Friends joined</p>
                </div>
                <div className="rounded-xl bg-secondary/40 py-3">
                  <p className="text-2xl font-bold">{data.monthsEarned}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Months earned</p>
                </div>
                <div className="rounded-xl bg-secondary/40 py-3">
                  <p className="text-2xl font-bold">{data.pending}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</p>
                </div>
              </div>
              {data.premiumUntil && (
                <p className="text-xs text-center text-primary">
                  Premium active until {new Date(data.premiumUntil).toLocaleDateString()} — enjoy it. 🎉
                </p>
              )}
              {data.pending > 0 && !data.premiumUntil && (
                <p className="text-[11px] text-center text-muted-foreground">
                  {data.pending} friend{data.pending > 1 ? "s" : ""} signed up — your reward lands the moment they start their trial.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* How it works */}
        <div className="space-y-3 pt-1">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            <Users className="w-4 h-4 text-primary" /> How it works
          </p>
          {[
            "Share your link with a friend.",
            "They sign up and start their 14-day free trial.",
            "You both get a free month of Premium — instantly.",
          ].map((step, i) => (
            <div key={step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <p className="text-sm text-muted-foreground leading-snug pt-0.5">{step}</p>
            </div>
          ))}
        </div>

        <div className="h-4" />
      </div>
    </MobileLayout>
  );
}
