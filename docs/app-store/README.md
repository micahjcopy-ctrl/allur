# App Store screenshots — how they are made

Everything here regenerates the store screenshots without touching production.

## What's in here

- `screenshots/` — the finished, upload-ready PNGs. `*_6.9in_1320x2868.png` for
  the 6.9" slot, `*_6.5in_1284x2778.png` for 6.5". Order 01–06 is the store order.
- `make_screens.py` + `Archivo-var.ttf` — compositor: brand background, caption,
  device frame. `python3 make_screens.py <captures_dir> <out_dir>`. Captions are
  keyed by the capture filename suffix (dashboard, score, coach, macros, plan,
  progress, onboarding). Point `FONT` at the ttf next to it.
- `pipeline/` — produces the raw captures at true iPhone resolution:
  - `mock_server.mjs` serves the built web app (`artifacts/fitcoach/dist/public`)
    with a stub API. Pass a state JSON as the 4th arg and it hydrates the app as a
    normal Base subscriber with that data. Nothing here calls getallur.com.
  - `demo_state_screens.json` — the demo athlete ("Alex"): plan, PRs, weights,
    meals, 3 weeks of logged sessions, a body scan. Photos point at the app's own
    bundled `/bodytypes/*.jpg` so nothing external is needed.
  - `demo_chat.json` — the coach conversation shown on screen 03.
  - `shoot_state.mjs` — Playwright, iPhone 15 Pro Max profile, 440×956 @3x
    (= 1320×2868). Presets the tour/gift flags, seeds the chat through the app's
    own `addChatMessage`, navigates client-side, saves `NN-route.png`.
  - `extract_state.mjs` — how `demo_state_screens.json` was first produced:
    enters the admin demo mode on the local build and dumps the seeded context.

## Regenerate

```
cd artifacts/fitcoach && pnpm build
cd ../../docs/app-store/pipeline
node mock_server.mjs ../../../artifacts/fitcoach/dist/public 4174 demo_state_screens.json &
npm i playwright   # once; needs a Chromium (CHROMIUM_PATH optional)
node shoot_state.mjs http://localhost:4174 ../captures demo_chat.json
cd .. && python3 make_screens.py captures screenshots
```

Edit `CAPTIONS` in `make_screens.py` to change the copy; edit the JSON files to
change what the phone shows.
