// ---------------------------------------------------------------------------
// Allur Score — pure presentation logic over the existing physique analyses.
//
// The AI analysis pipeline already produces overallScore (0-100), per-muscle
// BodyPartRating[], and a body-fat range. This module turns that data into
// the gamified score surface (delta vs last scan, Potential, canonical
// muscle ordering, share captions) without touching the analysis pipeline.
// Everything here is deterministic and unit-tested (bun test).
// ---------------------------------------------------------------------------

import type { BodyPartRating, PhysiqueAnalysis } from "@/context/FitCoachContext";

export interface AllurScoreData {
  overall: number;
  /** Change vs the previous scan, null on the first scan. */
  delta: number | null;
  potential: number;
  bodyFat: number;
  parts: BodyPartRating[];
  week?: number;
  date: string;
  photoUrl: string;
}

// Canonical display order; analysis part names are matched fuzzily so
// "Upper Chest", "chest", "Pecs" all bucket sensibly.
const PART_ORDER: { key: string; match: RegExp }[] = [
  { key: "Chest", match: /chest|pec/i },
  { key: "Shoulders", match: /shoulder|delt/i },
  { key: "Back", match: /back|lat|trap/i },
  { key: "Arms", match: /arm|bicep|tricep|forearm/i },
  { key: "Core", match: /core|ab|oblique/i },
  { key: "Legs", match: /leg|quad|ham|glute|calf|calves/i },
];

/**
 * Order parts for display: canonical groups first (chest → legs), anything
 * unmatched afterwards in its original order. When several ratings map to
 * the same group the strongest signal (highest rating) represents it.
 */
export function orderedParts(parts: BodyPartRating[]): BodyPartRating[] {
  const buckets = new Map<string, BodyPartRating>();
  const leftovers: BodyPartRating[] = [];
  for (const p of parts) {
    const slot = PART_ORDER.find((o) => o.match.test(p.part));
    if (!slot) {
      leftovers.push(p);
      continue;
    }
    const existing = buckets.get(slot.key);
    if (!existing || p.rating > existing.rating) buckets.set(slot.key, p);
  }
  const ordered: BodyPartRating[] = [];
  for (const o of PART_ORDER) {
    const hit = buckets.get(o.key);
    if (hit) ordered.push({ ...hit, part: o.key });
  }
  return [...ordered, ...leftovers];
}

/**
 * Potential — where this physique can realistically get on the current plan.
 * Deliberately simple and monotonic: a share of the remaining headroom plus
 * a small consistency bonus, always at least +4 above today and capped at 99
 * so there is forever one more point to chase.
 */
export function computePotential(overall: number, workoutStreak: number): number {
  const base = Math.max(0, Math.min(100, overall));
  const headroom = (100 - base) * 0.45;
  const consistency = (Math.min(Math.max(workoutStreak, 0), 14) / 14) * 3;
  return Math.min(99, Math.max(base + 4, Math.round(base + headroom + consistency)));
}

/** Latest analysis wins by week (undefined week = oldest), then by date. */
const analysisSortValue = (a: PhysiqueAnalysis): number =>
  (a.week ?? -1) * 1e15 + new Date(a.date).getTime() / 1000;

/**
 * Collapse the scan history into the score surface. Returns null until the
 * first analysis exists.
 */
export function buildAllurScore(
  analyses: PhysiqueAnalysis[],
  workoutStreak: number,
): AllurScoreData | null {
  if (!analyses.length) return null;
  const sorted = [...analyses].sort((a, b) => analysisSortValue(b) - analysisSortValue(a));
  const latest = sorted[0];
  const previous = sorted[1] ?? null;
  return {
    overall: Math.round(latest.overallScore),
    delta: previous ? Math.round(latest.overallScore) - Math.round(previous.overallScore) : null,
    potential: computePotential(latest.overallScore, workoutStreak),
    bodyFat: latest.bodyFatEstimate,
    parts: orderedParts(latest.parts ?? []),
    week: latest.week,
    date: latest.date,
    photoUrl: latest.photoUrl,
  };
}

/** Share-sheet caption for a scan card. */
export function scanShareCaption(d: AllurScoreData): string {
  const delta = d.delta != null && d.delta !== 0 ? ` (${d.delta > 0 ? "+" : ""}${d.delta})` : "";
  return `Allur Score: ${d.overall}${delta} — potential ${d.potential}. Scanned with ALLUR → getallur.com`;
}

/** Share-sheet caption for a PR card. */
export function prShareCaption(exercise: string, weight: string, reps: string): string {
  return `New PR — ${exercise}: ${weight} × ${reps}. Tracked with ALLUR → getallur.com`;
}
