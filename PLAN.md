# PLAN.md — ALLUR

> The living spec + progress tracker. Update as slices ship. Read `AGENTS.md` + `design-system/MASTER.md` first. Governed by `[[SOP-App-Building-with-AI]]`.

## Product spec (v-current)
Adaptive fitness/physique app. Core jobs: **Train** (plan + session logging + cardio), **Nutrition** (macros), **Progress** (body scans, Allur Score, PRs, charts), **Squad** (social/leaderboard), **Coach** (AI). Physique **Allur Score** is the signature number; a squad Reps/quest economy drives engagement. Platforms: web app now (mobile-first PWA); native wrap is a later phase. Monetization: paywall at score reveal (future phase).

## Status legend
✅ done & live · 🟡 in progress · ⬜ planned · ⛔ needs Micah's approval to proceed

---

## Phase 0 — Context ✅
- ✅ Read AppDev + Webdesign SOPs + ui-ux-pro-max; audited repo + current app state.

## Phase 1 — Foundation / scaffolding ✅
- ✅ `AGENTS.md` (repo root) — approved; committed to repo.
- ✅ `PLAN.md` (repo root) — this file; committed to repo.
- ✅ `artifacts/fitcoach/design-system/MASTER.md` — logo-derived cyan/teal system; committed to repo.
- ✅ Branch → PR → subagent review → merge adopted as standing workflow (first use: PR #7).

## Phase 2 — Design system + accent ✅
- ✅ MASTER.md generated, brand-reconciled (cyan/teal + chrome).
- ✅ Accent preview built (options A/B/C); **Micah picked Option B (Balanced)** — locked in MASTER.md.

## Phase 3 — Build in reviewed vertical slices (each: branch → verify → review → preview → merge → tick)
- ✅ **S1 — Accent to tokens.** ALLUR cyan (Option B) as semantic tokens on `.allur-app`. Branch `micahjcopy-ctrl-patch-1` → PR #7 → subagent review (APPROVE) → merged. Verified live (`--primary: 183 74% 62%`); marketing untouched.
- ✅ **S2 — Reduced-motion fix.** `useCountUp` (score number + ring) snaps to final under `prefers-reduced-motion`. Shipped in PR #7.
- ⬜ **S3 — Motion tokens + press-states.** One easing token; `active:scale(.97)` on tappable cards/buttons app-wide.
- ⬜ **S4 — Forgiving streak system** (low bar, free freeze, earn-back, 7/30/100 milestones) wired to existing Reps.
- ⬜ **S5 — Tiered celebration engine** (tick → chime → confetti) on PRs / score highs / goal hits, reduced-motion aware.
- ⬜ **S6 — Failure-state audit** on new features (loading/empty/error/retry).

### Already shipped this session (pre-SOP; to be back-filled with review where risky)
- ✅ 48 exercise demo images (real photos) + `exerciseImage` → `.jpg`.
- ✅ Training-KB refresh (frequency principle + per-muscle volume table).
- ✅ Dashboard "recommended cardio today" card.
- ✅ Nav 7 → 5 tabs (Home · Train · Nutrition · Progress · You) + Coach FAB.
- ✅ Allur Score count-up + ring sweep (⚠️ needs S2 reduced-motion retrofit).
- ✅ tabular-nums app-scoped.
- ✅ Squad `first_friend` quest completion fix.
- ↩️ Violet theme — shipped then **reverted** (SOP post-mortem: the reason this plan exists).

## Phase 4 — Production hardening ⬜
- ⬜ Verify Sentry initialized + capturing (errors, logs, traces, replay).
- ⬜ Rate-limit AI Coach / LLM calls (per-user/day).
- ⬜ Graceful-failure sweep.

## Phase 5 — Ship ⬜  ⛔ only on Micah's go
- ⬜ App-Store-Launch-Checklist: in-app delete-account (+ data removal), privacy/TOS/support pages, permission strings, app icon/splash, listing assets.

## Phase 6 — Mirror to vault ⬜
- ⬜ Commit this PLAN.md + MASTER.md + build notes → `03_Projects/ALLUR/`; session log → `_claude/sessions/`; open items → `Tasks.md`.

---
## Decisions locked (2026-07-23)
1. ✅ Phase-1 scaffolding approved + committed to repo (AGENTS.md, PLAN.md, design-system/MASTER.md).
2. ✅ Accent = **Option B (Balanced)**, ALLUR cyan `#57E0E6` / `hsl(183 74% 62%)`.
3. ✅ Branch → subagent review → preview → merge is the standing workflow.
