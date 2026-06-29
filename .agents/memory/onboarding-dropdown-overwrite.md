---
name: Onboarding step-1 dropdown overwrite
description: Why rapid Gender/Experience/Activity selection can silently leave the onboarding Next button disabled
---

# Onboarding step-1 dropdown overwrite

In `artifacts/fitcoach/src/pages/onboarding/Onboarding.tsx`, every field handler does
`setProfile({ ...profile, field: val })` reading `profile` from the render closure.
Selecting the three Radix Selects (Gender, Experience, Activity level) faster than a
re-render can occur makes a later `setProfile` overwrite an earlier one with stale data —
so a field (often Gender) silently reverts to empty and the "Next" button stays disabled
even though the UI looks fully filled. There is also NO feedback telling the user which
field is missing.

**Why:** Stale-closure object spreads instead of functional updates. Confirmed empirically —
automated walkthroughs failed three times with rapid selection and only passed once each
dropdown was paced ~1.2s apart (re-render between selections). The gating logic itself
(`hasCalculableProfile`) is correct; the bug is the state writes, not the validation.

**How to apply:** A real human clicking one dropdown at a time rarely hits this, but it is a
genuine latent bug. The safe fix is functional updates everywhere in this form:
`setProfile(prev => ({ ...prev, field: val }))`. Also consider surfacing why Next is disabled.
When automating/testing this form, pace dropdown selections so the form re-renders between them.
