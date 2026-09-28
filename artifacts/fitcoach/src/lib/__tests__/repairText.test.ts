// Run with: bun test src/lib/__tests__
// Mojibake repair for saved states written by the double-encoded plan data
// that shipped between 2026-07-29 and iOS build 7.
import { describe, expect, test } from "bun:test";
import { repairMojibake, repairMojibakeDeep } from "../repairText";

const bad = (s: string) => Buffer.from(s, "utf-8").toString("latin1");

describe("repairMojibake", () => {
  test("repairs the exact plan titles users saw on the phone", () => {
    expect(repairMojibake(bad("Full Body — Squat Focus"))).toBe("Full Body — Squat Focus");
    expect(repairMojibake(bad("Full Body — Hinge & Pull Focus"))).toBe("Full Body — Hinge & Pull Focus");
  });

  test("repairs en dash, arrow, approx and rule lines", () => {
    for (const s of ["0–2 reps", "A → B", "≈ 1,700 kcal", "──────"]) {
      expect(repairMojibake(bad(s))).toBe(s);
    }
  });

  test("leaves clean text alone, including real accented letters", () => {
    for (const s of ["Full Body — Squat Focus", "café", "naïve", "Señor", "£10", "plain ascii", "", "—"]) {
      expect(repairMojibake(s)).toBe(s);
    }
  });

  test("does not swallow a legitimate character after a repaired one", () => {
    expect(repairMojibake(bad("—") + "¡")).toBe("—¡");
  });

  test("is idempotent", () => {
    const once = repairMojibake(bad("Full Body — Squat Focus"));
    expect(repairMojibake(once)).toBe(once);
  });
});

describe("repairMojibakeDeep", () => {
  test("repairs strings nested in a saved state and keeps other values", () => {
    const state = {
      onboardingComplete: true,
      workoutPlan: [
        { dayName: "Monday", title: bad("Full Body — Squat Focus"), exercises: [{ name: "Back Squat", sets: 3, reps: "6-8", rest: "2m", note: bad("0–2 reps in reserve") }] },
      ],
      weightLogs: [{ date: "2026-09-28", weight: 80.5 }],
      enhancedGoalPhoto: null,
    };
    const out = repairMojibakeDeep(state);
    expect(out.workoutPlan[0].title).toBe("Full Body — Squat Focus");
    expect(out.workoutPlan[0].exercises[0].note).toBe("0–2 reps in reserve");
    expect(out.workoutPlan[0].exercises[0].sets).toBe(3);
    expect(out.weightLogs[0].weight).toBe(80.5);
    expect(out.enhancedGoalPhoto).toBeNull();
  });

  test("returns the same reference when nothing needed repair", () => {
    const state = { a: ["Full Body — Squat Focus", { b: "café" }], n: 1 };
    expect(repairMojibakeDeep(state)).toBe(state);
  });
});
