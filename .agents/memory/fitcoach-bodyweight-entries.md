---
name: Bodyweight chart entry 1 = onboarding weight (synthetic, not stored)
description: Why the onboarding weight must be a chart-only point and never auto-seeded into weightLogs
---

The Progress bodyweight chart shows the onboarding weight (`profile.weight`) as a synthetic "Start" point = entry 1, derived live at render time. It is **never** written into `weightLogs`.

**Why:** An earlier `useEffect` auto-called `addWeightLog(parseFloat(profile.weight))` whenever `profile.weight` changed while `weightLogs` was empty. It fired (a) mid-typing during onboarding — seeding a partial value like `1`, which a kg/lb unit round-trip then rounded to a nonsense `1.1`, and (b) again on hydration — duplicating the onboarding weight. Result: bogus + duplicate entries the user never logged.

**How to apply:** Keep `weightLogs` as user-added entries ONLY. Do not reintroduce any effect that seeds it from profile/onboarding/hydration. If entry 1 should reflect onboarding weight, prepend it to the chart's `chartData` (synthetic, `isStart:true`), not to persisted state. `removeWeightLog(id)` + the "Logged entries" delete list let users clear mistakes.
