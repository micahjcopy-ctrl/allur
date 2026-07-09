// Run with: bun test src/lib/__tests__
// Toggle persistence/visibility semantics.
import { describe, expect, test } from "bun:test";
import {
  FEATURES,
  TOGGLEABLE_FEATURES,
  isEnabled,
  resolveFeatureToggles,
} from "../features";

describe("feature registry", () => {
  test("keys are unique and hrefs are routes", () => {
    const keys = FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of FEATURES) expect(f.href.startsWith("/")).toBe(true);
  });

  test("core features are never listed as toggleable", () => {
    for (const f of TOGGLEABLE_FEATURES) expect(f.core).toBe(false);
  });
});

describe("resolveFeatureToggles (onboarding defaults + persistence)", () => {
  test("fresh user, weight-loss goal: cardio pre-enabled", () => {
    const t = resolveFeatureToggles(undefined, "Weight Loss");
    expect(t.cardio).toBe(true);
    expect(t.macros).toBe(true);
    expect(t.squad).toBe(true);
  });

  test("fresh user, muscle-gain goal: cardio off but discoverable", () => {
    const t = resolveFeatureToggles(undefined, "Muscle Gain");
    expect(t.cardio).toBe(false);
  });

  test("saved choices win over goal defaults (persistence)", () => {
    const t = resolveFeatureToggles({ cardio: true, squad: false }, "Muscle Gain");
    expect(t.cardio).toBe(true); // user turned it on — stays on
    expect(t.squad).toBe(false); // user turned it off — stays off
  });

  test("core features are forced on even if a stale save says off", () => {
    const t = resolveFeatureToggles({ plan: false as unknown as boolean, coach: false }, "Strength");
    expect(t.plan).toBe(true);
    expect(t.coach).toBe(true);
  });

  test("partial saves fill remaining keys from defaults", () => {
    const t = resolveFeatureToggles({ squad: false }, "Athleticism");
    expect(t.squad).toBe(false);
    expect(t.cardio).toBe(true); // athleticism default
    expect(t.macros).toBe(true);
  });
});

describe("isEnabled (visibility gate)", () => {
  test("reads the map, fails open for unknown state", () => {
    expect(isEnabled({ cardio: false }, "cardio")).toBe(false);
    expect(isEnabled({ cardio: true }, "cardio")).toBe(true);
    expect(isEnabled(undefined, "macros")).toBe(true);
    expect(isEnabled({}, "squad")).toBe(true);
  });

  test("core keys are always enabled regardless of map", () => {
    expect(isEnabled({ coach: false }, "coach")).toBe(true);
  });
});
