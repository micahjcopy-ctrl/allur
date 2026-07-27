// Run with: bun test src/lib/__tests__
// Covers the streak engine's contract: the momentum + level curves, and the
// day-by-day aggregation over the data the app already logs (meals, finished
// workouts, cardio, weekly scans) — including daily caps, momentum compounding,
// the missed-day reset (level survives, momentum does not), and the
// yesterday-hold before today is logged.
import { describe, expect, test } from "bun:test";
import {
  computeStreak,
  momentumForStreak,
  levelCost,
  levelThreshold,
  levelForPoints,
  tierForLevel,
  MOMENTUM_MAX,
  type StreakInputs,
} from "../streak";

const NOW = new Date("2026-07-27T10:00:00");
const empty = (): StreakInputs => ({
  meals: [],
  workoutSessions: [],
  cardioActivities: [],
  physiqueAnalyses: [],
  now: NOW,
});
const d = (offset: number): string => {
  const x = new Date("2026-07-27T00:00:00");
  x.setDate(x.getDate() + offset);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
};

describe("curves", () => {
  test("momentum builds past day 1, caps at 2x", () => {
    expect(momentumForStreak(0)).toBe(1);
    expect(momentumForStreak(1)).toBe(1);
    expect(momentumForStreak(2)).toBe(1.05);
    expect(momentumForStreak(21)).toBe(2);
    expect(momentumForStreak(999)).toBe(MOMENTUM_MAX);
  });
  test("levels are monotonic and never negative", () => {
    expect(levelCost(1)).toBe(100);
    expect(levelCost(2)).toBe(150);
    expect(levelThreshold(1)).toBe(0);
    expect(levelThreshold(2)).toBe(100);
    expect(levelThreshold(3)).toBe(250);
    expect(levelForPoints(0)).toBe(1);
    expect(levelForPoints(99)).toBe(1);
    expect(levelForPoints(100)).toBe(2);
    expect(levelForPoints(250)).toBe(3);
  });
  test("tiers", () => {
    expect(tierForLevel(1)).toBe("Ember");
    expect(tierForLevel(5)).toBe("Blaze");
    expect(tierForLevel(20)).toBe("Supernova");
  });
});

describe("computeStreak", () => {
  test("empty state", () => {
    const s = computeStreak(empty());
    expect(s.currentStreak).toBe(0);
    expect(s.lifetimePoints).toBe(0);
    expect(s.level).toBe(1);
    expect(s.momentum).toBe(1);
    expect(s.activeToday).toBe(false);
    expect(s.recentDays.length).toBe(14);
  });

  test("a single finished workout today", () => {
    const s = computeStreak({
      ...empty(),
      workoutSessions: [{ finishedAt: d(0) + "T09:00:00" }],
    });
    expect(s.currentStreak).toBe(1);
    expect(s.activeToday).toBe(true);
    expect(s.lifetimePoints).toBe(30);
    expect(s.todayPoints).toBe(30);
    const wk = s.todaySources.find((x) => x.key === "workout")!;
    expect(wk.points).toBe(30);
    expect(wk.capped).toBe(true);
  });

  test("daily caps: five meals count as three", () => {
    const s = computeStreak({
      ...empty(),
      meals: Array.from({ length: 5 }, () => ({ date: d(0) })),
    });
    const meal = s.todaySources.find((x) => x.key === "meal")!;
    expect(meal.count).toBe(5);
    expect(meal.points).toBe(30);
    expect(s.lifetimePoints).toBe(30);
  });

  test("consecutive days compound momentum", () => {
    const s = computeStreak({
      ...empty(),
      workoutSessions: [
        { finishedAt: d(-2) + "T09:00:00" },
        { finishedAt: d(-1) + "T09:00:00" },
        { finishedAt: d(0) + "T09:00:00" },
      ],
    });
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
    expect(s.momentum).toBe(1.1);
    expect(s.lifetimePoints).toBe(
      Math.round(30 * 1.0) + Math.round(30 * 1.05) + Math.round(30 * 1.1),
    );
  });

  test("a missed day resets momentum but preserves level + points", () => {
    const s = computeStreak({
      ...empty(),
      workoutSessions: [
        { finishedAt: d(-7) + "T09:00:00" },
        { finishedAt: d(-6) + "T09:00:00" },
        { finishedAt: d(-5) + "T09:00:00" },
        { finishedAt: d(-4) + "T09:00:00" },
        { finishedAt: d(-3) + "T09:00:00" },
        { finishedAt: d(0) + "T09:00:00" },
      ],
    });
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(5);
    expect(s.momentum).toBe(1);
    expect(s.lifetimePoints).toBeGreaterThan(30);
  });

  test("streak holds when yesterday was logged but today is not yet", () => {
    const s = computeStreak({
      ...empty(),
      workoutSessions: [
        { finishedAt: d(-1) + "T09:00:00" },
        { finishedAt: d(-2) + "T09:00:00" },
      ],
    });
    expect(s.activeToday).toBe(false);
    expect(s.currentStreak).toBe(2);
    expect(s.momentum).toBe(1.05);
  });

  test("unfinished workouts do not count", () => {
    const s = computeStreak({
      ...empty(),
      workoutSessions: [{ finishedAt: null }],
    });
    expect(s.currentStreak).toBe(0);
    expect(s.lifetimePoints).toBe(0);
  });

  test("all four sources on one day", () => {
    const s = computeStreak({
      ...empty(),
      workoutSessions: [{ finishedAt: d(0) + "T09:00:00" }],
      cardioActivities: [{ startedAt: d(0) + "T07:00:00" }],
      meals: [{ date: d(0) }, { date: d(0) }],
      physiqueAnalyses: [{ date: d(0) }],
    });
    expect(s.todaySources.reduce((a, x) => a + x.points, 0)).toBe(110);
    expect(s.lifetimePoints).toBe(110);
  });
});
