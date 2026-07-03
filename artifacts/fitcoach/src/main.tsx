import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

// Error monitoring (opt-in): only initializes when VITE_SENTRY_DSN is set in the
// build env, so it's a no-op until you create a Sentry project and add the DSN
// in Vercel. Error capture only — tracing/replay are off to keep it light/cheap.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  });
}

createRoot(document.getElementById("root")!).render(<App />);

// --- PWA service worker registration + update flow ---
// How pushed updates reach installed devices:
//  1. The SW is network-first for the app shell + hashed build assets, so an
//     online user always loads the freshest deploy on a cold start.
//  2. `updateViaCache: "none"` makes the browser fetch sw.js itself fresh when
//     checking for updates (never from the HTTP cache), so a new deploy's SW is
//     actually detected.
//  3. We proactively call `registration.update()` on load and whenever the app
//     regains focus, so a long-lived installed session notices new versions.
//  4. The SW calls skipWaiting()+clients.claim(), so a new version takes control
//     immediately; `controllerchange` then refreshes the page ONCE — but only for
//     a genuine update (a page that was already controlled), never on first
//     install, so users are never caught in a reload loop.
if ("serviceWorker" in navigator) {
  let refreshing = false;
  // Only auto-reload on a controller change if this page was already controlled
  // by a SW at startup. On the very first install the new SW claims this page
  // (controller goes null -> active), which must NOT trigger a reload.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
      .then((registration) => {
        // Check for a new deploy immediately, and again whenever the user
        // returns to the app (e.g. reopens the installed PWA / refocuses the tab).
        registration.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch(() => {
        /* registration is best-effort; the app works without it */
      });
  });
}
