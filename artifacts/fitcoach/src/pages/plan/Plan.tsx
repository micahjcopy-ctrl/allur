import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useFitCoach, composeGuideline, composeEquipment, composeDislikes, composePreferences, buildPhysiqueContext, physiqueLabel, type Goal, type UserProfile, type Workout, type WorkoutExercise } from "@/context/FitCoachContext";
import { buildExerciseDetail } from "@/data/exerciseOptimizer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import { OUT_OF_CREDITS_STATUS, outOfCreditsToast, needsSubscriptionToast } from "@/lib/credits";
import { getExerciseGuide, exerciseImage, type ExerciseGuide } from "@/data/exerciseGuide";
import { cn } from "@/lib/utils";
import {
  Calendar, Play, Mic, Square, Loader2, RefreshCw, Dumbbell, Repeat, Gauge, HeartPulse, Beef, Target,
  ChevronRight, CheckCircle2, Sun, Moon, ListChecks,
} from "lucide-react";
import { motion } from "framer-motion";

// Read a recorded audio Blob as a base64 data string for the transcribe endpoint.
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Offset (0-6) of a workout's day relative to today, so we can order the week
// starting from today and wrapping around.
const dayOffset = (dayName: string, todayIdx: number): number => {
  const idx = WEEKDAYS.findIndex((d) => d.toLowerCase() === dayName.trim().toLowerCase());
  if (idx === -1) return 99;
  return (idx - todayIdx + 7) % 7;
};

function MuscleTags({ muscles }: { muscles: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {muscles.map((m) => (
        <span key={m} className="text-[11px] font-medium bg-secondary/70 text-muted-foreground rounded-full px-2.5 py-1">
          {m}
        </span>
      ))}
    </div>
  );
}

// Image with graceful fallback if the demo asset is missing.
function ExerciseDemoImage({ guide, name }: { guide: ExerciseGuide | null; name: string }) {
  const [errored, setErrored] = useState(false);
  if (!guide || errored) {
    return (
      <div className="aspect-[4/3] w-full rounded-2xl bg-secondary/50 border border-border flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Dumbbell className="w-10 h-10" />
        <span className="text-xs">{name}</span>
      </div>
    );
  }
  return (
    <img
      src={exerciseImage(guide.slug)}
      alt={`${guide.name} demonstration`}
      onError={() => setErrored(true)}
      className="aspect-[4/3] w-full rounded-2xl object-cover border border-border bg-secondary/30"
    />
  );
}

function ExerciseDetailDialog({
  exercise, profile, goal, open, onOpenChange,
}: { exercise: WorkoutExercise | null; profile: UserProfile; goal: Goal; open: boolean; onOpenChange: (v: boolean) => void }) {
  const guide = exercise ? getExerciseGuide(exercise.name) : null;
  const guidance = exercise ? buildExerciseDetail(exercise, profile, goal) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92%] max-h-[88vh] overflow-y-auto rounded-3xl border-border bg-card p-0">
        {exercise && (
          <div>
            <div className="p-5 pb-0">
              <ExerciseDemoImage guide={guide} name={exercise.name} />
            </div>
            <div className="p-5 space-y-4">
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-xl">{exercise.name}</DialogTitle>
                <p className="text-sm">
                  <span className="text-info font-semibold">{exercise.sets > 1 ? `${exercise.sets} sets × ${exercise.reps}` : exercise.reps}</span>
                  {exercise.rest && exercise.rest !== "—" ? <span className="text-muted-foreground"> • {exercise.rest} rest</span> : ""}
                </p>
              </DialogHeader>

              {guidance && (
                <>
                  <div className="space-y-2 bg-primary/10 rounded-2xl p-4">
                    <p className="text-[11px] uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" /> How hard to go — {guidance.intensityShort}
                    </p>
                    <p className="text-sm leading-snug text-foreground/90">{guidance.intensity}</p>
                  </div>

                  {guidance.alternatives.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-[11px] uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                        <Repeat className="w-3.5 h-3.5" /> Swap it — 2 alternatives
                      </p>
                      <div className="space-y-2">
                        {guidance.alternatives.map((alt, i) => (
                          <div key={i} className="flex gap-2.5 bg-secondary/40 rounded-2xl p-3">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium leading-snug">{alt.name}</p>
                              <p className="text-xs text-muted-foreground leading-snug mt-0.5">{alt.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {guide ? (
                <>
                  <MuscleTags muscles={guide.muscles} />
                  <p className="text-sm leading-relaxed text-foreground/90">{guide.summary}</p>

                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                      <ListChecks className="w-3.5 h-3.5" /> How to do it
                    </p>
                    <ol className="space-y-2">
                      {guide.steps.map((s, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span className="leading-snug text-foreground/90">{s}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="space-y-2 bg-secondary/40 rounded-2xl p-4">
                    <p className="text-[11px] uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" /> Coach's form cues
                    </p>
                    <ul className="space-y-1.5">
                      {guide.cues.map((c, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground/90">
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span className="leading-snug">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {exercise.note && (
                    <div className="flex items-start gap-2 bg-primary/10 rounded-2xl p-3">
                      <Dumbbell className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-xs leading-snug">{exercise.note}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  A detailed form guide for this exercise is coming soon. Ask your AI Coach for tips in the meantime.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Small square thumbnail with an icon fallback when the demo image is missing.
function ExerciseThumb({ slug }: { slug: string | null }) {
  const [errored, setErrored] = useState(false);
  if (!slug || errored) {
    return <Dumbbell className="w-5 h-5 text-muted-foreground" />;
  }
  return (
    <img
      src={exerciseImage(slug)}
      alt=""
      onError={() => setErrored(true)}
      className="w-full h-full object-cover"
    />
  );
}

function WorkoutCard({
  day, isToday, profile, goal, onExercise, onStart,
}: { day: Workout; isToday?: boolean; profile: UserProfile; goal: Goal; onExercise: (ex: WorkoutExercise) => void; onStart: (day: Workout) => void }) {
  return (
    <Card className={cn(
      "border-border overflow-hidden",
      isToday ? "bg-card border-primary/50 shadow-[0_0_0_1px_rgba(199,205,212,0.25)]" : "bg-card/50",
    )}>
      <div className="divide-y divide-border">
        {day.exercises.map((ex, j) => {
          const guide = getExerciseGuide(ex.name);
          const guidance = buildExerciseDetail(ex, profile, goal);
          return (
            <button
              key={j}
              onClick={() => onExercise(ex)}
              className="w-full p-4 flex items-center gap-3 text-left hover:bg-secondary/40 transition-colors"
            >
              <div className="shrink-0 w-12 h-12 rounded-xl bg-secondary/60 border border-border overflow-hidden flex items-center justify-center">
                <ExerciseThumb slug={guide?.slug ?? null} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{ex.name}</p>
                <p className="text-sm mt-0.5">
                  <span className="text-info font-semibold">{ex.sets > 1 ? `${ex.sets} sets × ${ex.reps}` : ex.reps}</span>
                  {ex.rest && ex.rest !== "—" ? <span className="text-muted-foreground"> • {ex.rest} rest</span> : ""}
                </p>
                <p className="text-xs text-primary/90 mt-1 flex items-center gap-1 truncate">
                  <Gauge className="w-3 h-3 shrink-0" /> {guidance.intensityShort}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>
      <div className="p-3 bg-secondary/50 border-t border-border flex justify-center">
        <Button
          onClick={() => onStart(day)}
          variant={isToday ? "default" : "ghost"}
          className="w-full text-xs uppercase tracking-wider font-bold gap-2"
        >
          <Play className="w-3.5 h-3.5 fill-current" /> Start Workout
        </Button>
      </div>
    </Card>
  );
}

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

export default function Plan() {
  const { workoutPlan, programMeta, hasCredit, refreshCredits, isSubscribed, profile, goal, setWorkoutPlan, physiqueAnalysis, startWorkoutSession } = useFitCoach();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleStartWorkout = (day: Workout) => {
    if (!isSubscribed) {
      toast(needsSubscriptionToast());
      return;
    }
    const id = startWorkoutSession(day);
    navigate(`/session/${id}`);
  };
  const [requestText, setRequestText] = useState("");
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<WorkoutExercise | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const recorder = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const isRecording = recorder.state === "recording";

  // Record a voice note, transcribe it via /coach/transcribe, and append the
  // text into the adjustment field (mirrors Coach/Onboarding).
  const toggleRecording = async () => {
    if (transcribing) return;
    if (!isRecording) {
      try {
        await recorder.startRecording();
      } catch {
        toast({ variant: "destructive", title: "Microphone unavailable", description: "Check your browser's mic permissions and try again." });
      }
      return;
    }
    const blob = await recorder.stopRecording();
    if (!blob.size) return;
    setTranscribing(true);
    try {
      const audio = await blobToBase64(blob);
      const res = await fetch(`${apiBase()}/api/coach/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ audio, audioFormat: "webm" }),
      });
      if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
      const data = (await res.json()) as { text: string };
      const text = data.text?.trim();
      if (text) {
        setRequestText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      }
    } catch {
      toast({ variant: "destructive", title: "Couldn't transcribe", description: "We couldn't turn that into text. Please try again or type it instead." });
    } finally {
      setTranscribing(false);
    }
  };

  const todayIdx = new Date().getDay();
  const todayName = WEEKDAYS[todayIdx];

  // Order the week starting from today, wrapping around.
  const ordered = useMemo(() => {
    return [...workoutPlan]
      .map((w) => ({ w, offset: dayOffset(w.dayName, todayIdx) }))
      .sort((a, b) => a.offset - b.offset);
  }, [workoutPlan, todayIdx]);

  const todayWorkout = ordered.find((o) => o.offset === 0)?.w ?? null;
  const upcoming = ordered.filter((o) => o.w !== todayWorkout).map((o) => o.w);
  const nextWorkout = !todayWorkout ? (ordered[0]?.w ?? null) : null;
  const restOfWeek = nextWorkout ? upcoming.filter((w) => w !== nextWorkout) : upcoming;

  const openExercise = (ex: WorkoutExercise) => {
    setSelectedExercise(ex);
    setDetailOpen(true);
  };

  const handleRequest = async () => {
    const trimmed = requestText.trim();
    if (!trimmed || sending) return;

    if (!isSubscribed) {
      toast(needsSubscriptionToast());
      return;
    }

    if (!hasCredit("coaching")) {
      toast(outOfCreditsToast("coaching requests"));
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${apiBase()}/api/coach/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: [{ role: "user", content: trimmed }],
          goal,
          profile: {
            name: profile.name,
            experience: profile.experience,
            targetPhysique: physiqueLabel(profile.targetPhysique),
            activityLevel: profile.activityLevel,
            injuries: composeGuideline(profile.injuries, profile.injuryNotes),
            dietary: composeGuideline(profile.dietary, profile.dietaryNotes),
            equipment: composeEquipment(profile),
            dislikes: composeDislikes(profile),
            preferences: composePreferences(profile),
          },
          plan: workoutPlan,
          physique: buildPhysiqueContext(physiqueAnalysis),
        }),
      });

      if (res.status === OUT_OF_CREDITS_STATUS) {
        refreshCredits();
        toast(outOfCreditsToast("coaching requests"));
        return;
      }
      if (!res.ok) throw new Error(`Coach request failed (${res.status})`);
      const data = (await res.json()) as {
        reply: string;
        planUpdated: boolean;
        planSummary?: string | null;
        updatedPlan?: Workout[] | null;
      };

      if (data.planUpdated && data.updatedPlan) {
        setWorkoutPlan(data.updatedPlan);
        toast({ title: "Plan updated", description: data.planSummary ?? "Your training plan was adjusted." });
      } else {
        toast({ title: "Coach replied", description: data.reply });
      }
      refreshCredits();
      setRequestText("");
      setOpen(false);
    } catch {
      toast({ variant: "destructive", title: "Coach unavailable", description: "Couldn't reach your AI coach. Please try again." });
    } finally {
      setSending(false);
    }
  };

  if (!workoutPlan || workoutPlan.length === 0) {
    return (
      <MobileLayout>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Calendar className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Plan Found</h2>
          <p className="text-muted-foreground mb-6">Complete onboarding to generate your AI training plan.</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-6 space-y-6">
        <header className="flex justify-between items-end pt-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Plan</h1>
            <p className="text-muted-foreground">{todayName} • Today first</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline" className="rounded-full w-10 h-10 border-border bg-card">
                <RefreshCw className="w-4 h-4 text-primary" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md w-[90%] rounded-3xl border-border bg-card">
              <DialogHeader>
                <DialogTitle>Request AI Adjustment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Textarea
                  placeholder="E.g. I injured my knee, need upper body only for a few days."
                  className="resize-none h-32 bg-secondary/50 border-0"
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={toggleRecording}
                  disabled={transcribing}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 rounded-xl text-foreground",
                    isRecording ? "bg-red-500 hover:bg-red-500/90 text-white animate-pulse" : "bg-secondary hover:bg-secondary/80"
                  )}
                  variant="secondary"
                >
                  {transcribing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Transcribing…</>
                  ) : isRecording ? (
                    <><Square className="w-4 h-4" /> Stop recording</>
                  ) : (
                    <><Mic className="w-4 h-4" /> Or send voice note</>
                  )}
                </Button>
                <Button onClick={handleRequest} className="w-full rounded-xl" disabled={!requestText.trim() || sending}>
                  {sending ? "Coach is working…" : "Send Request (1 Credit)"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        {/* TODAY */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5" /> Today
            </span>
            <span className="text-sm text-muted-foreground">{todayName}</span>
          </div>

          {todayWorkout ? (
            <>
              <h3 className="text-lg font-bold">{todayWorkout.title}</h3>
              <WorkoutCard day={todayWorkout} isToday profile={profile} goal={goal} onExercise={openExercise} onStart={handleStartWorkout} />
            </>
          ) : (
            <>
              <Card className="border-border bg-card/50">
                <CardContent className="p-5 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-secondary/60 flex items-center justify-center shrink-0">
                    <Moon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">Rest day</p>
                    <p className="text-sm text-muted-foreground">Recover, walk, and refuel. Ask your AI Coach to add a session if you want to train.</p>
                  </div>
                </CardContent>
              </Card>
              {nextWorkout && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-primary/15 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Next up
                    </span>
                    <span className="text-sm text-muted-foreground">{nextWorkout.dayName} • {nextWorkout.title}</span>
                  </div>
                  <WorkoutCard day={nextWorkout} profile={profile} goal={goal} onExercise={openExercise} onStart={handleStartWorkout} />
                </div>
              )}
            </>
          )}
        </motion.section>

        {/* PROGRAM SUMMARY */}
        {programMeta && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border bg-card overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-primary font-bold">{programMeta.goalLabel}</p>
                    <h2 className="text-xl font-bold mt-0.5">{programMeta.splitName}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {programMeta.daysPerWeek} days/week • {programMeta.experience}
                    </p>
                  </div>
                  <div className="bg-primary/15 text-primary rounded-2xl w-12 h-12 flex items-center justify-center shrink-0">
                    <Dumbbell className="w-6 h-6" />
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">{programMeta.philosophy}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/40 rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Repeat className="w-3.5 h-3.5" />
                      <span className="text-[11px] uppercase tracking-wider font-bold">Reps</span>
                    </div>
                    <p className="text-xs leading-snug">{programMeta.repScheme}</p>
                  </div>
                  <div className="bg-secondary/40 rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Gauge className="w-3.5 h-3.5" />
                      <span className="text-[11px] uppercase tracking-wider font-bold">Volume</span>
                    </div>
                    <p className="text-xs leading-snug">{programMeta.weeklyVolume}</p>
                  </div>
                  <div className="bg-secondary/40 rounded-2xl p-3 col-span-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Dumbbell className="w-3.5 h-3.5" />
                      <span className="text-[11px] uppercase tracking-wider font-bold">Weekly Set Target</span>
                    </div>
                    <p className="text-xs leading-snug">{programMeta.volumeTarget}</p>
                  </div>
                  <div className="bg-secondary/40 rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span className="text-[11px] uppercase tracking-wider font-bold">Cardio</span>
                    </div>
                    <p className="text-xs leading-snug">{programMeta.cardio}</p>
                  </div>
                  <div className="bg-secondary/40 rounded-2xl p-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Beef className="w-3.5 h-3.5" />
                      <span className="text-[11px] uppercase tracking-wider font-bold">Protein</span>
                    </div>
                    <p className="text-xs leading-snug">{programMeta.proteinNote}</p>
                  </div>
                </div>

                <div className="bg-secondary/40 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ListChecks className="w-3.5 h-3.5" />
                    <span className="text-[11px] uppercase tracking-wider font-bold">Hard Sets Per Muscle / Week</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {programMeta.perMuscleVolume.map((m) => (
                      <div key={m.muscle} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{m.muscle}</span>
                        <span className="font-semibold tabular-nums">{m.sets}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground pt-1 border-t border-border/40">{programMeta.setQuality}</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">{programMeta.volumeDiminishingReturns}</p>
                </div>

                {programMeta.emphasis && (
                  <div className="flex items-start gap-2 bg-primary/10 rounded-2xl p-3">
                    <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs leading-snug text-foreground">{programMeta.emphasis}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* REST OF THE WEEK */}
        {restOfWeek.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Rest of your week</h2>
            {restOfWeek.map((day, i) => (
              <motion.div
                key={`${day.dayName}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {day.dayName}
                  </div>
                  <h3 className="font-semibold">{day.title}</h3>
                </div>
                <WorkoutCard day={day} profile={profile} goal={goal} onExercise={openExercise} onStart={handleStartWorkout} />
              </motion.div>
            ))}
          </div>
        )}

        <div className="h-4" />
      </div>

      <ExerciseDetailDialog exercise={selectedExercise} profile={profile} goal={goal} open={detailOpen} onOpenChange={setDetailOpen} />
    </MobileLayout>
  );
}
