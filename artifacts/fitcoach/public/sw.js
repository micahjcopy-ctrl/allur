// ALLUR service worker — network-first for the app shell + static assets only.
// It NEVER touches API traffic: authenticated /api/* requests always go straight
// to the network and are never cached (no stale/private data, no cross-account
// leakage on shared browsers). The cache is only an offline fallback for the
// static shell and built assets, and network-first keeps online users on the
// freshest deploy.
const CACHE = "allur-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Only the static shell / build assets are cacheable. API calls, auth, and any
// non-static request are excluded from both the read and the write path.
function isCacheable(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (request.mode === "navigate") return true;
  return ["script", "style", "image", "font"].includes(request.destination);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (!isCacheable(req, url)) return; // network handles everything else untouched

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200 && fresh.type === "basic") {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        throw err;
      }
    })(),
  );
});
