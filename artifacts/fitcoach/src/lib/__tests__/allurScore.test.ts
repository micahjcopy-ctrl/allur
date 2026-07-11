// Run with: bun test src/lib/__tests__
// Allur Score derivation — the gamified surface must be stable and honest.
import { describe, expect, test } from "bun:test";
import {
  buildAllurScore,
  computePotential,
  orderedParts,
  prShareCaption,
  scanShareCaption,
} from "../allurScore";
import type { PhysiqueAnalysis } from "@/context/FitCoachContext";

const mkAnalysis = (over: Partial<PhysiqueAnalysis>): PhysiqueAnalysis => ({
  id: "a1",
  week: 1,
  photoUrl: "p.jpg",
  photoUrls: ["p.jpg"],
  date: "2026-07-01T10:00:00.000Z",
  overallScore: 70,
  muscleMassKg: 60,
  bodyFatEstimate: 15,
  bodyFatLow: 13,
  bodyFatHigh: 17,
  confidence: "medium",
  markers: [],
  limitations: "",
  suggestedDirection: "",
  parts: [],
  strengths: [],
  focusAreas: [],
  ...over,
});

describe("computePotential", () => {
  test("always at least +4 above today, capped at 99", () => {
    expect(computePotential(70, 0)).toBeGreaterThanOrEqual(74);
    expect(computePotential(98, 100)).toBe(99);
    expect(computePotential(0, 0)).toBeGreaterThanOrEqual(4);
  });

  test("monotonic in streak (consistency is rewarded, never punished)", () => {
    expect(computePotential(70, 14)).toBeGreaterThanOrEqual(computePotential(70, 0));
    expect(computePotential(70, 100)).toBe(computePotential(70, 14)); // bonus caps at 14 days
  });

  test("lower scores have more headroom", () => {
    const low = computePotential(40, 7) - 40;
    const high = computePotential(90, 7) - 90;
    expect(low).toBeGreaterThan(high);
  });
});

describe("buildAllurScore", () => {
  test("null before the first scan", () => {
    expect(buildAllurScore([], 5)).toBeNull();
  });

  test("picks the latest week and computes the delta vs previous", () => {
    const s = buildAllurScore(
      [
        mkAnalysis({ id: "w1", week: 1, overallScore: 70 }),
        mkAnalysis({ id: "w3", week: 3, overallScore: 74, date: "2026-07-08T10:00:00.000Z" }),
        mkAnalysis({ id: "w2", week: 2, overallScore: 71 }),
      ],
      3,
    );
    expect(s?.overall).toBe(74);
    expect(s?.delta).toBe(3); // vs week 2, not week 1
    expect(s?.week).toBe(3);
  });

  test("first scan has no delta", () => {
    const s = buildAllurScore([mkAnalysis({})], 0);
    expect(s?.delta).toBeNull();
    expect(s?.potential).toBeGreaterThan(s!.overall);
  });
});

describe("orderedParts", () => {
  test("canonical order, fuzzy matching, strongest rating represents a group", () => {
    const parts = orderedParts([
      { part: "Quads", rating: 80, status: "developed" as never, note: "" },
      { part: "Upper Pecs", rating: 60, status: "developed" as never, note: "" },
      { part: "Rear Delts", rating: 75, status: "developed" as never, note: "" },
      { part: "Chest", rating: 72, status: "developed" as never, note: "" },
    ]);
    expect(parts.map((p) => p.part)).toEqual(["Chest", "Shoulders", "Legs"]);
    expect(parts[0].rating).toBe(72); // chest bucket keeps the higher rating
  });

  test("unmatched parts are appended, not dropped", () => {
    const parts = orderedParts([
      { part: "Neck", rating: 50, status: "developed" as never, note: "" },
      { part: "Back", rating: 70, status: "developed" as never, note: "" },
    ]);
    expect(parts.map((p) => p.part)).toEqual(["Back", "Neck"]);
  });
});

describe("share captions", () => {
  test("scan caption carries score, delta, potential and the site", () => {
    const s = buildAllurScore(
      [
        mkAnalysis({ week: 1, overallScore: 70 }),
        mkAnalysis({ week: 2, overallScore: 72, date: "2026-07-08T10:00:00.000Z" }),
      ],
      7,
    )!;
    const caption = scanShareCaption(s);
    expect(caption).toContain("72");
    expect(caption).toContain("+2");
    expect(caption).toContain("getallur.com");
  });

  test("pr caption", () => {
    const c = prShareCaption("Bench Press", "225 lb", "5");
    expect(c).toContain("Bench Press");
    expect(c).toContain("225 lb × 5");
    expect(c).toContain("getallur.com");
  });
});
