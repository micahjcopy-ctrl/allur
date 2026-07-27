// ---------------------------------------------------------------------------
// Celebration engine — pure config + detection for ALLUR's tiered celebrations.
//
// Moments worth celebrating come in three sizes, and the size decides how loud
// the payoff is (a quiet tick vs. a chime vs. a full confetti burst):
//   • small  — a rep/meal logged: a subtle tick, no sound.
//   • medium — a workout or cardio session finished, a streak extended: a soft
//              chime + a small burst.
//   • big    — a level-up, a streak milestone, a new PR, a new score high, a
//              goal hit: a chime + full confetti + a banner.
//
// This module is pure and unit-tested; the provider/overlay handle the actual
// motion + audio (and honour prefers-reduced-motion there).
// ---------------------------------------------------------------------------

export type CelebrationTier = "small" | "medium" | "big";

export type CelebrationKind =
  | "levelUp"
  | "streakMilestone"
  | "pr"
  | "scoreHigh"
  | "workoutComplete"
  | "cardioComplete"
  | "goalHit"
  | "generic";

export interface CelebrationConfig {
  tier: CelebrationTier;
  emoji: string;
  title: string;
}

export const CELEBRATIONS: Record<CelebrationKind, CelebrationConfig> = {
  levelUp: { tier: "big", emoji: "🔥", title: "Level up!" },
  streakMilestone: { tier: "big", emoji: "🔥", title: "Streak milestone!" },
  pr: { tier: "big", emoji: "🏆", title: "New personal record!" },
  scoreHigh: { tier: "big", emoji: "⭐", title: "New Allur Score high!" },
  goalHit: { tier: "big", emoji: "🎯", title: "Goal hit!" },
  workoutComplete: { tier: "medium", emoji: "💪", title: "Workout complete" },
  cardioComplete: { tier: "medium", emoji: "🏃", title: "Cardio logged" },
  generic: { tier: "small", emoji: "✨", title: "Nice" },
};

/** Streak lengths (days) that earn a big celebration when first reached. */
export const STREAK_MILESTONES = [7, 14, 30, 60, 100, 180, 365];

/**
 * The highest milestone strictly crossed by moving from "prev" to "next"
 * (prev < milestone <= next). Returns null if none was crossed. Handles jumps
 * that clear several milestones at once by returning the largest.
 */
export function crossedMilestone(prev: number, next: number): number | null {
  let hit: number | null = null;
  for (const m of STREAK_MILESTONES) {
    if (prev < m && next >= m) hit = m;
  }
  return hit;
}

/** Best overall score among prior analyses (0 when there are none). */
export function bestOverallBefore(scores: number[]): number {
  let best = 0;
  for (const s of scores) if (s > best) best = s;
  return best;
}

/**
 * True when "candidate" beats every prior score AND there was at least one
 * prior score (the very first scan is a baseline, not a "new high").
 */
export function isNewScoreHigh(priorScores: number[], candidate: number): boolean {
  if (priorScores.length === 0) return false;
  return candidate > bestOverallBefore(priorScores);
}

export const TIER_RANK: Record<CelebrationTier, number> = {
  small: 0,
  medium: 1,
  big: 2,
};

/** Confetti particle count per tier (0 = no confetti). */
export function tierParticleCount(tier: CelebrationTier): number {
  if (tier === "big") return 120;
  if (tier === "medium") return 40;
  return 0;
}

/** How long the celebration overlay lingers, in ms. */
export function tierDurationMs(tier: CelebrationTier): number {
  if (tier === "big") return 2600;
  if (tier === "medium") return 1500;
  return 900;
}

/** Whether this tier plays the audio chime (small tiers stay silent). */
export function tierHasSound(tier: CelebrationTier): boolean {
  return tier !== "small";
}
