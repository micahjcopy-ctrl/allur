// ---------------------------------------------------------------------------
// Deterministic guardrail for coach plan edits.
//
// The client sends the plan ordered TODAY-first, and the model is told the
// first day is today and to keep the weekday slots (only moving workout content
// between days). This function makes that guarantee real instead of trusting
// the model: when the edit keeps the same weekday slots (or the model mislabels
// them), we re-key the returned days onto the real today-first weekday slots BY
// POSITION — so "make today back & shoulders" can never land on the wrong day.
//
// It also refuses to hand back a structurally broken plan (empty, or bad
// weekday labels on an add/remove edit), so a bad model response can never
// corrupt the stored plan. Pure + exhaustively unit-tested.
// ---------------------------------------------------------------------------

export interface CoachPlanDay {
  dayName: string;
  title: string;
  exercises: unknown[];
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function isWeekday(name: string): boolean {
  return WEEKDAYS.includes(name.trim().toLowerCase());
}

/** Sorted, lowercased weekday set — used to tell "same slots" from a real
 *  weekday change. */
function weekdayKey(days: { dayName: string }[]): string {
  return days
    .map((d) => d.dayName.trim().toLowerCase())
    .sort()
    .join(",");
}

/**
 * @param sent     the plan the client sent, ordered TODAY-first
 * @param returned the plan the model produced via update_training_plan
 * @returns the plan to store, or null to reject the edit (caller falls back to
 *          a text-only reply so nothing is corrupted)
 */
export function normalizeCoachPlan<
  T extends CoachPlanDay,
>(sent: { dayName: string }[], returned: T[] | null | undefined): T[] | null {
  if (!returned || !Array.isArray(returned) || returned.length === 0) {
    return null;
  }

  // Reject anything structurally unusable so a bad response can't corrupt state.
  for (const d of returned) {
    if (
      !d ||
      typeof d.dayName !== "string" ||
      typeof d.title !== "string" ||
      !Array.isArray(d.exercises)
    ) {
      return null;
    }
  }

  // Same number of days: this is an in-place edit / rotation within the week.
  if (sent.length === returned.length && sent.length > 0) {
    const sameSlots = weekdayKey(sent) === weekdayKey(returned);
    const allWeekdays = returned.every((d) => isWeekday(d.dayName));
    if (sameSlots || !allWeekdays) {
      // Force the real today-first weekday onto each position. If the model
      // kept correct labels this is a no-op; if it mislabelled or scrambled
      // them, this repairs placement deterministically.
      return returned.map((d, i) => ({ ...d, dayName: sent[i].dayName }));
    }
    // Valid weekdays that differ from the originals = an intentional change of
    // which days are trained; respect it.
    return returned;
  }

  // Day count changed (added / removed a day): keep the model's plan, but only
  // if every day carries a real weekday label the app can place.
  if (!returned.every((d) => isWeekday(d.dayName))) return null;
  return returned;
}
