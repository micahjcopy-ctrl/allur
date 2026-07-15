import React, { useState, useRef, useEffect, useMemo } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { GoalPreview } from "@/components/GoalPreview";
import { AllurScoreCard, PrShareButton } from "@/components/AllurScore";
import { useFitCoach, buildPhysiqueAnalysisFromReply, buildPhysiqueContext, composeGuideline, physiqueLabel, MuscleStatus, AnalysisConfidence, PhysiqueAnalysisReply, PHOTO_ANGLES, type PhotoAngle, type ProgressPhoto, type Workout } from "@/context/FitCoachContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { OUT_OF_CREDITS_STATUS, outOfCreditsToast, needsSubscriptionToast } from "@/lib/credits";
import { cn } from "@/lib/utils";
import { awardReps, completeQuest } from "@/lib/reps";
import { downscaleImage, compressForStorage } from "@/lib/image";
import { Camera, TrendingUp, Trophy, UploadCloud, Flame, ScanLine, Sparkles, Loader2, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronUp, Plus, ArrowUp, ArrowDown, ArrowRight, GitCompareArrows } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

const statusTextColor = (s: MuscleStatus) =>
  s === "strong" ? "text-success" : s === "developing" ? "text-warning" : "text-destructive";
const statusBarColor = (s: MuscleStatus) =>
  s === "strong" ? "bg-success" : s === "developing" ? "bg-warning" : "bg-destructive";
const statusLabel = (s: MuscleStatus) =>
  s === "strong" ? "Strong" : s === "developing" ? "Developing" : "Needs work";

const confidenceStyle = (c: AnalysisConfidence) =>
  c === "high"
    ? "bg-success/15 text-success border-success/30"
    : c === "medium"
    ? "bg-warning/15 text-warning border-warning/30"
    : "bg-destructive/15 text-destructive border-destructive/30";

const fmtNum = (n: number) => (Math.round(n * 10) / 10).toString();

// A pill showing the magnitude + direction of a week-over-week change. When the
// move is "good" (depends on the metric, e.g. body fat down is good) it's green,
// otherwise red; a near-zero change reads as a neutral "no change" dash.
function DeltaBadge({ delta, goodWhenUp = true, suffix = "" }: { delta: number; goodWhenUp?: boolean; suffix?: string }) {
  if (Math.abs(delta) < 0.05) {
    return (
      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-secondary text-muted-foreground">
        No change
      </span>
    );
  }
  const up = delta > 0;
  const good = goodWhenUp ? up : !up;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
        good ? "bg-success/15 text-success border-success/30" : "bg-destructive/15 text-destructive border-destructive/30",
      )}
    >
      <Icon className="w-3 h-3" />
      {fmtNum(Math.abs(delta))}
      {suffix}
    </span>
  );
}

// One "from → to" comparison row with a delta badge. Renders "--" for any side
// that has no value (e.g. muscle mass when bodyweight is unknown).
function StatRow({ label, from, to, suffix = "", goodWhenUp = true }: { label: string; from: number | null; to: number | null; suffix?: string; goodWhenUp?: boolean }) {
  const hasBoth = from != null && to != null;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{from != null ? `${fmtNum(from)}${suffix}` : "--"}</span>
        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="font-semibold">{to != null ? `${fmtNum(to)}${suffix}` : "--"}</span>
        {hasBoth && <DeltaBadge delta={to - from} goodWhenUp={goodWhenUp} suffix={suffix} />}
      </div>
    </div>
  );
}

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

// Resolve a week's photos into fixed Front/Side/Back slots. Photos with a
// recognized `view` claim their slot; any without one (e.g. legacy single-photo
// weeks) fill the first open slot so they still appear.
const angleMap = (
  photos: ProgressPhoto[],
): Record<PhotoAngle, ProgressPhoto | undefined> => {
  const slots: Record<PhotoAngle, ProgressPhoto | undefined> = {
    Front: undefined,
    Side: undefined,
    Back: undefined,
  };
  const leftover: ProgressPhoto[] = [];
  for (const p of photos) {
    const v = p.view as PhotoAngle | undefined;
    if (v && PHOTO_ANGLES.includes(v) && !slots[v]) slots[v] = p;
    else leftover.push(p);
  }
  for (const p of leftover) {
    const open = PHOTO_ANGLES.find((a) => !slots[a]);
    if (open) slots[open] = p;
  }
  return slots;
};

export default function Progress() {
  const { weightLogs, addWeightLog, removeWeightLog, prs, addPR, progressPhotos, addAnglePhoto, removeProgressPhoto, updateProgressBodyFat, setWeekBodyFat, profile, goal, credits, hasCredit, refreshCredits, isSubscribed, physiqueAnalyses, setPhysiqueAnalysisForWeek, workoutPlan, setWorkoutPlan, programStartDate } = useFitCoach();
  const { toast } = useToast();
  
  const [newWeight, setNewWeight] = useState("");
  const [prForm, setPrForm] = useState({ exercise: "", weight: "", reps: "" });
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [personalizing, setPersonalizing] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  // Past weeks render collapsed; this tracks which the user manually expanded.
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  // The two weeks selected in the "Compare Progress" section.
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);
  const [changesDialog, setChangesDialog] = useState<{
    updated: boolean;
    summary: string | null;
    explanation: string;
    changes: string[];
  } | null>(null);
  // The (week, angle) slot a file picker is currently filling.
  const uploadTarget = useRef<{ week: number; view: PhotoAngle } | null>(null);
  const photoInput = useRef<HTMLInputElement | null>(null);

  // Group every progress photo by week, resolving each week's Front/Side/Back
  // angle slots. Each week becomes its own analyzable unit.
  const weeks = useMemo(() => {
    const map = new Map<number, ProgressPhoto[]>();
    for (const p of progressPhotos) {
      const arr = map.get(p.week) ?? [];
      arr.push(p);
      map.set(p.week, arr);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([week, photos]) => ({ week, photos, angles: angleMap(photos) }));
  }, [progressPhotos]);

  const hasAnyPhoto = weeks.length > 0;

  // Bumped each time a week boundary passes so currentWeek recomputes live even
  // if the page is left open (no user interaction needed).
  const [weekTick, setWeekTick] = useState(() => Date.now());

  // The current real-time week of the user's program, derived from the start
  // anchor (Week 1 begins on programStartDate). Advances automatically as real
  // calendar weeks pass, so a fresh card appears each week without any action.
  const currentWeek = useMemo(() => {
    if (!programStartDate) return 1;
    const start = new Date(programStartDate).getTime();
    if (!Number.isFinite(start)) return 1;
    const elapsed = weekTick - start;
    return Math.max(1, Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000)) + 1);
  }, [programStartDate, weekTick]);

  // Schedule a one-shot timer for the exact next week boundary; bumping weekTick
  // re-runs this effect, which re-arms for the following boundary.
  useEffect(() => {
    if (!programStartDate) return;
    const start = new Date(programStartDate).getTime();
    if (!Number.isFinite(start)) return;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - start;
    const msToNext = elapsed < 0 ? -elapsed : weekMs - (elapsed % weekMs);
    const id = setTimeout(() => setWeekTick(Date.now()), msToNext + 1000);
    return () => clearTimeout(id);
  }, [programStartDate, weekTick]);

  // Weeks the user has explicitly opened (via "+ Add Week") ahead of schedule.
  const [addedWeeks, setAddedWeeks] = useState<number[]>([]);

  // The full ordered list of week numbers to render: every week from 1 up to the
  // current real-time week (auto-added as time passes), plus any weeks that have
  // photos and any future weeks the user added manually.
  const displayWeekNumbers = useMemo(() => {
    const nums = new Set<number>();
    for (let w = 1; w <= currentWeek; w++) nums.add(w);
    for (const w of weeks) nums.add(w.week);
    for (const n of addedWeeks) nums.add(n);
    return [...nums].sort((a, b) => a - b);
  }, [weeks, addedWeeks, currentWeek]);

  const maxDisplayWeek = displayWeekNumbers[displayWeekNumbers.length - 1];
  // Can't queue another empty week until the latest one has at least one photo.
  const latestWeekIsEmpty = !weeks.some((w) => w.week === maxDisplayWeek);

  const handleAddWeek = () => {
    if (latestWeekIsEmpty) return;
    const next = maxDisplayWeek + 1;
    setAddedWeeks((prev) => [...prev, next]);
    // Show the freshly-added week expanded so the user can upload right away.
    setExpandedWeeks((prev) => new Set(prev).add(next));
  };

  // Keep added (empty) weeks in sync with reality: drop any placeholder that now
  // has photos, and clear everything when all photos are gone (the timeline then
  // renders purely from the real-time week range again).
  useEffect(() => {
    setAddedWeeks((prev) => {
      if (weeks.length === 0) return prev.length === 0 ? prev : [];
      const filtered = prev.filter((n) => !weeks.some((w) => w.week === n));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [weeks]);

  // Default the analysis week to the most recent week with photos, and keep the
  // selection valid as weeks are added or removed.
  useEffect(() => {
    if (!hasAnyPhoto) {
      if (selectedWeek !== null) setSelectedWeek(null);
      return;
    }
    if (selectedWeek === null || !weeks.some((w) => w.week === selectedWeek)) {
      setSelectedWeek(weeks[weeks.length - 1].week);
    }
  }, [weeks, hasAnyPhoto, selectedWeek]);

  const selectedWeekEntry = weeks.find((w) => w.week === selectedWeek) ?? null;
  const selectedWeekPhotos = selectedWeekEntry?.photos ?? [];
  // The user's most recent week that actually has photos — their latest
  // analyzable week. Plan adjustments are gated to this week; everything before
  // it is "past" and read-only for the plan. We use the latest *uploaded* week
  // (not the calendar week) so a user who's behind schedule can still tune their
  // plan off their newest scan instead of being blocked.
  const latestAnalyzableWeek = weeks.length ? weeks[weeks.length - 1].week : currentWeek;
  // Past weeks can be (re)analyzed for stats, but they never re-tune the live
  // plan — only the latest analyzable week drives plan adjustments.
  const selectedWeekIsPast = selectedWeek != null && selectedWeek < latestAnalyzableWeek;
  const weekAnalysis =
    selectedWeek != null ? physiqueAnalyses.find((a) => a.week === selectedWeek) ?? null : null;
  // Compare the set of photo URLs (order-insensitive) so merely re-slotting the
  // same angles doesn't falsely flag the week's analysis as stale.
  const analysisSignature = [...selectedWeekPhotos.map((p) => p.url)].sort().join("|");
  const analysisIsStale =
    !weekAnalysis ||
    [...(weekAnalysis.photoUrls ?? [weekAnalysis.photoUrl])].sort().join("|") !== analysisSignature;

  // Weeks that have a completed analysis — the only weeks that can be compared.
  // Deduped so the distinct-selection invariant can't depend on upstream uniqueness.
  const analyzedWeeks = useMemo(
    () =>
      [...new Set(physiqueAnalyses.filter((a) => a.week != null).map((a) => a.week as number))].sort(
        (a, b) => a - b,
      ),
    [physiqueAnalyses],
  );

  // Default the comparison to earliest vs latest analyzed week, and keep both
  // selections valid AND distinct as analyses are added or removed. Both sides
  // are reconciled in one pass and only written when they actually change, so
  // the effect is idempotent (no render loop) and can never leave from === to.
  useEffect(() => {
    if (analyzedWeeks.length < 2) {
      if (compareFrom !== null) setCompareFrom(null);
      if (compareTo !== null) setCompareTo(null);
      return;
    }
    const from = compareFrom != null && analyzedWeeks.includes(compareFrom) ? compareFrom : analyzedWeeks[0];
    const to =
      compareTo != null && analyzedWeeks.includes(compareTo) && compareTo !== from
        ? compareTo
        : [...analyzedWeeks].reverse().find((w) => w !== from) ?? analyzedWeeks[analyzedWeeks.length - 1];
    if (from !== compareFrom) setCompareFrom(from);
    if (to !== compareTo) setCompareTo(to);
  }, [analyzedWeeks, compareFrom, compareTo]);

  const fromAnalysis = compareFrom != null ? physiqueAnalyses.find((a) => a.week === compareFrom) ?? null : null;
  const toAnalysis = compareTo != null ? physiqueAnalyses.find((a) => a.week === compareTo) ?? null : null;
  const canCompare =
    analyzedWeeks.length >= 2 && fromAnalysis != null && toAnalysis != null && compareFrom !== compareTo;
  const toDisplayMass = (kg: number | null) =>
    kg == null ? null : profile.weightUnit === "lb" ? Math.round(kg * 2.2046226218 * 10) / 10 : kg;

  // Keep each week's BF% field in sync with that week's scan midpoint. Fills only
  // photos that have no body-fat value yet, so manual entries are never lost.
  useEffect(() => {
    for (const analysis of physiqueAnalyses) {
      if (analysis.bodyFatEstimate <= 0) continue;
      const analyzedUrls = new Set(analysis.photoUrls ?? [analysis.photoUrl]);
      for (const photo of progressPhotos) {
        if (analyzedUrls.has(photo.url) && photo.bodyFat == null) {
          updateProgressBodyFat(photo.id, analysis.bodyFatEstimate);
        }
      }
    }
  }, [physiqueAnalyses, progressPhotos, updateProgressBodyFat]);

  const handleAngleFile = (file: File | undefined, week: number, view: PhotoAngle) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      // Store a compressed copy sized to ALWAYS fit the account-sync budget —
      // an oversized photo used to be silently dropped from the persisted
      // state and vanish on the next app launch.
      const raw = reader.result as string;
      const stored = await compressForStorage(raw).catch(() => raw);
      addAnglePhoto(week, view, stored);
      toast({ title: `Week ${week} · ${view} added`, description: "Add more angles or log your body fat %." });
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = async (week: number) => {
    const entry = weeks.find((w) => w.week === week);
    const photosForWeek = entry?.photos ?? [];
    if (analyzing || photosForWeek.length === 0) return;
    if (!isSubscribed) {
      toast(needsSubscriptionToast());
      return;
    }
    if (!hasCredit("bodyScan")) {
      toast(outOfCreditsToast("body scans"));
      return;
    }
    setAnalyzing(true);
    try {
      const photos = await Promise.all(photosForWeek.map((p) => downscaleImage(p.url)));
      const res = await fetch(`${apiBase()}/api/coach/analyze-physique`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          photos,
          profile: {
            gender: profile.gender,
            age: profile.age,
            height: profile.height,
            heightUnit: profile.heightUnit,
            weight: profile.weight,
            weightUnit: profile.weightUnit,
            experience: profile.experience,
            targetPhysique: physiqueLabel(profile.targetPhysique),
            goal,
          },
        }),
      });

      if (res.status === OUT_OF_CREDITS_STATUS) {
        refreshCredits();
        toast(outOfCreditsToast("body scans"));
        return;
      }
      if (!res.ok) {
        let message = "Couldn't analyze those photos. Please try clearer, well-lit photos.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          /* keep default message */
        }
        throw new Error(message);
      }

      const reply = (await res.json()) as PhysiqueAnalysisReply;
      const analysis = buildPhysiqueAnalysisFromReply(profile, photosForWeek.map((p) => p.url), reply);
      refreshCredits();
      void completeQuest("first_scan");
      void awardReps("scan");
      setPhysiqueAnalysisForWeek(week, analysis);
      // A freshly-run scan is authoritative for its week: push the new midpoint
      // onto the week's BF% so the card reflects this analysis, not a stale value.
      if (analysis.bodyFatEstimate > 0) setWeekBodyFat(week, analysis.bodyFatEstimate);
      // Only the latest analyzable week drives plan changes. Reanalyzing a past
      // week refreshes its stats (BF%, muscle ratings, comparisons) but must
      // never re-tune the live plan off an outdated snapshot.
      const isPastWeek = week < latestAnalyzableWeek;
      toast({
        title: "Analysis complete",
        description: isPastWeek
          ? `Week ${week} stats updated. Past weeks don't change your current plan.`
          : `Your Week ${week} physique breakdown is ready.`,
      });
      // Fold the fresh scan into the training plan: add volume to lagging
      // muscle groups and tune the work for the body-fat estimate.
      if (!isPastWeek) void personalizePlanFromAnalysis(analysis);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // After a fresh physique scan, ask the coach to rebalance the existing plan
  // toward the muscle groups the scan flagged as lagging and for the estimated
  // body-fat level. Best-effort: a failure leaves the current plan untouched
  // and never blocks the analysis result the user just got.
  const personalizePlanFromAnalysis = async (
    analysis: ReturnType<typeof buildPhysiqueAnalysisFromReply>,
  ) => {
    const physique = buildPhysiqueContext(analysis);
    if (!physique || workoutPlan.length === 0) return;

    setPersonalizing(true);
    try {
      const res = await fetch(`${apiBase()}/api/coach/personalize-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          goal,
          profile: {
            name: profile.name,
            experience: profile.experience,
            targetPhysique: physiqueLabel(profile.targetPhysique),
            activityLevel: profile.activityLevel,
            injuries: composeGuideline(profile.injuries, profile.injuryNotes),
            dietary: composeGuideline(profile.dietary, profile.dietaryNotes),
          },
          plan: workoutPlan,
          physique,
        }),
      });

      if (!res.ok) throw new Error(`Personalize failed (${res.status})`);
      const data = (await res.json()) as {
        planUpdated: boolean;
        planSummary?: string | null;
        explanation: string;
        changes: string[];
        updatedPlan?: Workout[] | null;
      };

      if (data.planUpdated && data.updatedPlan && data.updatedPlan.length > 0) {
        setWorkoutPlan(data.updatedPlan);
        setChangesDialog({
          updated: true,
          summary: data.planSummary ?? null,
          explanation: data.explanation,
          changes: data.changes,
        });
      } else {
        // The scan's advice can READ like a promise ("add shoulder volume"),
        // so when the coach reviews the plan and changes nothing, say so
        // explicitly — silence here looked like a broken feature.
        setChangesDialog({
          updated: false,
          summary: null,
          explanation:
            data.explanation ||
            "Your current plan already lines up with this scan, so nothing was changed.",
          changes: [],
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Plan not updated",
        description:
          "We couldn't auto-tune your plan from this scan. Re-run the analysis, or ask the AI Coach to adjust your plan.",
      });
    } finally {
      setPersonalizing(false);
    }
  };

  const handleWeightSubmit = () => {
    const w = parseFloat(newWeight);
    if (!isNaN(w)) {
      addWeightLog(w);
      void awardReps("checkin");
      setNewWeight("");
      toast({ title: "Weight logged", description: `Recorded ${w}${profile.weightUnit}` });
    }
  };

  const handlePRSubmit = () => {
    if (prForm.exercise && prForm.weight && prForm.reps) {
      addPR({ exercise: prForm.exercise, weight: prForm.weight, reps: prForm.reps, date: new Date().toISOString() });
      setPrForm({ exercise: "", weight: "", reps: "" });
      toast({ title: "PR Logged!", description: "Great job pushing those limits." });
    }
  };

  // The weight the user entered during onboarding (same unit as the logs) is the
  // true starting point — entry 1 on the chart — even before they've logged
  // anything. weightLogs never includes it, so we prepend it ourselves.
  const onboardingWeight = (() => {
    const w = parseFloat(profile.weight);
    return Number.isFinite(w) && w > 0 ? w : null;
  })();

  // Logged weights oldest → newest, then prepend the onboarding starting weight
  // so it's always point 1. The x-axis counts entries (1, 2, 3…), not dates.
  const loggedPoints = weightLogs
    .map((log) => ({
      ts: new Date(log.date).getTime(),
      date: new Date(log.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      weight: log.weight,
      isStart: false,
    }))
    .sort((a, b) => a.ts - b.ts);

  const startPoint =
    onboardingWeight != null
      ? [
          {
            ts: programStartDate ? new Date(programStartDate).getTime() : (loggedPoints[0]?.ts ?? Date.now()) - 1,
            date: "Start",
            weight: onboardingWeight,
            isStart: true,
          },
        ]
      : [];

  const chartData = [...startPoint, ...loggedPoints].map((d, i) => ({ ...d, entry: i + 1 }));

  const firstWeight = chartData.length ? chartData[0].weight : null;
  const latestWeight = chartData.length ? chartData[chartData.length - 1].weight : null;
  const weightDelta =
    firstWeight != null && latestWeight != null
      ? Math.round((latestWeight - firstWeight) * 10) / 10
      : null;

  return (
    <MobileLayout>
      <div className="p-6 space-y-8">
        <header className="pt-2">
          <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
          <p className="text-muted-foreground">Track your evolution</p>
        </header>

        <GoalPreview />

        {/* Allur Score — gamified physique score + share loop */}
        <AllurScoreCard />

        {/* Transformation Timeline */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" /> Transformation
            </h2>
            {weeks.length > 0 && (
              <span className="text-xs text-muted-foreground font-medium">{weeks.length} {weeks.length === 1 ? "week" : "weeks"}</span>
            )}
          </div>

          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const t = uploadTarget.current;
              if (t) handleAngleFile(e.target.files?.[0], t.week, t.view);
              uploadTarget.current = null;
              e.target.value = "";
            }}
          />

          <div className="space-y-3">
            {displayWeekNumbers.map((week) => {
              const entry = weeks.find((w) => w.week === week);
              const angles = entry?.angles ?? { Front: undefined, Side: undefined, Back: undefined };
              const isNew = !entry;
              const weekPhotos = entry?.photos ?? [];
              const weekBf = weekPhotos.find((p) => p.bodyFat != null)?.bodyFat ?? null;
              // Only the current real-time week stays open by default; every other
              // week (past or empty) collapses to a tappable summary row.
              const isCurrent = week === currentWeek;
              const expanded = isCurrent || expandedWeeks.has(week);

              if (!expanded) {
                return (
                  <button
                    key={week}
                    type="button"
                    onClick={() => setExpandedWeeks((s) => new Set(s).add(week))}
                    className="w-full bg-card border border-border rounded-2xl p-3 flex items-center gap-3 text-left hover:bg-secondary/40 transition-colors"
                  >
                    <div className="flex -space-x-2 shrink-0">
                      {weekPhotos.length > 0 ? (
                        weekPhotos.slice(0, 3).map((p) => (
                          <img key={p.id} src={p.url} alt={p.view ?? `Week ${week}`} className="w-9 h-12 object-cover rounded-md border-2 border-card" />
                        ))
                      ) : (
                        <div className="w-9 h-12 rounded-md bg-secondary/50 flex items-center justify-center">
                          <Camera className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm flex items-center gap-2">
                        Week {week}
                        {week === 1 && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">START</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {weekPhotos.length} {weekPhotos.length === 1 ? "photo" : "photos"}{weekBf != null ? ` · ${weekBf}% BF` : ""}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              }

              return (
                <div key={week} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {!isCurrent && (
                        <button
                          type="button"
                          onClick={() => setExpandedWeeks((s) => { const n = new Set(s); n.delete(week); return n; })}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Collapse week ${week}`}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                      )}
                      <span className="font-semibold text-sm">Week {week}</span>
                      {week === 1 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-md">START</span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] text-primary uppercase tracking-wide font-semibold">Current</span>
                      )}
                      {isNew && (
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Add photos</span>
                      )}
                    </div>
                    {!isNew && (
                      <div className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-primary shrink-0" />
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          placeholder="--"
                          value={weekBf ?? ""}
                          onChange={(e) => { const v = parseFloat(e.target.value); setWeekBodyFat(week, e.target.value === "" || !Number.isFinite(v) ? null : v); }}
                          className="h-7 w-14 px-1 text-center text-sm font-semibold bg-secondary/50 border-0"
                          aria-label={`Week ${week} body fat percentage`}
                        />
                        <span className="text-xs text-muted-foreground">% BF</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {PHOTO_ANGLES.map((view) => {
                      const photo = angles[view];
                      const slotKey = `${week}-${view}`;
                      return (
                        <div key={view} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => { uploadTarget.current = { week, view }; photoInput.current?.click(); }}
                            onDragOver={(e) => { e.preventDefault(); setDragTarget(slotKey); }}
                            onDragLeave={() => setDragTarget((d) => (d === slotKey ? null : d))}
                            onDrop={(e) => { e.preventDefault(); setDragTarget(null); handleAngleFile(e.dataTransfer.files?.[0], week, view); }}
                            className={cn(
                              "relative aspect-[3/4] w-full rounded-xl overflow-hidden border transition-colors flex flex-col items-center justify-center text-center",
                              photo
                                ? "border-border"
                                : dragTarget === slotKey
                                ? "border-primary bg-primary/10 text-primary border-dashed"
                                : "border-dashed border-border bg-secondary/40 hover:bg-secondary text-muted-foreground"
                            )}
                          >
                            {photo ? (
                              <>
                                <img src={photo.url} alt={`Week ${week} ${view}`} className="absolute inset-0 w-full h-full object-cover" />
                                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] font-medium py-0.5 uppercase tracking-wide">{view}</span>
                              </>
                            ) : (
                              <>
                                <UploadCloud className="w-5 h-5 mb-1" />
                                <span className="text-[11px] font-medium">{view}</span>
                              </>
                            )}
                          </button>
                          {photo && (
                            <button
                              type="button"
                              onClick={() => removeProgressPhoto(photo.id)}
                              className="w-full text-[10px] text-muted-foreground hover:text-destructive flex items-center justify-center gap-1"
                            >
                              <X className="w-3 h-3" /> Remove
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleAddWeek}
              disabled={latestWeekIsEmpty}
              className={cn(
                "w-full rounded-2xl border border-dashed p-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors",
                latestWeekIsEmpty
                  ? "border-border text-muted-foreground/50 cursor-not-allowed"
                  : "border-primary/40 text-primary hover:bg-primary/10"
              )}
            >
              <Plus className="w-4 h-4" />
              {latestWeekIsEmpty ? `Add photos to Week ${maxDisplayWeek} first` : `Add Week ${maxDisplayWeek + 1}`}
            </button>
          </div>

          <div className="bg-primary/5 p-3 rounded-xl border border-primary/20 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              Add Front, Side, and Back angles for each week, then run a physique analysis on any week below.
            </p>
          </div>
        </section>

        {/* AI Physique Analysis */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-primary" /> Physique Analysis
            </h2>
            <span className="text-xs text-muted-foreground font-medium">{credits.bodyScan} scans left</span>
          </div>

          {!hasAnyPhoto ? (
            <div className="bg-secondary/40 border border-dashed border-border rounded-2xl p-6 text-center">
              <Sparkles className="w-7 h-7 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Add a progress photo above to unlock AI muscle analysis — it estimates your muscle development and pinpoints strong and weak points for any week.
              </p>
            </div>
          ) : (
            <>
              {/* Week selector */}
              <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {weeks.map((w) => {
                  const hasAnalysis = physiqueAnalyses.some((a) => a.week === w.week);
                  const active = w.week === selectedWeek;
                  return (
                    <button
                      key={w.week}
                      type="button"
                      onClick={() => setSelectedWeek(w.week)}
                      className={cn(
                        "shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-colors flex items-center gap-1.5",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
                      )}
                    >
                      Week {w.week}
                      {hasAnalysis && <CheckCircle2 className={cn("w-3.5 h-3.5", active ? "text-primary-foreground" : "text-success")} />}
                    </button>
                  );
                })}
              </div>

              {analyzing || personalizing ? (
                <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center text-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                  <p className="font-semibold">{personalizing ? "Tuning your plan..." : "Analyzing your physique..."}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {personalizing
                      ? "Adding volume to lagging muscles based on your scan."
                      : "Estimating muscle development across each body part."}
                  </p>
                </div>
              ) : analysisIsStale ? (
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-3 shrink-0">
                      {selectedWeekPhotos.map((p) => (
                        <img
                          key={p.id}
                          src={p.url}
                          alt={p.view ?? `Week ${p.week}`}
                          className="w-12 h-16 object-cover rounded-lg border-2 border-card"
                        />
                      ))}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{weekAnalysis ? "New photos — rescan available" : `Scan Week ${selectedWeek}`}</p>
                      <p className="text-xs text-muted-foreground">
                        Our AI rates each muscle group across {selectedWeekPhotos.length === 1 ? "this angle" : `all ${selectedWeekPhotos.length} angles`} and highlights what to bring up.
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => selectedWeek != null && runAnalysis(selectedWeek)} disabled={credits.bodyScan <= 0 || selectedWeekPhotos.length === 0} className="w-full mt-4 rounded-full h-11 font-semibold">
                    <ScanLine className="w-4 h-4 mr-2" /> {credits.bodyScan <= 0 ? "No scans left" : `Analyze Week ${selectedWeek}`}
                  </Button>
                  {selectedWeekIsPast && (
                    <p className="text-[11px] text-muted-foreground mt-2 text-center">
                      Past week — this refreshes its stats only and won't change your current plan.
                    </p>
                  )}
                </div>
              ) : weekAnalysis ? (
                <div className="space-y-4">
                  {/* Overview */}
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-3 shrink-0">
                        {(weekAnalysis.photoUrls ?? [weekAnalysis.photoUrl]).map((url, i) => (
                          <img key={i} src={url} alt="Analyzed physique" className="w-12 h-16 object-cover rounded-lg border-2 border-card" />
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-3 flex-1 text-center">
                        <div>
                          <p className="text-2xl font-bold text-primary">{weekAnalysis.overallScore}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dev Score</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{weekAnalysis.muscleMassKg != null ? `${profile.weightUnit === "lb" ? Math.round(weekAnalysis.muscleMassKg * 2.2046226218 * 10) / 10 : weekAnalysis.muscleMassKg}` : "--"}<span className="text-xs font-medium text-muted-foreground">{profile.weightUnit}</span></p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Muscle</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{weekAnalysis.bodyFatLow}–{weekAnalysis.bodyFatHigh}<span className="text-xs font-medium text-muted-foreground">%</span></p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Body Fat</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                      <p className="text-xs text-muted-foreground">
                        Estimated range — midpoint ~{weekAnalysis.bodyFatEstimate}%
                      </p>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border", confidenceStyle(weekAnalysis.confidence))}>
                        {weekAnalysis.confidence} confidence
                      </span>
                    </div>
                  </div>

                  {/* What the AI saw */}
                  {weekAnalysis.markers.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl p-5">
                      <p className="text-sm font-semibold flex items-center gap-2 mb-3"><ScanLine className="w-4 h-4 text-primary" /> What the AI saw</p>
                      <ul className="space-y-2">
                        {weekAnalysis.markers.map((m, i) => (
                          <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                            <span className="text-primary mt-0.5 shrink-0">•</span>
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Per-muscle breakdown */}
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                    <p className="text-sm font-semibold mb-1">Muscle development</p>
                    {weekAnalysis.parts.map((p) => (
                      <div key={p.part}>
                        <div className="flex justify-between items-center text-sm mb-1">
                          <span className="font-medium">{p.part}</span>
                          <span className={cn("text-xs font-semibold", statusTextColor(p.status))}>{statusLabel(p.status)} · {p.rating}</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", statusBarColor(p.status))} style={{ width: `${p.rating}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Strengths */}
                  {weekAnalysis.strengths.length > 0 && (
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                      <p className="text-sm font-semibold flex items-center gap-2 mb-3"><CheckCircle2 className="w-4 h-4 text-primary" /> Strong points</p>
                      <div className="space-y-2.5">
                        {weekAnalysis.strengths.map((p) => (
                          <div key={p.part} className="flex gap-2">
                            <span className="text-primary text-sm font-semibold shrink-0">{p.part}</span>
                            <span className="text-xs text-muted-foreground">{p.note}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Focus areas */}
                  <div className="bg-warning/5 border border-warning/20 rounded-2xl p-5">
                    <p className="text-sm font-semibold flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-warning" /> Focus areas</p>
                    <div className="space-y-2.5">
                      {weekAnalysis.focusAreas.map((p) => (
                        <div key={p.part} className="flex gap-2">
                          <span className={cn("text-sm font-semibold shrink-0", statusTextColor(p.status))}>{p.part}</span>
                          <span className="text-xs text-muted-foreground">{p.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coach summary */}
                  <div className="bg-secondary/40 rounded-2xl p-4 flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">{weekAnalysis.summary}</p>
                  </div>

                  {/* Recommended direction */}
                  {weekAnalysis.suggestedDirection && (
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                      <p className="text-sm font-semibold flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-primary" /> Recommended direction</p>
                      <p className="text-xs text-muted-foreground">{weekAnalysis.suggestedDirection}</p>
                    </div>
                  )}

                  {/* Accuracy note */}
                  {weekAnalysis.limitations && (
                    <div className="flex items-start gap-2 px-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{weekAnalysis.limitations}</p>
                    </div>
                  )}

                  <Button onClick={() => selectedWeek != null && runAnalysis(selectedWeek)} variant="secondary" disabled={credits.bodyScan <= 0} className="w-full rounded-full h-11 font-semibold">
                    <ScanLine className="w-4 h-4 mr-2" /> {credits.bodyScan <= 0 ? "No scans left" : `Re-analyze Week ${selectedWeek}`}
                  </Button>
                  {selectedWeekIsPast && (
                    <p className="text-[11px] text-muted-foreground text-center">
                      Past week — re-analyzing refreshes its stats only and won't change your current plan.
                    </p>
                  )}
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* Compare Progress — week-over-week deltas between any two analyzed weeks */}
        {canCompare && fromAnalysis && toAnalysis && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <GitCompareArrows className="w-5 h-5 text-primary" /> Compare Progress
            </h2>

            {/* Week pickers */}
            <div className="space-y-2">
              {([
                { label: "From", value: compareFrom, set: setCompareFrom, other: compareTo },
                { label: "To", value: compareTo, set: setCompareTo, other: compareFrom },
              ] as const).map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground w-9 shrink-0">{row.label}</span>
                  <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                    {analyzedWeeks.map((w) => {
                      const active = w === row.value;
                      const disabled = w === row.other;
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => row.set(w)}
                          disabled={disabled}
                          className={cn(
                            "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : disabled
                              ? "opacity-30 cursor-not-allowed bg-secondary/50 border-border text-muted-foreground"
                              : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary",
                          )}
                        >
                          Week {w}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Photos side by side */}
            <div className="grid grid-cols-2 gap-3">
              {[fromAnalysis, toAnalysis].map((a, idx) => (
                <div key={idx} className="bg-card border border-border rounded-2xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-center">
                    Week {a.week} <span className="text-muted-foreground font-normal">· {idx === 0 ? "Before" : "After"}</span>
                  </p>
                  <div className="flex justify-center -space-x-3">
                    {(a.photoUrls ?? [a.photoUrl]).map((url, i) => (
                      <img key={i} src={url} alt={`Week ${a.week}`} className="w-12 h-16 object-cover rounded-lg border-2 border-card" />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Headline metric deltas */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <StatRow label="Body fat" from={fromAnalysis.bodyFatEstimate} to={toAnalysis.bodyFatEstimate} suffix="%" goodWhenUp={false} />
              <StatRow label="Dev score" from={fromAnalysis.overallScore} to={toAnalysis.overallScore} goodWhenUp />
              <StatRow
                label={`Est. muscle (${profile.weightUnit})`}
                from={toDisplayMass(fromAnalysis.muscleMassKg)}
                to={toDisplayMass(toAnalysis.muscleMassKg)}
                goodWhenUp
              />
            </div>

            {/* Per-muscle rating deltas */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <p className="text-sm font-semibold mb-1">Muscle development change</p>
              {toAnalysis.parts.map((tp) => {
                const fp = fromAnalysis.parts.find((p) => p.part === tp.part);
                const from = fp?.rating ?? null;
                return (
                  <div key={tp.part} className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{tp.part}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs">{from != null ? from : "--"}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-xs">{tp.rating}</span>
                      {from != null && <DeltaBadge delta={tp.rating - from} goodWhenUp />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2 px-1">
              <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                These are AI estimates from photos — lighting, angle, and pose between weeks affect the numbers, so read the trend rather than any single point.
              </p>
            </div>
          </section>
        )}

        {/* Weight */}
        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Bodyweight
            </h2>
          </div>

          <Card className="border-border bg-card/50 overflow-hidden">
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2">
                <Input 
                  type="number" 
                  placeholder={`Enter weight (${profile.weightUnit})`} 
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="bg-secondary/50 border-0"
                />
                <Button onClick={handleWeightSubmit} disabled={!newWeight}>Log</Button>
              </div>

              {chartData.length > 0 && (
                <>
                  {/* Animated summary: latest weight + total change since entry 1 */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Latest</p>
                      <motion.p
                        key={latestWeight ?? "x"}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="text-2xl font-bold tabular-nums"
                      >
                        {latestWeight}
                        <span className="text-sm font-medium text-muted-foreground ml-1">{profile.weightUnit}</span>
                      </motion.p>
                    </div>
                    {weightDelta != null && chartData.length > 1 && (
                      <motion.div
                        key={weightDelta}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                          weightDelta < 0
                            ? "bg-success/15 text-success"
                            : weightDelta > 0
                            ? "bg-info/15 text-info"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {weightDelta < 0 ? (
                          <ArrowDown className="w-3.5 h-3.5" />
                        ) : weightDelta > 0 ? (
                          <ArrowUp className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                        {Math.abs(weightDelta)} {profile.weightUnit} since start
                      </motion.div>
                    )}
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="h-48 w-full mt-2"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="entry"
                          type="number"
                          domain={[1, "dataMax"]}
                          allowDecimals={false}
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `${v}`}
                        />
                        <YAxis
                          domain={["dataMin - 2", "dataMax + 2"]}
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={32}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          itemStyle={{ color: 'hsl(var(--info))' }}
                          labelFormatter={(label: number | string) => `Entry ${label}`}
                          formatter={(value: number | string) => [`${value} ${profile.weightUnit}`, "Weight"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="weight"
                          stroke="hsl(var(--info))"
                          strokeWidth={3}
                          fill="url(#weightFill)"
                          dot={{ fill: 'hsl(var(--info))', r: 4 }}
                          activeDot={{ r: 7, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                          isAnimationActive
                          animationDuration={900}
                          animationEasing="ease-out"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                </>
              )}

              {weightLogs.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logged entries</p>
                  {[...weightLogs]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((log) => (
                      <div key={log.id} className="flex justify-between items-center p-3 rounded-xl bg-secondary/30">
                        <div>
                          <p className="font-semibold">{log.weight} {profile.weightUnit}</p>
                          <p className="text-xs text-muted-foreground">{new Date(log.date).toLocaleDateString()}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeWeightLog(log.id)}
                          aria-label="Delete weight entry"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* PRs */}
        <section className="space-y-4 pb-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" /> Personal Records
            </h2>
          </div>

          <Card className="border-border bg-card/50">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Input placeholder="Exercise" value={prForm.exercise} onChange={e => setPrForm({...prForm, exercise: e.target.value})} className="col-span-3 bg-secondary/50 border-0" />
                <Input placeholder="Weight" value={prForm.weight} onChange={e => setPrForm({...prForm, weight: e.target.value})} className="bg-secondary/50 border-0" />
                <Input placeholder="Reps" value={prForm.reps} onChange={e => setPrForm({...prForm, reps: e.target.value})} className="bg-secondary/50 border-0" />
                <Button onClick={handlePRSubmit} disabled={!prForm.exercise || !prForm.weight || !prForm.reps} className="bg-primary text-black hover:bg-primary/80">Add</Button>
              </div>

              <div className="space-y-2 mt-4">
                {prs.map(pr => (
                  <div key={pr.id} className="flex justify-between items-center p-3 rounded-xl bg-secondary/30">
                    <div>
                      <p className="font-semibold">{pr.exercise}</p>
                      <p className="text-xs text-muted-foreground">{new Date(pr.date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="text-right">
                        <p className="font-bold text-success">{pr.weight}</p>
                        <p className="text-xs text-muted-foreground">{pr.reps} reps</p>
                      </div>
                      <PrShareButton pr={pr} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={changesDialog !== null} onOpenChange={(o) => !o && setChangesDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {changesDialog?.updated ? "Plan updated from your scan" : "Plan reviewed — no changes"}
            </DialogTitle>
          </DialogHeader>
          {changesDialog && (
            <div className="space-y-4">
              {changesDialog.summary && (
                <p className="text-sm font-semibold text-primary">{changesDialog.summary}</p>
              )}
              <p className="text-sm text-muted-foreground">{changesDialog.explanation}</p>
              {changesDialog.changes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What changed</p>
                  <ul className="space-y-2">
                    {changesDialog.changes.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Button onClick={() => setChangesDialog(null)} className="w-full rounded-full h-11 font-semibold">
                Got it
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
}
