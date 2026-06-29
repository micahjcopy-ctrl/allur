---
name: video-js scaffold typecheck
description: video-js artifact scaffold fails tsc typecheck (DOM lib) by design; verify via Vite + validate-recording.sh instead.
---

# video-js scaffold typecheck quirk

The video-js artifact scaffold's tsconfig omits the DOM `lib`, so `pnpm --filter @workspace/<slug> run typecheck` reports errors like `Cannot find name 'window'`/`document` and `Property 'volume' does not exist on HTMLAudioElement` — even in untouched scaffold files (`hooks.ts`, `main.tsx`, `animations.ts`).

**Why:** the scaffold builds/runs through Vite (esbuild), not `tsc`. These tsc errors are the scaffold baseline, not bugs you introduced.

**How to apply:** Do NOT try to "fix" them by editing scaffold tsconfig or the read-only `hooks.ts`. Verify a video build with `bash scripts/validate-recording.sh` + a clean workflow restart/log check, per the video-js skill ("no need to test/code review beyond scene-selector validation"). Audio/scene-control code that uses `window`/`document`/`HTMLAudioElement` will show these same tsc errors and still run fine.
