---
name: FitCoach exercise demo guide
description: How the Plan-tab exercise demo/coaching feature resolves names and serves images, plus the public/ restart gotcha.
---

- The Plan tab maps every workout exercise to a coaching guide (muscles, steps, form cues) + a demo image. Source of truth is `exerciseGuide.ts`.
- `trainingKnowledge.ts` uses ~70 exercise-name variants but only ~48 canonical movements. Guide resolution is GUIDE (canonical) → ALIASES (known variants) → normalized lookup (lowercase/trim/collapse-space/strip dots). Coach AI can edit plan exercise names, so always go through `getExerciseGuide()` — never index GUIDE directly.
- **Why normalization matters:** coach-generated plan edits introduce case/spacing drift; without it the UI silently falls back to generic content.
- Demo images: `public/exercises/<slug>.png`, referenced via `import.meta.env.BASE_URL` (consistent with the no-image-import-decl rule). Always render with an icon fallback in case a slug image is missing.

**Gotcha — newly added `public/` files need a workflow restart.** After generating images into `artifacts/fitcoach/public/exercises/`, the running Vite dev server returned the SPA `index.html` (200 text/html) for the image URLs until `restart_workflow` — then it served `200 image/png`. If freshly-added static assets 404 / return HTML, restart the artifact's workflow before debugging paths.
