---
name: FitCoach AI Coach feature
description: Non-obvious constraints for the conversational coach (text+voice) and its paid-LLM endpoints.
---

# FitCoach AI Coach

Real conversational coach in `artifacts/api-server/src/routes/coach.ts` (text `/api/coach/chat`, voice `/api/coach/voice`), grounded in re-encoded training knowledge (`lib/coachPrompt.ts`). Plan changes apply via an `update_training_plan` tool call; the frontend swaps the plan when `planUpdated` is true.

## Per-IP rate limiting behind the Replit proxy
The API server sits behind Replit's reverse proxy. You MUST `app.set("trust proxy", true)` or `req.ip` resolves to the single proxy IP and any per-IP limiter throttles every user together (self-DoS).
**Why:** the coach endpoints call paid LLM/STT/TTS APIs and the app has no user auth, so a lightweight in-memory per-IP limiter is the proportionate abuse guard — but it's only correct once `req.ip` reflects the real client.
**How to apply:** any per-IP logic (rate limit, abuse tracking) on this server depends on `trust proxy` being set in `app.ts`.

## Trust audio bytes, not the client-declared format
Voice STT detects the container via magic bytes (`detectAudioFormat`) and ignores the client's `audioFormat`. Browsers record different containers (Chrome webm, Safari mp4); anything not directly transcribable (mp4/ogg/unknown) is converted to wav via ffmpeg (`ensureCompatibleFormat`). `speechToText` only accepts wav/mp3/webm.

## TTS endpoint quirk
The OpenAI integration proxy returns 400 on `POST /audio/speech`. Generate speech via `gpt-audio` chat completions with `modalities: ["text","audio"]` and `audio: { voice, format }` (the `textToSpeech` helper in the openai-ai-server audio lib does this).

## Plan-edit invariant
Only return `planUpdated: true` when the tool produced a non-empty `updatedPlan` array; otherwise fall back to a text reply. Otherwise the UI shows "Plan updated" while nothing changed. Also wrap `JSON.parse(toolCall.function.arguments)` in try/catch.

## Physique → plan personalization truthfulness guard
`/api/coach/personalize-plan` rebalances the plan from a fresh physique scan (forced `rebalance_training_plan` tool returning summary/explanation/changes/days). A model can return a `changes` list while echoing the plan back **unchanged** — so requiring non-empty changes+explanation+plan is NOT enough. Also do a normalized structural compare (key-order-insensitive JSON) of input vs returned plan; if equal, report no-change. The Progress page auto-fires this after a scan (best-effort, non-blocking) and shows a "what changed" dialog only on a real change.
**Why:** without the equality check the UI claims "Plan updated from your scan" when nothing actually changed.
**How to apply:** any forced-tool "edit X and tell me what you changed" endpoint needs a semantic no-op guard, not just presence checks.

## Forward physique context on BOTH coach paths
When adding any new field to the coach context (e.g. `physique`), pass it through in `/coach/voice`'s `runCoach({...})` call too, not just `/coach/chat`. The voice handler rebuilds the chat request object by hand, so new fields silently drop unless added there.

## Vision endpoints share one stricter rate-limit bucket
`/api/coach/analyze-physique` (body-fat estimate) and `/api/coach/analyze-meal` (calorie/macro estimate from a food photo) are far more expensive per call than chat/voice, so they share `visionRateLimit` (separate, stricter per-IP limiter via a `makeRateLimit(limit, windowMs)` factory) plus a MIME allowlist (jpeg/png/webp) and a decoded-size cap (~3 MB) that reject before any paid call. Both force a structured tool call (`report_body_fat_analysis` / `report_meal_analysis`), parse args in try/catch, and Zod-validate the output. The meal tool returns `isFood` → respond 400 for non-food photos.
**Why:** they're unauthenticated like the other coach routes, but a single shared 20/min limiter + 25mb JSON body is a real cost-amplification hole for a paid vision model.
**How to apply:** any new paid unauthenticated endpoint needs the vision bucket + payload guard, not the shared chat limiter. Frontend downscales the photo client-side (~1024px) before upload, so the cap only catches abuse.

## fitcoach client does NOT depend on @workspace/api-zod
The `artifacts/fitcoach` web client has no `@workspace/api-zod` dependency, so importing generated request/response types there fails typecheck (TS2307). Mirror the server contract as a small inline interface in the consuming page (this is what `Coach.tsx` does), don't add the dep just for a type.
**Why:** fitcoach is a static client; adding a server-spec package for one type couples it to codegen output unnecessarily.
**How to apply:** when wiring a new fitcoach page to a backend route, copy the reply shape as a local `interface`, keep the Zod schema authoritative server-side.
