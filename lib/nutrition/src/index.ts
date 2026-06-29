export * from "./foods";
import { FOODS, type Food, type FoodMacros } from "./foods";

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Whole-phrase containment: does `needle` appear in `hay` on word boundaries?
const containsPhrase = (hay: string, needle: string): boolean =>
  ` ${hay} `.includes(` ${needle} `);

/**
 * Best-effort match of a free-text food name (as a vision model would describe
 * it) to an internal database entry. Returns null when nothing matches well, so
 * callers can fall back to an "estimated" item instead of grounding on a guess.
 */
export function matchFood(name: string): Food | null {
  const q = norm(name);
  if (!q) return null;
  let best: { food: Food; score: number } | null = null;
  for (const food of FOODS) {
    const candidates = [food.canonicalName, ...food.aliases].map(norm);
    let score = 0;
    for (const c of candidates) {
      if (!c) continue;
      if (q === c) score = Math.max(score, 1000 + c.length);
      else if (containsPhrase(q, c)) score = Math.max(score, 500 + c.length);
      else if (containsPhrase(c, q)) score = Math.max(score, 200 + q.length);
    }
    if (score > 0 && (!best || score > best.score)) best = { food, score };
  }
  return best?.food ?? null;
}

export function foodById(id: string): Food | null {
  return FOODS.find((f) => f.id === id) ?? null;
}

const r = (n: number): number => Math.max(0, Math.round(n));

/** Scale per-100g macros to a gram amount. */
export function macrosForGrams(per100g: FoodMacros, grams: number): FoodMacros {
  const f = Math.max(0, grams) / 100;
  return {
    calories: r(per100g.calories * f),
    protein: r(per100g.protein * f),
    carbs: r(per100g.carbs * f),
    fat: r(per100g.fat * f),
  };
}

export function computeMacros(food: Food, grams: number): FoodMacros {
  return macrosForGrams(food.per100g, grams);
}

/** Derive a per-100g basis from an absolute macro estimate (for foods not in the DB). */
export function per100From(macros: FoodMacros, grams: number): FoodMacros | null {
  if (grams <= 0) return null;
  const f = 100 / grams;
  return {
    calories: macros.calories * f,
    protein: macros.protein * f,
    carbs: macros.carbs * f,
    fat: macros.fat * f,
  };
}

export function sumMacros(list: FoodMacros[]): FoodMacros {
  return list.reduce<FoodMacros>(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// Rough added calories for cooking oil / butter / sauce the user confirms but
// can't quantify. Modeled as added fat (calories ≈ fat × 9).
export const ADDED_FAT_CALORIES = {
  none: 0,
  light: 40,
  moderate: 100,
  heavy: 180,
  not_sure: 75,
} as const;

export type AddedFatLevel = keyof typeof ADDED_FAT_CALORIES;

export function addedFatMacros(level: AddedFatLevel): FoodMacros {
  const calories = ADDED_FAT_CALORIES[level];
  return { calories, protein: 0, carbs: 0, fat: r(calories / 9) };
}

// How much of the plate the user actually ate.
export const PORTION_EATEN = {
  all: 1,
  three_quarters: 0.75,
  half: 0.5,
  third: 0.34,
} as const;

export type PortionEaten = keyof typeof PORTION_EATEN;

// Confidence 0..1 → user-facing label. Raw percentages are intentionally hidden.
export type ConfidenceLevel = "high" | "medium" | "low";

export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

export function confidenceLabel(score: number): string {
  const level = confidenceLevel(score);
  if (level === "high") return "High";
  if (level === "medium") return "Needs confirmation";
  return "Low";
}

// ---- Cooking-method adjustment -------------------------------------------------
// DB per-100g values assume a plain, lean preparation. How a food is cooked adds
// real (often hidden) calories — absorbed frying oil, poultry skin, breading.
// These layer ON TOP of the lean database base so the estimate reflects the plate.

export type CookingMethod =
  | "raw"
  | "grilled"
  | "baked"
  | "roasted"
  | "steamed"
  | "boiled"
  | "sauteed"
  | "fried"
  | "deep_fried"
  | "unknown";

export interface CookingAdjustment {
  method?: CookingMethod;
  skinOn?: boolean;
  breaded?: boolean;
}

// Extra absorbed-fat grams per 100g of food, by cooking method.
const METHOD_FAT_PER_100G: Record<CookingMethod, number> = {
  raw: 0,
  steamed: 0,
  boiled: 0,
  grilled: 0,
  baked: 1,
  roasted: 3,
  sauteed: 5,
  fried: 8,
  deep_fried: 12,
  unknown: 0,
};
const SKIN_FAT_PER_100G = 6; // poultry skin-on premium over skinless
const BREADING_CARBS_PER_100G = 9;
const BREADING_FAT_PER_100G = 5;

export const COOKING_METHOD_LABELS: Record<CookingMethod, string> = {
  raw: "Raw",
  grilled: "Grilled",
  baked: "Baked",
  roasted: "Roasted",
  steamed: "Steamed",
  boiled: "Boiled",
  sauteed: "Pan-fried",
  fried: "Fried",
  deep_fried: "Deep-fried",
  unknown: "Not sure",
};

/** Extra macros from how a food was cooked, on top of the lean DB base. */
export function cookingAdjustmentMacros(grams: number, adj: CookingAdjustment): FoodMacros {
  const f = Math.max(0, grams) / 100;
  let fat = METHOD_FAT_PER_100G[adj.method ?? "unknown"] ?? 0;
  let carbs = 0;
  if (adj.skinOn) fat += SKIN_FAT_PER_100G;
  if (adj.breaded) {
    fat += BREADING_FAT_PER_100G;
    carbs += BREADING_CARBS_PER_100G;
  }
  const fatG = r(fat * f);
  const carbsG = r(carbs * f);
  return { calories: r(fatG * 9 + carbsG * 4), protein: 0, carbs: carbsG, fat: fatG };
}

/** DB base macros for a gram amount, plus the cooking-method adjustment. */
export function groundedMacros(food: Food, grams: number, adj: CookingAdjustment): FoodMacros {
  return sumMacros([computeMacros(food, grams), cookingAdjustmentMacros(grams, adj)]);
}

// ---- Confidence ranges ---------------------------------------------------------
// Never present a single hard number. The spread widens as portion/identification
// confidence drops, so an unsure estimate visibly says so.

export interface MacroRange {
  low: FoodMacros;
  estimated: FoodMacros;
  high: FoodMacros;
}

/** ± fraction to spread an estimate by, driven mostly by portion uncertainty. */
export function rangeFraction(idConfidence: number, portionConfidence: number): number {
  const frac = 0.06 + (1 - portionConfidence) * 0.4 + (1 - idConfidence) * 0.12;
  return Math.min(0.6, Math.max(0.05, frac));
}

export function macroRange(m: FoodMacros, frac: number): MacroRange {
  const lo = (n: number) => r(n * (1 - frac));
  const hi = (n: number) => r(n * (1 + frac));
  return {
    low: { calories: lo(m.calories), protein: lo(m.protein), carbs: lo(m.carbs), fat: lo(m.fat) },
    estimated: { ...m },
    high: { calories: hi(m.calories), protein: hi(m.protein), carbs: hi(m.carbs), fat: hi(m.fat) },
  };
}

export function sumRanges(list: MacroRange[]): MacroRange {
  return {
    low: sumMacros(list.map((x) => x.low)),
    estimated: sumMacros(list.map((x) => x.estimated)),
    high: sumMacros(list.map((x) => x.high)),
  };
}
