import { Link } from "wouter";
import { ArrowLeft, Zap, Trophy, CalendarDays, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useFitCoach } from "@/context/FitCoachContext";
import { MobileLayout } from "@/components/layout/MobileLayout";

// ---------------------------------------------------------------------------
// Streak details — the tap-through breakdown behind the StreakBar. Explains the
// level (permanent), the momentum multiplier (resets on a missed day), today's
// earned points by source with their daily caps, and a 14-day activity strip.
// ---------------------------------------------------------------------------

function weekdayLetter(dayKey: string): string {
  const d = new Date(dayKey + "T00:00:00");
  return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
}

export default function StreakDetail() {
  const { streak } = useFitCoach();
  const {
    currentStreak,
    longestStreak,
    activeToday,
    momentum,
    momentumPct,
    level,
    tier,
    progressPct,
    pointsIntoLevel,
    levelSpan,
    pointsToNext,
    lifetimePoints,
    todayPoints,
    todaySources,
    recentDays,
  } = streak;

  return (
    <MobileLayout>
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground active:scale-90 transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-bold">Your Streak</h1>
        </div>

        {/* Hero — the fire */}
        <Card className="border-border bg-card/50 overflow-hidden">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="text-5xl leading-none" aria-hidden="true">
              🔥
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tabular-nums">
                  {currentStreak}
                </span>
                <span className="text-sm text-muted-foreground">
                  day{currentStreak === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeToday
                  ? "Logged today — nice. Keep it rolling."
                  : "Log anything today to keep the fire alive."}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Trophy className="h-3 w-3" /> Longest: {longestStreak} day
                {longestStreak === 1 ? "" : "s"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Level — the permanent blue bar */}
        <Card className="border-border bg-card/50">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">
                Level {level}
                <span className="text-muted-foreground font-normal">
                  {" · "}
                  {tier}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {pointsIntoLevel}/{levelSpan}
              </span>
            </div>
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: progressPct + "%" }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="tabular-nums">
                {pointsToNext} pts to Level {level + 1}
              </span>
              <span className="tabular-nums">
                {lifetimePoints} lifetime
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/60">
              Your level never drops. Every meal, workout, cardio session, and
              weekly body scan adds streak points that carry you up the tiers for
              good.
            </p>
          </CardContent>
        </Card>

        {/* Momentum — the resettable multiplier that feeds the score */}
        <Card className="border-border bg-card/50">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Zap className="h-4 w-4 text-primary" /> Momentum
              </span>
              <span className="text-xl font-bold text-primary tabular-nums">
                {momentum.toFixed(2)}×
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: momentumPct + "%" }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              The longer your streak runs, the more momentum you build — up to
              2× at a 21-day streak. Momentum multiplies the points every action
              earns and gives your Allur Score a live boost. Miss a day and
              momentum drops back to 1× and rebuilds — your level and points stay
              put.
            </p>
            <Link
              href="/score"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
            >
              See how it lifts your Allur Score →
            </Link>
          </CardContent>
        </Card>

        {/* Today's points by source */}
        <Card className="border-border bg-card/50">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Today</span>
              <span className="text-sm font-bold text-primary tabular-nums">
                +{todayPoints} pts
              </span>
            </div>
            <div className="space-y-2">
              {todaySources.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={
                        "h-2 w-2 rounded-full " +
                        (s.count > 0 ? "bg-primary" : "bg-secondary")
                      }
                      aria-hidden="true"
                    />
                    <span
                      className={
                        s.count > 0
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }
                    >
                      {s.label}
                    </span>
                    {s.capped && (
                      <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                        Max
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {s.count}/{s.cap} · +{s.points}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/60">
              Each source caps per day so points reflect real consistency, then
              your {momentum.toFixed(2)}× momentum is applied on top.
            </p>
          </CardContent>
        </Card>

        {/* 14-day activity strip */}
        <Card className="border-border bg-card/50">
          <CardContent className="p-5 space-y-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-muted-foreground" /> Last 14
              days
            </span>
            <div className="flex items-end justify-between gap-1">
              {recentDays.map((d, i) => (
                <div
                  key={d.day}
                  className="flex flex-col items-center gap-1 flex-1"
                  title={d.day + (d.active ? " · +" + d.points : "")}
                >
                  <div
                    className={
                      "w-full aspect-square rounded-md " +
                      (d.active
                        ? "bg-gradient-to-b from-sky-500 to-cyan-400"
                        : "bg-secondary")
                    }
                  />
                  <span className="text-[8px] text-muted-foreground">
                    {i === recentDays.length - 1 ? "•" : weekdayLetter(d.day)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="flex items-start gap-2 text-[11px] text-muted-foreground px-1 pb-2">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Your streak is a day-to-day game; your level and momentum feed the
            Allur Score you build over time.
          </span>
        </p>
      </div>
    </MobileLayout>
  );
}
