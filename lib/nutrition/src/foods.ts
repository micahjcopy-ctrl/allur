// Internal common-food nutrition database. This is the source of truth for macro
// numbers — the vision model only IDs foods and estimates portions; calories and
// macros are looked up here (per 100g) and scaled by grams. Values are typical
// cooked-state figures for common fitness foods. Keep names/aliases aligned with
// how a vision model is likely to describe a food on a plate.

export type FoodCategory =
  | "protein"
  | "carb"
  | "fat"
  | "vegetable"
  | "fruit"
  | "dairy"
  | "sauce"
  | "drink"
  | "dessert"
  | "other";

export interface FoodMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food {
  id: string;
  canonicalName: string;
  aliases: string[];
  category: FoodCategory;
  /** Macros per 100 grams (cooked, unless noted). */
  per100g: FoodMacros;
  /** Conservative gram defaults when scale is unclear. */
  defaultPortions: { small: number; medium: number; large: number };
}

export const FOODS: Food[] = [
  // ---- Proteins ----
  {
    id: "chicken-breast",
    canonicalName: "Chicken breast",
    aliases: ["chicken breast", "grilled chicken", "chicken", "cooked chicken", "sliced chicken", "plain chicken"],
    category: "protein",
    per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    defaultPortions: { small: 100, medium: 150, large: 200 },
  },
  {
    id: "chicken-thigh",
    canonicalName: "Chicken thigh",
    aliases: ["chicken thigh", "chicken thighs", "dark meat chicken"],
    category: "protein",
    per100g: { calories: 209, protein: 26, carbs: 0, fat: 11 },
    defaultPortions: { small: 100, medium: 150, large: 200 },
  },
  {
    id: "salmon",
    canonicalName: "Salmon",
    aliases: ["salmon", "grilled salmon", "baked salmon", "salmon fillet"],
    category: "protein",
    per100g: { calories: 208, protein: 22, carbs: 0, fat: 13 },
    defaultPortions: { small: 100, medium: 150, large: 200 },
  },
  {
    id: "white-fish",
    canonicalName: "White fish",
    aliases: ["white fish", "tilapia", "cod", "haddock", "fish fillet", "fish"],
    category: "protein",
    per100g: { calories: 128, protein: 26, carbs: 0, fat: 2.7 },
    defaultPortions: { small: 100, medium: 150, large: 200 },
  },
  {
    id: "tuna",
    canonicalName: "Tuna",
    aliases: ["tuna", "canned tuna", "tuna fish"],
    category: "protein",
    per100g: { calories: 116, protein: 26, carbs: 0, fat: 1 },
    defaultPortions: { small: 85, medium: 120, large: 170 },
  },
  {
    id: "shrimp",
    canonicalName: "Shrimp",
    aliases: ["shrimp", "prawns", "cooked shrimp"],
    category: "protein",
    per100g: { calories: 99, protein: 24, carbs: 0, fat: 0.3 },
    defaultPortions: { small: 85, medium: 120, large: 170 },
  },
  {
    id: "ground-beef-80",
    canonicalName: "Ground beef (80/20)",
    aliases: ["ground beef", "ground beef 80/20", "beef mince", "hamburger meat"],
    category: "protein",
    per100g: { calories: 254, protein: 26, carbs: 0, fat: 17 },
    defaultPortions: { small: 100, medium: 150, large: 220 },
  },
  {
    id: "ground-beef-90",
    canonicalName: "Ground beef (90/10)",
    aliases: ["ground beef 90/10", "lean ground beef", "lean beef mince"],
    category: "protein",
    per100g: { calories: 176, protein: 26, carbs: 0, fat: 8 },
    defaultPortions: { small: 100, medium: 150, large: 220 },
  },
  {
    id: "steak",
    canonicalName: "Steak",
    aliases: ["steak", "beef steak", "sirloin", "ribeye", "beef"],
    category: "protein",
    per100g: { calories: 271, protein: 25, carbs: 0, fat: 19 },
    defaultPortions: { small: 120, medium: 180, large: 250 },
  },
  {
    id: "pork",
    canonicalName: "Pork",
    aliases: ["pork", "pork chop", "pork tenderloin", "pork loin"],
    category: "protein",
    per100g: { calories: 242, protein: 27, carbs: 0, fat: 14 },
    defaultPortions: { small: 120, medium: 180, large: 250 },
  },
  {
    id: "turkey",
    canonicalName: "Turkey",
    aliases: ["turkey", "turkey breast", "ground turkey", "roast turkey"],
    category: "protein",
    per100g: { calories: 135, protein: 30, carbs: 0, fat: 1 },
    defaultPortions: { small: 100, medium: 150, large: 200 },
  },
  {
    id: "bacon",
    canonicalName: "Bacon",
    aliases: ["bacon", "cooked bacon", "bacon strips"],
    category: "protein",
    per100g: { calories: 541, protein: 37, carbs: 1.4, fat: 42 },
    defaultPortions: { small: 15, medium: 30, large: 45 },
  },
  {
    id: "tofu",
    canonicalName: "Tofu",
    aliases: ["tofu", "firm tofu", "bean curd"],
    category: "protein",
    per100g: { calories: 144, protein: 17, carbs: 3, fat: 9 },
    defaultPortions: { small: 100, medium: 150, large: 200 },
  },
  {
    id: "eggs",
    canonicalName: "Eggs",
    aliases: ["eggs", "egg", "fried egg", "scrambled eggs", "boiled egg", "whole eggs"],
    category: "protein",
    per100g: { calories: 143, protein: 13, carbs: 1, fat: 10 },
    defaultPortions: { small: 50, medium: 100, large: 150 },
  },
  {
    id: "egg-whites",
    canonicalName: "Egg whites",
    aliases: ["egg whites", "egg white"],
    category: "protein",
    per100g: { calories: 52, protein: 11, carbs: 0.7, fat: 0.2 },
    defaultPortions: { small: 50, medium: 100, large: 150 },
  },
  {
    id: "whey-protein",
    canonicalName: "Whey protein",
    aliases: ["whey protein", "protein shake", "protein powder", "whey"],
    category: "protein",
    per100g: { calories: 400, protein: 80, carbs: 8, fat: 6 },
    defaultPortions: { small: 30, medium: 60, large: 90 },
  },
  {
    id: "protein-bar",
    canonicalName: "Protein bar",
    aliases: ["protein bar", "energy bar"],
    category: "protein",
    per100g: { calories: 350, protein: 30, carbs: 35, fat: 10 },
    defaultPortions: { small: 50, medium: 60, large: 70 },
  },
  // ---- Carbs ----
  {
    id: "white-rice",
    canonicalName: "White rice",
    aliases: ["white rice", "rice", "steamed rice", "jasmine rice"],
    category: "carb",
    per100g: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    defaultPortions: { small: 80, medium: 160, large: 240 },
  },
  {
    id: "brown-rice",
    canonicalName: "Brown rice",
    aliases: ["brown rice", "wholegrain rice"],
    category: "carb",
    per100g: { calories: 123, protein: 2.7, carbs: 26, fat: 1 },
    defaultPortions: { small: 80, medium: 160, large: 240 },
  },
  {
    id: "pasta",
    canonicalName: "Pasta",
    aliases: ["pasta", "spaghetti", "penne", "noodles", "macaroni"],
    category: "carb",
    per100g: { calories: 158, protein: 6, carbs: 31, fat: 0.9 },
    defaultPortions: { small: 100, medium: 180, large: 280 },
  },
  {
    id: "potato",
    canonicalName: "Potato",
    aliases: ["potato", "potatoes", "baked potato", "mashed potatoes", "boiled potatoes"],
    category: "carb",
    per100g: { calories: 87, protein: 2, carbs: 20, fat: 0.1 },
    defaultPortions: { small: 130, medium: 200, large: 300 },
  },
  {
    id: "sweet-potato",
    canonicalName: "Sweet potato",
    aliases: ["sweet potato", "sweet potatoes", "yam"],
    category: "carb",
    per100g: { calories: 90, protein: 2, carbs: 21, fat: 0.1 },
    defaultPortions: { small: 130, medium: 200, large: 300 },
  },
  {
    id: "oats",
    canonicalName: "Oats",
    aliases: ["oats", "oatmeal", "porridge", "rolled oats"],
    category: "carb",
    per100g: { calories: 71, protein: 2.5, carbs: 12, fat: 1.5 },
    defaultPortions: { small: 150, medium: 240, large: 320 },
  },
  {
    id: "bread",
    canonicalName: "Bread",
    aliases: ["bread", "toast", "slice of bread", "white bread", "whole wheat bread"],
    category: "carb",
    per100g: { calories: 265, protein: 9, carbs: 49, fat: 3.2 },
    defaultPortions: { small: 30, medium: 60, large: 90 },
  },
  {
    id: "bagel",
    canonicalName: "Bagel",
    aliases: ["bagel"],
    category: "carb",
    per100g: { calories: 250, protein: 10, carbs: 49, fat: 1.5 },
    defaultPortions: { small: 60, medium: 90, large: 120 },
  },
  {
    id: "tortilla",
    canonicalName: "Tortilla",
    aliases: ["tortilla", "wrap", "flour tortilla"],
    category: "carb",
    per100g: { calories: 310, protein: 8, carbs: 50, fat: 8 },
    defaultPortions: { small: 40, medium: 60, large: 80 },
  },
  // ---- Mixed / restaurant ----
  {
    id: "burrito",
    canonicalName: "Burrito",
    aliases: ["burrito", "burrito bowl", "wrap burrito"],
    category: "other",
    per100g: { calories: 210, protein: 8, carbs: 26, fat: 8 },
    defaultPortions: { small: 200, medium: 300, large: 400 },
  },
  {
    id: "pizza",
    canonicalName: "Pizza",
    aliases: ["pizza", "pizza slice", "slice of pizza"],
    category: "other",
    per100g: { calories: 266, protein: 11, carbs: 33, fat: 10 },
    defaultPortions: { small: 100, medium: 200, large: 300 },
  },
  {
    id: "burger",
    canonicalName: "Burger",
    aliases: ["burger", "hamburger", "cheeseburger"],
    category: "other",
    per100g: { calories: 250, protein: 15, carbs: 19, fat: 13 },
    defaultPortions: { small: 150, medium: 250, large: 350 },
  },
  {
    id: "fries",
    canonicalName: "Fries",
    aliases: ["fries", "french fries", "chips"],
    category: "carb",
    per100g: { calories: 312, protein: 3.4, carbs: 41, fat: 15 },
    defaultPortions: { small: 100, medium: 150, large: 220 },
  },
  // ---- Dairy ----
  {
    id: "greek-yogurt",
    canonicalName: "Greek yogurt",
    aliases: ["greek yogurt", "yogurt", "plain yogurt"],
    category: "dairy",
    per100g: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
    defaultPortions: { small: 100, medium: 170, large: 250 },
  },
  {
    id: "cottage-cheese",
    canonicalName: "Cottage cheese",
    aliases: ["cottage cheese"],
    category: "dairy",
    per100g: { calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
    defaultPortions: { small: 100, medium: 150, large: 220 },
  },
  {
    id: "cheese",
    canonicalName: "Cheese",
    aliases: ["cheese", "cheddar", "shredded cheese", "melted cheese"],
    category: "dairy",
    per100g: { calories: 403, protein: 25, carbs: 1.3, fat: 33 },
    defaultPortions: { small: 20, medium: 30, large: 45 },
  },
  {
    id: "milk",
    canonicalName: "Milk",
    aliases: ["milk", "2% milk", "whole milk"],
    category: "drink",
    per100g: { calories: 50, protein: 3.4, carbs: 4.8, fat: 2 },
    defaultPortions: { small: 150, medium: 240, large: 360 },
  },
  // ---- Fats ----
  {
    id: "avocado",
    canonicalName: "Avocado",
    aliases: ["avocado", "guacamole"],
    category: "fat",
    per100g: { calories: 160, protein: 2, carbs: 9, fat: 15 },
    defaultPortions: { small: 50, medium: 100, large: 200 },
  },
  {
    id: "olive-oil",
    canonicalName: "Olive oil",
    aliases: ["olive oil", "cooking oil", "oil"],
    category: "fat",
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
    defaultPortions: { small: 5, medium: 14, large: 28 },
  },
  {
    id: "butter",
    canonicalName: "Butter",
    aliases: ["butter"],
    category: "fat",
    per100g: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81 },
    defaultPortions: { small: 5, medium: 14, large: 28 },
  },
  {
    id: "peanut-butter",
    canonicalName: "Peanut butter",
    aliases: ["peanut butter", "nut butter", "almond butter"],
    category: "fat",
    per100g: { calories: 588, protein: 25, carbs: 20, fat: 50 },
    defaultPortions: { small: 16, medium: 32, large: 48 },
  },
  {
    id: "salad-dressing",
    canonicalName: "Salad dressing",
    aliases: ["salad dressing", "dressing", "ranch", "vinaigrette", "mayo", "mayonnaise"],
    category: "sauce",
    per100g: { calories: 320, protein: 1, carbs: 6, fat: 33 },
    defaultPortions: { small: 15, medium: 30, large: 45 },
  },
  // ---- Vegetables & fruit ----
  {
    id: "broccoli",
    canonicalName: "Broccoli",
    aliases: ["broccoli"],
    category: "vegetable",
    per100g: { calories: 35, protein: 2.4, carbs: 7, fat: 0.4 },
    defaultPortions: { small: 60, medium: 90, large: 150 },
  },
  {
    id: "mixed-vegetables",
    canonicalName: "Mixed vegetables",
    aliases: ["mixed vegetables", "vegetables", "veggies", "salad", "green beans", "peas", "carrots"],
    category: "vegetable",
    per100g: { calories: 65, protein: 3, carbs: 13, fat: 0.5 },
    defaultPortions: { small: 60, medium: 90, large: 150 },
  },
  {
    id: "banana",
    canonicalName: "Banana",
    aliases: ["banana"],
    category: "fruit",
    per100g: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    defaultPortions: { small: 80, medium: 120, large: 150 },
  },
  {
    id: "apple",
    canonicalName: "Apple",
    aliases: ["apple"],
    category: "fruit",
    per100g: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
    defaultPortions: { small: 100, medium: 150, large: 200 },
  },
];
