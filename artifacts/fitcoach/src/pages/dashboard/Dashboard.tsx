import React, { useEffect, useMemo, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GoalPreview } from "@/components/GoalPreview";
import { useFitCoach, dayKeyOf } from "@/context/FitCoachContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Camera, Mic, Target, Flame, Zap, UtensilsCrossed, Gift, ChevronRight, Moon, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { WelcomeTour, hasSeenTour } from "@/components/WelcomeTour";
import { GettingStarted } from "@/components/GettingStarted";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Offset (0-6) of a plan day relative to today, wrapping around the week.
const dayOffset = (dayName: string, todayIdx: number): number => {
  const idx = WEEKDAYS.findIndex((d) => d.toLowerCase() === dayName.trim().toLowerCase());
  if (idx === -1) return 99;
  return (idx - todayIdx + 7) % 7;
};

export default function Dashboard() {
  const { profile, goal, workoutPlan, credits, isPremium, meals, macroTarget, physiqueAnalyses, restDaysCompleted, toggleRestDayComplete } = useFitCoach();
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
          <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center overflow-hidden border border-border">
            <span className="font-bold text-lg">{profile.name?.[0] || "A"}</span>
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

        {/* CALORIES LEFT — the other "what do I do next" number, front and center. */}
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

        <div className="grid grid-cols-2 gap-4">
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
