// ---------------------------------------------------------------------------
// ALLUR modular feature registry.
//
// Every major module of the app registers here with a stable key. Users can
// toggle non-core modules on/off ("Customize your app" in Settings); the
// toggle state is persisted per-user inside the fitness-state blob, so it
// syncs across devices and survives reinstalls.
//
// Semantics (product decision, 2026-07-09):
//   OFF  = hidden from navigation, dashboard and widgets AND the module's
//          background behaviour (prompts/notifications/collection) pauses.
//          Data and history are preserved untouched.
//   ON   = the module reappears exactly where it lives normally.
//
// New features: add one entry to FEATURES below and gate their surfaces with
// `isFeatureEnabled(...)` — they become user-toggleable automatically.
// ---------------------------------------------------------------------------

import type { Goal } from "@/context/FitCoachContext";

export type FeatureKey =
  | "plan"
  | "progress"
  | "coach"
  | "macros"
  | "squad"
  | "cardio";

export type FeatureToggles = Partial<Record<FeatureKey, boolean>>;

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  description: string;
  /** Core modules cannot be disabled (the app stops making sense without them). */
  core: boolean;
  /** Route the module lives at, used for nav wiring + direct-visit guards. */
  href: string;
  /**
   * Whether the module starts enabled for a brand-new user with this goal.
   * Non-core modules left off stay discoverable in Settings.
   */
  defaultOn: (goal: Goal) => boolean;
}

export const FEATURES: FeatureDef[] = [
  {
    key: "plan",
    label: "Training plan",
    description: "Your personalized workout program.",
    core: true,
    href: "/plan",
    defaultOn: () => true,
  },
  {
    key: "coach",
    label: "AI Coach",
    description: "24/7 coach that answers and updates your plan.",
    core: true,
    href: "/coach",
    defaultOn: () => true,
  },
  {
    key: "progress",
    label: "Progress tracking",
    description: "Weight, PRs, photos and physique analysis.",
    core: false,
    href: "/progress",
    defaultOn: () => true,
  },
  {
    key: "macros",
    label: "Macro tracker",
    description: "Photo meal logging with calorie & macro estimates.",
    core: false,
    href: "/macros",
    defaultOn: () => true,
  },
  {
    key: "squad",
    label: "Squad",
    description: "Train with friends — invites, duels and Respect.",
    core: false,
    href: "/squad",
    defaultOn: () => true,
  },
  {
    key: "cardio",
    label: "Cardio tracking",
    description: "GPS runs, rides, walks & hikes that feed your macros and coach.",
    core: false,
    href: "/cardio",
    // Cardio-forward goals start with it on; lifters keep it discoverable.
    defaultOn: (goal) => goal === "Weight Loss" || goal === "Athleticism",
  },
];

export const FEATURE_BY_KEY: Record<FeatureKey, FeatureDef> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f]),
) as Record<FeatureKey, FeatureDef>;

/** Modules the user may switch on/off in Settings. */
export const TOGGLEABLE_FEATURES = FEATURES.filter((f) => !f.core);

/**
 * Resolve a full toggle map from whatever was persisted (possibly undefined
 * or partial — older saves predate this system) plus the user's goal for
 * defaults. Core features are always forced on. Pure + deterministic so it
 * is directly testable.
 */
export function resolveFeatureToggles(
  saved: FeatureToggles | undefined,
  goal: Goal,
): Record<FeatureKey, boolean> {
  const out = {} as Record<FeatureKey, boolean>;
  for (const f of FEATURES) {
    if (f.core) {
      out[f.key] = true;
      continue;
    }
    const savedVal = saved?.[f.key];
    out[f.key] = typeof savedVal === "boolean" ? savedVal : f.defaultOn(goal);
  }
  return out;
}

/** Safe accessor — unknown/missing keys read as enabled (fail open for core UX). */
export function isEnabled(
  toggles: Partial<Record<FeatureKey, boolean>> | undefined,
  key: FeatureKey,
): boolean {
  if (FEATURE_BY_KEY[key]?.core) return true;
  const v = toggles?.[key];
  return typeof v === "boolean" ? v : true;
}
