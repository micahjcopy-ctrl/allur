import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFitCoach, type PR } from "@/context/FitCoachContext";
import { useToast } from "@/hooks/use-toast";
import { buildAllurScore, prShareCaption, scanShareCaption } from "@/lib/allurScore";
import { renderPrCard, renderScanCard, sharePng } from "@/lib/shareCard";
import { ChevronRight, Loader2, Lock, Share2, Sparkles } from "lucide-react";
import { Link } from "wouter";

// ---------------------------------------------------------------------------
// Allur Score — the gamified face of the physique analysis, plus the share
// buttons that turn scans and PRs into watermarked cards (the growth loop).
// ---------------------------------------------------------------------------

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

/** Best-effort referral code so shared cards double as invites. */
async function fetchReferralCode(): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase()}/api/referral/status`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { code?: string };
    return data.code ?? null;
  } catch {
    return null;
  }
}

function useCountUp(value: number, dur = 1200) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    // Respect reduced-motion: snap to final value, no animation.
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setShown(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return shown;
}

function AnimatedNumber({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <>{Math.round(shown)}</>;
}

function ScoreRing({ value }: { value: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const shown = useCountUp(value);
  return (
    <svg viewBox="0 0 128 128" className="w-32 h-32 -rotate-90">
      <defs>
        <linearGradient id="allurArc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="hsl(var(--accent-navy))" />
          <stop offset="0.5" stopColor="hsl(var(--accent-deep))" />
          <stop offset="1" stopColor="hsl(var(--primary))" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r={R} fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
      <circle
        cx="64"
        cy="64"
        r={R}
        fill="none"
        stroke="url(#allurArc)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - Math.min(shown, 100) / 100)}
      />
    </svg>
  );
}

export function AllurScoreCard() {
  const { physiqueAnalyses, workoutStreak } = useFitCoach();
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);

  const score = useMemo(
    () => buildAllurScore(physiqueAnalyses, workoutStreak),
    [physiqueAnalyses, workoutStreak],
  );

  if (!score) {
    return (
      <Link href="/progress">
        <Card className="border-border bg-card/50 overflow-hidden cursor-pointer transition-transform active:scale-[.97]">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wider">Allur Score</span>
            </div>
            <div className="flex items-center gap-5">
              <div className="relative shrink-0 opacity-40">
                <ScoreRing value={0} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="w-7 h-7 text-muted-foreground" />
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-base font-bold text-foreground">Unlock your Allur Score</p>
                <p className="text-sm text-muted-foreground leading-snug">
                  Run your first body scan to reveal your physique score and track it over time.
                </p>
                <p className="flex items-center gap-1 text-sm font-semibold text-primary pt-1">
                  Run your first scan
                  <ChevronRight className="w-4 h-4" />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const code = await fetchReferralCode();
      const blob = await renderScanCard(score, code);
      const outcome = await sharePng(blob, `allur-score-${score.overall}.png`, scanShareCaption(score));
      toast({
        title: outcome === "shared" ? "Score shared" : "Score card saved",
        description:
          outcome === "shared"
            ? "Friends who join with your code earn you free premium."
            : "Post it anywhere — your invite code is on the card.",
      });
    } catch {
      toast({ variant: "destructive", title: "Couldn't build the share card" });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Card className="border-border bg-card/50 overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium uppercase tracking-wider">Allur Score</span>
          {score.week != null && (
            <span className="ml-auto text-xs text-muted-foreground">Week {score.week}</span>
          )}
        </div>

        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <ScoreRing value={score.overall} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tabular-nums"><AnimatedNumber value={score.overall} /></span>
              {score.delta != null && score.delta !== 0 && (
                <span
                  className={
                    score.delta > 0
                      ? "text-[11px] font-semibold text-success"
                      : "text-[11px] font-semibold text-destructive"
                  }
                >
                  {score.delta > 0 ? `+${score.delta}` : score.delta}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Potential</span>
              <span className="text-lg font-bold text-primary tabular-nums">{score.potential}</span>
            </div>
            {score.parts.slice(0, 4).map((p) => (
              <div key={p.part} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">{p.part}</span>
                  <span className="font-semibold tabular-nums">{Math.round(p.rating)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(p.rating, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button variant="secondary" className="w-full h-11" onClick={share} disabled={sharing}>
          {sharing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Share2 className="w-4 h-4 mr-2" />
          )}
          Share your score
        </Button>
      </CardContent>
    </Card>
  );
}

/** Small share affordance for a PR row — renders a celebration card. */
export function PrShareButton({ pr }: { pr: PR }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const code = await fetchReferralCode();
      const blob = await renderPrCard(
        { exercise: pr.exercise, weight: pr.weight, reps: pr.reps, date: pr.date },
        code,
      );
      await sharePng(
        blob,
        `allur-pr-${pr.exercise.toLowerCase().replace(/\s+/g, "-")}.png`,
        prShareCaption(pr.exercise, pr.weight, pr.reps),
      );
    } catch {
      toast({ variant: "destructive", title: "Couldn't build the PR card" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      aria-label="Share this PR"
      onClick={share}
      disabled={busy}
      className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
    </button>
  );
}
