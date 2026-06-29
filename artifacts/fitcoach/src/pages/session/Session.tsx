import React, { useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useFitCoach, type SessionExercise } from "@/context/FitCoachContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Check,
  Camera,
  Loader2,
  Dumbbell,
  CheckCircle2,
  Flag,
} from "lucide-react";
import type { WeightAnalysisReply } from "@workspace/api-client-react";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

// Downscale a captured photo before sending it to the vision endpoint.
const downscaleImage = (src: string, maxDim = 1024, quality = 0.82): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(src);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Could not load that image."));
    img.src = src;
  });

function ExerciseRow({
  exercise,
  onToggle,
  onWeight,
  onSnap,
  snapping,
}: {
  exercise: SessionExercise;
  onToggle: () => void;
  onWeight: (weight: number | null, unit: "kg" | "lb") => void;
  onSnap: () => void;
  snapping: boolean;
}) {
  const weightStr = exercise.weight == null ? "" : String(exercise.weight);
  return (
    <Card
      className={cn(
        "border-border transition-colors",
        exercise.completed ? "bg-primary/5 border-primary/40" : "bg-card",
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label={exercise.completed ? "Mark incomplete" : "Mark complete"}
            className={cn(
              "shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors mt-0.5",
              exercise.completed
                ? "bg-primary border-primary text-black"
                : "border-muted-foreground/40 text-transparent hover:border-primary",
            )}
          >
            <Check className="w-4 h-4" strokeWidth={3} />
          </button>
          <div className="flex-1 min-w-0">
            <p className={cn("font-semibold truncate", exercise.completed && "line-through text-muted-foreground")}>
              {exercise.name}
            </p>
            <p className="text-sm text-info font-medium mt-0.5">
              {exercise.targetSets > 1
                ? `${exercise.targetSets} sets × ${exercise.targetReps}`
                : exercise.targetReps}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-10">
          <div className="flex items-center gap-1.5">
            <Input
              inputMode="decimal"
              value={weightStr}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, "");
                onWeight(raw === "" ? null : Number(raw), exercise.unit);
              }}
              placeholder="Weight"
              className="w-24 h-9"
            />
            <div className="flex bg-secondary rounded-full p-0.5">
              {(["kg", "lb"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => onWeight(exercise.weight, u)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-semibold rounded-full transition-colors",
                    exercise.unit === u
                      ? "bg-primary text-black"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onSnap}
            disabled={snapping}
            className="h-9 gap-1.5 ml-auto"
          >
            {snapping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            Snap
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Session() {
  const [, params] = useRoute("/session/:id");
  const sessionId = params?.id ?? "";
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const {
    workoutSessions,
    toggleExerciseComplete,
    logExerciseWeight,
    finishWorkoutSession,
  } = useFitCoach();

  const session = useMemo(
    () => workoutSessions.find((s) => s.id === sessionId) ?? null,
    [workoutSessions, sessionId],
  );

  const fileInput = useRef<HTMLInputElement | null>(null);
  const [snapTarget, setSnapTarget] = useState<string | null>(null);
  const snapBusy = useRef(false);

  if (!session) {
    return (
      <MobileLayout showNav={false}>
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold">Session not found</h1>
          <p className="text-muted-foreground">This workout session is no longer available.</p>
          <Button onClick={() => navigate("/plan")}>Back to Plan</Button>
        </div>
      </MobileLayout>
    );
  }

  const completedCount = session.exercises.filter((e) => e.completed).length;
  const total = session.exercises.length;
  const isFinished = !!session.finishedAt;

  const requestSnap = (exerciseName: string) => {
    if (snapBusy.current) return;
    setSnapTarget(exerciseName);
    fileInput.current?.click();
  };

  const handleFile = (file: File | undefined) => {
    const target = snapTarget;
    if (!file || !target) {
      setSnapTarget(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Not an image", description: "Please take a photo of the weight." });
      setSnapTarget(null);
      return;
    }
    snapBusy.current = true;
    const reader = new FileReader();
    reader.onload = () => void analyzeWeight(target, reader.result as string);
    reader.onerror = () => {
      snapBusy.current = false;
      setSnapTarget(null);
      toast({ variant: "destructive", title: "Couldn't read file", description: "Please try another photo." });
    };
    reader.readAsDataURL(file);
  };

  const analyzeWeight = async (exerciseName: string, url: string) => {
    try {
      const photo = await downscaleImage(url);
      const res = await fetch(`${apiBase()}/api/coach/analyze-weight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photo, exerciseName }),
      });
      if (!res.ok) {
        let message = "Couldn't read the weight. Enter it manually instead.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          /* keep default */
        }
        throw new Error(message);
      }
      const data = (await res.json()) as WeightAnalysisReply;
      if (!data.readable || data.weight <= 0) {
        toast({
          variant: "destructive",
          title: "No weight detected",
          description: "Couldn't read a weight from that photo. Enter it manually instead.",
        });
        return;
      }
      logExerciseWeight(session.id, exerciseName, data.weight, data.unit);
      toast({
        title: `Logged ${data.weight}${data.unit}`,
        description:
          data.confidence === "high"
            ? "Read from your photo."
            : "Best-effort read — double-check it's right.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't read the weight",
        description: err instanceof Error ? err.message : "Enter it manually instead.",
      });
    } finally {
      snapBusy.current = false;
      setSnapTarget(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleFinish = () => {
    finishWorkoutSession(session.id);
    toast({
      title: "Workout complete",
      description: `${completedCount} of ${total} exercises logged. Nice work.`,
    });
    navigate("/plan");
  };

  return (
    <MobileLayout showNav={false}>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="p-6 space-y-6 pb-28">
        <header className="space-y-3 pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate("/plan")}
            className="rounded-full -ml-2 gap-1 text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" /> Plan
          </Button>
          <div className="flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${total ? (completedCount / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {completedCount}/{total}
            </span>
          </div>
        </header>

        {isFinished ? (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium">
                This workout was completed. Snap a weight to update your log next time.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-3">
          {session.exercises.map((ex) => (
            <ExerciseRow
              key={ex.name}
              exercise={ex}
              onToggle={() => toggleExerciseComplete(session.id, ex.name)}
              onWeight={(weight, unit) => logExerciseWeight(session.id, ex.name, weight, unit)}
              onSnap={() => requestSnap(ex.name)}
              snapping={snapTarget === ex.name}
            />
          ))}
        </div>
      </div>

      {!isFinished ? (
        <div className="fixed bottom-0 inset-x-0 max-w-md mx-auto p-4 bg-gradient-to-t from-background via-background to-transparent">
          <Button onClick={handleFinish} className="w-full h-12 rounded-xl font-bold gap-2">
            <Flag className="w-4 h-4" /> Finish Workout
          </Button>
        </div>
      ) : null}
    </MobileLayout>
  );
}
