// Run with: bun test src/lib/__tests__
// Contract for the celebration engine: tier config integrity, streak-milestone
// crossing (including multi-milestone jumps and no double-fire), and new
// score-high detection (first scan is a baseline, ties don't count).
import { describe, expect, test } from "bun:test";
import {
  CELEBRATIONS,
  STREAK_MILESTONES,
  crossedMilestone,
  bestOverallBefore,
  isNewScoreHigh,
  tierParticleCount,
  tierDurationMs,
  tierHasSound,
  TIER_RANK,
} from "../celebration";

describe("config", () => {
  test("tiers are assigned as expected", () => {
    expect(CELEBRATIONS.levelUp.tier).toBe("big");
    expect(CELEBRATIONS.pr.tier).toBe("big");
    expect(CELEBRATIONS.scoreHigh.tier).toBe("big");
    expect(CELEBRATIONS.workoutComplete.tier).toBe("medium");
    expect(CELEBRATIONS.mealLogged.tier).toBe("medium");
    expect(CELEBRATIONS.nutritionGoal.tier).toBe("big");
    expect(CELEBRATIONS.generic.tier).toBe("small");
  });
  test("every kind has a title and emoji", () => {
    for (const c of Object.values(CELEBRATIONS)) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.emoji.length).toBeGreaterThan(0);
    }
  });
});

describe("streak milestones", () => {
  test("crossing fires once, exactly on the boundary", () => {
    expect(crossedMilestone(6, 7)).toBe(7);
    expect(crossedMilestone(7, 8)).toBe(null);
    expect(crossedMilestone(29, 30)).toBe(30);
  });
  test("a jump that clears several returns the largest", () => {
    expect(crossedMilestone(5, 40)).toBe(30);
    expect(crossedMilestone(0, 100)).toBe(100);
  });
  test("no streak and going backwards never celebrate", () => {
    expect(crossedMilestone(0, 0)).toBe(null);
    expect(crossedMilestone(100, 1)).toBe(null);
  });
  test("first milestone is a week", () => {
    expect(STREAK_MILESTONES[0]).toBe(7);
  });
});

describe("score highs", () => {
  test("best-before", () => {
    expect(bestOverallBefore([])).toBe(0);
    expect(bestOverallBefore([50, 62, 58])).toBe(62);
  });
  test("first scan is a baseline, not a high", () => {
    expect(isNewScoreHigh([], 70)).toBe(false);
  });
  test("beats prior max, ties do not", () => {
    expect(isNewScoreHigh([60], 65)).toBe(true);
    expect(isNewScoreHigh([60, 70], 70)).toBe(false);
    expect(isNewScoreHigh([60, 70], 71)).toBe(true);
  });
});

describe("tier params", () => {
  test("bigger tier, bigger payoff", () => {
    expect(tierParticleCount("big")).toBeGreaterThan(tierParticleCount("medium"));
    expect(tierParticleCount("small")).toBe(0);
    expect(tierDurationMs("big")).toBeGreaterThan(tierDurationMs("small"));
    expect(TIER_RANK.big).toBeGreaterThan(TIER_RANK.medium);
  });
  test("small tiers are silent", () => {
    expect(tierHasSound("small")).toBe(false);
    expect(tierHasSound("medium")).toBe(true);
    expect(tierHasSound("big")).toBe(true);
  });
});
