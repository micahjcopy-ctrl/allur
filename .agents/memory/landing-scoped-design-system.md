---
name: ALLUR landing scoped design system
description: The marketing landing page has its own brand palette/typography, intentionally separate from the in-app TITANIUM theme.
---

# ALLUR marketing site = its own brand world

The marketing landing (`artifacts/fitcoach/src/pages/landing/Landing.tsx`) uses a
**dark premium futuristic** system that is deliberately distinct from the in-app
TITANIUM theme: Space Grotesk headlines in **sentence case** (uppercase only for
micro kicker labels) + Inter body; navy-black palette (#050816 bg) with cyan
(#6EE7F2) + teal (#2DD4BF) accents.

**Why:** the design spec explicitly says the website should feel like the brand
world *around* the app, not copy the app colors 1:1. So the two surfaces are
allowed to diverge — do not "unify" them.

**How to apply:** all landing tokens + utilities live under the `.allur-lp`
wrapper class in `index.css` (`--lp-*` CSS vars, `.lp-display`, `.lp-kicker`,
`.lp-cta` / `.lp-cta-ghost`, `.lp-card` / `.lp-card-hover`, `.lp-underline`,
`.lp-halo`, `.lp-vlines`, `.lp-divider`). Edit those — never the global `.dark`
tokens — to restyle the landing, or the in-app theme changes too. Landing uses
native `<button>`s with the `lp-cta*` classes (not the shared `Button`) for exact
CTA fidelity. Emphasis rule per section: bold 1-2 ideas + one cyan highlight +
at most one custom cyan underline; never all three on the same phrase.
`.font-display` (Archivo, uppercase) is now unused by the landing but still
defined in `index.css`.
