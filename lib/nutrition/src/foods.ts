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


// Row form for the expansion table below: keeps 100+ entries readable.
type Row = [
  id: string,
  canonicalName: string,
  aliases: string[],
  category: FoodCategory,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  small: number,
  medium: number,
  large: number,
];
function compact(rows: Row[]): Food[] {
  return rows.map(([id, canonicalName, aliases, category, calories, protein, carbs, fat, small, medium, large]) => ({
    id,
    canonicalName,
    aliases,
    category,
    per100g: { calories, protein, carbs, fat },
    defaultPortions: { small, medium, large },
  }));
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
    aliases: ["ground beef", "ground beef 80/20", "beef mince", "hamburger meat", "beef patty", "burger patty", "hamburger patty", "beef burger patty", "ground beef patty", "smash burger patty", "beef burger"],
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
    aliases: ["steak", "beef steak", "sirloin", "ribeye", "beef", "prime rib", "filet mignon", "new york strip", "flank steak", "skirt steak", "brisket"],
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
    aliases: ["tortilla", "flour tortilla", "corn tortilla", "tortillas"],
    category: "carb",
    per100g: { calories: 310, protein: 8, carbs: 50, fat: 8 },
    defaultPortions: { small: 40, medium: 60, large: 80 },
  },
  // ---- Mixed / restaurant ----
  {
    id: "burrito",
    canonicalName: "Burrito",
    aliases: ["burrito", "burrito bowl", "wrap burrito", "wrap", "chicken wrap", "veggie wrap", "turkey wrap", "breakfast burrito", "chipotle bowl"],
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
    aliases: ["burger", "hamburger", "cheeseburger", "fast food burger", "big mac", "whopper", "quarter pounder", "double cheeseburger"],
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

  // =========================================================================
  // Expansion (2026-09-23). The first 43 entries covered "clean fitness food"
  // and little else, so real meals (deli ham, a wagyu patty, a bun, sauces,
  // drinks, restaurant dishes) either fell back to the model's guess or, worse,
  // fuzzy-matched a wrong entry. Values are typical USDA-style per-100g figures
  // for the food as normally eaten (cooked unless noted).
  // =========================================================================
  ...compact([
    // ---- Proteins: deli, processed, fatty cuts ----
    ["deli-ham", "Deli ham", ["ham", "deli ham", "sliced ham", "ham slices", "smoked ham", "ham steak", "honey ham", "prosciutto"], "protein", 145, 21, 1.5, 6, 28, 56, 85],
    ["deli-turkey", "Deli turkey", ["deli turkey", "turkey slices", "sliced turkey", "turkey cold cuts", "turkey deli meat", "turkey lunch meat"], "protein", 104, 17, 4, 2, 28, 56, 85],
    ["roast-beef-deli", "Roast beef (deli)", ["roast beef", "deli roast beef", "sliced roast beef", "pastrami", "corned beef"], "protein", 130, 19, 2, 5, 28, 56, 85],
    ["salami", "Salami / pepperoni", ["salami", "pepperoni", "chorizo", "cured sausage"], "protein", 400, 22, 1.5, 34, 20, 40, 60],
    ["sausage", "Sausage", ["sausage", "breakfast sausage", "sausage links", "sausage patty", "pork sausage", "bratwurst", "italian sausage", "kielbasa"], "protein", 325, 13, 1, 30, 45, 90, 135],
    ["hot-dog", "Hot dog (frank)", ["hot dog", "hotdog", "frankfurter", "wiener"], "protein", 290, 11, 3, 26, 45, 50, 100],
    ["wagyu-beef", "Wagyu / fatty ground beef", ["wagyu", "wagyu beef", "wagyu burger", "wagyu patty", "wagyu beef patty", "wagyu beef burger", "ground beef 70/30", "fatty ground beef", "70/30 beef"], "protein", 300, 20, 0, 25, 110, 170, 230],
    ["chicken-wings", "Chicken wings", ["chicken wings", "wings", "buffalo wings", "hot wings", "wing"], "protein", 290, 27, 0, 20, 90, 180, 270],
    ["fried-chicken", "Fried chicken (breaded)", ["fried chicken", "chicken tenders", "chicken nuggets", "chicken strips", "popcorn chicken", "crispy chicken", "fried chicken sandwich patty"], "protein", 246, 24, 8, 13, 100, 150, 250],
    ["rotisserie-chicken", "Rotisserie chicken (with skin)", ["rotisserie chicken", "roast chicken", "chicken with skin", "chicken leg", "chicken drumstick", "drumstick"], "protein", 220, 25, 0, 13, 100, 150, 220],
    ["pork-ribs", "Pork ribs", ["ribs", "pork ribs", "baby back ribs", "bbq ribs", "spare ribs", "rib"], "protein", 290, 20, 0, 23, 120, 200, 300],
    ["pulled-pork", "Pulled pork", ["pulled pork", "bbq pork", "carnitas", "shredded pork"], "protein", 200, 22, 5, 10, 100, 150, 220],
    ["lamb", "Lamb", ["lamb", "lamb chop", "lamb chops", "leg of lamb", "lamb shoulder"], "protein", 258, 25, 0, 17, 100, 150, 220],
    ["meatballs", "Meatballs", ["meatballs", "meatball"], "protein", 230, 15, 8, 15, 90, 150, 220],
    ["gyro-meat", "Gyro / kebab meat", ["gyro", "gyro meat", "doner", "doner kebab", "kebab", "shawarma", "souvlaki"], "protein", 250, 17, 6, 17, 100, 150, 220],
    ["tempeh", "Tempeh", ["tempeh"], "protein", 195, 20, 8, 11, 85, 120, 170],
    ["plant-burger", "Plant-based burger patty", ["veggie burger", "plant based burger", "plant-based burger", "beyond burger", "impossible burger", "veggie patty", "plant based patty"], "protein", 230, 17, 9, 14, 85, 113, 150],
    ["edamame", "Edamame", ["edamame", "soybeans"], "protein", 120, 11, 9, 5, 60, 100, 150],
    ["beans", "Beans", ["beans", "black beans", "pinto beans", "kidney beans", "refried beans", "baked beans", "white beans", "cannellini beans"], "carb", 130, 9, 24, 0.5, 80, 130, 200],
    ["lentils", "Lentils", ["lentils", "lentil", "dal", "dhal"], "carb", 116, 9, 20, 0.4, 100, 150, 220],
    ["chickpeas", "Chickpeas", ["chickpeas", "garbanzo beans", "garbanzo"], "carb", 164, 9, 27, 2.6, 80, 130, 200],
    ["hummus", "Hummus", ["hummus", "houmous"], "sauce", 166, 8, 14, 10, 30, 60, 100],
    ["falafel", "Falafel", ["falafel"], "protein", 333, 13, 32, 18, 50, 100, 150],
    // ---- Carbs: bakery, breakfast, grains, snacks ----
    ["bun", "Burger bun", ["bun", "burger bun", "hamburger bun", "brioche bun", "hot dog bun", "sandwich roll", "kaiser roll", "dinner roll", "roll", "sub roll", "hoagie roll", "ciabatta"], "carb", 280, 9, 50, 4, 45, 55, 85],
    ["croissant", "Croissant", ["croissant", "croissants"], "carb", 406, 8, 46, 21, 45, 65, 90],
    ["muffin", "Muffin", ["muffin", "blueberry muffin", "chocolate muffin", "banana muffin"], "carb", 377, 6, 53, 16, 60, 110, 150],
    ["donut", "Donut", ["donut", "doughnut", "donuts", "glazed donut"], "dessert", 452, 5, 51, 25, 50, 70, 100],
    ["pancakes", "Pancakes", ["pancakes", "pancake", "flapjacks"], "carb", 227, 6, 28, 10, 80, 150, 240],
    ["waffle", "Waffle", ["waffle", "waffles", "belgian waffle"], "carb", 291, 8, 33, 14, 75, 110, 180],
    ["french-toast", "French toast", ["french toast"], "carb", 230, 8, 28, 10, 65, 130, 200],
    ["cereal", "Breakfast cereal", ["cereal", "breakfast cereal", "corn flakes", "cheerios", "frosted flakes", "cinnamon toast crunch"], "carb", 380, 7, 84, 3, 30, 50, 80],
    ["granola", "Granola", ["granola", "muesli"], "carb", 471, 10, 64, 20, 30, 50, 80],
    ["quinoa", "Quinoa", ["quinoa"], "carb", 120, 4.4, 21, 1.9, 100, 160, 220],
    ["couscous", "Couscous", ["couscous"], "carb", 112, 3.8, 23, 0.2, 100, 160, 220],
    ["corn", "Corn", ["corn", "sweet corn", "corn on the cob", "corn kernels"], "vegetable", 96, 3.4, 21, 1.5, 80, 130, 200],
    ["pita", "Pita", ["pita", "pita bread", "pitta"], "carb", 275, 9, 55, 1.2, 30, 60, 90],
    ["naan", "Naan", ["naan", "naan bread", "flatbread", "roti", "chapati"], "carb", 310, 9, 50, 8, 60, 90, 130],
    ["tortilla-chips", "Tortilla chips", ["tortilla chips", "corn chips", "doritos"], "carb", 489, 7, 65, 23, 28, 50, 85],
    ["potato-chips", "Potato chips", ["potato chips", "crisps", "lays", "pringles"], "carb", 536, 7, 53, 35, 28, 50, 85],
    ["popcorn", "Popcorn", ["popcorn", "movie popcorn"], "carb", 500, 9, 58, 28, 20, 40, 80],
    ["crackers", "Crackers", ["crackers", "cracker", "rice cakes", "rice cake", "pretzels", "pretzel"], "carb", 430, 9, 70, 12, 20, 40, 60],
    // ---- Mixed / restaurant dishes (composites: prefer decomposing) ----
    ["sandwich", "Sandwich", ["sandwich", "sub", "sub sandwich", "hoagie", "club sandwich", "blt", "grilled cheese", "panini", "footlong"], "other", 250, 12, 28, 10, 150, 230, 350],
    ["taco", "Taco", ["taco", "tacos", "beef taco", "chicken taco", "fish taco"], "other", 226, 10, 20, 12, 80, 150, 250],
    ["quesadilla", "Quesadilla", ["quesadilla", "quesadillas"], "other", 300, 13, 25, 16, 120, 200, 300],
    ["nachos", "Nachos", ["nachos", "loaded nachos"], "other", 306, 8, 35, 15, 150, 250, 400],
    ["mac-and-cheese", "Mac and cheese", ["mac and cheese", "macaroni and cheese", "mac n cheese", "kraft dinner"], "other", 164, 6, 20, 7, 150, 250, 350],
    ["lasagna", "Lasagna", ["lasagna", "lasagne"], "other", 135, 8, 13, 6, 200, 300, 400],
    ["fried-rice", "Fried rice", ["fried rice", "egg fried rice", "chicken fried rice"], "other", 165, 5, 25, 5, 150, 250, 350],
    ["sushi", "Sushi", ["sushi", "sushi roll", "california roll", "maki", "spicy tuna roll", "nigiri"], "other", 150, 6, 28, 2, 100, 200, 300],
    ["ramen", "Ramen (bowl)", ["ramen", "ramen bowl", "pho", "noodle soup"], "other", 90, 5, 12, 3, 300, 500, 700],
    ["chili", "Chili (con carne)", ["chili", "chilli", "chili con carne"], "other", 120, 10, 9, 5, 200, 300, 450],
    ["curry", "Curry", ["curry", "chicken curry", "tikka masala", "butter chicken", "thai curry", "korma"], "other", 130, 10, 6, 8, 200, 300, 450],
    ["soup", "Soup", ["soup", "chicken soup", "vegetable soup", "tomato soup", "chicken noodle soup", "broth"], "other", 50, 3, 6, 1.5, 200, 300, 450],
    ["stew", "Stew", ["stew", "beef stew", "pot roast", "goulash"], "other", 110, 9, 7, 5, 200, 300, 450],
    ["spring-roll", "Spring roll / egg roll", ["spring roll", "egg roll", "spring rolls", "egg rolls"], "other", 220, 7, 23, 11, 40, 80, 160],
    ["omelette", "Omelette (plain)", ["omelette", "omelet", "egg omelette", "frittata"], "protein", 154, 11, 1, 12, 100, 150, 220],
    ["stir-fry", "Stir-fry", ["stir fry", "stir-fry", "chicken stir fry", "beef stir fry"], "other", 120, 10, 8, 6, 200, 300, 400],
    // ---- Dairy & sweets ----
    ["american-cheese", "American cheese", ["american cheese", "cheese slice", "sliced cheese", "processed cheese", "cheese slices", "kraft singles"], "dairy", 375, 18, 2, 31, 21, 42, 63],
    ["mozzarella", "Mozzarella", ["mozzarella", "fresh mozzarella", "string cheese"], "dairy", 300, 22, 2, 22, 28, 45, 85],
    ["parmesan", "Parmesan", ["parmesan", "parmigiano", "grated cheese", "pecorino"], "dairy", 431, 38, 4, 29, 10, 20, 40],
    ["feta", "Feta / goat cheese", ["feta", "goat cheese", "blue cheese", "gorgonzola"], "dairy", 264, 14, 4, 21, 28, 45, 70],
    ["cream-cheese", "Cream cheese", ["cream cheese", "philadelphia"], "dairy", 342, 6, 4, 34, 15, 30, 50],
    ["sour-cream", "Sour cream", ["sour cream", "creme fraiche"], "dairy", 198, 2.4, 5, 19, 15, 30, 60],
    ["cream", "Cream", ["cream", "heavy cream", "whipping cream", "whipped cream", "double cream"], "dairy", 340, 2, 3, 36, 15, 30, 60],
    ["half-and-half", "Half and half", ["half and half", "creamer", "coffee creamer"], "dairy", 131, 3, 4, 11, 15, 30, 60],
    ["ice-cream", "Ice cream", ["ice cream", "gelato", "frozen yogurt", "soft serve"], "dessert", 207, 3.5, 24, 11, 70, 130, 200],
    ["chocolate", "Chocolate", ["chocolate", "chocolate bar", "dark chocolate", "milk chocolate", "candy bar", "snickers", "kit kat"], "dessert", 546, 5, 61, 31, 20, 45, 90],
    ["cookie", "Cookie", ["cookie", "cookies", "chocolate chip cookie", "oreo", "oreos", "biscuit"], "dessert", 480, 5, 65, 22, 20, 45, 90],
    ["cake", "Cake", ["cake", "slice of cake", "cupcake", "cheesecake", "birthday cake", "pastry", "cinnamon roll", "danish"], "dessert", 370, 4, 50, 17, 60, 100, 150],
    ["brownie", "Brownie", ["brownie", "brownies", "blondie"], "dessert", 405, 5, 55, 19, 40, 60, 100],
    ["candy", "Candy", ["candy", "gummies", "gummy bears", "skittles", "jelly beans", "lollipop"], "dessert", 390, 1, 90, 3, 20, 40, 80],
    ["pie", "Pie", ["pie", "apple pie", "pumpkin pie", "pecan pie"], "dessert", 265, 3, 37, 12, 100, 150, 200],
    // ---- Nuts, seeds, fats, condiments ----
    ["almonds", "Almonds", ["almonds", "almond"], "fat", 579, 21, 22, 50, 15, 30, 50],
    ["peanuts", "Peanuts", ["peanuts", "peanut"], "fat", 567, 26, 16, 49, 15, 30, 50],
    ["mixed-nuts", "Mixed nuts", ["mixed nuts", "nuts", "cashews", "cashew", "walnuts", "walnut", "pecans", "pistachios", "macadamia"], "fat", 607, 20, 21, 54, 15, 30, 50],
    ["trail-mix", "Trail mix", ["trail mix"], "fat", 462, 14, 45, 29, 30, 50, 80],
    ["seeds", "Seeds", ["seeds", "chia seeds", "chia", "flax seeds", "sunflower seeds", "pumpkin seeds", "hemp seeds"], "fat", 520, 20, 30, 40, 10, 20, 35],
    ["ketchup", "Ketchup", ["ketchup", "catsup"], "sauce", 101, 1, 27, 0.1, 10, 17, 34],
    ["bbq-sauce", "BBQ sauce", ["bbq sauce", "barbecue sauce", "teriyaki sauce", "sweet chili sauce", "honey mustard"], "sauce", 172, 1, 40, 0.6, 15, 30, 60],
    ["soy-sauce", "Soy sauce", ["soy sauce", "tamari", "fish sauce"], "sauce", 53, 8, 5, 0, 5, 15, 30],
    ["hot-sauce", "Hot sauce / mustard", ["hot sauce", "sriracha", "tabasco", "mustard", "vinegar", "pickles", "pickle"], "sauce", 20, 1, 3, 0.2, 5, 15, 30],
    ["salsa", "Salsa", ["salsa", "pico de gallo"], "sauce", 36, 1.5, 7, 0.2, 30, 60, 100],
    ["marinara", "Tomato sauce", ["marinara", "tomato sauce", "pasta sauce", "pizza sauce"], "sauce", 50, 1.5, 8, 1.5, 60, 120, 180],
    ["cream-sauce", "Cream sauce", ["cream sauce", "alfredo", "alfredo sauce", "cheese sauce", "hollandaise", "carbonara sauce", "bechamel"], "sauce", 180, 3, 5, 16, 40, 80, 130],
    ["pesto", "Pesto", ["pesto"], "sauce", 400, 5, 8, 40, 15, 30, 60],
    ["gravy", "Gravy", ["gravy"], "sauce", 60, 2, 5, 3, 40, 80, 130],
    ["aioli", "Aioli / garlic sauce", ["aioli", "garlic sauce", "chipotle mayo", "tartar sauce", "burger sauce", "special sauce", "remoulade"], "sauce", 500, 1, 5, 54, 15, 30, 45],
    ["honey", "Honey / syrup", ["honey", "maple syrup", "syrup", "agave"], "sauce", 300, 0.2, 80, 0, 10, 21, 42],
    ["jam", "Jam", ["jam", "jelly", "marmalade", "preserves"], "sauce", 278, 0.4, 69, 0.1, 10, 20, 40],
    ["sugar", "Sugar", ["sugar", "brown sugar", "sweetener"], "other", 387, 0, 100, 0, 4, 8, 16],
    ["nutella", "Hazelnut spread", ["nutella", "hazelnut spread", "chocolate spread"], "sauce", 539, 6, 57, 31, 15, 37, 60],
    ["coconut-milk", "Coconut milk", ["coconut milk", "coconut cream"], "dairy", 197, 2, 3, 21, 60, 120, 200],
    // ---- Drinks ----
    ["soda", "Soda", ["soda", "coke", "cola", "coca cola", "pepsi", "sprite", "soft drink", "dr pepper", "mountain dew", "ginger ale", "lemonade", "sweet tea", "iced tea"], "drink", 41, 0, 10.6, 0, 355, 500, 600],
    ["diet-soda", "Diet soda / water", ["diet soda", "diet coke", "coke zero", "zero sugar", "sparkling water", "water", "seltzer", "black tea", "green tea", "tea"], "drink", 0, 0, 0, 0, 355, 500, 600],
    ["juice", "Juice", ["juice", "orange juice", "apple juice", "fruit juice", "cranberry juice", "grape juice"], "drink", 45, 0.7, 10, 0.2, 200, 300, 450],
    ["beer", "Beer", ["beer", "lager", "ipa", "ale", "pilsner", "stout"], "drink", 43, 0.5, 3.6, 0, 355, 473, 568],
    ["wine", "Wine", ["wine", "red wine", "white wine", "rose", "prosecco", "champagne"], "drink", 83, 0.1, 2.6, 0, 150, 175, 250],
    ["spirits", "Spirits", ["vodka", "whiskey", "whisky", "tequila", "rum", "gin", "bourbon", "liquor"], "drink", 231, 0, 0, 0, 44, 60, 90],
    ["cocktail", "Cocktail", ["cocktail", "margarita", "mojito", "old fashioned", "cosmopolitan", "pina colada", "mixed drink"], "drink", 150, 0, 15, 0, 120, 200, 300],
    ["latte", "Latte / milk coffee", ["latte", "cappuccino", "flat white", "coffee with milk", "mocha", "macchiato", "chai latte", "iced latte"], "drink", 60, 3, 5, 3, 240, 355, 470],
    ["coffee", "Coffee (black)", ["coffee", "black coffee", "americano", "espresso", "iced coffee", "cold brew"], "drink", 1, 0, 0, 0, 240, 355, 470],
    ["smoothie", "Smoothie", ["smoothie", "fruit smoothie", "acai bowl"], "drink", 70, 1.5, 16, 0.3, 250, 400, 600],
    ["oat-milk", "Oat milk", ["oat milk", "soy milk"], "drink", 45, 1.5, 7, 1.5, 120, 240, 350],
    ["almond-milk", "Almond milk", ["almond milk", "unsweetened almond milk"], "drink", 15, 0.5, 0.6, 1.1, 120, 240, 350],
    ["sports-drink", "Sports drink", ["sports drink", "gatorade", "powerade", "electrolyte drink"], "drink", 25, 0, 6, 0, 355, 500, 600],
    ["energy-drink", "Energy drink", ["energy drink", "red bull", "monster energy", "celsius", "prime energy"], "drink", 45, 0, 11, 0, 250, 355, 473],
    // ---- Vegetables & fruit ----
    ["spinach", "Spinach / leafy greens", ["spinach", "kale", "lettuce", "arugula", "leafy greens", "greens", "romaine", "cabbage"], "vegetable", 23, 2.5, 3.6, 0.4, 30, 60, 100],
    ["tomato", "Tomato", ["tomato", "tomatoes", "cherry tomatoes"], "vegetable", 18, 0.9, 3.9, 0.2, 50, 100, 150],
    ["onion", "Onion", ["onion", "onions", "red onion", "grilled onions", "caramelized onions"], "vegetable", 40, 1.1, 9, 0.1, 30, 60, 100],
    ["mushrooms", "Mushrooms", ["mushrooms", "mushroom"], "vegetable", 22, 3, 3, 0.3, 40, 80, 120],
    ["cucumber", "Cucumber / celery", ["cucumber", "celery", "zucchini", "courgette"], "vegetable", 15, 0.7, 3.6, 0.1, 50, 100, 150],
    ["bell-pepper", "Bell pepper", ["bell pepper", "peppers", "capsicum", "red pepper", "green pepper"], "vegetable", 26, 1, 6, 0.3, 50, 100, 150],
    ["asparagus", "Asparagus", ["asparagus", "brussels sprouts", "cauliflower", "eggplant", "aubergine"], "vegetable", 30, 2.5, 5, 0.3, 60, 90, 150],
    ["berries", "Berries", ["berries", "strawberries", "blueberries", "raspberries", "blackberries", "mixed berries"], "fruit", 45, 1, 11, 0.4, 70, 140, 200],
    ["orange", "Orange / citrus", ["orange", "oranges", "clementine", "mandarin", "grapefruit", "tangerine"], "fruit", 47, 0.9, 12, 0.1, 100, 140, 200],
    ["grapes", "Grapes", ["grapes", "grape"], "fruit", 69, 0.7, 18, 0.2, 75, 150, 220],
    ["mango", "Mango / tropical fruit", ["mango", "pineapple", "papaya", "kiwi"], "fruit", 58, 0.7, 14, 0.4, 100, 165, 250],
    ["melon", "Melon", ["watermelon", "melon", "cantaloupe", "honeydew"], "fruit", 32, 0.7, 8, 0.2, 150, 280, 400],
    ["stone-fruit", "Stone fruit / pear", ["peach", "nectarine", "plum", "pear", "apricot", "cherries"], "fruit", 50, 0.7, 12, 0.2, 100, 150, 200],
    ["dried-fruit", "Dried fruit", ["dried fruit", "raisins", "dates", "date", "dried mango", "dried apricots", "craisins"], "fruit", 300, 2.5, 75, 0.5, 20, 40, 80],
  ]),
];
