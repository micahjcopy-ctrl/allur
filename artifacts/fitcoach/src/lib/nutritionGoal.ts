// ---------------------------------------------------------------------------
// Nutrition goal detection — did today's logged food hit the user's goal?
//
// The win looks different depending on the goal:
//   • Weight Loss (cut): ate most of the calorie budget WITHOUT going over, and
//     still hit protein — a clean, on-target day rather than "barely ate".
//   • Muscle Gain / Strength / Athleticism: reached the calorie target AND hit
//     protein — you fed the growth.
//
// Pure + unit-tested; the context fires a celebration once per day when this
// flips true.
// ---------------------------------------------------------------------------

/** Minimal structural macro shape — MacroBreakdown satisfies this. */
export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// Tunable thresholds (fractions of the daily target).
const PROTEIN_HIT = 0.9; // >= 90% of protein target counts as "hit"
const CUT_FLOOR = 0.85; // cut: must have eaten at least 85% of the budget …
const CUT_CEILING = 1.02; // … and no more than 102% (stayed under, with slack)
const GAIN_FLOOR = 0.95; // gain/strength: must reach 95% of the calorie target

export function nutritionGoalMet(
  goal: string | null | undefined,
  consumed: Macros,
  target: Macros,
): boolean {
  if (!goal) return false;
  if (!target || target.calories <= 0) return false;

  const cal = consumed.calories;
  const tcal = target.calories;
  const proteinHit =
    target.protein <= 0 ? true : consumed.protein >= target.protein * PROTEIN_HIT;

  if (!proteinHit) return false;

  if (goal === "Weight Loss") {
    // On budget: ate most of it, didn't blow past it.
    return cal >= tcal * CUT_FLOOR && cal <= tcal * CUT_CEILING;
  }

  // Muscle Gain / Strength / Athleticism (and any other build goal): hit calories.
  return cal >= tcal * GAIN_FLOOR;
}

/** A short, goal-aware line for the celebration banner. */
export function nutritionGoalMessage(goal: string | null | undefined): string {
  if (goal === "Weight Loss") return "On budget and protein in — clean cut day.";
  return "Calories and protein hit — fuelled up.";
}
