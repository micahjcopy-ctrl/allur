# AGENTS.md — ALLUR

> Project instructions for any AI coding agent (Claude, Codex, Cursor, …). Auto-load this at session start. One source of truth for conventions + always/never rules. `CLAUDE.md` → "see AGENTS.md". Governed by the vault's `[[SOP-App-Building-with-AI]]` + `[[SOP-Webdesign-with-Claude]]`.

## What ALLUR is
An adaptive fitness/physique app: workout plans, cardio, macros, body-scan "Allur Score", AI coach, and a squad/social layer. Monorepo: a marketing **website** and the **app** (`artifacts/fitcoach`) + an **api** backend, deployed on Vercel.

## Stack (locked — do not swap without a Phase-1 decision)
- **App:** React 19 + Vite + TypeScript + Tailwind + shadcn/radix + wouter + framer-motion.
- **Backend:** `api/` (Node), rebuilt on Vercel from source.
- **Monorepo:** pnpm workspace. **Zero new npm dependencies** without approval (Vercel frozen-lockfile risk).
- **Auth/data:** existing (replit-auth); state in `FitCoachContext` persisted as a JSONB blob (no DB migration needed for new state fields).
- **Observability:** `@sentry/react` present — verify it's initialized before relying on it.

## Design (read before ANY UI change)
- **`design-system/MASTER.md` is law.** No UI code before reading it. Brand (the logo: chrome + cyan→teal→navy) wins.
- **Accent = ALLUR cyan/teal, from tokens.** Never introduce a color outside MASTER.md. **No AI purple/pink — ever.**
- **Never change an accent/theme and push it live without a preview Micah approved first.**

## Always
- **Plan before code.** Work from `PLAN.md`; keep it updated as slices ship.
- **One vertical slice at a time.** Small, coherent diffs.
- **Branch per feature** → PR → **code-review pass (subagent, always; CodeRabbit if wired)** → merge. `main` stays runnable.
- **Verify loop every slice:** build green + headless render/screenshot vs the approved target + check contrast, reduced-motion, 44px targets. "Compiled" ≠ "works".
- **Semantic tokens**, `tabular-nums` on data, SVG (Lucide) icons, one motion easing, `active:scale(.97)` on tappables.
- **Handle failure states** (loading/empty/error/retry/permission) on every feature.
- **Respect `prefers-reduced-motion`** on all animation.
- **Scope app changes to the app shell** (`.allur-app` / MobileLayout); do not restyle the marketing site incidentally.
- **Mirror to the vault** when done (Phase 6).

## Never
- Never commit a half-working feature, or any feature, straight to `main` (branch → PR → review → merge).
- Never write raw hex in components (`bg-[#...]`). Tokens only.
- Never emoji-as-icon in app UI.
- Never deploy/publish/submit/spend without Micah's explicit go.
- Never add an npm dependency without approval.
- Never trust model memory for a third-party API — verify against current docs.

## Build / deploy notes (this environment)
- The container **cannot reach GitHub** (403). Edits are pushed via Micah's Chrome → GitHub web upload UI; Vercel auto-deploys on push; poll `commits/main/status` for `success`.
- Commit through the upload UI's **"Create a new branch"** option to open a PR (do not "commit directly to main" for features).
- Keep commit summaries < 50 chars (UI button shifts otherwise).

## Reference
`[[App-Dev-Index]]` · `[[SOP-App-Building-with-AI]]` · `[[SOP-Webdesign-with-Claude]]` · `[[Git-and-Code-Review-Workflow]]` · `design-system/MASTER.md` · `PLAN.md`
