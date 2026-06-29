---
name: PWA standalone vs browser entry split
description: Why the installed app and the website show different signed-out entry screens, and how the AuthGate branch is structured.
---
The signed-out entry experience is split by display mode: the **installed PWA** (standalone) opens to a minimal branded welcome screen (`AppWelcome`, logo + Log In + Get Started), while the **browser** shows the full marketing landing page (`Landing` at `/home`). The marketing landing must NEVER render inside the installed app.

**Why:** product decision — the website's job is to market and convert; the installed home-screen app is for people who already have an account (created on the web before installing), so its first screen should feel like a native app's splash/auth, not a scrollytelling marketing site.

**How to apply:** `isStandalone()` (exported from `usePwaInstall.ts`, matches `display-mode: standalone` or iOS `navigator.standalone`) is the single switch, read once in `AuthGate`. Signed-out standalone is confined to `/welcome | /auth | /reset-password` (everything else, including `/home`, redirects to `/welcome`) and the render returns `standalone ? <AppWelcome/> : <Landing/>`. Signed-in standalone on `/home` redirects to `/` and shows a spinner (never `<Landing/>`). Manifest `start_url` is `/?source=pwa`; on a signed-out standalone launch the `!authUser && standalone` render already yields `AppWelcome` on the first paint, so the `/` → `/welcome` redirect causes no Landing/NotFound flash. When adding new signed-out public routes, add them to BOTH the standalone and browser allow-lists in the AuthGate effect or they'll bounce.
