// ---------------------------------------------------------------------------
// Auto PR detection â "records the moment they happen".
//
// Pure logic over the finished workout history. When a session is completed we
// compare each logged lift against every prior instance (estimated-1RM basis,
// canonical kg) and surface the ones that beat the old best. Sessions log a
// working weight (reps optional), so a weight PR is the common case. The hits
// drive both the celebration overlay and the auto-populated PR list â which
// then feed the share-card growth loop.
// ---------------------------------------------------------------------------

import type { PR, WorkoutSession } from "@/context/FitCoachContext";
import { estimateOneRepMax, toKg } from "@/lib/predict";

export interface PrHit {
  exercise: string;
  weight: number; // in the unit it was logged
  unit: "kg" | "lb";
  reps: number | null;
  targetReps: string;
  e1rmKg: number; // canonical estimated 1RM for the new effort
  previousKg: number; // previous best e1RM (canonical)
}

/** Effort as an estimated 1RM in kg. Falls back to raw load when reps are absent. */
function effortKg(weightInUnit: number, unit: "kg" | "lb", reps: number | null): number {
  const kg = toKg(weightInUnit, unit);
  return reps && reps > 0 ? estimateOneRepMax(kg, reps) : kg;
}

/** Best estimated-1RM (kg) for an exercise across finished history. */
function bestE1rmKg(history: WorkoutSession[], name: string, excludeId: string): number {
  const key = name.trim().toLowerCase();
  let best = 0;
  for (const s of history) {
    if (!s.finishedAt || s.id === excludeId) continue;
    for (const ex of s.exercises) {
      if (ex.name.trim().toLowerCase() !== key || ex.weight == null) continue;
      const e = effortKg(ex.weight, ex.unit, ex.reps);
      if (e > best) best = e;
    }
  }
  return best;
}

/**
 * Detect strength PRs in a just-finished session against prior finished history.
 * A PR = a completed, logged lift whose estimated 1RM beats every prior instance.
 * First-ever lifts establish a baseline silently (no prior best => not a record),
 * which keeps a brand-new user's first workout from firing a dozen "PRs".
 */
export function detectPRs(session: WorkoutSession, history: WorkoutSession[]): PrHit[] {
  const hits: PrHit[] = [];
  for (const ex of session.exercises) {
    if (!ex.completed || ex.weight == null) continue;
    const e = effortKg(ex.weight, ex.unit, ex.reps);
    const prev = bestE1rmKg(history, ex.name, session.id);
    if (prev > 0 && e > prev + 0.01) {
      hits.push({
        exercise: ex.name,
        weight: ex.weight,
        unit: ex.unit,
        reps: ex.reps,
        targetReps: ex.targetReps,
        e1rmKg: e,
        previousKg: prev,
      });
    }
  }
  // Biggest breakthroughs first.
  hits.sort((a, b) => b.e1rmKg - b.previousKg - (a.e1rmKg - a.previousKg));
  return hits;
}

/** Turn a hit into a PR record for the history list + share card. */
export function prHitToRecord(hit: PrHit, dateISO: string): Omit<PR, "id"> {
  return {
    exercise: hit.exercise,
    weight: `${hit.weight} ${hit.unit}`,
    reps: hit.reps != null ? String(hit.reps) : hit.targetReps,
    date: dateISO,
  };
}
