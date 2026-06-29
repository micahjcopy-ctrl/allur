---
name: FitCoach exercise optimizer (equipment + preferences)
description: How the training-setup constraints (equipment, dislikes, enjoyed sports/classes) flow into deterministic plan generation and per-exercise detail.
---

# Exercise optimizer — equipment & preference constraints

`artifacts/fitcoach/src/data/exerciseOptimizer.ts` is the client-side source of truth that turns the onboarding "training setup" profile fields into two deterministic capabilities: `adaptPlanToEquipment(days, profile)` (rewrites a generated program) and `buildExerciseDetail(exercise, profile, goal)` (intensity + exactly 2 alternatives shown on the Plan page). The same constraints are mirrored to the AI coach server-side via `guidelinesSection` in `coachPrompt.ts` — there is no shared import; the two must stay consistent by hand.

## Non-obvious rules (learned the hard way during review)

- **Cardio cannot be bypassed in adaptation.** Generated plans use *descriptive* cardio names ("Rower / Incline Walk", "Bike / Walk / Swim", "Incline Walk (Zone 2)") that are NOT in the `META` table, so a naive `if (pattern==="cardio") return` (and even `if (!meta) return`) lets a disliked modality leak through the exercise NAME. Cardio and meta-less entries must run through `adaptDislikedCardio()`, which name-matches modality via `CARDIO_MODALITY_RULES` and swaps to a liked alternative.
  **Why:** requirement is "never program disliked cardio"; the leak is invisible because the dislike check was pattern/meta-based, not name-based.

- **buildExerciseDetail must infer cardio from the name** (`looksLikeCardio()`) when `META` lookup misses, or descriptive cardio rows render *strength* intensity guidance. Only consulted when meta is null, so it never mislabels strength rows (which have meta).

- **Dislike-filter EVERY alternative candidate, not just fallbacks.** A user can simultaneously dislike a modality and have selected the matching class (dislike cycling + chose a spin class). `buildCardioAlternatives` must filter the whole pool (classes/sports/pool/machine + generic fallbacks) through `cardioNameDisliked()` before dedupe/slice, then pad to exactly 2.

- **resolveAvailableEquipment returns `null` for "no equipment info"** = unknown access, don't cripple the plan (treat everything as available). Empty-but-known is different from absent.
