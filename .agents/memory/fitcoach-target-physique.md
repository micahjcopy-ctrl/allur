---
name: FitCoach target physique (gender-aware)
description: How the onboarding target-physique selection is modeled (stable id vs human label) and the gender split, so future edits keep all call sites consistent.
---

# Target physique — stable id vs human label, gender-aware options

`TargetPhysique` (in `FitCoachContext.tsx`) is a **stable id** union (e.g. `LeanVTaper`, `Aesthetic`, `StrongCurves`), NOT the display string. Two derived pieces ride alongside it:

- `PHYSIQUE_LABELS` + `physiqueLabel(id)` — the human-readable label (e.g. "Lean V-Taper"). The id is what gets stored/compared and what keys `PHYSIQUE_EMPHASIS` in `trainingKnowledge.ts`; the **label** is what must be sent to every AI endpoint so prompts read naturally.
- `normalizePhysique()` — maps retired ids onto current ones (e.g. legacy `Bodybuilder → Aesthetic`) and drops unknowns. Called in `hydrateFrom` so persisted profiles stay valid after the option set changes.

## Non-obvious rules

- **Every coach/AI payload must send `physiqueLabel(profile.targetPhysique)`, not the raw id.** There are SEVERAL call sites: Onboarding `generatePlan`, Coach chat, Plan adjustment, and **Progress** (analyze-physique AND personalize-plan). It is easy to add a new AI call and forget the label — a review caught Progress sending raw ids. When adding any new endpoint that includes the profile, convert via `physiqueLabel`.
  **Why:** raw ids like `LeanVTaper` leak into prompts/logs and read poorly to the model.

- **Onboarding physique options are gender-aware.** Step 3 picks `MEN_PHYSIQUES` vs `WOMEN_PHYSIQUES` from `profile.gender` (captured step 1). `Athletic` is the one id shared across both sets. Guard cross-gender stale selection with `physiqueSelected = physiqueOptions.some(p => p.id === targetPhysique)` and gate Next on it — otherwise a man's pick survives a later switch to Female.

- **Labels have ONE source: `PHYSIQUE_LABELS` in `FitCoachContext`.** The onboarding option list (`src/data/physiques.ts`, holding id/img/desc + gender split) derives each `label` from `PHYSIQUE_LABELS[id]`, so the onboarding display label and the coach-payload label (`physiqueLabel()`) can never diverge. Don't re-hardcode label strings in `physiques.ts`.
  **Why:** a review flagged drift risk when labels lived in both places.

- **`PHYSIQUE_EMPHASIS` must stay exhaustive.** It is typed `Record<Exclude<TargetPhysique,"">, ...>`, so adding/removing an id forces updating the emphasis map (compile error if missed) — good. Images live in `public/physiques/` (men-*.png / women-*.png), brand colors only (dark + titanium silver + cyan, never green).
