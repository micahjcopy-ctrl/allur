// Run with: bun test src/lib/__tests__
// Auto PR detection â only genuine records, correct across kg/lb + reps.
import { describe, expect, test } from "bun:test";
import { detectPRs, prHitToRecord } from "../prs";
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
  id: "cur",
  dayName: "Push",
  title: "Push Day",
  startedAt: "2026-07-08T10:00:00.000Z",
  finishedAt: "2026-07-08T11:00:00.000Z",
  exercises: [ex({})],
  ...over,
});

describe("detectPRs", () => {
  test("first-ever lift is a baseline, not a celebrated PR", () => {
    const cur = session({ exercises: [ex({ weight: 100 })] });
    expect(detectPRs(cur, [])).toHaveLength(0);
  });

  test("beating the prior best weight fires a PR", () => {
    const prior = session({ id: "old", finishedAt: "2026-07-01T10:00:00.000Z", exercises: [ex({ weight: 100 })] });
    const cur = session({ id: "cur", exercises: [ex({ weight: 105 })] });
    const hits = detectPRs(cur, [prior]);
    expect(hits).toHaveLength(1);
    expect(hits[0].exercise).toBe("Bench Press");
    expect(hits[0].weight).toBe(105);
  });

  test("matching or under the prior best is not a PR", () => {
    const prior = session({ id: "old", finishedAt: "2026-07-01T10:00:00.000Z", exercises: [ex({ weight: 105 })] });
    const same = session({ id: "cur", exercises: [ex({ weight: 105 })] });
    const under = session({ id: "cur2", exercises: [ex({ weight: 100 })] });
    expect(detectPRs(same, [prior])).toHaveLength(0);
    expect(detectPRs(under, [prior])).toHaveLength(0);
  });

  test("uses estimated 1RM when reps are present (more reps at same load = PR)", () => {
    const prior = session({ id: "old", finishedAt: "2026-07-01T10:00:00.000Z", exercises: [ex({ weight: 100, reps: 5 })] });
    const cur = session({ id: "cur", exercises: [ex({ weight: 100, reps: 8 })] });
    expect(detectPRs(cur, [prior])).toHaveLength(1); // same weight, more reps -> higher e1RM
  });

  test("cross-unit comparison is correct (225 lb > 100 kg)", () => {
    const prior = session({ id: "old", finishedAt: "2026-07-01T10:00:00.000Z", exercises: [ex({ weight: 100, unit: "kg" })] });
    const cur = session({ id: "cur", exercises: [ex({ weight: 225, unit: "lb" })] }); // ~102 kg
    expect(detectPRs(cur, [prior])).toHaveLength(1);
  });

  test("ignores incomplete or unlogged exercises, and the session's own id", () => {
    const prior = session({ id: "old", finishedAt: "2026-07-01T10:00:00.000Z", exercises: [ex({ weight: 100 })] });
    const cur = session({
      id: "cur",
      exercises: [ex({ weight: 200, completed: false }), ex({ name: "Row", weight: null })],
    });
    // 200 kg bench would be a PR but it wasn't completed; Row has no weight.
    expect(detectPRs(cur, [prior, cur])).toHaveLength(0);
  });

  test("multiple PRs are ordered by biggest breakthrough", () => {
    const prior = session({
      id: "old",
      finishedAt: "2026-07-01T10:00:00.000Z",
      exercises: [ex({ name: "Bench Press", weight: 100 }), ex({ name: "Squat", weight: 140 })],
    });
    const cur = session({
      id: "cur",
      exercises: [ex({ name: "Bench Press", weight: 102.5 }), ex({ name: "Squat", weight: 160 })],
    });
    const hits = detectPRs(cur, [prior]);
    expect(hits.map((h) => h.exercise)).toEqual(["Squat", "Bench Press"]); // +20 kg beats +2.5 kg
  });
});

describe("prHitToRecord", () => {
  test("weight-only PR falls back to the target rep range", () => {
    const cur = session({ id: "cur", exercises: [ex({ weight: 105, reps: null, targetReps: "8-12" })] });
    const prior = session({ id: "old", finishedAt: "2026-07-01T10:00:00.000Z", exercises: [ex({ weight: 100 })] });
    const rec = prHitToRecord(detectPRs(cur, [prior])[0], "2026-07-08T11:00:00.000Z");
    expect(rec.weight).toBe("105 kg");
    expect(rec.reps).toBe("8-12");
  });

  test("uses the actual rep count when present", () => {
    const cur = session({ id: "cur", exercises: [ex({ weight: 100, reps: 8 })] });
    const prior = session({ id: "old", finishedAt: "2026-07-01T10:00:00.000Z", exercises: [ex({ weight: 100, reps: 5 })] });
    const rec = prHitToRecord(detectPRs(cur, [prior])[0], "2026-07-08T11:00:00.000Z");
    expect(rec.reps).toBe("8");
  });
});
