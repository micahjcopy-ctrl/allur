// ALLUR — Training knowledge base.
//
// This is the project's source-of-truth training context. It encodes the
// research-backed workout philosophies, splits, rep schemes, volume targets and
// cardio guidance the program generator pulls from when building a user's custom
// plan. Derived from the goal-by-goal training research brief.
//
// The real drivers of results are specificity, progressive overload, total
// weekly volume, intensity, recovery and consistency — the split is just the
// weekly organization layered on top of those principles.

import type { Goal, UserProfile, Workout, WorkoutExercise, TargetPhysique } from "@/context/FitCoachContext";
import { adaptPlanToEquipment } from "@/data/exerciseOptimizer";

export type Experience = "Beginner" | "Intermediate" | "Advanced";

export interface MuscleVolume {
  muscle: string;
  sets: string;
}

export interface ProgramMeta {
  goalLabel: string;
  splitName: string;
  daysPerWeek: number;
  experience: Experience;
  philosophy: string;
  repScheme: string;
  intensity: string;
  weeklyVolume: string;
  volumeTarget: string;
  setQuality: string;
  volumeDiminishingReturns: string;
  perMuscleVolume: MuscleVolume[];
  cardio: string;
  proteinTargetG: number | null;
  proteinNote: string;
  emphasis: string | null;
  principles: string[];
}

export interface GeneratedProgram {
  meta: ProgramMeta;
  days: Workout[];
}

// Section 1 — the non-negotiables that apply to every goal.
export const UNIVERSAL_PRINCIPLES = [
  "Specificity — train the exact quality you want to improve.",
  "Progressive overload — gradually add weight, reps, sets, range, or quality.",
  "Volume drives adaptation, but only what you can recover from — about 10–20 hard sets per muscle per week is the growth window for most.",
  "Frequency — train each muscle about 2x per week; it beats the same weekly volume crammed into one session.",
  "Match intensity to the goal: heavy (85%+ 1RM) for strength, moderate loads near failure for muscle.",
  "Proximity to failure matters more for muscle than for strength — most hard sets end 0–3 reps in reserve.",
  "Most people need both lifting and cardio (~150 min/wk + 2+ strength days).",
];

// Section 2 — evidence-based weekly volume model (Jeff Nippard, "How Many Sets
// Do You Need?"). Volume is counted in HARD sets — taken to within 0–3 reps in
// reserve. More sets give diminishing returns, so the goal is the least volume
// that still drives progress, not the most a user can survive.
export interface VolumeLandmark {
  // Minimum effective volume — the floor that still drives/maintains growth.
  mev: string;
  // Recommended growth range — where most progress happens for the effort.
  growth: string;
  // High-end / specialization ceiling (advanced only); null when not applicable.
  max: string | null;
}

export const VOLUME_GUIDELINES: {
  byExperience: Record<Experience, VolumeLandmark>;
  progression: Record<Experience, string>;
  perMuscleWeeklySets: MuscleVolume[];
  intensityRule: string;
  diminishingReturns: string;
} = {
  byExperience: {
    Beginner: { mev: "1–5 sets/week", growth: "4–12 sets/week", max: null },
    Intermediate: { mev: "4–8 sets/week", growth: "8–15 sets/week", max: null },
    Advanced: { mev: "4–8 sets/week (maintenance)", growth: "12–20 sets/week", max: "15–25 sets/week (specialization)" },
  },
  progression: {
    Beginner: "Start at ~8 hard sets/week per muscle; add sets only when progress stalls.",
    Intermediate: "Operate mostly between 10–15 hard sets/week per muscle.",
    Advanced: "Keep most muscles at 10–15 sets; push lagging muscles to 15–20+ sets temporarily, then bring them back.",
  },
  // The "sweet spot" most lifters get excellent results from without piling on fatigue.
  perMuscleWeeklySets: [
    { muscle: "Chest", sets: "10–20" },
    { muscle: "Back", sets: "14–22" },
    { muscle: "Quads", sets: "12–18" },
    { muscle: "Hamstrings", sets: "10–16" },
    { muscle: "Glutes", sets: "8–16" },
    { muscle: "Shoulders (esp. side delts)", sets: "12–20" },
    { muscle: "Biceps", sets: "12–20" },
    { muscle: "Triceps", sets: "10–16" },
    { muscle: "Calves", sets: "12–16" },
    { muscle: "Abs", sets: "8–16" },
  ],
  intensityRule: "Quality over quantity: every set should be a HARD set, taken to within 0–3 reps in reserve. Six hard sets beat ten easy ones.",
  diminishingReturns: "Volume has diminishing returns — 0→5 sets is a huge gain, 5→10 adds more, 10→20 yields smaller gains for much more fatigue. Add the least volume that still drives progress.",
};

// Per-experience weekly-volume target string for a program summary card.
function volumeTargetFor(experience: Experience): string {
  const l = VOLUME_GUIDELINES.byExperience[experience];
  const range = l.max ? `${l.growth}, up to ${l.max}` : l.growth;
  return `Target ${range} of hard sets per muscle (min effective ${l.mev}). ${VOLUME_GUIDELINES.progression[experience]}`;
}

const ex = (name: string, sets: number, reps: string, rest: string, note?: string): WorkoutExercise =>
  note ? { name, sets, reps, rest, note } : { name, sets, reps, rest };

const cardio = (name: string, duration: string, note?: string): WorkoutExercise =>
  ex(name, 1, duration, "—", note);

interface GoalVariant {
  splitName: string;
  daysPerWeek: number;
  days: Workout[];
}

interface GoalSpec {
  label: string;
  philosophy: string;
  repScheme: string;
  intensity: string;
  weeklyVolume: string;
  cardio: string;
  proteinPerKg: number;
  principles: string[];
  byExperience: Record<Experience, GoalVariant>;
}

// ──────────────────────────────────────────────────────────────────────────
// Goal specifications. App goals map to the research brief as:
//   Weight Loss -> Fat Loss | Muscle Gain -> Hypertrophy
//   Strength    -> Strength | Athleticism -> Athletic Performance
// ──────────────────────────────────────────────────────────────────────────
const GOAL_SPECS: Record<NonNullable<Goal>, GoalSpec> = {
  "Weight Loss": {
    label: "Fat Loss",
    philosophy:
      "Fat loss is an energy-balance problem supported by training. Lift to preserve muscle, add cardio and steps to raise expenditure, and keep adherence high.",
    repScheme: "10–15 reps, full-body / circuit style, moderate load",
    intensity: "Moderate (RPE 7–8). HIIT 1–2x/week max — it is fatiguing.",
    weeklyVolume: "2–4 lifting sessions + 150–300 min cardio",
    cardio: "Zone 2 cardio 2–5x/week + 7,000–12,000 steps/day. HIIT sparingly.",
    proteinPerKg: 2.2,
    principles: [
      "Preserve lean mass while dieting — resistance training is non-negotiable.",
      "Most calorie burn comes from steps and easy cardio, not brutal HIIT.",
      "Don't make every session a max-effort HIIT class.",
    ],
    byExperience: {
      Beginner: {
        splitName: "3-Day Full Body + Cardio",
        daysPerWeek: 5,
        days: [
          { dayName: "Monday", title: "Full Body Strength", exercises: [ex("Goblet Squat", 3, "12-15", "60s"), ex("Incline Dumbbell Press", 3, "12", "60s"), ex("Lat Pulldown", 3, "12-15", "60s"), ex("Plank", 3, "45s", "45s")] },
          { dayName: "Tuesday", title: "Zone 2 Cardio", exercises: [cardio("Incline Walk (Zone 2)", "35 min", "Conversational pace — should feel sustainable.")] },
          { dayName: "Wednesday", title: "Full Body Strength", exercises: [ex("Romanian Deadlift", 3, "12", "75s"), ex("Seated Row", 3, "12-15", "60s"), ex("Dumbbell Shoulder Press", 3, "12", "60s"), ex("Hanging Knee Raise", 3, "12-15", "45s")] },
          { dayName: "Friday", title: "Full Body Strength", exercises: [ex("Leg Press", 3, "15", "60s"), ex("Push-ups", 3, "AMRAP", "60s"), ex("Cable Row", 3, "12", "60s"), ex("Lateral Raise", 3, "15", "45s")] },
          { dayName: "Saturday", title: "Long Easy Cardio", exercises: [cardio("Bike / Walk / Swim", "45-60 min", "Low intensity, builds the calorie base.")] },
        ],
      },
      Intermediate: {
        splitName: "4-Day Upper/Lower + Cardio",
        daysPerWeek: 6,
        days: [
          { dayName: "Monday", title: "Upper Body", exercises: [ex("Bench Press", 4, "8-12", "75s"), ex("Pull-ups", 3, "8-12", "75s"), ex("Dumbbell Shoulder Press", 3, "10-12", "60s"), ex("Cable Curl", 3, "12-15", "45s"), ex("Tricep Pushdown", 3, "12-15", "45s")] },
          { dayName: "Tuesday", title: "Lower Body", exercises: [ex("Back Squat", 4, "8-12", "2m"), ex("Romanian Deadlift", 3, "10", "90s"), ex("Walking Lunges", 3, "12/leg", "60s"), ex("Calf Raise", 4, "15", "45s")] },
          { dayName: "Wednesday", title: "Zone 2 Cardio", exercises: [cardio("Rower / Incline Walk", "40 min", "Steady, conversational effort.")] },
          { dayName: "Thursday", title: "Upper Body", exercises: [ex("Incline Dumbbell Press", 4, "10-12", "75s"), ex("Barbell Row", 4, "8-12", "75s"), ex("Lateral Raise", 4, "15", "45s"), ex("Face Pull", 3, "15", "45s")] },
          { dayName: "Friday", title: "Lower Body", exercises: [ex("Deadlift", 3, "6-8", "2m"), ex("Leg Press", 3, "12-15", "75s"), ex("Leg Curl", 3, "12-15", "60s"), ex("Plank", 3, "60s", "45s")] },
          { dayName: "Saturday", title: "Intervals + Steps", exercises: [cardio("Intervals", "20 min", "1–2 hard sessions/week is plenty."), cardio("Easy Walk", "20 min")] },
        ],
      },
      Advanced: {
        splitName: "Lifting + Programmed Cardio",
        daysPerWeek: 6,
        days: [
          { dayName: "Monday", title: "Upper Strength", exercises: [ex("Bench Press", 4, "6-10", "90s"), ex("Weighted Pull-ups", 4, "6-10", "90s"), ex("Overhead Press", 3, "8-10", "75s"), ex("Barbell Curl", 3, "12", "45s")] },
          { dayName: "Tuesday", title: "Lower Strength", exercises: [ex("Back Squat", 4, "6-10", "2m"), ex("Romanian Deadlift", 4, "8", "90s"), ex("Bulgarian Split Squat", 3, "10/leg", "75s"), ex("Calf Raise", 4, "15", "45s")] },
          { dayName: "Wednesday", title: "Zone 2 Cardio", exercises: [cardio("Bike / Row", "45 min", "Recovery-friendly aerobic work.")] },
          { dayName: "Thursday", title: "Upper Volume", exercises: [ex("Incline DB Press", 4, "10-12", "75s"), ex("Chest-Supported Row", 4, "10-12", "75s"), ex("Lateral Raise", 4, "15-20", "45s"), ex("Tricep Pushdown", 3, "15", "45s")] },
          { dayName: "Friday", title: "Lower Volume + Conditioning", exercises: [ex("Leg Press", 4, "12-15", "75s"), ex("Leg Curl", 3, "12-15", "60s"), cardio("Intervals", "15 min", "Keep hard cardio purposeful.")] },
          { dayName: "Saturday", title: "Long Zone 2", exercises: [cardio("Long Easy Cardio", "60-75 min")] },
        ],
      },
    },
  },
  "Muscle Gain": {
    label: "Muscle Gain",
    philosophy:
      "Hypertrophy is driven by enough hard weekly sets, high-tension exercises, progressive overload and training close to failure — fueled by protein, food and recovery.",
    repScheme: "6–12 reps on compounds, 10–20 on accessories, 0–3 reps in reserve",
    intensity: "Moderate loads (60–80% 1RM) taken close to failure",
    weeklyVolume: "10–20 hard sets per muscle/week, each muscle trained ~2x",
    cardio: "1–3 easy sessions/week for health — not enough to blunt recovery.",
    proteinPerKg: 2.0,
    principles: [
      "10–20 hard sets per muscle per week is the growth window.",
      "Most hard sets should end 0–3 reps from failure.",
      "Train each muscle ~2x/week to distribute volume without junk sets.",
    ],
    byExperience: {
      Beginner: {
        splitName: "3-Day Full Body Hypertrophy",
        daysPerWeek: 3,
        days: [
          { dayName: "Monday", title: "Full Body — Squat Focus", exercises: [ex("Back Squat", 3, "6-8", "2m", "Add 2.5kg once you hit the top of the range."), ex("Bench Press", 3, "8-10", "90s"), ex("Lat Pulldown", 3, "10-12", "75s"), ex("Plank", 3, "45s", "45s")] },
          { dayName: "Wednesday", title: "Full Body — Press Focus", exercises: [ex("Overhead Press", 3, "6-8", "90s"), ex("Romanian Deadlift", 3, "8-10", "90s"), ex("Incline DB Press", 3, "10-12", "75s"), ex("Seated Row", 3, "10-12", "75s")] },
          { dayName: "Friday", title: "Full Body — Hinge & Pull Focus", exercises: [ex("Deadlift", 3, "5", "2m"), ex("Pull-ups", 3, "8-10", "90s"), ex("Leg Press", 3, "10-12", "75s"), ex("Barbell Curl", 2, "12", "45s")] },
        ],
      },
      Intermediate: {
        splitName: "4-Day Upper/Lower",
        daysPerWeek: 4,
        days: [
          { dayName: "Monday", title: "Upper A", exercises: [ex("Bench Press", 4, "8-10", "90s"), ex("Barbell Row", 4, "8-10", "90s"), ex("Overhead Press", 3, "10-12", "75s"), ex("Lateral Raise", 3, "15", "45s"), ex("Barbell Curl", 3, "12", "45s")] },
          { dayName: "Tuesday", title: "Lower A", exercises: [ex("Back Squat", 4, "8-10", "2m"), ex("Romanian Deadlift", 3, "10", "90s"), ex("Leg Press", 3, "12", "75s"), ex("Calf Raise", 4, "15", "45s")] },
          { dayName: "Thursday", title: "Upper B", exercises: [ex("Incline DB Press", 4, "10-12", "75s"), ex("Weighted Pull-ups", 4, "8-10", "90s"), ex("Cable Fly", 3, "12-15", "45s"), ex("Face Pull", 3, "15", "45s"), ex("Tricep Pushdown", 3, "12-15", "45s")] },
          { dayName: "Friday", title: "Lower B", exercises: [ex("Deadlift", 3, "6", "2m"), ex("Front Squat", 3, "8-10", "90s"), ex("Leg Curl", 3, "12-15", "60s"), ex("Hanging Leg Raise", 3, "12", "45s")] },
        ],
      },
      Advanced: {
        splitName: "5-Day Upper/Lower/Push/Pull/Legs",
        daysPerWeek: 5,
        days: [
          { dayName: "Monday", title: "Upper", exercises: [ex("Bench Press", 4, "6-8", "90s"), ex("Barbell Row", 4, "6-8", "90s"), ex("Overhead Press", 3, "8-10", "75s"), ex("Pull-ups", 3, "8-10", "75s")] },
          { dayName: "Tuesday", title: "Lower", exercises: [ex("Back Squat", 4, "6-8", "2m"), ex("Romanian Deadlift", 4, "8", "90s"), ex("Leg Press", 3, "12", "75s"), ex("Calf Raise", 4, "15", "45s")] },
          { dayName: "Thursday", title: "Push", exercises: [ex("Incline DB Press", 4, "10-12", "75s"), ex("Machine Shoulder Press", 3, "10-12", "60s"), ex("Cable Fly", 3, "12-15", "45s"), ex("Lateral Raise", 4, "15-20", "45s"), ex("Tricep Pushdown", 3, "12-15", "45s")] },
          { dayName: "Friday", title: "Pull", exercises: [ex("Weighted Pull-ups", 4, "8-10", "90s"), ex("Chest-Supported Row", 4, "10-12", "75s"), ex("Rear Delt Fly", 3, "15", "45s"), ex("Hammer Curl", 3, "12", "45s"), ex("Barbell Curl", 3, "12", "45s")] },
          { dayName: "Saturday", title: "Legs", exercises: [ex("Front Squat", 4, "8-10", "2m"), ex("Hip Thrust", 3, "10-12", "75s"), ex("Leg Curl", 3, "12-15", "60s"), ex("Leg Extension", 3, "15", "45s"), ex("Calf Raise", 4, "15-20", "45s")] },
        ],
      },
    },
  },
  Strength: {
    label: "Strength",
    philosophy:
      "Strength is the ability to produce force in specific lifts. It needs heavy loads, skill practice on the main lifts, longer rest, lower reps, planned progression and less failure than hypertrophy.",
    repScheme: "1–5 reps on main lifts, 4–8 for strength-size, 6–15 accessories",
    intensity: "Heavy — ~80%+ of 1RM on main lifts",
    weeklyVolume: "Main lifts 1–3x/week, ~2–3 hard sets per exercise",
    cardio: "Optional easy conditioning for recovery and work capacity.",
    proteinPerKg: 2.0,
    principles: [
      "Main, technical lift first while you're fresh.",
      "Rest 2–4 minutes on heavy work to keep performance up.",
      "Avoid taking heavy squats/benches/deadlifts to failure often.",
    ],
    byExperience: {
      Beginner: {
        splitName: "3-Day Full Body Strength",
        daysPerWeek: 3,
        days: [
          { dayName: "Monday", title: "Squat + Bench + Row", exercises: [ex("Back Squat", 5, "5", "3m", "Leave 1–2 reps in the tank — don't grind."), ex("Bench Press", 5, "5", "3m"), ex("Barbell Row", 3, "6-8", "2m")] },
          { dayName: "Wednesday", title: "Deadlift + Press + Pull-up", exercises: [ex("Deadlift", 4, "4", "3m"), ex("Overhead Press", 4, "5", "2m"), ex("Pull-ups", 3, "6-8", "2m")] },
          { dayName: "Friday", title: "Squat & Bench Variation + Hinge", exercises: [ex("Front Squat", 4, "5", "2m"), ex("Close-Grip Bench", 4, "6", "2m"), ex("Romanian Deadlift", 3, "8", "2m")] },
        ],
      },
      Intermediate: {
        splitName: "4-Day Upper/Lower Strength",
        daysPerWeek: 4,
        days: [
          { dayName: "Monday", title: "Upper Strength", exercises: [ex("Bench Press", 5, "3-5", "3m"), ex("Weighted Pull-ups", 4, "5", "2m"), ex("Overhead Press", 3, "5", "2m")] },
          { dayName: "Tuesday", title: "Lower Strength", exercises: [ex("Back Squat", 5, "3-5", "3m"), ex("Deadlift", 3, "3", "3m"), ex("Walking Lunge", 3, "8/leg", "90s")] },
          { dayName: "Thursday", title: "Upper Volume", exercises: [ex("Incline Bench", 4, "6-8", "2m"), ex("Barbell Row", 4, "6-8", "2m"), ex("Lateral Raise", 3, "12", "60s"), ex("Triceps Extension", 3, "10", "60s")] },
          { dayName: "Friday", title: "Lower Volume", exercises: [ex("Front Squat", 4, "6-8", "2m"), ex("Romanian Deadlift", 3, "8", "2m"), ex("Leg Curl", 3, "12", "60s"), ex("Calf Raise", 4, "12", "45s")] },
        ],
      },
      Advanced: {
        splitName: "Powerlifting Split",
        daysPerWeek: 4,
        days: [
          { dayName: "Monday", title: "Squat + Bench", exercises: [ex("Back Squat", 5, "3-5", "4m"), ex("Bench Press", 5, "3-5", "3m"), ex("Leg Press", 3, "8", "2m")] },
          { dayName: "Tuesday", title: "Deadlift + Posterior Chain", exercises: [ex("Deadlift", 5, "2-3", "4m"), ex("Romanian Deadlift", 3, "6", "2m"), ex("Barbell Row", 3, "8", "2m")] },
          { dayName: "Thursday", title: "Bench + Upper Back", exercises: [ex("Bench Press", 5, "5", "3m"), ex("Close-Grip Bench", 3, "6", "2m"), ex("Weighted Pull-ups", 4, "6", "2m"), ex("Face Pull", 3, "15", "60s")] },
          { dayName: "Friday", title: "Squat/Deadlift Variation + Accessories", exercises: [ex("Pause Squat", 4, "4", "3m"), ex("Deficit Deadlift", 3, "4", "3m"), ex("Hanging Leg Raise", 3, "12", "60s")] },
        ],
      },
    },
  },
  Athleticism: {
    label: "Athletic Performance",
    philosophy:
      "Athletic performance combines strength, power, conditioning, mobility and skill transfer. Train to move better, jump higher and sprint faster — not just to lift heavy in isolation.",
    repScheme: "Power 3–5 explosive reps, strength 4–6, conditioning intervals",
    intensity: "High-velocity power work + heavy strength + interval conditioning",
    weeklyVolume: "3–5 sessions mixing strength, power and conditioning",
    cardio: "Intervals + Zone 2 base for repeatable performance.",
    proteinPerKg: 1.8,
    principles: [
      "Power and heavy lifts go first, while the nervous system is fresh.",
      "Build an aerobic base — most conditioning should stay easy.",
      "Keep hard intervals limited and purposeful (1–2x/week).",
    ],
    byExperience: {
      Beginner: {
        splitName: "3-Day Athletic Full Body",
        daysPerWeek: 3,
        days: [
          { dayName: "Monday", title: "Power & Lower Strength", exercises: [ex("Box Jump", 4, "5", "90s", "Reset fully between reps — quality over fatigue."), ex("Back Squat", 4, "5", "2m"), ex("Walking Lunge", 3, "10/leg", "75s")] },
          { dayName: "Wednesday", title: "Upper Strength & Core", exercises: [ex("Bench Press", 4, "5", "2m"), ex("Pull-ups", 4, "6-8", "90s"), ex("Plank", 3, "45s", "45s"), cardio("Tempo Intervals", "12 min")] },
          { dayName: "Friday", title: "Total-Body Power + Conditioning", exercises: [ex("Power Clean", 5, "3", "2m"), ex("Kettlebell Swing", 3, "15", "60s"), cardio("Shuttle Runs / Sled", "15 min")] },
        ],
      },
      Intermediate: {
        splitName: "4-Day Strength + Power + Conditioning",
        daysPerWeek: 4,
        days: [
          { dayName: "Monday", title: "Lower Power", exercises: [ex("Box Jump", 4, "4", "90s"), ex("Back Squat", 4, "4-6", "2m"), ex("Romanian Deadlift", 3, "8", "90s")] },
          { dayName: "Tuesday", title: "Upper Strength", exercises: [ex("Bench Press", 4, "5", "2m"), ex("Weighted Pull-ups", 4, "5", "2m"), ex("Overhead Press", 3, "6-8", "90s"), ex("Med-Ball Throw", 3, "5", "60s")] },
          { dayName: "Thursday", title: "Conditioning", exercises: [cardio("Intervals", "20 min", "Hard but repeatable efforts."), cardio("Zone 2 Cooldown", "15 min")] },
          { dayName: "Friday", title: "Total-Body Power", exercises: [ex("Power Clean", 5, "3", "2m"), ex("Trap-Bar Jump", 4, "3", "90s"), ex("Sled Push", 4, "20m", "90s")] },
        ],
      },
      Advanced: {
        splitName: "5-Day Performance Split",
        daysPerWeek: 5,
        days: [
          { dayName: "Monday", title: "Max Strength — Lower", exercises: [ex("Back Squat", 5, "3", "3m"), ex("Deadlift", 4, "3", "3m"), ex("Nordic Curl", 3, "6", "90s")] },
          { dayName: "Tuesday", title: "Power & Speed", exercises: [ex("Power Clean", 6, "2", "2m"), ex("Sprint", 6, "30m", "2m", "Full recovery between sprints."), ex("Med-Ball Throw", 4, "4", "60s")] },
          { dayName: "Wednesday", title: "Conditioning", exercises: [cardio("Interval Conditioning", "25 min"), cardio("Mobility Flow", "10 min")] },
          { dayName: "Thursday", title: "Max Strength — Upper", exercises: [ex("Bench Press", 5, "3", "3m"), ex("Weighted Pull-ups", 4, "4", "2m"), ex("Overhead Press", 4, "5", "2m")] },
          { dayName: "Saturday", title: "Power + Long Conditioning", exercises: [ex("Trap-Bar Jump", 5, "3", "90s"), ex("Sled Push", 4, "25m", "90s"), cardio("Zone 2 Base", "40 min")] },
        ],
      },
    },
  },
};

// Target-physique emphasis — a weak-point / aesthetic finisher appended when the
// user has chosen a desired look during onboarding.
const PHYSIQUE_EMPHASIS: Record<Exclude<TargetPhysique, "">, { day: Workout; note: string }> = {
  // --- Men's physique goals -------------------------------------------------
  LeanVTaper: {
    note: "Lean V-taper — shoulder and back width plus lean conditioning for a tapered, broad-to-narrow look.",
    day: {
      dayName: "Sunday",
      title: "Width & Taper",
      exercises: [
        ex("Lateral Raises", 4, "15-20", "45s", "Cap the delts to widen the shoulders."),
        ex("Wide-Grip Lat Pulldown", 4, "10-12", "60s", "Build back width for the V-taper."),
        ex("Cable Lateral Raises", 3, "15", "45s"),
        ex("Hanging Leg Raises", 3, "12", "45s", "Tighten the waist to sharpen the taper."),
      ],
    },
  },
  Athletic: {
    note: "Athletic build — explosive, functional work to stay lean and sport-ready.",
    day: {
      dayName: "Sunday",
      title: "Athletic Conditioning",
      exercises: [
        ex("Box Jumps", 4, "5", "90s", "Explosive lower-body power."),
        ex("Kettlebell Swings", 4, "15", "60s"),
        ex("Sled Push", 4, "20m", "90s"),
        ex("Hanging Leg Raises", 3, "12", "45s"),
      ],
    },
  },
  Aesthetic: {
    note: "Aesthetic physique — extra side-delt, upper-chest and arm volume for symmetry, detail and visible abs.",
    day: {
      dayName: "Sunday",
      title: "Symmetry & Detail",
      exercises: [
        ex("Lateral Raises", 4, "15-20", "45s", "Build shoulder width for a capped, 3D look."),
        ex("Incline Dumbbell Flyes", 3, "12", "60s", "Upper-chest fullness."),
        ex("Cable Curls", 3, "12-15", "45s"),
        ex("Rope Pushdowns", 3, "15", "45s"),
        ex("Cable Crunches", 3, "15", "45s", "Carve out visible abs."),
      ],
    },
  },
  Mass: {
    note: "Mass build — heavy compound finisher to drive total-body size and raw strength.",
    day: {
      dayName: "Sunday",
      title: "Mass Builder",
      exercises: [
        ex("Deadlift", 5, "5", "3m", "Heavy compound to drive total-body mass."),
        ex("Barbell Squat", 4, "8", "2m"),
        ex("Weighted Dips", 3, "10", "90s"),
        ex("Barbell Shrugs", 4, "12", "60s"),
      ],
    },
  },
  // --- Women's physique goals -----------------------------------------------
  LeanToned: {
    note: "Lean & toned — full-body toning with core and conditioning to stay defined without bulk.",
    day: {
      dayName: "Sunday",
      title: "Tone & Conditioning",
      exercises: [
        ex("Walking Lunges", 3, "12", "60s", "Shape and tone the legs."),
        ex("Cable Glute Kickbacks", 3, "15", "45s"),
        ex("Lateral Raises", 3, "15", "45s", "Light, for a defined upper body."),
        ex("Plank", 3, "45s", "45s", "Core tightness."),
        ex("Incline Walk (Zone 2)", 1, "20m", "—", "Steady conditioning to stay lean."),
      ],
    },
  },
  StrongCurves: {
    note: "Strong curves — glute and leg emphasis for shape and strength while staying athletic.",
    day: {
      dayName: "Sunday",
      title: "Glutes & Curves",
      exercises: [
        ex("Hip Thrust", 4, "10-12", "90s", "Primary glute builder for shape and strength."),
        ex("Bulgarian Split Squat", 3, "10", "75s"),
        ex("Romanian Deadlift", 3, "10", "90s", "Hamstrings and glute tie-in."),
        ex("Cable Glute Kickbacks", 3, "15", "45s"),
        ex("Hip Abduction", 3, "20", "45s", "Upper-glute roundness."),
      ],
    },
  },
  Sculpted: {
    note: "Sculpted physique — shoulders, glutes, legs and abs for an aesthetic, symmetrical, stage-style look.",
    day: {
      dayName: "Sunday",
      title: "Sculpt & Symmetry",
      exercises: [
        ex("Lateral Raises", 4, "15-20", "45s", "Cap the shoulders for an hourglass frame."),
        ex("Hip Thrust", 4, "10-12", "90s", "Glute shape and strength."),
        ex("Walking Lunges", 3, "12", "60s"),
        ex("Cable Glute Kickbacks", 3, "15", "45s"),
        ex("Hanging Leg Raises", 3, "12", "45s", "Define the abs and tighten the waist."),
      ],
    },
  },
};

const parseWeightKg = (profile: UserProfile): number | null => {
  const raw = parseFloat(profile.weight);
  if (isNaN(raw) || raw <= 0) return null;
  return profile.weightUnit === "lb" ? raw * 0.453592 : raw;
};

const clone = (days: Workout[]): Workout[] =>
  days.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e })) }));

// Build a personalized program from the knowledge base, factoring in the user's
// goal, training experience, target physique and bodyweight (for protein).
const EXPERIENCES: Experience[] = ["Beginner", "Intermediate", "Advanced"];

const resolveExperience = (value: UserProfile["experience"]): Experience =>
  EXPERIENCES.includes(value as Experience) ? (value as Experience) : "Beginner";

export function buildProgram(profile: UserProfile, goal: Goal): GeneratedProgram {
  const experience = resolveExperience(profile.experience);
  const g: NonNullable<Goal> = goal ?? "Muscle Gain";
  const spec = GOAL_SPECS[g];
  const variant = spec.byExperience[experience];

  const baseDays = clone(variant.days);
  const emphasis = profile.targetPhysique ? PHYSIQUE_EMPHASIS[profile.targetPhysique] : null;
  if (emphasis) baseDays.push({ ...emphasis.day, exercises: emphasis.day.exercises.map((e) => ({ ...e })) });

  // Optimize the deterministic program to the athlete's actual training setup:
  // never prescribe a movement they can't do with their equipment, or a workout
  // they dislike. Applies to every experience level, not just beginners.
  const days = adaptPlanToEquipment(baseDays, profile);

  const kg = parseWeightKg(profile);
  const proteinTargetG = kg ? Math.round(spec.proteinPerKg * kg) : null;

  const meta: ProgramMeta = {
    goalLabel: spec.label,
    splitName: variant.splitName,
    daysPerWeek: days.length,
    experience,
    philosophy: spec.philosophy,
    repScheme: spec.repScheme,
    intensity: spec.intensity,
    weeklyVolume: spec.weeklyVolume,
    volumeTarget: volumeTargetFor(experience),
    setQuality: VOLUME_GUIDELINES.intensityRule,
    volumeDiminishingReturns: VOLUME_GUIDELINES.diminishingReturns,
    perMuscleVolume: VOLUME_GUIDELINES.perMuscleWeeklySets,
    cardio: spec.cardio,
    proteinTargetG,
    proteinNote: proteinTargetG
      ? `${spec.proteinPerKg} g/kg ≈ ${proteinTargetG} g/day`
      : `${spec.proteinPerKg} g/kg of bodyweight`,
    emphasis: emphasis ? emphasis.note : null,
    principles: spec.principles,
  };

  return { meta, days };
}
