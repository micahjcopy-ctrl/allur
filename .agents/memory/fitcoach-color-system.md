---
name: ALLUR (fitcoach) color/semantic token system
description: How color is themed in the ALLUR app and which semantic token maps to which meaning ("TITANIUM" brand theme)
---

# ALLUR color system ("TITANIUM" theme)

Brand is **ALLUR** (logo = glowing cyan ring + thin wide "ALLUR" wordmark). Design theme is **TITANIUM** — "Strong. Modern. Refined." Theme is centralized in `artifacts/fitcoach/src/index.css` as HSL CSS vars. App is **dark-mode only** (`.dark` class wrapper in App.tsx), so the `.dark` block is what actually renders; keep `:root` in sync for safety. Tailwind v4 `@theme inline` maps `--color-*` to `hsl(var(--*))` — any new token must be registered there to get `bg-/text-` utilities.

## Semantic palette (TITANIUM)
- **primary = Titanium Silver** (#C7CDD4) — primary buttons, key accents, "today" pills. Light, so `primary-foreground` is near-black (#0A0A0A). Do NOT put white text on `bg-primary`.
- **success = Emerald** (#34D399) — completed workouts, PRs, positive metrics.
- **info = ALLUR Cyan** (~#5BE0E6) — charts/analytics AND sets/reps; also the brand glow (`.bg-allur-glow` radial + `--ring`).
- **warning = Amber** (#F59E0B) — missed goals, alerts, over-target. (This was the old brand gold; gold is NOT primary anymore.)
- **destructive/error = Red** (#EF4444).
- background near-black (#0A0A0A), cards carbon (#111217 → `224 15% 8%`); headlines near-white, subheads `--muted-foreground` (#8D9096).

Gradient helpers: `.bg-hero-gradient` (cool dark), `.bg-achievement-gradient` (titanium metallic silver, dark text), `.bg-progress-gradient` (emerald), `.bg-allur-glow` (cyan ring halo).

**Why:** rebrand moved the "reward" color from gold→titanium-silver and demoted gold to `warning`. Charts/sets are cyan, completed/PR is green. Pages are token-driven (no raw `amber/yellow/sky` classes), so editing `index.css` re-themes the whole app.
**How to apply:** reach for the semantic token, not raw Tailwind colors. When a button uses `bg-primary`, pair with `text-primary-foreground` or `text-black` (primary is light). The ALLUR logo lives at `public/allur-logo.png` (transparent, blends on dark) — reference via `${import.meta.env.BASE_URL}allur-logo.png`.
