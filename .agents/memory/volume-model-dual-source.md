---
name: Volume model dual source of truth
description: The weekly-set volume numbers live in two files that must stay in sync.
---

The evidence-based weekly volume model (per-experience set landmarks, per-muscle sweet
spots, progression, diminishing returns, 0-3 RIR hard-set rule) is encoded twice:

- Client: `VOLUME_GUIDELINES` in `artifacts/fitcoach/src/data/trainingKnowledge.ts`
  (drives `buildProgram` -> `ProgramMeta` -> Plan page UI).
- Server: `VOLUME_RULES` in `artifacts/api-server/src/lib/fitnessKnowledge.ts`
  (injected into `FITNESS_KNOWLEDGE_REFERENCE`, the coach prompt).

**Why:** the React knowledge module cannot be imported server-side, so the numbers are
re-encoded as plain data for the coach (same pattern as `coachPrompt.ts`). If only one
side is edited, the Plan page and the AI coach will recommend conflicting set targets.

**How to apply:** any change to volume numbers must update BOTH files in lockstep.
