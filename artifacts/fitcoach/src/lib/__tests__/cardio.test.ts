// Run with: bun test src/lib/__tests__
// Covers the three contract areas the cardio feature promises:
//   1. calorie -> macro adjustment
//   2. activity -> AI-trainer data contract (CardioLoadSummary)
//   3. GPS track math feeding both
import { describe, expect, test } from "bun:test";
import {
  applyActivityCalories,
  activityCaloriesOn,
  buildCardioLoadSummary,
  computeTrackStats,
  describeCardioLoad,
  estimateCalories,
  fmtDistance,
  fmtPace,
  haversineM,
  lbsToKg,
  metFor,
  slimTrack,
  type CardioActivity,
  type TrackPoint,
} from "../cardio";

const mk = (over: Partial<CardioActivity>): CardioActivity => ({
  id: "a1",
  type: "run",
  startedAt: "2026-07-09T10:00:00.000Z",
  finishedAt: "2026-07-09T10:30:00.000Z",
  source: "gps",
  distanceM: 5000,
  elapsedSec: 1800,
  movingSec: 1700,
  avgSpeedMps: 5000 / 1700,
  maxSpeedMps: 4,
  elevGainM: 40,
  elevLossM: 40,
  uphillDistM: 900,
  downhillDistM: 900,
  calories: 350,
  points: [],
  ...over,
});

describe("geo math", () => {
  test("haversine: ~111km per degree of latitude", () => {
    const d = haversineM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });

  test("track stats: distance, moving time, elevation split", () => {
    // straight line north, 10 m every 5 s, climbing 2 m per step for the
    // second half — 20 points ≈ 190 m
    const pts: TrackPoint[] = [];
    for (let i = 0; i < 20; i++) {
      pts.push({
        t: i * 5000,
        lat: i * (10 / 111_320), // ~10 m per step
        lon: 0,
        alt: i < 10 ? 100 : 100 + (i - 9) * 2,
        acc: 5,
      });
    }
    const s = computeTrackStats(pts);
    expect(s.distanceM).toBeGreaterThan(170);
    expect(s.distanceM).toBeLessThan(210);
    expect(s.elapsedSec).toBe(95);
    expect(s.movingSec).toBeGreaterThan(80); // constant 2 m/s => always moving
    expect(s.elevGainM).toBeGreaterThanOrEqual(18);
    expect(s.elevLossM).toBe(0);
    expect(s.uphillDistM).toBeGreaterThan(0);
    expect(s.downhillDistM).toBe(0);
    expect(s.avgSpeedMps).toBeGreaterThan(1.5);
    expect(s.avgSpeedMps).toBeLessThan(2.5);
  });

  test("track stats: bad-accuracy fixes and jitter are ignored", () => {
    const pts: TrackPoint[] = [
      { t: 0, lat: 0, lon: 0, acc: 5 },
      { t: 1000, lat: 0.00001, lon: 0, acc: 5 }, // ~1.1 m: jitter, skipped
      { t: 2000, lat: 0.5, lon: 0, acc: 500 }, // filtered by accuracy
      { t: 3000, lat: 0.00002, lon: 0, acc: 5 },
    ];
    const s = computeTrackStats(pts);
    expect(s.distanceM).toBeLessThan(5);
  });

  test("empty / single-point tracks are safe", () => {
    expect(computeTrackStats([]).distanceM).toBe(0);
    expect(computeTrackStats([{ t: 0, lat: 0, lon: 0 }]).avgSpeedMps).toBe(0);
  });
});

describe("calories", () => {
  test("MET tables are monotonic in speed", () => {
    expect(metFor("run", 2)).toBeLessThan(metFor("run", 4));
    expect(metFor("cycle", 3)).toBeLessThan(metFor("cycle", 8));
    expect(metFor("walk", 0.8)).toBeLessThan(metFor("walk", 1.7));
  });

  test("5k easy run for 70kg ≈ 300-450 kcal", () => {
    const kcal = estimateCalories({
      type: "run",
      movingSec: 1800,
      distanceM: 5000,
      elevGainM: 0,
      weightKg: 70,
    });
    expect(kcal).toBeGreaterThan(280);
    expect(kcal).toBeLessThan(460);
  });

  test("climbing adds energy", () => {
    const flat = estimateCalories({ type: "hike", movingSec: 3600, distanceM: 5000, elevGainM: 0, weightKg: 80 });
    const hilly = estimateCalories({ type: "hike", movingSec: 3600, distanceM: 5000, elevGainM: 500, weightKg: 80 });
    expect(hilly - flat).toBeGreaterThan(150);
  });

  test("degenerate inputs return 0", () => {
    expect(estimateCalories({ type: "run", movingSec: 0, distanceM: 0, elevGainM: 0, weightKg: 70 })).toBe(0);
    expect(estimateCalories({ type: "run", movingSec: 100, distanceM: 100, elevGainM: 0, weightKg: 0 })).toBe(0);
  });

  test("lbs conversion", () => {
    expect(lbsToKg(154)).toBeCloseTo(69.85, 1);
  });
});

describe("macro adjustment (calorie -> targets)", () => {
  const base = { calories: 2400, protein: 180, carbs: 250, fat: 70 };

  test("earned calories split 60/40 carbs/fat, protein untouched", () => {
    const t = applyActivityCalories(base, 400);
    expect(t.calories).toBe(2800);
    expect(t.protein).toBe(180);
    expect(t.carbs).toBe(250 + Math.round((400 * 0.6) / 4)); // +60 g
    expect(t.fat).toBe(70 + Math.round((400 * 0.4) / 9)); // +18 g
  });

  test("zero/negative activity leaves target unchanged (new object)", () => {
    const t = applyActivityCalories(base, 0);
    expect(t).toEqual(base);
    expect(t).not.toBe(base);
  });

  test("activityCaloriesOn sums only the given local day", () => {
    const acts = [
      mk({ id: "1", finishedAt: new Date(2026, 6, 9, 8).toISOString(), calories: 300 }),
      mk({ id: "2", finishedAt: new Date(2026, 6, 9, 18).toISOString(), calories: 200 }),
      mk({ id: "3", finishedAt: new Date(2026, 6, 8, 12).toISOString(), calories: 999 }),
    ];
    expect(activityCaloriesOn(acts, new Date(2026, 6, 9, 12))).toBe(500);
  });
});

describe("AI-trainer contract (CardioLoadSummary)", () => {
  const now = new Date("2026-07-09T20:00:00.000Z");

  test("only counts the trailing window and aggregates correctly", () => {
    const acts = [
      mk({ id: "1", finishedAt: "2026-07-09T10:30:00.000Z", movingSec: 1800, distanceM: 5000, elevGainM: 100, type: "run" }),
      mk({ id: "2", finishedAt: "2026-07-06T10:30:00.000Z", movingSec: 3600, distanceM: 20000, elevGainM: 50, type: "cycle" }),
      mk({ id: "old", finishedAt: "2026-06-20T10:30:00.000Z", movingSec: 9999, distanceM: 99999 }),
    ];
    const s = buildCardioLoadSummary(acts, now);
    expect(s.sessions).toBe(2);
    expect(s.totalMovingMin).toBe(90);
    expect(s.totalKm).toBe(25);
    expect(s.totalElevGainM).toBe(150);
    expect(s.byType.run).toBe(1);
    expect(s.byType.cycle).toBe(1);
    expect(s.relativeEffort).toBeGreaterThan(0);
    expect(s.lastActivityAt).toBe("2026-07-09T10:30:00.000Z");
  });

  test("empty week -> calm contract + calm sentence", () => {
    const s = buildCardioLoadSummary([], now);
    expect(s.sessions).toBe(0);
    expect(s.relativeEffort).toBe(0);
    expect(describeCardioLoad(s)).toContain("No cardio");
  });

  test("high load is flagged for recovery in the prompt line", () => {
    const acts = Array.from({ length: 5 }, (_, i) =>
      mk({ id: String(i), finishedAt: "2026-07-08T10:00:00.000Z", movingSec: 5400, distanceM: 15000, elevGainM: 300 }),
    );
    const s = buildCardioLoadSummary(acts, now);
    expect(s.relativeEffort).toBeGreaterThanOrEqual(250);
    expect(describeCardioLoad(s)).toContain("recovery");
  });
});

describe("persistence + formatting", () => {
  test("slimTrack caps points and keeps endpoints", () => {
    const pts: TrackPoint[] = Array.from({ length: 5000 }, (_, i) => ({ t: i, lat: i, lon: 0, acc: 5 }));
    const slim = slimTrack(pts);
    expect(slim.length).toBeLessThanOrEqual(160);
    expect(slim[0].t).toBe(0);
    expect(slim[slim.length - 1].t).toBe(4999);
    expect((slim[0] as TrackPoint).acc).toBeUndefined(); // acc stripped
  });

  test("formatters", () => {
    expect(fmtDistance(1609.344, "imperial")).toBe("1.00 mi");
    expect(fmtDistance(1500, "metric")).toBe("1.50 km");
    expect(fmtPace(3.352, "imperial")).toMatch(/8:00 \/mi/);
    expect(fmtPace(0, "metric")).toBe("--:--");
  });
});
