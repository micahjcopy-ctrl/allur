// ALLUR — Exercise optimizer.
//
// Turns the user's training setup (equipment access, disliked workouts, enjoyed
// styles/sports/classes) into two deterministic capabilities:
//
//   1. adaptPlanToEquipment(days, profile) — rewrites a generated program so it
//      never prescribes a movement the user can't actually do (no barbell when
//      they only have dumbbells) or a cardio modality they dislike, swapping in
//      the best same-pattern alternative they CAN do.
//
//   2. buildExerciseDetail(exercise, profile, goal) — for any exercise on the
//      plan, returns concrete intensity guidance (e.g. "Zone 2 · resistance
//      5–7/10" for a 45-min bike) plus exactly two alternatives the user can do,
//      biased toward the sports and classes they enjoy.
//
// This is the client-side source of truth. The same constraints are mirrored to
// the AI coach via the server prompt (see api-server guidelinesSection), so a
// coach-driven adjustment respects the same rules.

import { getExerciseGuide } from "@/data/exerciseGuide";
import type { Goal, UserProfile, Workout, WorkoutExercise } from "@/context/FitCoachContext";

// ---------------------------------------------------------------------------
// Equipment model
// ---------------------------------------------------------------------------

export type EquipmentId =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "cable"
  | "machine"
  | "pullup_bar"
  | "bench"
  | "cardio_machine"
  | "pool"
  | "sled"
  | "trap_bar"
  | "bodyweight";

const ALL_EQUIPMENT: EquipmentId[] = [
  "barbell", "dumbbell", "kettlebell", "cable", "machine", "pullup_bar",
  "bench", "cardio_machine", "pool", "sled", "trap_bar", "bodyweight",
];

// Onboarding chip labels mapped to the equipment they unlock. "Full gym" unlocks
// everything. Bodyweight is always implicitly available (see isAvailable).
export const EQUIPMENT_OPTIONS: { label: string; ids: EquipmentId[] }[] = [
  { label: "Full gym", ids: ALL_EQUIPMENT },
  { label: "Barbell & rack", ids: ["barbell", "bench"] },
  { label: "Dumbbells", ids: ["dumbbell"] },
  { label: "Kettlebells", ids: ["kettlebell"] },
  { label: "Cable machine", ids: ["cable"] },
  { label: "Weight machines", ids: ["machine"] },
  { label: "Pull-up bar", ids: ["pullup_bar"] },
  { label: "Bench", ids: ["bench"] },
  { label: "Cardio machines (bike / treadmill / rower)", ids: ["cardio_machine"] },
  { label: "Pool access", ids: ["pool"] },
  { label: "Bodyweight only", ids: ["bodyweight"] },
];

export const SPORTS_OPTIONS = [
  "Basketball", "Soccer", "Tennis", "Pickleball", "Volleyball",
  "Running / jogging", "Cycling", "Swimming", "Golf", "Rock climbing",
];

export const CLASS_OPTIONS = [
  "Boxing", "Hot yoga", "Yoga", "Spin / cycling", "CrossFit",
  "Pilates", "HIIT bootcamp", "Rowing class", "Dance / Zumba", "Martial arts",
];

export const ENJOY_OPTIONS = [
  "Heavy compound lifts", "Bodyweight training", "Kettlebell work",
  "Outdoor cardio", "Group classes", "Swimming", "Cycling",
  "Sports / games", "Short intense sessions", "Mobility / stretching",
];

export const AVOID_OPTIONS = [
  "Running", "Burpees", "Long cardio", "Treadmill",
  "High-impact jumping", "Heavy barbell lifts", "Early-morning workouts", "Crowded machines",
];

// Resolve which equipment the user actually has. Returns null when the user gave
// no equipment info at all — meaning "unknown access, don't cripple the plan".
export function resolveAvailableEquipment(profile: UserProfile): Set<EquipmentId> | null {
  const labels = profile.equipment ?? [];
  if (labels.length === 0) return null;
  if (labels.includes("Full gym")) return new Set(ALL_EQUIPMENT);
  const set = new Set<EquipmentId>(["bodyweight"]);
  for (const label of labels) {
    const opt = EQUIPMENT_OPTIONS.find((o) => o.label === label);
    if (opt) opt.ids.forEach((id) => set.add(id));
  }
  return set;
}

const isAvailable = (need: EquipmentId[], avail: Set<EquipmentId> | null): boolean => {
  if (avail === null) return true; // unknown access → assume they can do it
  return need.every((e) => e === "bodyweight" || avail.has(e));
};

// ---------------------------------------------------------------------------
// Exercise metadata — movement pattern + the MINIMUM equipment required.
// Keyed by the canonical exercise name (the `.name` returned by getExerciseGuide).
// ---------------------------------------------------------------------------

export type MovementPattern =
  | "squat" | "hinge" | "horizontal_push" | "vertical_push"
  | "horizontal_pull" | "vertical_pull" | "lateral_raise" | "rear_delt"
  | "biceps" | "triceps" | "calves" | "quad_iso" | "ham_iso"
  | "glute" | "core" | "shrug" | "power" | "cardio";

interface ExerciseMeta {
  pattern: MovementPattern;
  equipment: EquipmentId[];
}

const META: Record<string, ExerciseMeta> = {
  "Back Squat": { pattern: "squat", equipment: ["barbell"] },
  "Front Squat": { pattern: "squat", equipment: ["barbell"] },
  "Pause Squat": { pattern: "squat", equipment: ["barbell"] },
  "Goblet Squat": { pattern: "squat", equipment: ["dumbbell"] },
  "Bulgarian Split Squat": { pattern: "squat", equipment: ["bodyweight"] },
  "Walking Lunge": { pattern: "squat", equipment: ["bodyweight"] },
  "Leg Press": { pattern: "squat", equipment: ["machine"] },

  "Deadlift": { pattern: "hinge", equipment: ["barbell"] },
  "Romanian Deadlift": { pattern: "hinge", equipment: ["barbell"] },
  "Hip Thrust": { pattern: "glute", equipment: ["barbell", "bench"] },
  "Kettlebell Swing": { pattern: "hinge", equipment: ["kettlebell"] },

  "Bench Press": { pattern: "horizontal_push", equipment: ["barbell", "bench"] },
  "Incline Dumbbell Press": { pattern: "horizontal_push", equipment: ["dumbbell", "bench"] },
  "Incline Dumbbell Flyes": { pattern: "horizontal_push", equipment: ["dumbbell", "bench"] },
  "Cable Fly": { pattern: "horizontal_push", equipment: ["cable"] },
  "Close-Grip Bench": { pattern: "triceps", equipment: ["barbell", "bench"] },
  "Weighted Dips": { pattern: "horizontal_push", equipment: ["bodyweight"] },
  "Push-ups": { pattern: "horizontal_push", equipment: ["bodyweight"] },

  "Overhead Press": { pattern: "vertical_push", equipment: ["barbell"] },
  "Dumbbell Shoulder Press": { pattern: "vertical_push", equipment: ["dumbbell"] },

  "Barbell Row": { pattern: "horizontal_pull", equipment: ["barbell"] },
  "Cable Row": { pattern: "horizontal_pull", equipment: ["cable"] },
  "Lat Pulldown": { pattern: "vertical_pull", equipment: ["machine"] },
  "Pull-ups": { pattern: "vertical_pull", equipment: ["pullup_bar"] },

  "Lateral Raise": { pattern: "lateral_raise", equipment: ["dumbbell"] },
  "Face Pull": { pattern: "rear_delt", equipment: ["cable"] },
  "Rear Delt Fly": { pattern: "rear_delt", equipment: ["dumbbell"] },

  "Barbell Curl": { pattern: "biceps", equipment: ["barbell"] },
  "Cable Curl": { pattern: "biceps", equipment: ["cable"] },
  "Hammer Curl": { pattern: "biceps", equipment: ["dumbbell"] },
  "Tricep Pushdown": { pattern: "triceps", equipment: ["cable"] },
  "Triceps Extension": { pattern: "triceps", equipment: ["dumbbell"] },

  "Leg Curl": { pattern: "ham_iso", equipment: ["machine"] },
  "Nordic Curl": { pattern: "ham_iso", equipment: ["bodyweight"] },
  "Leg Extension": { pattern: "quad_iso", equipment: ["machine"] },
  "Calf Raise": { pattern: "calves", equipment: ["bodyweight"] },

  "Plank": { pattern: "core", equipment: ["bodyweight"] },
  "Hanging Leg Raise": { pattern: "core", equipment: ["pullup_bar"] },
  "Barbell Shrugs": { pattern: "shrug", equipment: ["barbell"] },

  "Power Clean": { pattern: "power", equipment: ["barbell"] },
  "Trap-Bar Jump": { pattern: "power", equipment: ["trap_bar"] },
  "Box Jump": { pattern: "power", equipment: ["bodyweight"] },
  "Med-Ball Throw": { pattern: "power", equipment: ["bodyweight"] },
  "Sled Push": { pattern: "power", equipment: ["sled"] },
  "Sprint": { pattern: "power", equipment: ["bodyweight"] },

  "Mobility Flow": { pattern: "cardio", equipment: ["bodyweight"] },
  "Zone 2 Cardio": { pattern: "cardio", equipment: ["bodyweight"] },
  "Intervals": { pattern: "cardio", equipment: ["bodyweight"] },
};

// Ordered substitution candidates per pattern — best/most-loaded first, down to
// a bodyweight option last. Substitution walks this list and picks the first one
// the user can actually do (and doesn't dislike).
const SUBSTITUTIONS: Record<MovementPattern, string[]> = {
  squat: ["Back Squat", "Front Squat", "Leg Press", "Goblet Squat", "Bulgarian Split Squat", "Walking Lunge"],
  hinge: ["Deadlift", "Romanian Deadlift", "Hip Thrust", "Kettlebell Swing", "Nordic Curl"],
  horizontal_push: ["Bench Press", "Incline Dumbbell Press", "Cable Fly", "Weighted Dips", "Push-ups"],
  vertical_push: ["Overhead Press", "Dumbbell Shoulder Press", "Push-ups"],
  horizontal_pull: ["Barbell Row", "Cable Row", "Pull-ups"],
  vertical_pull: ["Lat Pulldown", "Pull-ups"],
  lateral_raise: ["Lateral Raise", "Cable Fly"],
  rear_delt: ["Face Pull", "Rear Delt Fly"],
  biceps: ["Barbell Curl", "Cable Curl", "Hammer Curl"],
  triceps: ["Tricep Pushdown", "Triceps Extension", "Weighted Dips", "Push-ups"],
  calves: ["Calf Raise"],
  quad_iso: ["Leg Extension", "Walking Lunge"],
  ham_iso: ["Leg Curl", "Nordic Curl"],
  glute: ["Hip Thrust", "Bulgarian Split Squat", "Walking Lunge"],
  core: ["Hanging Leg Raise", "Plank"],
  shrug: ["Barbell Shrugs", "Hammer Curl"],
  power: ["Power Clean", "Trap-Bar Jump", "Kettlebell Swing", "Sled Push", "Box Jump", "Med-Ball Throw", "Sprint"],
  cardio: ["Zone 2 Cardio", "Intervals"],
};

// Resolve an exercise name (possibly an alias) to its canonical name + meta.
function metaFor(name: string): { canonical: string; meta: ExerciseMeta | null } {
  const guide = getExerciseGuide(name);
  const canonical = guide?.name ?? name;
  return { canonical, meta: META[canonical] ?? null };
}

// ---------------------------------------------------------------------------
// Dislike matching — keep it lightweight + intent-based.
// ---------------------------------------------------------------------------

function isDislikedExercise(canonical: string, meta: ExerciseMeta, dislikes: string): boolean {
  const d = dislikes.toLowerCase();
  if (!d) return false;
  if (d.includes("barbell") && meta.equipment.includes("barbell")) return true;
  if (
    (d.includes("jump") || d.includes("plyo") || d.includes("high-impact") || d.includes("high impact") || d.includes("burpee")) &&
    /jump|box|sprint|clean|throw/i.test(canonical)
  ) {
    return true;
  }
  return false;
}

// Map a disliked-cardio phrase to the regex that matches that modality in a
// cardio exercise NAME. Used to detect when a generated cardio entry (e.g.
// "Rower / Incline Walk") names a modality the user wants to avoid.
const CARDIO_MODALITY_RULES: { when: (d: string) => boolean; matches: RegExp }[] = [
  { when: (d) => /\brun(ning)?\b|\bjog/.test(d), matches: /run|jog|sprint/i },
  { when: (d) => /treadmill/.test(d), matches: /treadmill|incline walk/i },
  { when: (d) => /\bwalk/.test(d), matches: /\bwalk\b/i },
  { when: (d) => /swim/.test(d), matches: /swim/i },
  { when: (d) => /\bbike\b|cycl|spin/.test(d), matches: /\bbike\b|cycl|spin/i },
  { when: (d) => /\brow/.test(d), matches: /\brow/i },
];

// True when the cardio exercise's name references a modality the user dislikes.
function cardioNameDisliked(name: string, dislikesLower: string): boolean {
  if (!dislikesLower.trim()) return false;
  return CARDIO_MODALITY_RULES.some((r) => r.when(dislikesLower) && r.matches.test(name));
}

// Heuristic: does this exercise name read as a cardio/conditioning session?
// Only consulted when the movement isn't in META (descriptive cardio names),
// so it never mislabels strength rows etc. (those have metadata).
function looksLikeCardio(name: string): boolean {
  return /walk|run|jog|bike|cycl|spin|row|swim|cardio|zone\s*2|interval|conditioning|hiit|sprint|elliptical|stair|hike|aerobic|treadmill|rower/i.test(
    name,
  );
}

// If a cardio entry names a disliked modality, swap its name to the best liked
// alternative the user CAN do (class > sport > pool/machine > generic), keeping
// the interval-vs-steady character and the prescribed duration. Otherwise the
// exercise is returned unchanged.
function adaptDislikedCardio(
  exercise: WorkoutExercise,
  profile: UserProfile,
  dislikesLower: string,
): WorkoutExercise {
  if (!cardioNameDisliked(exercise.name, dislikesLower)) return exercise;
  const isInterval = /interval|sprint|hiit|tempo|conditioning/i.test(exercise.name);
  const alt = buildCardioAlternatives(exercise, profile, isInterval)[0];
  if (!alt) return exercise; // nothing safe to swap to → leave as-is
  const why = `Swapped from ${exercise.name} so it skips cardio you'd rather avoid.`;
  return {
    ...exercise,
    name: alt.name,
    note: exercise.note ? `${exercise.note} ${why}` : why,
  };
}

// ---------------------------------------------------------------------------
// Plan adaptation
// ---------------------------------------------------------------------------

/**
 * Rewrite a generated program so every exercise is one the user can actually
 * perform with their equipment and doesn't dislike. Cardio is left in place
 * (its modality is generic — the per-exercise detail picks a liked option), but
 * strength/power/core movements are swapped within their movement pattern. Sets,
 * reps and rest are preserved; a short note explains each swap.
 */
export function adaptPlanToEquipment(days: Workout[], profile: UserProfile): Workout[] {
  const avail = resolveAvailableEquipment(profile);
  const dislikes = (profile.dislikes ?? []).join("; ") + " " + (profile.dislikeNotes ?? "");
  // Nothing to constrain: no equipment info AND no dislikes.
  if (avail === null && !dislikes.trim()) return days;

  const dislikesLower = dislikes.toLowerCase();

  return days.map((day) => ({
    ...day,
    exercises: day.exercises.map((exercise) => {
      const { canonical, meta } = metaFor(exercise.name);
      if (!meta) {
        // Unknown movement. It may still be a descriptive cardio entry (e.g.
        // "Rower / Incline Walk") whose name embeds a disliked modality, so run
        // the cardio-dislike guard on it before leaving it untouched.
        return adaptDislikedCardio(exercise, profile, dislikesLower);
      }
      if (meta.pattern === "cardio") return adaptDislikedCardio(exercise, profile, dislikesLower);

      const blocked = !isAvailable(meta.equipment, avail) || isDislikedExercise(canonical, meta, dislikes);
      if (!blocked) return exercise;

      const candidates = SUBSTITUTIONS[meta.pattern] ?? [];
      const replacement = candidates.find((c) => {
        if (c === canonical) return false;
        const m = META[c];
        return m && isAvailable(m.equipment, avail) && !isDislikedExercise(c, m, dislikes);
      });
      if (!replacement) {
        // Couldn't find a workable swap — keep it but flag it for the user.
        const flag = "Adjust this to your equipment — ask the Coach for a swap.";
        return { ...exercise, note: exercise.note ? `${exercise.note} ${flag}` : flag };
      }
      const why = `Swapped from ${exercise.name} to fit your available equipment.`;
      return {
        ...exercise,
        name: replacement,
        note: exercise.note ? `${exercise.note} ${why}` : why,
      };
    }),
  }));
}

// ---------------------------------------------------------------------------
// Per-exercise detail: intensity + 2 alternatives
// ---------------------------------------------------------------------------

export interface ExerciseAlternative {
  name: string;
  detail: string;
}

export interface ExerciseGuidance {
  intensityShort: string;
  intensity: string;
  alternatives: ExerciseAlternative[];
}

const CLASS_BLURB: Record<string, string> = {
  "Spin / cycling": "Spin class — same Zone 2 effort, group energy.",
  "Hot yoga": "Hot yoga — active recovery, mobility and a light sweat.",
  "Yoga": "Yoga flow — easy aerobic work plus mobility.",
  "Boxing": "Boxing class — conditioning that never feels like cardio.",
  "CrossFit": "CrossFit class — mixed conditioning at your own scaling.",
  "Pilates": "Pilates — low-impact core and control work.",
  "HIIT bootcamp": "HIIT bootcamp — fun way to hit the same heart-rate zone.",
  "Rowing class": "Rowing class — full-body, zero-impact steady cardio.",
  "Dance / Zumba": "Dance / Zumba — keep moving, keep it fun.",
  "Martial arts": "Martial arts session — skill work that doubles as cardio.",
};

function durationFromReps(reps: string): string {
  const m = reps.match(/(\d+)\s*(min|sec|s\b|m\b)/i);
  if (m) return reps.trim();
  const n = reps.match(/(\d+)/);
  return n ? `${n[1]} min` : "the session";
}

function buildCardioAlternatives(
  exercise: WorkoutExercise,
  profile: UserProfile,
  isInterval: boolean,
): ExerciseAlternative[] {
  const dur = durationFromReps(exercise.reps);
  const avail = resolveAvailableEquipment(profile);
  const has = (e: EquipmentId) => isAvailable([e], avail);
  const dislikes = (composeListLower(profile.dislikes, profile.dislikeNotes));
  const dislikesRunning = dislikes.includes("run") || dislikes.includes("treadmill") || dislikes.includes("jog");

  const pool: ExerciseAlternative[] = [];

  if (isInterval) {
    profile.classes?.forEach((c) => {
      if (["HIIT bootcamp", "CrossFit", "Boxing", "Spin / cycling"].includes(c)) {
        pool.push({ name: `${c} class`, detail: CLASS_BLURB[c] ?? "A high-intensity class that matches this interval work." });
      }
    });
    if (has("cardio_machine")) pool.push({ name: "Bike intervals", detail: "8–10 × 30s hard (resistance 8–9/10) / 90s easy spin." });
    if (has("cardio_machine")) pool.push({ name: "Rower intervals", detail: "10 × 250m hard / 90s easy — keep splits consistent." });
    if (!dislikesRunning) pool.push({ name: "Hill sprints", detail: "6–10 × 20s hard uphill, walk down to recover." });
    pool.push({ name: "Bodyweight circuit", detail: "30s work / 30s rest through 4–5 moves for the same conditioning hit." });
  } else {
    profile.classes?.forEach((c) => {
      if (["Spin / cycling", "Hot yoga", "Yoga", "Rowing class", "Dance / Zumba"].includes(c)) {
        pool.push({ name: `${c} class`, detail: CLASS_BLURB[c] ?? "A steady-effort class for the same Zone 2 work." });
      }
    });
    profile.sports?.forEach((s) => {
      pool.push({ name: `Play ${s}`, detail: `Get ${dur} of ${s.toLowerCase()} in — same heart-rate zone, far more fun.` });
    });
    if (has("pool")) pool.push({ name: `Swim ${dur}`, detail: "Easy, continuous laps — zero-impact Zone 2." });
    if (has("cardio_machine")) pool.push({ name: `Row or cycle ${dur}`, detail: "Steady, conversational effort, resistance 5–7/10." });
    if (!dislikesRunning) pool.push({ name: `Incline walk ${dur}`, detail: "Brisk treadmill incline at a pace you could still talk through." });
    pool.push({ name: `Brisk outdoor walk ${dur}`, detail: "Keep a steady pace you could hold a conversation at." });
  }

  // Generic fallbacks so we always return exactly two, even for a sparse
  // profile (no classes/sports/equipment, running disliked).
  const fallbacks: ExerciseAlternative[] = isInterval
    ? [
        { name: "Bodyweight circuit", detail: "30s work / 30s rest through 4–5 moves for the same conditioning hit." },
        { name: "Stair / step intervals", detail: "30s hard up, walk down to recover — repeat for the interval block." },
        { name: "Shadow-boxing rounds", detail: "3-min rounds of fast combos with 1 min rest — zero equipment." },
      ]
    : [
        { name: `Brisk walk ${dur}`, detail: "Keep a steady pace you could hold a conversation at." },
        { name: `Easy hike ${dur}`, detail: "Gentle rolling terrain at a conversational effort." },
        { name: `Bodyweight flow ${dur}`, detail: "Continuous easy movement (squats, lunges, mobility) at a low heart rate." },
      ];
  // Filter EVERY candidate (preferred classes/sports/equipment AND fallbacks)
  // against dislikes — a user can both dislike cycling and have selected a spin
  // class, and we must never surface the disliked modality either way.
  const safe = [...pool, ...fallbacks].filter((a) => !cardioNameDisliked(a.name, dislikes));
  return dedupeAlternatives(safe, exercise.name).slice(0, 2);
}

function buildStrengthAlternatives(
  canonical: string,
  meta: ExerciseMeta,
  profile: UserProfile,
): ExerciseAlternative[] {
  const avail = resolveAvailableEquipment(profile);
  const dislikes = (profile.dislikes ?? []).join("; ") + " " + (profile.dislikeNotes ?? "");
  const candidates = SUBSTITUTIONS[meta.pattern] ?? [];

  const out: ExerciseAlternative[] = [];
  for (const c of candidates) {
    if (c === canonical) continue;
    const m = META[c];
    if (!m) continue;
    if (!isAvailable(m.equipment, avail)) continue;
    if (isDislikedExercise(c, m, dislikes)) continue;
    const guide = getExerciseGuide(c);
    out.push({ name: c, detail: guide?.summary ?? "Trains the same movement pattern." });
    if (out.length === 2) break;
  }

  // Always return exactly two — pad with tempo / rep-range variations of the
  // movement itself when there aren't two distinct equipment alternatives.
  if (out.length < 2) {
    const fillers: ExerciseAlternative[] = [
      { name: `${canonical} (tempo)`, detail: "Same movement with a slow 3-second lowering — more tension, less load." },
      { name: `${canonical} (higher reps)`, detail: "Same movement for 15–20 reps to match the stimulus with lighter weight." },
    ];
    for (const f of fillers) {
      if (out.length === 2) break;
      out.push(f);
    }
  }
  return out.slice(0, 2);
}

/**
 * Build the intensity guidance + two alternatives shown for an exercise on the
 * Plan page. Cardio gets effort/resistance guidance and liked-modality swaps;
 * strength/power/core get load guidance keyed to the user's goal plus
 * same-pattern alternatives they can actually do.
 */
export function buildExerciseDetail(
  exercise: WorkoutExercise,
  profile: UserProfile,
  goal: Goal,
): ExerciseGuidance {
  const { canonical, meta } = metaFor(exercise.name);
  // Generated plans use descriptive cardio names ("Incline Walk (Zone 2)",
  // "Bike / Row") that aren't in META, so infer cardio from the name when the
  // metadata lookup misses — otherwise they'd render strength guidance.
  const pattern = meta?.pattern ?? (looksLikeCardio(exercise.name) ? "cardio" : undefined);
  const reps = exercise.reps;

  if (pattern === "cardio") {
    const isInterval = /interval|sprint|hiit/i.test(canonical) || /interval|sprint|hiit/i.test(exercise.name);
    const isMobility = /mobility|flow|stretch/i.test(canonical);
    if (isMobility) {
      return {
        intensityShort: "Easy · recovery pace",
        intensity:
          "Move slowly and breathe — this is recovery, not a workout. Ease into each position and never force a range that pinches or hurts.",
        alternatives: [
          { name: "Foam-roll + stretch", detail: "10 min rolling tight areas, then hold easy stretches." },
          { name: "Easy walk", detail: "A relaxed 15–20 min walk to keep blood moving." },
        ],
      };
    }
    if (isInterval) {
      return {
        intensityShort: "Hard / easy · 8–9 of 10 on work bouts",
        intensity:
          "Push the work bouts to about 8–9 out of 10 (on a bike, crank the resistance to 8–9/10 so you're really driving), then ease right back to 3–4/10 to recover. One or two interval sessions a week is plenty.",
        alternatives: buildCardioAlternatives(exercise, profile, true),
      };
    }
    return {
      intensityShort: "Zone 2 · effort 5–6 of 10",
      intensity:
        `Keep it easy and steady — about 5–6 out of 10, where you could still hold a short conversation. On a stationary bike set resistance to a moderate 5–7/10; on a treadmill use an incline walk. If you can't talk, slow down. Aim for ${durationFromReps(reps)}.`,
      alternatives: buildCardioAlternatives(exercise, profile, false),
    };
  }

  if (pattern === "power") {
    return {
      intensityShort: "Explosive · fast & crisp",
      intensity:
        `Move every rep as fast and explosively as you can with clean technique — quality over fatigue. Use a load you can really accelerate and stop the set the moment bar speed drops. Reset fully between efforts.`,
      alternatives: meta ? buildStrengthAlternatives(canonical, meta, profile) : [],
    };
  }

  if (pattern === "core") {
    return {
      intensityShort: "Brace hard · stop at form breakdown",
      intensity:
        "Brace your whole midsection as if about to be punched and keep ribs down. End the set when your form starts to break, not at an arbitrary number.",
      alternatives: meta ? buildStrengthAlternatives(canonical, meta, profile) : [],
    };
  }

  // Default: resistance/strength movement. Intensity keyed to the goal.
  let intensityShort: string;
  let intensity: string;
  switch (goal) {
    case "Strength":
      intensityShort = `Heavy · ~1–2 reps in reserve`;
      intensity =
        `Work the ${reps} range with a heavy load, leaving about 1–2 reps in the tank on each set. When you hit the top of the range with clean form, add a little weight next session.`;
      break;
    case "Weight Loss":
      intensityShort = `Moderate · controlled, short rest`;
      intensity =
        `Use a moderate load you fully control for all ${reps} reps, keeping rest short and form crisp to keep the heart rate up. Add reps or a touch of weight as it gets easier.`;
      break;
    default: // Muscle Gain / Athleticism / unset
      intensityShort = `Challenging · 0–2 reps in reserve`;
      intensity =
        `Pick a load where the last 1–2 of your ${reps} reps are genuinely hard (0–2 left in reserve) while your form holds. Beat the top of the rep range, then add weight.`;
  }

  return {
    intensityShort,
    intensity,
    alternatives: meta ? buildStrengthAlternatives(canonical, meta, profile) : [],
  };
}

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function composeListLower(chips: string[] | undefined, notes: string | undefined): string {
  return [...(chips ?? []), notes ?? ""].join(" ").toLowerCase();
}

function dedupeAlternatives(list: ExerciseAlternative[], excludeName: string): ExerciseAlternative[] {
  const seen = new Set<string>([excludeName.toLowerCase()]);
  const out: ExerciseAlternative[] = [];
  for (const a of list) {
    const key = a.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}
