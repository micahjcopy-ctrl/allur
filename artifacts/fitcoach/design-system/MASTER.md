# ALLUR — Design System (MASTER)

> Source of truth for all ALLUR **app** UI. Generated via the ui-ux-pro-max method, reconciled with the **brand (the logo wins)**. Read this at the start of every UI build session. Page-specific overrides live in `design-system/pages/*.md` and win over this file for that page.
> **Scope:** the authenticated app shell (`.allur-app` / MobileLayout). The public marketing site keeps its own theme — never restyle it from here without a separate task.

Created 2026-07-23 · Product type: **fitness / physique tracker — dark, premium, gamified** · Stack: React + Vite + Tailwind + shadcn/radix + wouter.

---

## 1. Brand truth (the logo decides)

The ALLUR logo = a **chrome/silver wordmark** inside a broken circle whose arc is a gradient **deep-navy → teal → bright cyan**. That is the palette. Everything below is derived from it. **No color enters the app that isn't in this system.**

- **Signature accent = ALLUR Cyan/Teal** (the arc). Not purple, not steel-gray — cyan.
- **Neutral = chrome/silver** (the wordmark) — this is the *metal*, used for secondary text, icons, hairlines. It is a neutral, **not** a second accent.
- **Canvas = near-black.** Premium dark, matches the logo's transparent-on-dark presentation.

## 2. Color tokens (semantic — never raw hex in components)

Define these as CSS variables on the app shell; components reference the token, never the hex.

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0B0D` | app canvas (near-black, not pure black) |
| `--surface` | `#101317` | cards, sheets |
| `--surface-2` | `#171B21` | raised / active surfaces |
| `--line` | `rgba(255,255,255,.08)` | hairline dividers |
| `--accent` | `#57E0E6` | **ALLUR Cyan** — primary accent, active states, key numbers |
| `--accent-deep` | `#23A6B4` | teal — pressed/secondary accent, gradient partner |
| `--accent-navy` | `#0E2A3A` | deep end of the arc — gradient start, deep fills |
| `--accent-fg` | `#04191E` | text/icon ON a cyan fill (near-black-teal, high contrast) |
| `--chrome` | `#C7CFD8` | chrome/silver — secondary text, icons, "metal" accents |
| `--chrome-dim` | `#8A96A3` | tertiary text, disabled |
| `--text` | `#F2F5F7` | primary text |
| `--text-2` | `#9AA6B2` | secondary text |
| `--success` | `#37C8A6` | positive (harmonised teal-green) — **+ icon/text, never color alone** |
| `--warn` | `#E0A32E` | caution — semantic only |
| `--danger` | `#E5624C` | error/destructive — semantic only |

**Signature gradient** (hero moments only — the Allur Score ring, share cards): `--accent-navy → --accent-deep → --accent` (mirrors the logo arc). Use sparingly; it is the brand's one flourish.

### Contrast (checked, WCAG AA)
- Cyan `#57E0E6` on `#0A0B0D`: **≈ 12:1** ✓ (accents, text, icons all safe)
- `--accent-fg` on cyan button: **≈ 9:1** ✓
- `--text-2` `#9AA6B2` on `#0A0B0D`: **≈ 6.3:1** ✓
- Always re-verify any new pair before shipping.

## 3. Accent intensity — pick ONE (Phase-2 decision for Micah)

Three on-brand options, all cyan/teal, differing only in how loud the accent is. See the preview.
- **A — Chrome-forward (subtle):** UI is chrome/silver + near-black; cyan reserved for the score, active tab, and key CTAs only. Most premium/restrained.
- **B — Balanced (recommended):** cyan on all primary actions, active nav, streak, and data highlights; chrome for everything secondary. Clear brand presence without shouting.
- **C — Cyan-forward (vivid):** cyan used liberally incl. accents on cards and progress; energetic, closest to a "brand-drenched" feel.

## 4. Typography
- **Display / numbers:** Space Grotesk (600/700). **Body/UI:** Inter (400/500/600). (Both already in the app.)
- **Numbers use `tabular-nums`** everywhere (data doesn't jitter). Big hero number per screen.
- Scale: 12 · 14 · 16 · 20 · 28 · 40 · 64. Body min 16px. Line-height 1.5 body.

## 5. Motion spec (one system, applied globally)
- **One easing token:** `--ease: cubic-bezier(.23,1,.32,1)` (ease-out). Springs only for gesture/drag.
- **Durations:** 150–250ms micro; ≤400ms transitions; never >500ms.
- **Only animate `transform` / `opacity`.** Never width/height/top/margin.
- **Press feedback:** `active:scale(.97)` on every tappable card/button; 80–150ms.
- **`prefers-reduced-motion`: REQUIRED.** All count-ups, ring sweeps, confetti, staggers must no-op / snap to final when reduced-motion is set. (This is a hard gate — the current score animation fails it and must be fixed.)
- Delight (confetti/celebration) is the **~20% "earned moment"** layer only — never near steady data.

## 6. Component rules (from ui-ux-pro-max)
- **Icons: SVG only (Lucide), one family, consistent stroke.** No emoji as icons anywhere in the app UI.
- **Touch targets ≥ 44×44** (use hit-area padding for small icons).
- **Bottom nav ≤ 5, stable** (never feature-gate a tab in/out of existence), icon + label, active state highlighted in `--accent`.
- **One primary CTA per screen;** secondary actions subordinate (chrome, ghost).
- **Every feature handles:** loading (skeleton sized to content) · empty · error + retry · permission. No spinners > 1s; no silent failures.
- **Focus states** visible (2–4px ring in `--accent`); keyboard order = visual order.
- **Safe areas** respected for the nav/FAB/CTA bars.

## 7. Anti-patterns — banned in ALLUR (this is the guardrail)
- ❌ **AI purple / pink / magenta accents or gradients.** (The 2026-07 purple incident. Cyan/teal only.)
- ❌ **Raw hex in components** (`bg-[#....]`). Use tokens. The old cyan-glow hardcode + the violet FAB both violated this.
- ❌ **Non-desaturated, 100%-sat colors in dark mode.** Tone accents for the dark canvas.
- ❌ Emoji as structural icons.
- ❌ Animating layout properties; motion with no reduced-motion fallback.
- ❌ Second decorative color competing with cyan. Chrome is a neutral, not a color.
- ❌ Shipping an accent/theme change **without a preview approved by Micah** (Phase-2 gate).

## 8. Definition of on-brand (quick gate before any UI merges)
Cyan/teal accent from tokens · chrome as neutral · near-black canvas · tabular numbers · one motion easing · reduced-motion respected · SVG icons · ≥44px targets · contrast ≥4.5:1 · previewed & approved.

*Palette sampled from the ALLUR logo (chrome wordmark + navy→teal→cyan arc), 2026-07-23.*
