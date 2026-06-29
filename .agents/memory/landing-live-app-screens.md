---
name: Landing live app-screen presentation
description: How the ALLUR marketing landing shows "product UI" and runs its scroll-storytelling, plus the reduced-motion approach.
---

# Landing live app-screen presentation

The landing presents the product with **hand-built live React "screen-state" components**, not screenshots.

**Why:** the bundled images in `artifacts/fitcoach/public/` are AI-generated lifestyle/abstract renders, NOT real app UI. Using them as "product shots" looks fake. Instead, `artifacts/fitcoach/src/pages/landing/AppScreens.tsx` renders faithful mini app screens (Onboarding/Dashboard/Coach/Meal/Progress/Adapt) built entirely from the `.allur-lp` design tokens, so they match the real product and re-animate every time they appear.

**How to apply:**
- Add/edit product screens in `AppScreens.tsx` (primitives: `ProgressRing`, `Bar`, `LineChart`, `ScreenChrome`, `PhoneFrame`, `FloatingCallout`). Keep them token-driven (`var(--lp-*)`) so they never drift from the brand palette.
- Scroll-storytelling lives in `Landing.tsx` `#how-it-works`: `useScroll({target: stepsRef, offset:["start start","end end"]})` + `useMotionValueEvent` → `activeStep = floor(v * JOURNEY.length)` (clamped). The right column is `sticky top-20 h-[calc(100vh-5rem)]` (offset clears the fixed navbar).
- **Phone-screen swap = crossfade INSIDE a static PhoneFrame, NOT `mode="wait"` on the whole device.** Render `PhoneFrame` once (it stays visually anchored while the left copy scrolls); inside it put `AnimatePresence initial={false}` (sync mode) with `key={activeStep}` opacity-only layers (`absolute inset-0`, duration ~0.35). **Why:** the old approach wrapped the entire phone in `AnimatePresence mode="wait"` with y/scale enter+exit — on fast scroll `wait` serializes exit→enter, so the phone visibly goes BLANK and appears to "skip/repeat". Sync crossfade overlaps outgoing/incoming screens so the phone never empties even when scrubbing fast. Mirror the proven `AutoCyclingScreen` pattern in `AppScreens.tsx`.
- `PhoneFrame` uses `width: min(300px, calc(100vw - 2.5rem))` + `aspectRatio` (not a fixed height) so it never clips on narrow phones.
- **Reduced motion:** wrap screen children in `<MotionConfig reducedMotion="user">` (done inside `PhoneFrame` and the `ConsolePanel` helper). Note MotionConfig only neutralizes *transform/layout* motion — SVG-attribute draws (ring `strokeDashoffset`, bar `width`, path `pathLength`) still animate; that's an accepted tradeoff (brief one-shot draws). Heavy parallax in `Landing.tsx` is separately guarded with `useReducedMotion()` (`style={prefersReduced ? undefined : { y }}`).

**`position: sticky` gotcha (the phone-sticks-while-copy-scrolls effect):** the sticky right column in `#how-it-works` silently does NOT stick if ANY ancestor has `overflow-x: hidden` — that turns the ancestor into a scroll container, so sticky anchors to it instead of the viewport. The `.allur-lp` root needs `overflow-x: clip` (clips horizontal overflow from parallax/decorative absolutes WITHOUT creating a scroll container). Never reintroduce `overflow-x-hidden` on the landing root.
**Why:** clip vs hidden is the difference between sticky working and silently failing; the markup looked correct the whole time.

**Hard constraint that shaped this:** add ONLY motion + product presentation; do not touch the existing premium design, fonts, branding, palette, or the `.allur-lp` scoped style system.
