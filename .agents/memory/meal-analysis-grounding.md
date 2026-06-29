---
name: Meal analysis macro grounding
description: How photo meal analysis grounds macros, and why no external nutrition API is used.
---

# Meal analysis macro grounding

Photo-based meal analysis (CAL.AI-style) grounds macros in the **internal** `lib/nutrition` database, not in numbers invented by the vision model.

- The vision model only identifies foods + estimates grams + confidence; the server (`analyze-meal` in `coach.ts`) resolves each via `matchFood`/`computeMacros` (`source:"internal"`) and falls back to the model's `est*` values only when there is no DB match (`source:"estimated"`).
- The client (`MealReview.tsx`) recomputes per-item macros from `per100g` on every portion edit and re-sums totals, so totals always reflect edits.

**Why no external nutrition API (USDA / Open Food Facts):** those require API keys / accounts and are out of scope for the free tier. The internal curated DB is the deliberate choice. If asked to expand coverage, grow `lib/nutrition/src/foods.ts` rather than reaching for an external API unless the user explicitly wants one and can provide credentials.

**How to apply:** when editing the food set or macro math, change `lib/nutrition` (shared by both server route and client) — keep the per-100g model as the single source so server totals and client recompute stay identical.

## Cooking-method adjustment — apply exactly once

Macros = lean DB base + a cooking adjustment (absorbed oil by method, skin-on, breading) from `lib/nutrition` (`cookingAdjustmentMacros`/`groundedMacros`). The adjustment must be added **once**:
- `source:"internal"` (DB-matched, lean base) → server `groundedMacros` and client `recompute` both add the cooking adjustment. They must stay mirrored.
- `source:"estimated"` (model `est*` values) → NO adjustment; the model's estimate already reflects visible cooking. Re-applying double-counts.
- An `internal` item whose `foodId` doesn't resolve in the client's local `FOODS` (catalog skew): client derives per100 from the already-cooked server macros, so it must be downgraded to `estimated` (no extra adjustment) — else it overcounts.

**Why:** the adjustment lives in shared `lib/nutrition` but is invoked in two places (server route + client `MealReview.recompute`); any item-creation/swap site that flips `source` to `internal` must reset cooking flags to defaults, or stale flags inflate calories.

**How to apply:** when adding item-creation/mutation paths in `MealReview.tsx`, set `cookingMethod:"unknown", skinOn:false, breaded:false` defaults; keep server and client adjustment logic identical; never add the adjustment to estimated items. Confidence is shown as a low–high RANGE (`rangeFraction`/`macroRange`/`sumRanges`), never a single hard number.
