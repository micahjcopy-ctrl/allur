import React, { useRef, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useFitCoach, type MacroBreakdown } from "@/context/FitCoachContext";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { OUT_OF_CREDITS_STATUS, outOfCreditsToast } from "@/lib/credits";
import { LockedFeature } from "@/components/subscription/LockedFeature";
import { Camera, UtensilsCrossed, Sparkles, Trash2, Flame, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import MealReview, { type MealAnalysisReply } from "./MealReview";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

// Downscale a captured photo before sending it to the vision endpoint. Phone
// photos are multi-MB; ~1024px on the long edge keeps the request small and
// fast while leaving enough detail to identify a meal.
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

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min((value / target) * 100, 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-semibold">
          {value}<span className="text-muted-foreground font-normal">/{target}g</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Macros() {
  const { meals, macroTarget, removeMeal, hasCredit, refreshCredits, isSubscribed } = useFitCoach();
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [review, setReview] = useState<{ photoUrl: string; analysis: MealAnalysisReply } | null>(null);
  const busyRef = useRef(false);

  const today = new Date().toDateString();
  const todayMeals = meals.filter(m => new Date(m.date).toDateString() === today);

  const consumed = todayMeals.reduce<MacroBreakdown>(
    (acc, m) => ({
      calories: acc.calories + m.macros.calories,
      protein: acc.protein + m.macros.protein,
      carbs: acc.carbs + m.macros.carbs,
      fat: acc.fat + m.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const calPct = Math.min((consumed.calories / macroTarget.calories) * 100, 100);
  const calRemaining = macroTarget.calories - consumed.calories;

  const handleFile = (file: File | undefined) => {
    if (busyRef.current) return;
    if (!file || !file.type.startsWith("image/")) {
      if (file) toast({ variant: "destructive", title: "Not an image", description: "Please choose a photo of your meal." });
      return;
    }
    if (!hasCredit("photo")) {
      toast(outOfCreditsToast("photo logs"));
      return;
    }
    busyRef.current = true;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setAnalyzing(url);
      void analyzeMeal(url);
    };
    reader.onerror = () => {
      busyRef.current = false;
      setAnalyzing(null);
      toast({ variant: "destructive", title: "Couldn't read file", description: "Please try another photo." });
    };
    reader.readAsDataURL(file);
  };

  const analyzeMeal = async (url: string) => {
    try {
      const photo = await downscaleImage(url);
      const res = await fetch(`${apiBase()}/api/coach/analyze-meal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photo }),
      });

      if (res.status === OUT_OF_CREDITS_STATUS) {
        refreshCredits();
        toast(outOfCreditsToast("photo logs"));
        return;
      }
      if (!res.ok) {
        let message = "Couldn't analyze that photo. Please try a clearer photo of your meal.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          /* keep default message */
        }
        throw new Error(message);
      }

      const meal = (await res.json()) as MealAnalysisReply;
      refreshCredits();
      setReview({ photoUrl: url, analysis: meal });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    } finally {
      setAnalyzing(null);
      busyRef.current = false;
    }
  };

  if (!isSubscribed) {
    return (
      <MobileLayout>
        <LockedFeature
          title="Macro tracking is locked"
          description="Snap a meal and let AI count your calories and macros with ALLUR Base. Reactivate to start tracking again."
        />
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="p-6 space-y-6">
        <header className="pt-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="w-7 h-7 text-primary" /> Macros
          </h1>
          <p className="text-muted-foreground">Snap your meals, let AI count the rest</p>
        </header>

        {/* Daily summary */}
        <Card className="border-border bg-hero-gradient overflow-hidden">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Today</p>
                <p className="text-3xl font-bold">
                  {consumed.calories}
                  <span className="text-base font-medium text-muted-foreground"> / {macroTarget.calories} kcal</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{calRemaining >= 0 ? "Remaining" : "Over"}</p>
                <p className={cn("text-lg font-bold", calRemaining >= 0 ? "text-primary" : "text-warning")}>
                  {Math.abs(calRemaining)}
                </p>
              </div>
            </div>

            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${calPct}%` }} />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <MacroBar label="Protein" value={consumed.protein} target={macroTarget.protein} color="bg-info" />
              <MacroBar label="Carbs" value={consumed.carbs} target={macroTarget.carbs} color="bg-primary" />
              <MacroBar label="Fat" value={consumed.fat} target={macroTarget.fat} color="bg-warning" />
            </div>
          </CardContent>
        </Card>

        {/* Snap a meal */}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
        />

        {analyzing ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 relative">
              <img src={analyzing} alt="Analyzing meal" className="object-cover w-full h-full" />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Analyzing meal…
              </p>
              <p className="text-sm text-muted-foreground">Estimating calories &amp; macros from your photo.</p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFile(e.dataTransfer.files?.[0]); }}
            className={cn(
              "w-full rounded-2xl border border-dashed p-6 flex flex-col items-center justify-center text-center gap-2 transition-colors",
              dragActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/40 hover:bg-secondary text-foreground"
            )}
          >
            <div className="p-3 bg-primary/20 rounded-full">
              <Camera className="w-6 h-6 text-primary" />
            </div>
            <span className="font-semibold">Snap a meal</span>
            <span className="text-xs text-muted-foreground">
              <span className="hidden sm:inline">Drop a photo or click to upload</span>
              <span className="sm:hidden">Take a photo or pick from library</span>
            </span>
          </button>
        )}

        {/* Meal log */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Today's meals</h2>
            {todayMeals.length > 0 && (
              <span className="text-xs text-muted-foreground font-medium">{todayMeals.length} logged</span>
            )}
          </div>

          {todayMeals.length === 0 && !analyzing ? (
            <div className="flex flex-col items-center justify-center p-8 bg-secondary/40 rounded-2xl border border-dashed border-border text-center">
              <UtensilsCrossed className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No meals logged yet today.</p>
              <p className="text-xs text-muted-foreground mt-1">Snap your first meal to start counting.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {todayMeals.map((meal) => (
                  <motion.div
                    key={meal.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className="border-border bg-card/50 overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex gap-3">
                          <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-secondary">
                            <img src={meal.photoUrl} alt={meal.name} className="object-cover w-full h-full" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{meal.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{meal.items.join(", ")}</p>
                              </div>
                              <button
                                onClick={() => removeMeal(meal.id)}
                                aria-label={`Remove ${meal.name}`}
                                className="text-muted-foreground hover:text-red-400 transition-colors shrink-0 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1 mt-1.5 text-sm font-bold">
                              <Flame className="w-4 h-4 text-primary" />
                              {meal.macros.calories} <span className="text-muted-foreground font-medium text-xs">kcal</span>
                            </div>
                            <div className="flex gap-1.5 mt-2">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-info/15 text-info">P {meal.macros.protein}g</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">C {meal.macros.carbs}g</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning">F {meal.macros.fat}g</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <div className="h-4" />
      </div>

      {review && (
        <MealReview
          photoUrl={review.photoUrl}
          analysis={review.analysis}
          onClose={() => setReview(null)}
        />
      )}
    </MobileLayout>
  );
}
