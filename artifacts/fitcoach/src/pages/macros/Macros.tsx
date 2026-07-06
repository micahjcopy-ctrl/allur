import React, { useRef, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { useFitCoach, type MacroBreakdown } from "@/context/FitCoachContext";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { OUT_OF_CREDITS_STATUS, outOfCreditsToast } from "@/lib/credits";
import { LockedFeature } from "@/components/subscription/LockedFeature";
import { Input } from "@/components/ui/input";
import { Camera, UtensilsCrossed, Sparkles, Trash2, Flame, Loader2, Pencil, Type, X, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import MealReview, { type MealAnalysisReply } from "./MealReview";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

// Read a recorded audio Blob as RAW base64 (data-URL prefix stripped — the
// transcribe endpoint decodes the string directly, and a "data:audio/...;"
// prefix corrupts the decoded bytes and breaks format detection).
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(((reader.result as string) ?? "").split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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
  // A captured photo held for the user to add a note before it's analyzed.
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const busyRef = useRef(false);
  // "Describe a meal" (no photo): typed or dictated description → AI estimate.
  const [describing, setDescribing] = useState(false);
  const [description, setDescription] = useState("");
  const [analyzingText, setAnalyzingText] = useState(false);
  const recorder = useVoiceRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const isRecording = recorder.state === "recording";

  // Record a voice note, transcribe it via /coach/transcribe, and append the
  // text to the description (same pattern as the Coach and Plan pages).
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
        setDescription((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      }
    } catch {
      toast({ variant: "destructive", title: "Couldn't transcribe", description: "We couldn't turn that into text. Please try again or type it instead." });
    } finally {
      setTranscribing(false);
    }
  };

  // Send the description to the AI for a grounded macro estimate, then open
  // the same review sheet the photo flow uses.
  const analyzeDescription = async () => {
    const desc = description.trim();
    if (!desc || analyzingText) return;
    if (!hasCredit("photo")) {
      toast(outOfCreditsToast("meal logs"));
      return;
    }
    setAnalyzingText(true);
    try {
      const res = await fetch(`${apiBase()}/api/coach/analyze-meal-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: desc }),
      });
      if (res.status === OUT_OF_CREDITS_STATUS) {
        refreshCredits();
        toast(outOfCreditsToast("meal logs"));
        return;
      }
      if (!res.ok) {
        let message = "Couldn't analyze that description. Try rephrasing what you ate.";
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
      setDescribing(false);
      setDescription("");
      setReview({ photoUrl: "", analysis: meal });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    } finally {
      setAnalyzingText(false);
    }
  };

  // Empty analysis used to open the review sheet in text-only mode (log a food
  // by name, no photo).
  const EMPTY_ANALYSIS: MealAnalysisReply = {
    name: "Meal",
    items: [],
    foods: [],
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    confidence: "low",
  };

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
    // Hold the photo so the user can add a note before it's analyzed. The
    // credit check happens at analyze time, not here.
    const reader = new FileReader();
    reader.onload = () => {
      setNote("");
      setPending(reader.result as string);
    };
    reader.onerror = () => {
      toast({ variant: "destructive", title: "Couldn't read file", description: "Please try another photo." });
    };
    reader.readAsDataURL(file);
  };

  // Kick off analysis of the held photo, sending the optional note along.
  const analyzePending = () => {
    if (!pending || busyRef.current) return;
    if (!hasCredit("photo")) {
      toast(outOfCreditsToast("photo logs"));
      return;
    }
    const url = pending;
    const noteVal = note.trim();
    setPending(null);
    busyRef.current = true;
    setAnalyzing(url);
    void analyzeMeal(url, noteVal);
  };

  const analyzeMeal = async (url: string, mealNote?: string) => {
    try {
      const photo = await downscaleImage(url);
      const res = await fetch(`${apiBase()}/api/coach/analyze-meal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photo, note: mealNote || undefined }),
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
      // Persist a small copy, never the original: full-res phone photos are
      // multi-MB as data URLs and a single one pushes the account state blob
      // past the platform's request-body limit, silently breaking ALL saves.
      const stored = await downscaleImage(url, 640, 0.72).catch(() => photo);
      setReview({ photoUrl: stored, analysis: meal });
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
        ) : pending ? (
          /* Photo captured — let the user add a note before analysis. */
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <img src={pending} alt="Your meal" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">Add a note before we analyze?</p>
                <p className="text-xs text-muted-foreground">Optional — tell the AI anything the photo can't show.</p>
              </div>
              <button
                type="button"
                onClick={() => { setPending(null); setNote(""); }}
                aria-label="Discard photo"
                className="p-1 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5">
              <Pencil className="w-3.5 h-3.5 text-primary shrink-0" />
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") analyzePending(); }}
                placeholder='e.g. "chicken thigh, not breast" · "cooked in butter"'
                className="h-10 border-0 bg-transparent px-1 text-sm focus-visible:ring-0"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={analyzePending}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Analyze meal
              </button>
              <button
                type="button"
                onClick={() => { setPending(null); setNote(""); fileInput.current?.click(); }}
                className="h-11 px-4 rounded-xl bg-secondary text-foreground font-medium"
              >
                Retake
              </button>
            </div>
          </div>
        ) : analyzingText ? (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Working it out…
              </p>
              <p className="text-sm text-muted-foreground">Estimating calories &amp; macros from your description.</p>
            </div>
          </div>
        ) : describing ? (
          /* No photo — describe the meal (typed or dictated) and let AI estimate. */
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">Tell me what you ate</p>
                <p className="text-xs text-muted-foreground">Speak it or type it — amounts help ("two eggs, a cup of rice").</p>
              </div>
              <button
                type="button"
                onClick={() => { setDescribing(false); setDescription(""); }}
                aria-label="Cancel"
                className="p-1 text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='e.g. "Grilled chicken breast, a cup of white rice, and a side salad with ranch"'
              className="resize-none h-24 bg-background/60 border-border text-sm"
            />
            <button
              type="button"
              onClick={() => void toggleRecording()}
              disabled={transcribing}
              className={cn(
                "w-full h-11 rounded-xl font-semibold inline-flex items-center justify-center gap-2 transition-colors",
                isRecording
                  ? "bg-red-500 hover:bg-red-500/90 text-white animate-pulse"
                  : "bg-secondary hover:bg-secondary/80 text-foreground",
              )}
            >
              {transcribing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Transcribing…</>
              ) : isRecording ? (
                <><Square className="w-4 h-4" /> Stop recording</>
              ) : (
                <><Mic className="w-4 h-4" /> Describe it by voice</>
              )}
            </button>
            <button
              type="button"
              onClick={() => void analyzeDescription()}
              disabled={!description.trim() || isRecording || transcribing}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" /> Estimate my macros
            </button>
            <button
              type="button"
              onClick={() => { setDescribing(false); setDescription(""); setReview({ photoUrl: "", analysis: EMPTY_ANALYSIS }); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
            >
              Skip the AI — enter foods manually
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
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
            <button
              type="button"
              onClick={() => setDescribing(true)}
              className="w-full rounded-xl border border-border bg-secondary/30 hover:bg-secondary py-3 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors"
            >
              <Mic className="w-4 h-4" /> No photo? Describe your meal
              <Type className="w-4 h-4 opacity-60" />
            </button>
          </div>
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
                          <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
                            {meal.photoUrl ? (
                              <img src={meal.photoUrl} alt={meal.name} className="object-cover w-full h-full" />
                            ) : (
                              <UtensilsCrossed className="w-7 h-7 text-muted-foreground" />
                            )}
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
