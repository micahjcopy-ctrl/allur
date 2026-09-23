export * from "./foods";
import { FOODS, type Food, type FoodMacros } from "./foods";

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9/ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Words that say HOW MUCH or add nothing to WHAT the food is. Stripped from the
// query before matching so "2 slices of ham" matches "ham" and "3 large fried
// eggs" matches "eggs". Cooking words are kept: aliases like "fried chicken" and
// "grilled salmon" rely on them.
const FILLER = new Set([
  "a", "an", "the", "of", "with", "and", "some", "my", "his", "her", "their", "our",
  "plain", "fresh", "regular", "normal", "standard", "small", "medium", "large",
  "little", "half", "whole", "extra", "x",
  "piece", "pieces", "slice", "slices", "cup", "cups", "tbsp", "tsp", "tablespoon",
  "tablespoons", "teaspoon", "teaspoons", "oz", "ounce", "ounces", "g", "gram", "grams",
  "lb", "lbs", "pound", "pounds", "serving", "servings", "portion", "bowl", "plate",
  "handful", "scoop", "scoops", "can", "bottle", "glass",
]);
// A bare number, a simple fraction (1/2, 3/4) or a number glued to a unit (8oz,
// 250g). Ratios like "80/20" (fat blend) are NOT quantities and stay in the query.
const isQuantity = (t: string): boolean =>
  /^\d+(\.\d+)?$/.test(t) || /^\d\/\d$/.test(t) || /^\d+(\.\d+)?(oz|g|lb|lbs|ml|kg)$/.test(t);

/** Tokens that describe the food itself (numbers, units and filler removed). */
export function foodTokens(name: string): string[] {
  return norm(name)
    .split(" ")
    .filter((t) => t && !isQuantity(t) && !FILLER.has(t));
}

// Whole-phrase containment: does `needle` appear in `hay` on word boundaries?
const containsPhrase = (hay: string, needle: string): boolean =>
  ` ${hay} `.includes(` ${needle} `);

/**
 * How well a database entry explains the query.
 * - exact:   the query IS the alias ("3 eggs" → "eggs").
 * - strong:  the alias covers most of the query, or is its head noun
 *            ("grilled chicken breast" → "chicken breast"; "wagyu beef patty" → "wagyu beef patty").
 * - partial: the alias is one word inside a longer, more specific phrase
 *            ("ham and cheese omelette" → "cheese") — probably the wrong entry,
 *            or the right entry on the wrong basis.
 */
export type MatchStrength = "exact" | "strong" | "partial";

export interface FoodMatch {
  food: Food;
  strength: MatchStrength;
}

/**
 * Best-effort match of a free-text food name (as a vision model or a user would
 * describe it) to an internal database entry, with a strength rating the caller
 * can use to decide how much to trust the grounded numbers. Returns null when
 * nothing matches at all.
 */
export function matchFoodDetailed(name: string): FoodMatch | null {
  const qTokens = foodTokens(name);
  const q = qTokens.join(" ");
  if (!q) return null;
  // The head noun is the last word of the PRIMARY food, i.e. before any
  // "with / plus / topped / served / on / in / over …" tail that names toppings
  // or sides: "wagyu burger with cheese" is a burger, not cheese; "oatmeal with
  // banana" is oatmeal.
  const primary = norm(name).split(/\b(?:with|plus|topped|served|on|in|over)\b/)[0] ?? "";
  const primaryTokens = foodTokens(primary);
  const head = (primaryTokens.length ? primaryTokens : qTokens)[
    (primaryTokens.length ? primaryTokens : qTokens).length - 1
  ];
  let best: { food: Food; score: number; strength: MatchStrength } | null = null;
  for (const food of FOODS) {
    const candidates = [food.canonicalName, ...food.aliases].map(norm);
    let score = 0;
    let strength: MatchStrength = "partial";
    for (const c of candidates) {
      if (!c) continue;
      const cTokens = c.split(" ");
      let sc = 0;
      let st: MatchStrength = "partial";
      if (q === c) {
        sc = 1000 + c.length;
        st = "exact";
      } else if (containsPhrase(q, c)) {
        // Alias inside the query: "grilled chicken breast" ⊃ "chicken breast".
        const coverage = cTokens.length / qTokens.length;
        const isHead = cTokens[cTokens.length - 1] === head;
        sc = 500 + c.length + (isHead ? 50 : 0);
        st = coverage >= 0.5 || isHead ? "strong" : "partial";
      } else if (containsPhrase(c, q)) {
        // Query inside the alias: "salmon" ⊂ "grilled salmon".
        sc = 200 + q.length;
        st = "strong";
      }
      if (sc > score) {
        score = sc;
        strength = st;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { food, score, strength };
  }
  return best ? { food: best.food, strength: best.strength } : null;
}

/** Back-compatible shape: just the food. */
export function matchFood(name: string): Food | null {
  return matchFoodDetailed(name)?.food ?? null;
}

/**
 * Read a portion the model reported as grams. Models occasionally send the
 * unit along ("227g", "8 oz") or ounces as a bare number; a plain Number() on
 * those is NaN and used to silently become a 100 g default — which is how an
 * 8 oz burger can turn into a 100 g one. Returns null when nothing numeric is
 * there.
 */
export function parseGrams(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;
  if (typeof raw !== "string") return null;
  const m = raw.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|ml)?/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2] ?? "";
  if (unit.startsWith("oz") || unit.startsWith("ounce")) return n * 28.35;
  if (unit.startsWith("lb") || unit.startsWith("pound")) return n * 453.6;
  return n;
}

/**
 * Decide between the database-grounded macros and the model's own estimate for
 * one item. The database wins when the two broadly agree (it is the more
 * precise source); the model wins when they are wildly apart, because that
 * almost always means the entry was the wrong food ("ham and cheese omelette" →
 * cheese) or the wrong basis (a whole-sandwich entry scaled by patty weight),
 * while the model's number reflects the full description it actually read.
 * Tolerance widens with match strength.
 */
export function reconcileWithEstimate(
  grounded: FoodMacros,
  estimate: FoodMacros | null,
  strength: MatchStrength,
): { macros: FoodMacros; source: "internal" | "estimated" } {
  if (!estimate || !(estimate.calories > 0)) return { macros: grounded, source: "internal" };
  if (!(grounded.calories > 0)) return { macros: estimate, source: "estimated" };
  const ratio = Math.max(grounded.calories, estimate.calories) / Math.min(grounded.calories, estimate.calories);
  const limit = strength === "exact" ? 2.5 : strength === "strong" ? 2.2 : 1.6;
  if (ratio > limit) return { macros: estimate, source: "estimated" };
  return { macros: grounded, source: "internal" };
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
