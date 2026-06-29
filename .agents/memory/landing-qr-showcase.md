---
name: Landing QR showcase connector beams
description: Why the radial QR "beams" use stretched-viewBox SVG lines (not circles) and how the tap target behaves.
---
The landing "Progress should be predictable" section (Feature Pair 1) uses a centered tappable QR with cyan beams radiating to 4 corner blurbs.

**SVG distortion rule:** the desktop beam SVG uses `viewBox="0 0 100 100" preserveAspectRatio="none"` inside a non-square container (1040x600). Under `preserveAspectRatio="none"` the x/y axes scale by different factors, so any `<circle>`/`<rect>` renders as a stretched ellipse — `vectorEffect="non-scaling-stroke"` fixes only the stroke, not the fill geometry. Use only `<line>` elements here; if you need round endpoint dots, render them as absolutely-positioned HTML, not SVG circles.
**Why:** an earlier version had circular line-end dots that showed up as ugly ellipses.

**QR tap behavior:** gated to mobile only — `if (isMobile && canInstall) promptInstall(); else setLocation("/get")`. Desktop clicks always route to /get (the code is meant to be scanned), so don't drop the `isMobile` guard or desktop Chrome will fire its own PWA install prompt.

**QR encodes `/get`, NOT the landing root.** Both QR codes (landing `QrShowcase` + the `/get` page itself) build their value via `buildInstallUrl()` in `usePwaInstall.ts` → `${origin}${BASE_URL}get?utm_source=qr`. **Why:** it previously pointed at `${origin}/?utm_source=qr`, so scanning opened the marketing homepage with zero install guidance — users read that as "nothing downloaded." `/get` is the public (AuthGate-exempt) install walkthrough with per-platform Add-to-Home-Screen steps + the Android install button. This is a PWA: there is NO file download — "install" = Add to Home Screen (iOS Safari only) / Chrome install (Android). The PWA is genuinely installable (valid `/manifest.webmanifest`, `/sw.js`, 1024² icon, HTTPS) — verified prod serves all of them 200. Modern iOS (16.4+) honors the manifest `start_url` (`/?source=pwa`), so even though iOS A2HS captures the current `/get` URL, the installed icon launches the app root, not the install page. Caveat to tell the user: the dev-preview QR points at the session-bound dev origin (may not load on a separate phone); the published domain is the reliable target.
