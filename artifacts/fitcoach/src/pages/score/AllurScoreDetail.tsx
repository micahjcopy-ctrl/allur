import { useMemo, type ReactNode, type ComponentType } from "react";
import {
  ArrowLeft,
  Sparkles,
  Info,
  Scale,
  Target,
  TrendingUp,
  Dumbbell,
  Flame,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFitCoach } from "@/context/FitCoachContext";
import { buildAllurScore, latestAnalysis, analysesByRecency } from "@/lib/allurScore";
import { ScoreRing } from "@/components/AllurScore";
import { MobileLayout } from "@/components/layout/MobileLayout";

// Muscle status -> label + token-based colours (all classes exist in the theme).
const STATUS = {
  strong: { label: "Strong", bar: "bg-success", chip: "bg-success/10 text-success" },
  developing: { label: "Developing", bar: "bg-primary", chip: "bg-primary/10 text-primary" },
  weak: { label: "Needs work", bar: "bg-muted-foreground/50", chip: "bg-muted text-muted-foreground" },
} as const;

function StatusChip({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status] ?? STATUS.developing;
  return (
    <span className={"text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full " + s.chip}>
      {s.label}
    </span>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-xs font-medium uppercase tracking-wider">{children}</span>
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon?: ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3 text-center">
      <div className="flex items-center justify-center gap-1">
        {Icon ? <Icon className="w-3.5 h-3.5 text-primary" /> : null}
        <span className="text-xl font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Back"
        onClick={() => window.history.back()}
        className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-muted-foreground active:scale-95"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="text-2xl font-bold">Allur Score</h1>
    </div>
  );
}

export default function AllurScoreDetail() {
  const { physiqueAnalyses, workoutStreak, workoutSessions, streak } = useFitCoach();

  const score = useMemo(
    () => buildAllurScore(physiqueAnalyses, workoutStreak, streak.momentum),
    [physiqueAnalyses, workoutStreak, streak.momentum],
  );
  const latest = useMemo(() => latestAnalysis(physiqueAnalyses), [physiqueAnalyses]);
  const history = useMemo(() => analysesByRecency(physiqueAnalyses), [physiqueAnalyses]);

  if (!score || !latest) {
    return (
      <MobileLayout>
        <div className="p-6 space-y-6">
          <Header />
          <Card className="border-border bg-card/50">
            <CardContent className="p-6 text-center space-y-3">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <p className="text-base font-bold text-foreground">Unlock your Allur Score</p>
              <p className="text-sm text-muted-foreground">
                Run your first body scan to reveal your physique score, a muscle-by-muscle
                breakdown, and your projected body-fat range.
              </p>
              <Link href="/progress">
                <Button className="w-full h-11">Run your first scan</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  const sessions = workoutSessions ?? [];
  const totalWorkouts = sessions.length;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const nowTs = new Date().getTime();
  const workoutsThisWeek = sessions.filter((w) => {
    const t = w.finishedAt ? new Date(w.finishedAt).getTime() : NaN;
    return !Number.isNaN(t) && nowTs - t <= weekMs;
  }).length;

  const bfLow = Math.round(latest.bodyFatLow);
  const bfHigh = Math.round(latest.bodyFatHigh);
  const parts = score.parts;
  const maxScore = Math.max(1, ...history.map((h) => h.overallScore));

  return (
    <MobileLayout>
      <div className="p-6 space-y-5 pb-24">
        <Header />

        <Card className="border-border bg-card/50 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <ScoreRing value={score.overall} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold tabular-nums">{score.overall}</span>
                  {score.delta != null && score.delta !== 0 ? (
                    <span className={score.delta > 0 ? "text-[11px] font-semibold text-success" : "text-[11px] font-semibold text-destructive"}>
                      {score.delta > 0 ? "+" + score.delta : score.delta} vs last
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Allur Score</p>
                <p className="text-sm text-foreground">
                  Your overall physique development, scored 0 to 100 from your latest scan.
                </p>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">Potential</span>
                  <span className="text-lg font-bold text-primary tabular-nums">{score.potential}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardContent className="p-5 space-y-3">
            <SectionTitle icon={Info}>What this measures</SectionTitle>
            <p className="text-sm text-muted-foreground">
              Your score rates muscular development, symmetry, and conditioning from your scan
              photos against a lean, well-developed physique benchmark. It reflects how your body
              looks now, not your effort. Log workouts and scan again to watch it climb.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {latest.confidence} confidence
              </span>
              {score.week != null ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Week {score.week}
                </span>
              ) : null}
            </div>
            {latest.limitations ? (
              <p className="text-xs text-muted-foreground/80 leading-snug">
                <span className="font-semibold">Worth knowing: </span>
                {latest.limitations}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardContent className="p-5 space-y-4">
            <SectionTitle icon={Scale}>Body composition</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Projected body fat</p>
                <p className="text-xl font-bold tabular-nums">
                  {bfLow} to {bfHigh}<span className="text-sm font-medium text-muted-foreground"> %</span>
                </p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Est. lean mass</p>
                <p className="text-xl font-bold tabular-nums">
                  {latest.muscleMassKg != null ? (
                    <>{Math.round(latest.muscleMassKg)}<span className="text-sm font-medium text-muted-foreground"> kg</span></>
                  ) : "—"}
                </p>
              </div>
            </div>
            {latest.markers.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">What the estimate is based on</p>
                <div className="flex flex-wrap gap-1.5">
                  {latest.markers.map((m, i) => (
                    <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{m}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50">
          <CardContent className="p-5 space-y-4">
            <SectionTitle icon={Target}>Muscle breakdown</SectionTitle>
            <div className="space-y-4">
              {parts.map((p) => {
                const st = STATUS[p.status] ?? STATUS.developing;
                return (
                  <div key={p.part} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-foreground truncate">{p.part}</span>
                        <StatusChip status={p.status} />
                      </div>
                      <span className="text-sm font-bold tabular-nums">{Math.round(p.rating)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className={"h-full rounded-full " + st.bar} style={{ width: Math.min(p.rating, 100) + "%" }} />
                    </div>
                    {p.note ? <p className="text-xs text-muted-foreground leading-snug">{p.note}</p> : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {(latest.focusAreas.length > 0 || latest.suggestedDirection || latest.summary) ? (
          <Card className="border-border bg-card/50">
            <CardContent className="p-5 space-y-3">
              <SectionTitle icon={TrendingUp}>What to focus on</SectionTitle>
              {latest.summary ? <p className="text-sm text-muted-foreground">{latest.summary}</p> : null}
              {latest.focusAreas.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {latest.focusAreas.map((f) => (
                    <span key={f.part} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{f.part}</span>
                  ))}
                </div>
              ) : null}
              {latest.suggestedDirection ? (
                <p className="text-sm text-foreground">{latest.suggestedDirection}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border bg-card/50">
          <CardContent className="p-5 space-y-4">
            <SectionTitle icon={Dumbbell}>Training</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Day streak" value={workoutStreak} icon={Flame} />
              <Stat label="This week" value={workoutsThisWeek} />
              <Stat label="Total logged" value={totalWorkouts} />
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Your physique score comes from scans, but consistency is what moves it. Logged
              workouts raise your <span className="text-primary font-semibold">Potential</span>, the
              ceiling you are climbing toward. Keep the streak alive and scan again to bank the gains.
            </p>
          </CardContent>
        </Card>

        {history.length > 1 ? (
          <Card className="border-border bg-card/50">
            <CardContent className="p-5 space-y-4">
              <SectionTitle icon={TrendingUp}>Progress over time</SectionTitle>
              <div className="flex items-end gap-1.5 h-24">
                {history.slice().reverse().slice(-8).map((h, i) => (
                  <div key={h.id ?? i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-primary/70" style={{ height: Math.max(6, (h.overallScore / maxScore) * 84) + "px" }} />
                    <span className="text-[9px] text-muted-foreground tabular-nums">{Math.round(h.overallScore)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Allur Score across your last {Math.min(history.length, 8)} scans.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MobileLayout>
  );
}
