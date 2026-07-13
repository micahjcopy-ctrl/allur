// ---------------------------------------------------------------------------
// Predictive next-set logging â "ALLUR knows what you should lift next".
//
// Pure, explainable progressive-overload logic over the existing workout
// history (WorkoutSession[]). No AI, no dependencies â it reads the last logged
// weight for an exercise and either advances the load (if the lifter hit their
// target reps) or holds it (build reps first). Deterministic + unit-tested.
// ---------------------------------------------------------------------------

import type { WorkoutSession } from "@/context/FitCoachContext";

export interface WeightSuggestion {
  weight: number;
  unit: "kg" | "lb";
  rationale: string;
  /** true when we're advising a load increase vs holding steady. */
  progressed: boolean;
}

const LB_PER_KG = 2.2046226218;

export const toKg = (w: number, unit: "kg" | "lb"): number =>
  unit === "kg" ? w : w / LB_PER_KG;
export const fromKg = (kg: number, unit: "kg" | "lb"): number =>
  unit === "kg" ? kg : kg * LB_PER_KG;

/** Round to the smallest plate change realistic in a gym (2.5 kg / 5 lb). */
export function roundToStep(weight: number, unit: "kg" | "lb"): number {
  const step = unit === "kg" ? 2.5 : 5;
  return Math.round(weight / step) * step;
}

/** Top of a target rep range: "8-12" -> 12, "10" -> 10, "8â10 reps" -> 10. */
export function topTargetReps(targetReps: string): number {
  const nums = (targetReps.match(/\d+/g) ?? []).map(Number);
  return nums.length ? Math.max(...nums) : 0;
}

/** Epley one-rep-max estimate; handy for analytics + future strength curves. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Heavier compound movements earn a bigger jump than isolation work. */
function incrementKg(exerciseName: string): number {
  const n = exerciseName.toLowerCase();
  const heavy = /(squat|deadlift|leg press|hip thrust|rdl|romanian|rack pull)/.test(n);
  return heavy ? 5 : 2.5;
}

interface PastEntry {
  weight: number;
  unit: "kg" | "lb";
  reps: number | null;
  completed: boolean;
  finishedAt: string;
}

/** Most recent finished, logged instance of an exercise (name-insensitive). */
function lastEntry(history: WorkoutSession[], name: string): PastEntry | null {
  const key = name.trim().toLowerCase();
  let best: PastEntry | null = null;
  for (const s of history) {
    if (!s.finishedAt) continue;
    for (const ex of s.exercises) {
      if (ex.name.trim().toLowerCase() !== key || ex.weight == null) continue;
      if (!best || s.finishedAt > best.finishedAt) {
        best = {
          weight: ex.weight,
          unit: ex.unit,
          reps: ex.reps,
          completed: ex.completed,
          finishedAt: s.finishedAt,
        };
      }
    }
  }
  return best;
}

/**
 * Rule-based load suggestion for the next set of `name`, expressed in
 * `displayUnit`. Returns null when there is no usable history to learn from.
 * Conservative by design: it only advances when the lifter earned it.
 */
export function suggestWeight(
  history: WorkoutSession[],
  name: string,
  targetReps: string,
  displayUnit: "kg" | "lb",
): WeightSuggestion | null {
  const last = lastEntry(history, name);
  if (!last) return null;

  const top = topTargetReps(targetReps);
  // Earned a bump? Explicit reps beat the range; otherwise a completed exercise
  // is treated as "hit it at that weight".
  const hit =
    last.reps != null ? (top > 0 ? last.reps >= top : last.reps > 0) : last.completed;

  const lastKg = toKg(last.weight, last.unit);
  const nextKg = hit ? lastKg + incrementKg(name) : lastKg;

  const lastShown = roundToStep(fromKg(lastKg, displayUnit), displayUnit);
  let weight = roundToStep(fromKg(nextKg, displayUnit), displayUnit);
  // Guarantee a visible bump when earned, even if rounding would swallow it.
  if (hit && weight <= lastShown) weight = lastShown + (displayUnit === "kg" ? 2.5 : 5);

  const progressed = hit && weight > lastShown;
  const rationale = progressed
    ? `Up from ${lastShown} ${displayUnit} â you hit your reps last time`
    : `Same as last time â lock in your reps first`;

  return { weight, unit: displayUnit, rationale, progressed };
}
