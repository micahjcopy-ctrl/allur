import { describe, expect, test } from "bun:test";
import {
  matchFoodDetailed,
  parseGrams,
  reconcileWithEstimate,
  groundedMacros,
  sumMacros,
  foodTokens,
  type FoodMacros,
} from "./index";

const name = (q: string) => matchFoodDetailed(q)?.food.canonicalName ?? null;
const strength = (q: string) => matchFoodDetailed(q)?.strength ?? null;

describe("foodTokens", () => {
  test("drops quantities, units and filler but keeps the food and its qualifiers", () => {
    expect(foodTokens("2 slices of ham")).toEqual(["ham"]);
    expect(foodTokens("3 large fried eggs")).toEqual(["fried", "eggs"]);
    expect(foodTokens("8oz wagyu beef burger")).toEqual(["wagyu", "beef", "burger"]);
    expect(foodTokens("1/2 cup white rice")).toEqual(["white", "rice"]);
  });
  test("keeps fat-blend ratios, which are not quantities", () => {
    expect(foodTokens("ground beef 80/20")).toEqual(["ground", "beef", "80/20"]);
  });
});

describe("matchFoodDetailed", () => {
  test("quantity words never block an exact match", () => {
    expect(name("3 eggs")).toBe("Eggs");
    expect(strength("3 eggs")).toBe("exact");
    expect(name("2 slices of ham")).toBe("Deli ham");
    expect(name("a tortilla")).toBe("Tortilla");
  });

  test("the head noun wins over a topping after 'with'", () => {
    expect(name("8oz wagyu beef burger with cheese")).toBe("Wagyu / fatty ground beef");
    expect(name("oatmeal with banana")).toBe("Oats");
  });

  test("burger components resolve to components, not the whole-sandwich entry", () => {
    expect(name("wagyu beef patty")).toBe("Wagyu / fatty ground beef");
    expect(name("beef patty")).toBe("Ground beef (80/20)");
    expect(name("burger bun")).toBe("Burger bun");
    expect(name("brioche bun")).toBe("Burger bun");
    expect(name("american cheese")).toBe("American cheese");
  });

  test("a whole fast-food burger still maps to the composite", () => {
    expect(name("cheeseburger")).toBe("Burger");
    expect(name("big mac")).toBe("Burger");
  });

  test("regressions from the first TestFlight review", () => {
    expect(name("prime rib")).toBe("Steak");
    expect(name("espresso shot")).toBe("Coffee (black)");
    expect(name("chicken wrap")).toBe("Burrito");
    expect(name("beef stew")).toBe("Stew");
    expect(name("ground beef 90/10")).toBe("Ground beef (90/10)");
  });

  test("a one-word hit inside a specific phrase is only a partial match", () => {
    // "cheese" inside "ham and cheese omelette" used to win outright.
    const m = matchFoodDetailed("blue cheese crumbles on a wedge salad");
    expect(m).not.toBeNull();
    expect(m!.strength).not.toBe("exact");
  });

  test("returns null for nothing food-like", () => {
    expect(matchFoodDetailed("")).toBeNull();
    expect(matchFoodDetailed("   ")).toBeNull();
    expect(matchFoodDetailed("xyzzy")).toBeNull();
  });
});

describe("parseGrams", () => {
  test("numbers pass through, unit strings convert", () => {
    expect(parseGrams(227)).toBe(227);
    expect(parseGrams("227")).toBe(227);
    expect(parseGrams("227g")).toBe(227);
    expect(parseGrams("8 oz")).toBeCloseTo(226.8, 1);
    expect(parseGrams("8oz")).toBeCloseTo(226.8, 1);
    expect(parseGrams("0.5 lb")).toBeCloseTo(226.8, 1);
  });
  test("garbage is null, never a silent default", () => {
    expect(parseGrams("abc")).toBeNull();
    expect(parseGrams(null)).toBeNull();
    expect(parseGrams(undefined)).toBeNull();
    expect(parseGrams(-5)).toBeNull();
    expect(parseGrams(NaN)).toBeNull();
  });
});

describe("reconcileWithEstimate", () => {
  const db: FoodMacros = { calories: 215, protein: 20, carbs: 2, fat: 15 };

  test("database wins when the model broadly agrees", () => {
    const r = reconcileWithEstimate(db, { calories: 200, protein: 18, carbs: 1, fat: 14 }, "exact");
    expect(r.source).toBe("internal");
    expect(r.macros).toEqual(db);
  });

  test("model wins when the database number is wildly off (wrong entry / wrong basis)", () => {
    // "ham and cheese omelette" grounded as 200 g of cheese = 806 kcal.
    const r = reconcileWithEstimate(
      { calories: 806, protein: 50, carbs: 3, fat: 66 },
      { calories: 380, protein: 28, carbs: 3, fat: 28 },
      "partial",
    );
    expect(r.source).toBe("estimated");
    expect(r.macros.calories).toBe(380);
  });

  test("tolerance widens with match strength", () => {
    const est = { calories: 100, protein: 5, carbs: 5, fat: 5 };
    const twice = { calories: 200, protein: 10, carbs: 10, fat: 10 };
    expect(reconcileWithEstimate(twice, est, "partial").source).toBe("estimated"); // 2.0 > 1.6
    expect(reconcileWithEstimate(twice, est, "strong").source).toBe("internal"); // 2.0 < 2.2
    expect(reconcileWithEstimate(twice, est, "exact").source).toBe("internal"); // 2.0 < 2.5
  });

  test("no usable estimate → database", () => {
    expect(reconcileWithEstimate(db, null, "partial").source).toBe("internal");
    expect(reconcileWithEstimate(db, { calories: 0, protein: 0, carbs: 0, fat: 0 }, "partial").source).toBe("internal");
  });
});

describe("Micah's meal, 2026-09-23 (was logged as 645 kcal)", () => {
  // "a tortilla, 3 eggs, 2 slices of ham, plus an 8 oz wagyu beef burger with
  // cheese, very oily" — decomposed the way the prompt now asks for.
  test("grounds to a plausible total", () => {
    const items: [string, number, Parameters<typeof groundedMacros>[2]][] = [
      ["flour tortilla", 70, { method: "unknown" }],
      ["fried eggs", 150, { method: "fried" }],
      ["deli ham", 56, { method: "unknown" }],
      ["wagyu beef patty", 227, { method: "fried" }],
      ["burger bun", 55, { method: "unknown" }],
      ["american cheese", 21, { method: "unknown" }],
    ];
    const macros = items.map(([n, g, adj]) => {
      const m = matchFoodDetailed(n);
      expect(m).not.toBeNull();
      return groundedMacros(m!.food, g, adj);
    });
    const total = sumMacros(macros);
    expect(total.calories).toBeGreaterThan(1300);
    expect(total.calories).toBeLessThan(1900);
    expect(total.protein).toBeGreaterThan(80);
  });
});
