import React, { useEffect, useMemo, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GoalPreview } from "@/components/GoalPreview";
import { AllurScoreCard } from "@/components/AllurScore";
import { useFitCoach, dayKeyOf } from "@/context/FitCoachContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Activity, Camera, Mic, Target, Flame, Zap, UtensilsCrossed, Gift, ChevronRight, Moon, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { isEnabled } from "@/lib/features";
import { WelcomeTour, hasSeenTour } from "@/components/WelcomeTour";
import { GettingStarted } from "@/components/GettingStarted";
import { NotificationsBell } from "@/components/NotificationsBell";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type CardioOption = { label: string; detail: string };
// Goal-aware cardio suggestion for the dashboard. Evidence-based: fat loss leans
// on steps + Zone 2, muscle/strength keep cardio light to protect recovery, and
// athletic goals get sharp intervals done fresh.
function cardioRecForGoal(
  goal: string | null,
  todayIdx: number,
  sessionsThisWeek: number,
  liftingToday: boolean,
): { headline: string; primary: CardioOption; options: CardioOption[] } {
  const pools: Record<string, { primary: CardioOption; options: CardioOption[] }> = {
    "Weight Loss": {
      primary: { label: "Zone 2 — 35 min easy", detail: "Conversational pace. Burns fat without eating into recovery." },
      options: [
        { label: "Incline walk — 40 min", detail: "Brisk, ~12% incline. Low impact, high burn." },
        { label: "Intervals — 15 min", detail: "6×(30s hard / 90s easy). Use 1–2×/week max." },
        { label: "10k step day", detail: "Steps quietly do most of the fat-loss work." },
      ],
    },
    "Muscle Gain": {
      primary: { label: "Zone 2 — 20 min easy", detail: "Enough for heart health; won't blunt your gains." },
      options: [
        { label: "Easy bike — 25 min", detail: "Low-impact, spares the legs before training." },
        { label: "Brisk walk — 30 min", detail: "Active recovery that keeps you lean." },
      ],
    },
    "Strength": {
      primary: { label: "Easy conditioning — 20 min", detail: "Builds work capacity and speeds recovery between heavy days." },
      options: [
        { label: "Incline walk — 25 min", detail: "Zero interference with strength." },
        { label: "Bike Zone 2 — 20 min", detail: "Flush the legs at no fatigue cost." },
      ],
    },
    "Athleticism": {
      primary: { label: "Intervals — 6×(20s/90s)", detail: "Sharp, repeatable power. Do it fresh, not after heavy legs." },
      options: [
        { label: "Tempo run — 20 min", detail: "Comfortably hard. Builds your engine." },
        { label: "Zone 2 base — 30 min", detail: "Aerobic base makes everything else repeatable." },
      ],
    },
  };
  const key = goal && pools[goal] ? goal : "Muscle Gain";
  const base = pools[key];
  if (sessionsThisWeek >= 4 && key !== "Weight Loss") {
    return {
      headline: "You've logged plenty this week — keep it light.",
      primary: { label: "Recovery walk — 20 min", detail: "Easy movement so your training can adapt." },
      options: base.options.slice(0, 2),
    };
  }
  const rotation = [base.primary, ...base.options];
  const primary = rotation[todayIdx % rotation.length];
  const options = rotation.filter((o) => o !== primary).slice(0, 3);
  const headline = liftingToday
    ? "Pair with today's lift — do it after or later in the day."
    : "No lift scheduled today — a great standalone cardio day.";
  return { headline, primary, options };
}

// Offset (0-6) of a plan day relative to today, wrapping around the week.
const dayOffset = (dayName: string, todayIdx: number): number => {
  const idx = WEEKDAYS.findIndex((d) => d.toLowerCase() === dayName.trim().toLowerCase());
  if (idx === -1) return 99;
  return (idx - todayIdx + 7) % 7;
};

export default function Dashboard() {
  const { profile, goal, workoutPlan, credits, isPremium, meals, macroTargetAdjusted: macroTarget, todayActiveCalories, featureToggles, cardioLoad, physiqueAnalyses, restDaysCompleted, toggleRestDayComplete } = useFitCoach();
  const [, setLocation] = useLocation();
  const [tourOpen, setTourOpen] = useState(false);

  // First run on this device → show the walkthrough.
  useEffect(() => {
    if (!hasSeenTour()) setTourOpen(true);
  }, []);

  // Body fat from the MOST RECENT scan by date — not the highest program week —
  // so the number on the home screen always matches the analysis the user just
  // ran (re-scanning an earlier week used to leave this stale).
  const latestScan = useMemo(() => {
    if (physiqueAnalyses.length === 0) return null;
    return [...physiqueAnalyses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )[0];
  }, [physiqueAnalyses]);
  const bodyFatLabel = latestScan ? `${latestScan.bodyFatEstimate}%` : "—";

  // Resolve TODAY's actual plan day (by weekday name), and the next one after
  // it, so "what's next" is always real — never just the first array entry.
  const todayIdx = new Date().getDay();
  const ordered = useMemo(
    () =>
      [...workoutPlan]
        .map((w) => ({ w, offset: dayOffset(w.dayName, todayIdx) }))
        .sort((a, b) => a.offset - b.offset),
    [workoutPlan, todayIdx],
  );
  const todayWorkout = ordered.find((o) => o.offset === 0)?.w ?? null;
  const cardioRec = useMemo(
    () => cardioRecForGoal(goal, todayIdx, cardioLoad?.sessions ?? 0, !!todayWorkout),
    [goal, todayIdx, cardioLoad, todayWorkout],
  );
  const nextUp = ordered.find((o) => o.offset > 0)?.w ?? null;
  const todayKey = dayKeyOf();
  const restDayDone = restDaysCompleted.includes(todayKey);

  const today = new Date().toDateString();
  const todayMeals = meals.filter(m => new Date(m.date).toDateString() === today);
  const consumedCals = todayMeals.reduce((sum, m) => sum + m.macros.calories, 0);
  const consumedProtein = todayMeals.reduce((sum, m) => sum + m.macros.protein, 0);
  const consumedCarbs = todayMeals.reduce((sum, m) => sum + m.macros.carbs, 0);
  const consumedFat = todayMeals.reduce((sum, m) => sum + m.macros.fat, 0);
  const caloriesLeft = Math.max(macroTarget.calories - consumedCals, 0);
  const calPct = Math.min((consumedCals / macroTarget.calories) * 100, 100);

  return (
    <MobileLayout>
      <div className="p-6 space-y-6">
        <header className="flex justify-between items-center pt-2">
          <div>
            <h1 className="text-2xl font-bold">Hey, {profile.name || "Athlete"}</h1>
            <p className="text-muted-foreground">Ready to crush it today?</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center overflow-hidden border border-border">
              <span className="font-bold text-lg">{profile.name?.[0] || "A"}</span>
            </div>
          </div>
        </header>

        {/* First-run walkthrough */}
        <WelcomeTour open={tourOpen} onClose={() => setTourOpen(false)} />

        {/* Getting-started checklist (hides itself once complete) */}
        <GettingStarted />

        {/* WHAT'S NEXT — today's real workout (or rest day) is always the first
            thing on screen, so it's never ambiguous what to do right now. */}
        <div className="bg-hero-gradient rounded-3xl border border-border p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            {todayWorkout ? <Zap className="w-24 h-24" /> : <Moon className="w-24 h-24" />}
          </div>
          <div className="relative z-10">
            <div className="inline-block bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold mb-4">
              UP NEXT · TODAY
            </div>
            {todayWorkout ? (
              <>
                <h2 className="text-2xl font-bold mb-1">{todayWorkout.title}</h2>
                <p className="text-muted-foreground mb-6">{todayWorkout.exercises.length} movements planned</p>
                <Link href="/plan" className="w-full">
                  <Button className="w-full rounded-full h-12 bg-primary text-black font-bold hover:bg-primary/90">
                    Start Today's Workout
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold mb-1">{restDayDone ? "Rest day — done" : "Rest Day"}</h2>
                <p className="text-muted-foreground mb-6">
                  {nextUp ? `Next workout: ${nextUp.dayName} · ${nextUp.title}` : "Recover, walk, and refuel."}
                </p>
                <Button
                  onClick={() => toggleRestDayComplete(todayKey)}
                  className="w-full rounded-full h-12 bg-primary text-black font-bold hover:bg-primary/90"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {restDayDone ? "Rest day complete ✓ (tap to undo)" : "Mark Rest Day as Done"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ALLUR SCORE — signature number on Home: empty-state CTA before first scan, full score card after. */}
        {isEnabled(featureToggles, "progress") && <AllurScoreCard />}

        {/* CALORIES LEFT — the other "what do I do next" number, front and center. */}
        {isEnabled(featureToggles, "macros") && (
        <Card className="border-border bg-card/50 overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <UtensilsCrossed className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider">Nutrition · Today</span>
              </div>
              <span className="text-xs text-muted-foreground">{consumedCals} / {macroTarget.calories} kcal eaten</span>
            </div>

            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold">
                {caloriesLeft.toLocaleString()}
                <span className="text-sm font-medium text-muted-foreground"> kcal left today</span>
              </p>
            </div>
            {todayActiveCalories > 0 && (
              <p className="text-[11px] font-medium text-primary">
                +{todayActiveCalories} kcal earned from cardio
              </p>
            )}

            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${calPct}%` }} />
            </div>

            <div className="flex gap-2">
              <span className="flex-1 text-center text-[11px] font-semibold px-2 py-1 rounded-full bg-info/15 text-info">P {consumedProtein}/{macroTarget.protein}g</span>
              <span className="flex-1 text-center text-[11px] font-semibold px-2 py-1 rounded-full bg-primary/15 text-primary">C {consumedCarbs}/{macroTarget.carbs}g</span>
              <span className="flex-1 text-center text-[11px] font-semibold px-2 py-1 rounded-full bg-warning/15 text-warning">F {consumedFat}/{macroTarget.fat}g</span>
            </div>

            <Link href="/macros" className="w-full block">
              <Button className="w-full rounded-full h-11 bg-primary text-black font-bold hover:bg-primary/90">
                <Camera className="w-4 h-4 mr-2" /> Snap a meal
              </Button>
            </Link>
          </CardContent>
        </Card>
        )}

        {isEnabled(featureToggles, "cardio") && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-primary" />
                <p className="font-semibold text-sm">Recommended cardio today</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{cardioRec.headline}</p>
              <Link href="/cardio" className="block">
                <div className="rounded-xl bg-card border border-primary/40 p-3 mb-3 hover:border-primary transition-colors">
                  <p className="font-bold text-sm text-primary">{cardioRec.primary.label}</p>
                  <p className="text-xs text-muted-foreground">{cardioRec.primary.detail}</p>
                </div>
              </Link>
              {cardioRec.options.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Or try</p>
                  <div className="flex flex-col gap-2">
                    {cardioRec.options.map((o) => (
                      <Link key={o.label} href="/cardio" className="block">
                        <div className="rounded-lg bg-card/50 border border-border p-2.5 hover:border-primary/50 transition-colors">
                          <p className="text-xs font-semibold">{o.label}</p>
                          <p className="text-[11px] text-muted-foreground">{o.detail}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* CARDIO — quick status + entry point; hidden when the module is off. */}
        {isEnabled(featureToggles, "cardio") && (
          <Link href="/cardio" className="block">
            <Card className="border-border bg-card/50 hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/20 rounded-full">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Cardio</p>
                    <p className="text-xs text-muted-foreground">
                      {cardioLoad.sessions > 0
                        ? `${cardioLoad.sessions} session${cardioLoad.sessions === 1 ? "" : "s"} · ${cardioLoad.totalKm} km this week`
                        : "Track a run, ride, walk or hike"}
                    </p>
                  </div>
                </div>
                {todayActiveCalories > 0 ? (
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">+{todayActiveCalories}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">kcal today</p>
                  </div>
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </CardContent>
            </Card>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-4">
          {isEnabled(featureToggles, "progress") && (
          <Link href="/progress">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full border-border bg-card/50">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3 h-full">
                <div className="p-3 bg-secondary rounded-full">
                  <Camera className="w-6 h-6 text-foreground" />
                </div>
                <span className="font-semibold text-sm">Log Progress</span>
              </CardContent>
            </Card>
          </Link>
          )}
          <Link href="/coach">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full border-border bg-card/50">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3 h-full">
                <div className="p-3 bg-primary/20 rounded-full">
                  <Mic className="w-6 h-6 text-primary" />
                </div>
                <span className="font-semibold text-sm">Ask Coach</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider">GOAL</span>
              </div>
              <span className="text-lg font-bold">{goal || "Set a Goal"}</span>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Flame className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium uppercase tracking-wider">BODY FAT (EST)</span>
              </div>
              <span className="text-lg font-bold">{bodyFatLabel}</span>
            </CardContent>
          </Card>
        </div>

        <GoalPreview />

        {/* Referral banner — give a month, get a month */}
        <button
          type="button"
          onClick={() => setLocation("/refer")}
          className="w-full flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Give a month, get a month</p>
            <p className="text-xs text-muted-foreground">Refer a friend — you both get free Premium.</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </button>

        <Card className="border-border bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
              <span>MONTHLY CREDITS</span>
              <Link href="/account" className="text-primary hover:underline">Upgrade</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {isPremium ? (
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-primary" />
                <span className="font-medium">Unlimited — Premium</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>AI Coaching</span>
                    <span className="font-medium">{credits.coaching} / 4</span>
                  </div>
                  <Progress value={(credits.coaching / 4) * 100} className="h-1.5" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Photo Uploads</span>
                    <span className="font-medium">{credits.photo} / 4</span>
                  </div>
                  <Progress value={(credits.photo / 4) * 100} className="h-1.5" />
                </div>
              </>
            )}
          </CardContent>
        </Card>
        
        <div className="h-4" />
      </div>
    </MobileLayout>
  );
}
