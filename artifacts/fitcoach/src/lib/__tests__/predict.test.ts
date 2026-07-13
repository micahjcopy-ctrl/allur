// Run with: bun test src/lib/__tests__
// Predictive next-set logic â must be conservative, unit-correct, explainable.
import { describe, expect, test } from "bun:test";
import {
  estimateOneRepMax,
  roundToStep,
  suggestWeight,
  topTargetReps,
} from "../predict";
import type { SessionExercise, WorkoutSession } from "@/context/FitCoachContext";

const ex = (over: Partial<SessionExercise>): SessionExercise => ({
  name: "Bench Press",
  targetSets: 3,
  targetReps: "8-12",
  completed: true,
  weight: 100,
  unit: "kg",
  reps: null,
  ...over,
});

const session = (over: Partial<WorkoutSession>): WorkoutSession => ({
  id: "s1",
  dayName: "Push",
  title: "Push Day",
  startedAt: "2026-07-01T10:00:00.000Z",
  finishedAt: "2026-07-01T11:00:00.000Z",
  exercises: [ex({})],
  ...over,
});

describe("helpers", () => {
  test("topTargetReps parses ranges, singles, en-dashes", () => {
    expect(topTargetReps("8-12")).toBe(12);
    expect(topTargetReps("10")).toBe(10);
    expect(topTargetReps("8â10 reps")).toBe(10);
    expect(topTargetReps("AMRAP")).toBe(0);
  });

  test("roundToStep snaps to plate increments", () => {
    expect(roundToStep(101.2, "kg")).toBe(100);
    expect(roundToStep(223, "lb")).toBe(225);
  });

  test("Epley 1RM", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.3, 1);
    expect(estimateOneRepMax(0, 5)).toBe(0);
  });
});

describe("suggestWeight", () => {
  test("no history -> no suggestion", () => {
    expect(suggestWeight([], "Bench Press", "8-12", "kg")).toBeNull();
  });

  test("hit the top of the range -> advances the load", () => {
    const s = suggestWeight(
      [session({ exercises: [ex({ weight: 100, reps: 12 })] })],
      "Bench Press",
      "8-12",
      "kg",
    )!;
    expect(s.weight).toBe(102.5); // +2.5 kg isolation/upper step
    expect(s.progressed).toBe(true);
    expect(s.rationale).toContain("Up from 100");
  });

  test("missed the range -> holds the weight", () => {
    const s = suggestWeight(
      [session({ exercises: [ex({ weight: 100, reps: 8 })] })],
      "Bench Press",
      "8-12",
      "kg",
    )!;
    expect(s.weight).toBe(100);
    expect(s.progressed).toBe(false);
    expect(s.rationale).toContain("lock in your reps");
  });

  test("completed with no rep count is treated as a hit", () => {
    const s = suggestWeight(
      [session({ exercises: [ex({ weight: 100, reps: null, completed: true })] })],
      "Bench Press",
      "8-12",
      "kg",
    )!;
    expect(s.progressed).toBe(true);
  });

  test("heavy compound gets the bigger jump", () => {
    const s = suggestWeight(
      [session({ exercises: [ex({ name: "Back Squat", weight: 140, reps: 5 })] })],
      "Back Squat",
      "5",
      "kg",
    )!;
    expect(s.weight).toBe(145); // +5 kg
  });

  test("converts to the display unit the lifter is using", () => {
    const s = suggestWeight(
      [session({ exercises: [ex({ weight: 100, unit: "kg", reps: 12 })] })],
      "Bench Press",
      "8-12",
      "lb",
    )!;
    // 102.5 kg -> ~225.97 lb -> snapped to 225, above last-shown 220
    expect(s.weight).toBe(225);
    expect(s.unit).toBe("lb");
    expect(s.progressed).toBe(true);
  });

  test("uses the most recent finished session, ignores in-progress", () => {
    const s = suggestWeight(
      [
        session({ id: "old", finishedAt: "2026-06-01T10:00:00.000Z", exercises: [ex({ weight: 90, reps: 12 })] }),
        session({ id: "new", finishedAt: "2026-07-08T10:00:00.000Z", exercises: [ex({ weight: 105, reps: 12 })] }),
        session({ id: "live", finishedAt: null, exercises: [ex({ weight: 200, reps: 12 })] }),
      ],
      "Bench Press",
      "8-12",
      "kg",
    )!;
    expect(s.weight).toBe(107.5); // from the 105 kg session, not 90 or the live 200
  });
});
