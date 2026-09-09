# ALLUR — Onboarding Redesign Plan

Reference: Liftoff (Ranked Gym Workouts), 26 captured screens. Their onboarding is
better than ALLUR's, and the gap is **structural, not decorative**. This separates the
mechanics worth taking from the skin we must not take, then specifies the ALLUR version.

> Kept in the repo deliberately. This lived only in Obsidian and a chat thread, and a
> workspace wipe nearly cost it. Plans that drive code belong next to the code.

**Decisions locked (2026-08-21):** 22 screens · accent intensity **B (Balanced)** ·
system stack for UI + **Archivo** for display · **chrome tokens** added · Score preview
held to screen 6 for personalisation.

---

## PART 1 — Why theirs feels better

Nine mechanics, all transferable without copying a pixel.

1. **One decision per screen. Never two.** ALLUR's step 5 asked *five* things at once —
   day count, which days, session length, busiest-day floor, equipment. That single
   screen is why ALLUR read as a form and theirs read as a conversation. Highest-impact
   change in this document.
2. **The question is spoken, not labelled.** Every question arrives in a speech bubble
   from a character. "How tall are you?" isn't a field label — it's someone asking.
3. **Inputs are physical, not typed.** Height is a huge numeral beside a ruler you drag.
   Weight and reps the same. Almost nothing is a text field. ALLUR summoned the keyboard
   three times on one screen.
4. **Progress always visible, and segmented.** ALLUR already has this. Keep it.
5. **One CTA, bottom-anchored, identical position every time.** The thumb learns one
   target and never hunts.
6. **Momentum screens that ask nothing.** Pure pacing — they turn a queue of fields into
   something with acts. ALLUR had **zero**.
7. **The core mechanic is shown before anything is asked.** Their screen 2 is a body map
   with per-muscle ranks. **ALLUR buries its two best assets behind the paywall** — the
   ALLUR Score and the NOW → GOAL projection. That is backwards.
8. **Reassurance exactly where friction is.** The weight question explains privacy and
   why it's needed, right underneath — not in a policy page.
9. **A physical commitment gesture.** A promise made by holding your thumb down is harder
   to abandon than a tapped checkbox.

## PART 2 — The line

**Take:** one-question-per-screen, conversational framing, drag inputs, momentum beats,
front-loaded payoff, in-place reassurance, hold-to-commit, the trial-reminder screen, the
single bottom CTA. These are interaction patterns — ideas, not property.

**Do not take:** the mascot, rank tier names, illustrations, copy, palette, avatar art.

Beyond the legal point, copying them makes ALLUR **worse**. Their tone is gamified and
juvenile; ALLUR's is redemptive and adult. ALLUR says *"It was never your fault"* and
*"When did you last feel like yourself?"* — aimed at someone in their thirties who has
failed at this before and is quietly embarrassed. **A cartoon elephant breaks that spell
instantly.** ALLUR's writing is better than Liftoff's; the redesign must protect it.

## PART 3 — The ALLUR translation

### 3.1 The Coach Mark — our answer to the mascot
Conversational structure without the cartoon. The speaker is *the coach*, an abstract mark.
- ALLUR bolt glyph in `--primary`, ~28px, in a teal-glow disc (`bg-primary/10`, 44px).
- Fixed top-left of the content area on every question screen.
- Question to its right in a bubble (`bg-card`, `border-border`, `rounded-2xl`).
- Written as speech: "How tall are you?" not "Height".
- Pulses once on appear (scale 1 → 1.06 → 1, ~400ms, existing `--ease`).

### 3.2 The Dial — our answer to their rulers
One component, three uses (height, weight, age).
- Value in **Archivo**, ~56px, tabular figures (global via `.allur-app`).
- Tick rail beneath; centre indicator a 2px `--primary` line with soft glow.
- Drag to change; unit toggle reuses the existing `UnitToggle`.
- Haptic tick per unit step (`@capacitor/haptics`, `ImpactStyle.Light`).
- **Fallback:** tap the number to type. Never trap someone who wants the keyboard.

### 3.3 Colour as reward
| Act | Background | Feeling |
|---|---|---|
| Identity (1–6) | near-black | neutral |
| The wound (7–9) | near-black + faint navy vignette | intimate |
| Commitment (10) | navy wash | weight |
| Numbers + week (11–21) | near-black | businesslike |
| Build + reveal (22–23) | teal glow rising from the bottom | momentum |
| Paywall (24–25) | the one full gradient | arrival |

The gradient appears **once**. Because it's the only time, it reads as a state change.

### 3.4 Front-load the payoff
- **ALLUR Score** — this *is* ALLUR's rank system. Show the concept early (held to screen
  6/7 so it can be personalised to the stated goal).
- **NOW → GOAL projection** — the strongest asset in the product, currently paywalled.
  A stock version (their chosen starting body → chosen target physique) belongs in the reveal.

## PART 4 — Components

| Component | Purpose |
|---|---|
| `CoachBubble` | question + coach mark |
| `Dial` | drag input for height / weight / age |
| `ChoiceCard` | **exists as `CardBtn`** — unify everything onto it |
| `BeatScreen` | momentum screen, no input |
| `HoldToCommit` | press-and-hold; ring fills, haptic on complete |
| `StepShell` | eyebrow + question + content + one bottom CTA |
| `ScorePreview` | reuse the existing radial from Progress |

## PART 5 — Screen map: 8 → 22

**Act I — Hook:** 1 Splash · 2 "Here's what ALLUR builds you" (Score preview)
**Act II — Identity:** 3 Gender · 4 Starting physique · 5 Target physique · 6 Primary goal
**Act III — The wound:** 7 What's gotten in the way · 8 **"None of these were your fault"** (own screen) · 9 When did you last feel like yourself
**Act IV — Commitment:** 10 "I will use ALLUR to…" + hold to commit
**Act V — Numbers:** 11 Name · 12 Age · 13 Height · 14 Weight *(+ reassurance)* · 15 Experience · 16 Activity level
**Act VI — Real week:** 17 How many days · 18 Which days · 19 Session length + busiest day · 20 Where you train · 21 Anything to train around
**Act VII — Payoff:** 22 Building your plan · 23 The reveal · 24 Trial reminder preference · 25 Paywall

Screens 24–25 are the structure worth taking wholesale: **trust is built before the card
is requested.**

## PART 6 — Build order

**Phase 1 — the system:** `StepShell` · `CoachBubble` · `Dial` (+ haptics) · `BeatScreen`
**Phase 2 — split what exists:** current step 5 → screens 17–21 · step 7 → 11–16 ·
steps 1–2 → 3–6 · promote the "not your fault" box to screen 8
**Phase 3 — new material:** screens 1–2 · screen 10 · screen 22 · screen 24
**Phase 4 — the reveal:** rebuild screen 23
**Phase 5:** colour-act treatment · paywall gradient

**Before Phase 3:** convert the flow from hardcoded `{step === N}` blocks to a config
array, so length is a dial rather than a rewrite. Adding 14 screens as hardcoded blocks
rebuilds the exact drift being removed.
