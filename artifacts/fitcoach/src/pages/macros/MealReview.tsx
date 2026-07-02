import React, { useMemo, useState } from "react";
import {
  FOODS,
  foodById,
  macrosForGrams,
  per100From,
  addedFatMacros,
  cookingAdjustmentMacros,
  COOKING_METHOD_LABELS,
  confidenceLabel,
  sumMacros,
  matchFood,
  macroRange,
  sumRanges,
  rangeFraction,
  type Food,
  type FoodMacros,
  type AddedFatLevel,
  type CookingMethod,
} from "@workspace/nutrition";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useFitCoach, type MacroBreakdown } from "@/context/FitCoachContext";
import { useToast } from "@/hooks/use-toast";
import { OUT_OF_CREDITS_STATUS, outOfCreditsToast } from "@/lib/credits";
import { awardReps } from "@/lib/reps";
import {
  Check,
  Plus,
  Trash2,
  Flame,
  Pencil,
  X,
  Search,
  Droplet,
  Sparkles,
  Info,
  ChefHat,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mirror of the server's MealAnalysisReply (kept inline — fitcoach is a static
// client and does not depend on @workspace/api-zod).
export interface MealFoodItem {
  detectedName: string;
  dbMatch: string | null;
  foodId: string | null;
  category: string;
  alternatives: string[];
  confidence: number;
  portionConfidence: number;
  grams: number;
  source: "internal" | "estimated";
  cookingMethod?: CookingMethod;
  skinOn?: boolean;
  breaded?: boolean;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
export interface MealClarification {
  targetName: string | null;
  reason: string | null;
  question: string;
  options: string[];
}
export interface MealHiddenRisk {
  risk: string;
  question: string;
}
export interface MealAnalysisReply {
  name: string;
  items: string[];
  foods: MealFoodItem[];
  clarifications?: MealClarification[];
  hiddenRisks?: MealHiddenRisk[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "low" | "medium" | "high";
  biggestUncertainty?: string | null;
  note?: string | null;
}

interface ReviewItem {
  uid: string;
  detectedName: string;
  name: string;
  foodId: string | null;
  category: string;
  grams: number | null;
  per100: FoodMacros | null;
  macros: FoodMacros;
  source: "internal" | "estimated" | "added";
  confidence: number;
  portionConfidence: number;
  alternatives: string[];
  cookingMethod: CookingMethod;
  skinOn: boolean;
  breaded: boolean;
  level?: AddedFatLevel;
  riskKey?: string;
}

let uidCounter = 0;
const nextUid = () => `ri-${Date.now()}-${uidCounter++}`;

const toMacros = (f: { calories: number; protein: number; carbs: number; fat: number }): FoodMacros => ({
  calories: f.calories,
  protein: f.protein,
  carbs: f.carbs,
  fat: f.fat,
});

function toReviewItem(f: MealFoodItem): ReviewItem {
  const food = f.foodId ? foodById(f.foodId) : null;
  const per100 = food ? food.per100g : per100From(toMacros(f), f.grams);
  // If the server matched a DB food we don't have locally (catalog skew), its
  // per100 is derived from the already-cooked server macros — re-applying the
  // cooking adjustment would double-count, so trust the server value (estimated).
  const source: ReviewItem["source"] = f.source === "internal" && !food ? "estimated" : f.source;
  return {
    uid: nextUid(),
    detectedName: f.detectedName,
    name: f.dbMatch ?? f.detectedName,
    foodId: food ? f.foodId : null,
    category: f.category,
    grams: f.grams,
    per100,
    macros: toMacros(f),
    source,
    confidence: f.confidence,
    portionConfidence: f.portionConfidence,
    alternatives: f.alternatives ?? [],
    cookingMethod: f.cookingMethod ?? "unknown",
    skinOn: f.skinOn ?? false,
    breaded: f.breaded ?? false,
  };
}

function recompute(item: ReviewItem): ReviewItem {
  if (item.per100 && item.grams != null) {
    const base = macrosForGrams(item.per100, item.grams);
    // Only DB-matched items get the cooking-method adjustment layered on; an
    // "estimated" item's macros already bake in the visible cooking, and "added"
    // items have no per100, so neither double-counts.
    if (item.source === "internal") {
      const adj = cookingAdjustmentMacros(item.grams, {
        method: item.cookingMethod,
        skinOn: item.skinOn,
        breaded: item.breaded,
      });
      return { ...item, macros: sumMacros([base, adj]) };
    }
    return { ...item, macros: base };
  }
  return item;
}

const CONFIDENCE_STYLE: Record<string, string> = {
  High: "bg-primary/15 text-primary",
  "Needs confirmation": "bg-warning/15 text-warning",
  Low: "bg-red-500/15 text-red-400",
};

const ADDED_FAT_OPTIONS: { level: AddedFatLevel; label: string }[] = [
  { level: "none", label: "None" },
  { level: "light", label: "Light" },
  { level: "moderate", label: "Moderate" },
  { level: "heavy", label: "Heavy" },
  { level: "not_sure", label: "Not sure" },
];

// Methods offered as quick corrections — ordered low→high added oil.
const COOKING_METHOD_OPTIONS: CookingMethod[] = [
  "grilled",
  "baked",
  "roasted",
  "sauteed",
  "fried",
  "deep_fried",
  "unknown",
];

function FoodPicker({
  initialQuery = "",
  onPick,
  onClose,
}: {
  initialQuery?: string;
  onPick: (food: Food) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FOODS;
    return FOODS.filter(
      (f) =>
        f.canonicalName.toLowerCase().includes(q) ||
        f.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/80 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods…"
            className="pl-8 h-9"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close food picker"
          className="p-2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-52 overflow-y-auto -mx-1 px-1 space-y-1">
        {results.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            No match. Keep your typed name instead.
          </p>
        ) : (
          results.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onPick(f)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary transition-colors flex items-center justify-between gap-2"
            >
              <span className="text-sm font-medium">{f.canonicalName}</span>
              <span className="text-[10px] text-muted-foreground">
                {f.per100g.calories} kcal /100g
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function MealReview({
  photoUrl,
  analysis,
  onClose,
}: {
  photoUrl: string;
  analysis: MealAnalysisReply;
  onClose: () => void;
}) {
  const { addMeal, hasCredit, refreshCredits } = useFitCoach();
  const { toast } = useToast();

  const [mealName, setMealName] = useState(analysis.name || "Meal");
  const [note, setNote] = useState("");
  const [reanalyzing, setReanalyzing] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>(
    () => analysis.foods.map((f) => recompute(toReviewItem(f))),
  );
  const [clarifications, setClarifications] = useState<MealClarification[]>(
    () => analysis.clarifications ?? [],
  );
  const [hiddenAnswers, setHiddenAnswers] = useState<Record<string, AddedFatLevel>>({});
  const [editingUid, setEditingUid] = useState<string | null>(null);
  // Text-only mode: no photo → open the food search immediately so the user can
  // build the meal by name.
  const textOnly = !photoUrl;
  const [addingItem, setAddingItem] = useState(textOnly && analysis.foods.length === 0);

  const totals = useMemo<FoodMacros>(
    () => sumMacros(items.map((i) => i.macros)),
    [items],
  );

  // A range, not a single hard number — the spread widens when the AI was less
  // sure about portions or identification, so an uncertain estimate looks uncertain.
  const totalsRange = useMemo(
    () =>
      sumRanges(
        items.map((it) => {
          const frac =
            it.source === "added" ? 0.25 : rangeFraction(it.confidence, it.portionConfidence);
          return macroRange(it.macros, frac);
        }),
      ),
    [items],
  );

  const updateItem = (uid: string, mutate: (it: ReviewItem) => ReviewItem) =>
    setItems((prev) => prev.map((it) => (it.uid === uid ? recompute(mutate(it)) : it)));

  const setItemFood = (uid: string, food: Food) =>
    updateItem(uid, (it) => ({
      ...it,
      name: food.canonicalName,
      foodId: food.id,
      category: food.category,
      per100: food.per100g,
      grams: it.grams ?? food.defaultPortions.medium,
      source: "internal",
      confidence: 1,
      cookingMethod: "unknown",
      skinOn: false,
      breaded: false,
    }));

  const setGrams = (uid: string, grams: number) =>
    updateItem(uid, (it) => ({ ...it, grams: Math.max(1, Math.round(grams)) }));

  const setCooking = (
    uid: string,
    patch: { cookingMethod?: CookingMethod; skinOn?: boolean; breaded?: boolean },
  ) => updateItem(uid, (it) => ({ ...it, ...patch }));

  const removeItem = (uid: string) => setItems((prev) => prev.filter((it) => it.uid !== uid));

  const addFood = (food: Food) => {
    setItems((prev) => [
      ...prev,
      recompute({
        uid: nextUid(),
        detectedName: food.canonicalName,
        name: food.canonicalName,
        foodId: food.id,
        category: food.category,
        grams: food.defaultPortions.medium,
        per100: food.per100g,
        macros: food.per100g,
        source: "internal",
        confidence: 1,
        portionConfidence: 1,
        alternatives: [],
        cookingMethod: "unknown",
        skinOn: false,
        breaded: false,
      }),
    ]);
    setAddingItem(false);
  };

  const answerClarification = (clar: MealClarification, option: string) => {
    const food = matchFood(option);
    setItems((prev) => {
      // Find the item this question targets: by detectedName, else first item
      // in the same broad category, else the lowest-confidence item.
      if (prev.length === 0) return prev;
      let targetIdx = clar.targetName
        ? prev.findIndex((it) => it.detectedName.toLowerCase() === clar.targetName!.toLowerCase())
        : -1;
      if (targetIdx < 0 && food) targetIdx = prev.findIndex((it) => it.category === food.category);
      if (targetIdx < 0) {
        targetIdx = prev.reduce(
          (lo, it, idx, arr) => (it.confidence < arr[lo].confidence ? idx : lo),
          0,
        );
      }
      if (targetIdx < 0) return prev;
      return prev.map((it, idx) => {
        if (idx !== targetIdx) return it;
        if (food) {
          return recompute({
            ...it,
            name: food.canonicalName,
            foodId: food.id,
            category: food.category,
            per100: food.per100g,
            grams: it.grams ?? food.defaultPortions.medium,
            source: "internal",
            confidence: 1,
            cookingMethod: "unknown",
            skinOn: false,
            breaded: false,
          });
        }
        return { ...it, name: option, confidence: 1 };
      });
    });
    setClarifications((prev) => prev.filter((c) => c !== clar));
  };

  const answerHiddenRisk = (risk: MealHiddenRisk, level: AddedFatLevel) => {
    const key = risk.risk;
    setHiddenAnswers((prev) => ({ ...prev, [key]: level }));
    setItems((prev) => {
      const without = prev.filter((it) => it.riskKey !== key);
      if (level === "none") return without;
      return [
        ...without,
        {
          uid: nextUid(),
          detectedName: "added fat",
          name: `Added fat — ${risk.risk} (${level.replace("_", " ")})`,
          foodId: null,
          category: "fat",
          grams: null,
          per100: null,
          macros: addedFatMacros(level),
          source: "added",
          confidence: 1,
          portionConfidence: 1,
          alternatives: [],
          cookingMethod: "unknown",
          skinOn: false,
          breaded: false,
          level,
          riskKey: key,
        },
      ];
    });
  };

  // Re-run the AI analysis with a user correction the photo can't show
  // (e.g. "chicken thigh, not breast", "cooked in butter"). Replaces the
  // item list with the updated estimate; manual tweaks are re-applied by hand.
  const reanalyzeWithNote = async () => {
    const trimmed = note.trim();
    if (!trimmed || reanalyzing) return;
    if (!hasCredit("photo")) {
      toast(outOfCreditsToast("photo logs"));
      return;
    }
    setReanalyzing(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/coach/analyze-meal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photo: photoUrl, note: trimmed }),
      });
      if (res.status === OUT_OF_CREDITS_STATUS) {
        refreshCredits();
        toast(outOfCreditsToast("photo logs"));
        return;
      }
      if (!res.ok) {
        let message = "Couldn't update the analysis. Please try again.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          /* keep default message */
        }
        throw new Error(message);
      }
      const updated = (await res.json()) as MealAnalysisReply;
      refreshCredits();
      setItems(updated.foods.map((f) => recompute(toReviewItem(f))));
      setClarifications(updated.clarifications ?? []);
      setHiddenAnswers({});
      if (updated.name) setMealName(updated.name);
      setNote("");
      toast({ title: "Analysis updated", description: "Recalculated with your note." });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    } finally {
      setReanalyzing(false);
    }
  };

  const handleLog = () => {
    if (items.length === 0) {
      toast({ variant: "destructive", title: "Nothing to log", description: "Add at least one item." });
      return;
    }
    const macros: MacroBreakdown = {
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
    };
    addMeal({
      name: mealName.trim() || "Meal",
      photoUrl,
      items: items.map((i) => i.name),
      macros,
    });
    void awardReps("meal");
    toast({ title: "Meal logged", description: `${mealName.trim() || "Meal"} added to today.` });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-md p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        {textOnly ? (
          <div className="px-4 pt-5 pb-3 border-b border-border">
            <p className="text-xs font-medium uppercase tracking-wider text-primary flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Add food by name
            </p>
            <Input
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              className="mt-1 h-8 bg-transparent border-0 px-0 text-xl font-bold focus-visible:ring-0"
            />
          </div>
        ) : (
          <div className="relative">
            <img src={photoUrl} alt="Your meal" className="w-full h-32 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-xs font-medium uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Estimated breakdown
              </p>
              <Input
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                className="mt-1 h-8 bg-transparent border-0 px-0 text-xl font-bold focus-visible:ring-0"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          <p className="text-xs text-muted-foreground">
            {textOnly
              ? "Search foods below and adjust portions. Macros come from the nutrition database."
              : "These are estimates from your photo, grounded in a nutrition database. Tweak anything before logging."}
          </p>

          {/* Correction note — tell the AI what the photo can't show. Photo-only. */}
          {!textOnly && (
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <Pencil className="w-3.5 h-3.5 text-primary" /> Know something the photo doesn't show?
            </p>
            <div className="flex gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void reanalyzeWithNote();
                }}
                placeholder='e.g. "chicken thigh, not breast"'
                className="h-9 text-sm"
                disabled={reanalyzing}
              />
              <button
                type="button"
                onClick={() => void reanalyzeWithNote()}
                disabled={reanalyzing || !note.trim()}
                className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
              >
                {reanalyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Update
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Re-analyzes the photo with your note · uses 1 photo credit
            </p>
          </div>
          )}

          {/* Biggest source of uncertainty */}
          {analysis.biggestUncertainty && (
            <div className="rounded-xl border border-info/40 bg-info/5 p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold">Biggest uncertainty</p>
                <p className="text-xs text-muted-foreground">{analysis.biggestUncertainty}</p>
              </div>
            </div>
          )}

          {/* Clarification questions */}
          {clarifications.map((clar, i) => (
            <div key={i} className="rounded-xl border border-warning/40 bg-warning/5 p-3 space-y-2">
              <p className="text-sm font-semibold">{clar.question}</p>
              <div className="flex flex-wrap gap-2">
                {clar.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => answerClarification(clar, opt)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary hover:bg-secondary/70 transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Hidden calorie questions (oil / butter / sauce) */}
          {(analysis.hiddenRisks ?? []).map((risk, i) => (
            <div key={i} className="rounded-xl border border-info/40 bg-info/5 p-3 space-y-2">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Droplet className="w-4 h-4 text-info shrink-0" /> {risk.question}
              </p>
              <p className="text-xs text-muted-foreground">Cooking fats add calories you can't see.</p>
              <div className="flex flex-wrap gap-2">
                {ADDED_FAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.level}
                    type="button"
                    onClick={() => answerHiddenRisk(risk, opt.level)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                      hiddenAnswers[risk.risk] === opt.level
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-secondary/70",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Food cards */}
          <div className="space-y-3">
            {items.map((it) => {
              const label = it.source === "added" ? null : confidenceLabel(it.confidence);
              const food = it.foodId ? foodById(it.foodId) : null;
              return (
                <div key={it.uid} className="rounded-xl border border-border bg-card/50 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{it.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {it.grams != null && (
                          <span className="text-xs text-muted-foreground">Est. {it.grams}g</span>
                        )}
                        {label && (
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", CONFIDENCE_STYLE[label])}>
                            ID: {label}
                          </span>
                        )}
                        {it.source !== "added" && it.grams != null && (
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", CONFIDENCE_STYLE[confidenceLabel(it.portionConfidence)])}>
                            Portion: {confidenceLabel(it.portionConfidence)}
                          </span>
                        )}
                        {it.source === "estimated" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            Estimated
                          </span>
                        )}
                        {it.source === "internal" && it.cookingMethod !== "unknown" && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {COOKING_METHOD_LABELS[it.cookingMethod]}
                            {it.skinOn ? " · skin" : ""}
                            {it.breaded ? " · breaded" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {it.source !== "added" && (
                        <button
                          type="button"
                          onClick={() => setEditingUid(editingUid === it.uid ? null : it.uid)}
                          aria-label={`Change ${it.name}`}
                          className="p-1.5 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeItem(it.uid)}
                        aria-label={`Remove ${it.name}`}
                        className="p-1.5 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-sm font-bold">
                    <Flame className="w-4 h-4 text-primary" />
                    {it.macros.calories}
                    <span className="text-muted-foreground font-medium text-xs">kcal</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-info/15 text-info">P {it.macros.protein}g</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">C {it.macros.carbs}g</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning">F {it.macros.fat}g</span>
                  </div>

                  {/* Portion controls (gram-based items only) */}
                  {it.grams != null && it.per100 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {food &&
                        (["small", "medium", "large"] as const).map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setGrams(it.uid, food.defaultPortions[size])}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors",
                              it.grams === food.defaultPortions[size]
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary hover:bg-secondary/70",
                            )}
                          >
                            {size}
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => setGrams(it.uid, Math.max(1, Math.round(it.grams! * 0.5)))}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary hover:bg-secondary/70 transition-colors"
                      >
                        Ate half
                      </button>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          inputMode="numeric"
                          value={it.grams}
                          onChange={(e) => setGrams(it.uid, Number(e.target.value) || 1)}
                          className="h-7 w-16 text-xs px-2"
                        />
                        <span className="text-[11px] text-muted-foreground">g</span>
                      </div>
                    </div>
                  )}

                  {/* Alternatives quick-swap */}
                  {it.source !== "added" && it.alternatives.length > 0 && editingUid !== it.uid && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-muted-foreground">Or:</span>
                      {it.alternatives.slice(0, 3).map((alt) => {
                        const altFood = matchFood(alt);
                        return (
                          <button
                            key={alt}
                            type="button"
                            onClick={() => (altFood ? setItemFood(it.uid, altFood) : setEditingUid(it.uid))}
                            className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary hover:bg-secondary/70 transition-colors"
                          >
                            {alt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Cooking method correction (DB-matched items — drives hidden oil) */}
                  {editingUid === it.uid && it.source === "internal" && (
                    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
                      <p className="text-[11px] font-semibold flex items-center gap-1.5">
                        <ChefHat className="w-3.5 h-3.5 text-primary" /> How was it cooked?
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {COOKING_METHOD_OPTIONS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCooking(it.uid, { cookingMethod: m })}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                              it.cookingMethod === m
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary hover:bg-secondary/70",
                            )}
                          >
                            {COOKING_METHOD_LABELS[m]}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCooking(it.uid, { skinOn: !it.skinOn })}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                            it.skinOn
                              ? "bg-warning text-background"
                              : "bg-secondary hover:bg-secondary/70",
                          )}
                        >
                          Skin on
                        </button>
                        <button
                          type="button"
                          onClick={() => setCooking(it.uid, { breaded: !it.breaded })}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                            it.breaded
                              ? "bg-warning text-background"
                              : "bg-secondary hover:bg-secondary/70",
                          )}
                        >
                          Breaded
                        </button>
                      </div>
                    </div>
                  )}

                  {editingUid === it.uid && (
                    <FoodPicker
                      initialQuery=""
                      onPick={(f) => {
                        setItemFood(it.uid, f);
                        setEditingUid(null);
                      }}
                      onClose={() => setEditingUid(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Add item */}
          {addingItem ? (
            <FoodPicker onPick={addFood} onClose={() => setAddingItem(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAddingItem(true)}
              className="w-full rounded-xl border border-dashed border-border py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add missing item
            </button>
          )}
        </div>

        {/* Totals + actions */}
        <div className="border-t border-border bg-card/60 p-4 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimated total</p>
              <p className="text-2xl font-bold flex items-center gap-1.5">
                <Flame className="w-5 h-5 text-primary" />
                {totals.calories}
                <span className="text-sm font-medium text-muted-foreground">kcal</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Likely range ≈ {totalsRange.low.calories}–{totalsRange.high.calories} kcal
              </p>
            </div>
            <div className="flex gap-1.5">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-info/15 text-info">P {totals.protein}g</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">C {totals.carbs}g</span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning">F {totals.fat}g</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLog}
              className="flex-1 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Log meal
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
