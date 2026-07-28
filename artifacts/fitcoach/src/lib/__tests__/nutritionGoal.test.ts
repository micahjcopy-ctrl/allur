import { nutritionGoalMet, nutritionGoalMessage, type Macros } from "../nutritionGoal";
import { describe, expect, test } from "bun:test";

const target: Macros = { calories: 2000, protein: 150, carbs: 200, fat: 60 };
const m = (calories: number, protein: number): Macros => ({ calories, protein, carbs: 0, fat: 0 });

describe("nutritionGoalMet", () => {
  test("no goal or no target never fires", () => {
    expect(nutritionGoalMet(null, m(2000, 150), target)).toBe(false);
    expect(nutritionGoalMet("Weight Loss", m(2000, 150), { calories: 0, protein: 0, carbs: 0, fat: 0 })).toBe(false);
  });

  test("Weight Loss: on budget + protein hits, over budget or too little misses", () => {
    expect(nutritionGoalMet("Weight Loss", m(1900, 150), target)).toBe(true);
    expect(nutritionGoalMet("Weight Loss", m(2000, 150), target)).toBe(true);
    expect(nutritionGoalMet("Weight Loss", m(2100, 150), target)).toBe(false);
    expect(nutritionGoalMet("Weight Loss", m(1000, 150), target)).toBe(false);
    expect(nutritionGoalMet("Weight Loss", m(1900, 100), target)).toBe(false);
  });

  test("Muscle Gain / Strength: reach calories + protein; overshoot is fine", () => {
    expect(nutritionGoalMet("Muscle Gain", m(2000, 150), target)).toBe(true);
    expect(nutritionGoalMet("Muscle Gain", m(2400, 160), target)).toBe(true);
    expect(nutritionGoalMet("Muscle Gain", m(1800, 150), target)).toBe(false);
    expect(nutritionGoalMet("Muscle Gain", m(2000, 120), target)).toBe(false);
    expect(nutritionGoalMet("Strength", m(2000, 150), target)).toBe(true);
    expect(nutritionGoalMet("Athleticism", m(1950, 145), target)).toBe(true);
  });

  test("zero protein target auto-satisfies protein", () => {
    expect(nutritionGoalMet("Muscle Gain", m(2000, 0), { ...target, protein: 0 })).toBe(true);
  });
});

describe("nutritionGoalMessage", () => {
  test("goal-aware, non-empty", () => {
    expect(nutritionGoalMessage("Weight Loss").length).toBeGreaterThan(0);
    expect(nutritionGoalMessage("Muscle Gain").length).toBeGreaterThan(0);
  });
});
