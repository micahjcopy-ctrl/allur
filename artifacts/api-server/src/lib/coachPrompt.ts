// ALLUR — server-side coaching knowledge & system prompt builder.
//
// This mirrors the philosophy encoded in the frontend training knowledge base
// (artifacts/fitcoach/src/data/trainingKnowledge.ts). The frontend file imports
// React-app types, so it cannot be imported here; the durable principles are
// re-encoded as plain data so the coach's advice stays grounded and consistent
// with the program generator.

import type { CoachChatRequest, PersonalizePlanRequest } from "@workspace/api-zod";
import { BODY_FAT_COACH_REFERENCE } from "./bodyFatKnowledge";
import { FITNESS_KNOWLEDGE_REFERENCE } from "./fitnessKnowledge";

const UNIVERSAL_PRINCIPLES = [
  "Specificity — train the exact quality you want to improve.",
  "Progressive overload — gradually add weight, reps, sets, range, or quality.",
  "Volume drives adaptation, but only what you can recover from.",
  "Match intensity to the goal: heavy for strength, moderate near-failure for muscle.",
  "Proximity to failure matters more for muscle than for strength.",
  "Most people need both lifting and cardio (~150 min/wk + 2+ strength days).",
];

interface GoalKnowledge {
  label: string;
  philosophy: string;
  repScheme: string;
  intensity: string;
  weeklyVolume: string;
  cardio: string;
  proteinPerKg: number;
  principles: string[];
}

const GOAL_KNOWLEDGE: Record<string, GoalKnowledge> = {
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
  },
};

function formatPlan(plan: CoachChatRequest["plan"]): string {
  if (!plan.length) return "(no plan generated yet)";
  return plan
    .map((day) => {
      const lines = day.exercises
        .map(
          (e) =>
            `    - ${e.name}: ${e.sets} x ${e.reps}, rest ${e.rest}${
              e.note ? ` (${e.note})` : ""
            }`,
        )
        .join("\n");
      return `  ${day.dayName} — ${day.title}\n${lines}`;
    })
    .join("\n");
}

export function physiqueSection(
  physique: CoachChatRequest["physique"],
): string {
  if (!physique) return "";
  const parts = physique.parts ?? [];
  const weak = parts.filter((p) => p.status === "weak");
  const strong = parts.filter((p) => p.status === "strong");
  const ratingLine = parts.length
    ? parts
        .map((p) => `${p.part} ${Math.round(p.rating)}/100 (${p.status})`)
        .join(", ")
    : "(no per-muscle ratings)";

  const lines = [
    "## Latest AI physique analysis (use this to personalize training)",
    `- Estimated body fat: ${physique.bodyFatLow}–${physique.bodyFatHigh}% (midpoint ~${physique.bodyFatMidpoint}%).`,
    `- Overall development score: ${Math.round(physique.overallScore)}/100.`,
    `- Per-muscle development: ${ratingLine}.`,
  ];
  if (weak.length) {
    lines.push(
      `- Lagging / priority muscle groups: ${weak.map((p) => p.part).join(", ")}. Bias extra weekly volume toward these (add 2-4 hard sets/week each, or a targeted exercise) without overshooting recoverable volume.`,
    );
  }
  if (strong.length) {
    lines.push(
      `- Already well-developed: ${strong.map((p) => p.part).join(", ")}. Keep these at maintenance volume rather than adding more.`,
    );
  }
  lines.push(
    "- Let the body-fat estimate inform emphasis: higher body fat → keep/raise conditioning and protect muscle in a deficit; leaner → it's fine to push hypertrophy volume.",
    "",
  );
  return lines.join("\n");
}

function guidelinesSection(profile: CoachChatRequest["profile"]): string {
  const injuries = profile.injuries?.trim();
  const dietary = profile.dietary?.trim();
  const equipment = profile.equipment?.trim();
  const dislikes = profile.dislikes?.trim();
  const preferences = profile.preferences?.trim();
  if (!injuries && !dietary && !equipment && !dislikes && !preferences) return "";

  const lines = ["## User guidelines (hard constraints — always honor these)"];
  if (injuries) {
    lines.push(
      `- Injuries / physical limitations: ${injuries}`,
      "  Train around these. Never program movements that would aggravate them — substitute a safe alternative for the same muscle/pattern and briefly say why. When in doubt, pick the gentler option.",
    );
  }
  if (dietary) {
    lines.push(
      `- Dietary restrictions / preferences: ${dietary}`,
      "  All nutrition, meal, protein, and supplement advice must respect these. Never suggest foods that violate them.",
    );
  }
  if (equipment) {
    lines.push(
      `- Available equipment / facilities: ${equipment}`,
      "  Only program movements the user can actually perform with this equipment. If an ideal exercise needs gear they don't have, substitute within the same movement pattern and briefly note the swap. Never assume access to anything not listed.",
    );
  }
  if (dislikes) {
    lines.push(
      `- Disliked workouts (do NOT program these): ${dislikes}`,
      "  Keep these out of the plan entirely. This applies especially to cardio — if they dislike a modality (e.g. running), use a different one they tolerate or one of their enjoyed sports/classes instead.",
    );
  }
  if (preferences) {
    lines.push(
      `- Enjoyed training / sports / classes: ${preferences}`,
      "  Bias the plan toward these for adherence, and offer them as cardio/conditioning alternatives where they fit the goal (e.g. a spin class or pickup basketball can replace a steady-state cardio slot).",
    );
  }
  lines.push("");
  return lines.join("\n");
}

export function buildCoachSystemPrompt(body: CoachChatRequest): string {
  const { goal, profile, plan, physique } = body;
  const knowledge = goal ? GOAL_KNOWLEDGE[goal] : undefined;

  const goalSection = knowledge
    ? [
        `The user's goal is "${goal}" (${knowledge.label}).`,
        `Philosophy: ${knowledge.philosophy}`,
        `Rep scheme: ${knowledge.repScheme}`,
        `Intensity: ${knowledge.intensity}`,
        `Weekly volume: ${knowledge.weeklyVolume}`,
        `Cardio: ${knowledge.cardio}`,
        `Protein target: ~${knowledge.proteinPerKg} g/kg of bodyweight per day.`,
        `Goal-specific principles:\n${knowledge.principles.map((p) => `  - ${p}`).join("\n")}`,
      ].join("\n")
    : "The user has not selected a specific training goal yet.";

  return [
    "You are the ALLUR Coach, an expert, friendly strength & conditioning coach inside the ALLUR app.",
    "You give concise, practical, science-based advice and have a warm, motivating tone. Keep replies short and conversational (2-5 sentences) unless the user asks for detail. You are speaking with the user in a chat that may also be read aloud, so avoid markdown tables and long bullet dumps.",
    "",
    "## Universal training principles (always honor these)",
    UNIVERSAL_PRINCIPLES.map((p) => `- ${p}`).join("\n"),
    "",
    "## This user",
    `- Name: ${profile.name || "(unknown)"}`,
    `- Training experience: ${profile.experience || "(unknown)"}`,
    `- Target physique: ${profile.targetPhysique || "(none specified)"}`,
    `- Activity level: ${profile.activityLevel || "(unknown)"}`,
    "",
    guidelinesSection(profile),
    physiqueSection(physique),
    "## Goal context",
    goalSection,
    "",
    "## Fitness knowledge base (reason with this on every turn)",
    FITNESS_KNOWLEDGE_REFERENCE,
    "",
    "## Body-fat % knowledge",
    BODY_FAT_COACH_REFERENCE,
    "",
    "## The user's current workout plan",
    formatPlan(plan),
    "",
    "## Modifying the plan",
    "You can edit the user's workout plan, but ONLY by calling the `update_training_plan` tool.",
    "Rules for editing:",
    "- Only call the tool when the user has clearly agreed to a concrete change (e.g. 'yes, swap that', 'add a leg day', 'make Monday push instead'). Never edit the plan based on a vague or exploratory question.",
    "- When exploring options or answering a question, just reply in text. Propose changes and ask for confirmation first; apply them on the next turn once the user agrees.",
    "- When you DO call the tool, you must return the COMPLETE updated plan (every day, every exercise) in `days`, not just the changed part. Preserve the days/exercises the user did not ask to change.",
    "- Keep any change consistent with the universal principles and the user's goal above.",
    "- `message` is your normal conversational reply to show in chat. `summary` is a very short (3-6 word) label of what changed, e.g. 'Added a dedicated leg day'.",
    "- Day objects need dayName, title, and exercises[]. Each exercise needs name, sets (number), reps (string like '8-12'), rest (string like '90s'), and an optional note.",
  ].join("\n");
}

/**
 * System prompt for the automatic plan-personalization pass that runs after a
 * fresh physique analysis. Unlike the conversational coach, this is NOT a
 * back-and-forth: the act of running the analysis IS the user's agreement, so
 * the model must rebalance the plan in a single shot and report exactly what it
 * changed via the rebalance_training_plan tool.
 */
export function buildPersonalizePlanPrompt(body: PersonalizePlanRequest): string {
  const { goal, profile, plan, physique } = body;
  const knowledge = goal ? GOAL_KNOWLEDGE[goal] : undefined;

  const goalSection = knowledge
    ? [
        `The user's goal is "${goal}" (${knowledge.label}).`,
        `Rep scheme: ${knowledge.repScheme}`,
        `Intensity: ${knowledge.intensity}`,
        `Weekly volume: ${knowledge.weeklyVolume}`,
        `Goal-specific principles:\n${knowledge.principles.map((p) => `  - ${p}`).join("\n")}`,
      ].join("\n")
    : "The user has not selected a specific training goal yet.";

  return [
    "You are the ALLUR Coach personalizing a user's workout plan from their latest AI physique analysis.",
    "The user just ran a physique scan. Rebalance their CURRENT plan so it better fits what the scan revealed, then report what you changed. This is a one-shot automatic adjustment — do NOT ask questions or wait for confirmation.",
    "",
    "## Universal training principles (always honor these)",
    UNIVERSAL_PRINCIPLES.map((p) => `- ${p}`).join("\n"),
    "",
    "## This user",
    `- Name: ${profile.name || "(unknown)"}`,
    `- Training experience: ${profile.experience || "(unknown)"}`,
    `- Target physique: ${profile.targetPhysique || "(none specified)"}`,
    `- Activity level: ${profile.activityLevel || "(unknown)"}`,
    "",
    guidelinesSection(profile),
    physiqueSection(physique),
    "## Goal context",
    goalSection,
    "",
    "## Fitness knowledge base (reason with this)",
    FITNESS_KNOWLEDGE_REFERENCE,
    "",
    "## The user's current workout plan",
    formatPlan(plan),
    "",
    "## How to rebalance",
    "- Add training volume to the lagging / priority muscle groups the analysis flagged: add 2-4 hard sets/week to each (extra sets on existing exercises and/or a targeted accessory), distributed across the week — never dump it all in one day.",
    "- Pull back slightly on already well-developed groups (toward maintenance) if needed to keep total weekly volume recoverable for the user's experience level. Do not bloat the plan.",
    "- Use the body-fat estimate to set emphasis: higher body fat → keep or add conditioning and protect muscle; leaner → it's fine to push hypertrophy volume.",
    "- Respect the user's goal, experience-appropriate volume landmarks, and any injury/dietary constraints above. Never program movements that would aggravate a stated injury.",
    "- Keep the same number of training days and the overall structure the user already has unless a small change is clearly needed; this is a rebalance, not a rewrite.",
    "",
    "## You MUST respond by calling the rebalance_training_plan tool",
    "- `days`: the COMPLETE updated plan (every day, every exercise), preserving everything you did not intentionally change. Day objects need dayName, title, exercises[]. Each exercise needs name, sets (number), reps (string like '8-12'), rest (string like '90s'), optional note.",
    "- `summary`: a very short (3-6 word) label, e.g. 'Added shoulder & arm volume'.",
    "- `explanation`: a warm, plain-language paragraph (2-4 sentences) telling the user how their scan shaped these changes.",
    "- `changes`: a list of specific, concrete changes you made, each one short and readable, e.g. 'Added 3 sets of lateral raises on Push day for lagging shoulders'.",
  ].join("\n");
}
