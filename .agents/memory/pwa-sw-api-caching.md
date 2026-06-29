---
name: PWA service worker API caching
description: A service worker that caches same-origin GETs must exclude /api/ — otherwise it leaks stale/private authenticated data.
---

# PWA service worker must never cache authenticated API responses

When adding a service worker to make a same-origin app installable (PWA), a naive
network-first handler that caches *all* same-origin GET responses will also cache
authenticated `/api/*` responses and replay them on network failure.

**Why:** the API is on the same origin as the app shell. Caching it (a) serves stale
private data offline, and (b) on a shared browser profile can replay one account's
cached API responses into another session. This was flagged as a blocking security
issue during review of the ALLUR "Get the app" PWA feature.

**How to apply:** in the SW `fetch` handler, gate caching to the app shell + static
build assets only — `request.mode === "navigate"` or `request.destination` in
{script,style,image,font} — AND explicitly bypass anything under `/api/` (and other
sensitive paths) from both the cache-write and cache-read paths. Keep it network-first
with a cached "/" shell fallback only for navigations.
