/* ===========================================================================
   analytics.ts — the client write path for ALLUR's self-hosted analytics.

   Read this before adding a call site:

   1. NOTHING HERE MAY THROW, and nothing here may block the UI. Every public
      function swallows its own errors. A user must never see a broken screen
      because a metric failed to send. This mirrors the server contract in
      artifacts/api-server/src/lib/analytics.ts and the degrade-silently
      pattern in lib/push.ts.

   2. Events are queued and flushed in batches, not sent per call. Onboarding
      fires several events within a few seconds; one request per event would
      be wasteful on mobile data and would race the page unload.

   3. The identifiers are deliberately weak. `anonId` is a rotating random
      value with no relationship to the person — not an email hash, not a
      device fingerprint — and it rotates every 180 days so it can't become a
      permanent identifier. `sessionId` is per browsing session. The real user
      id is attached SERVER-side from the session cookie and is never sent
      from here.

   4. Disabled in dev. Local `vite dev` runs with import.meta.env.DEV, so
      clicking through the app on a laptop never pollutes the funnel. Preview
      and production deploys are both production builds and do report.
   =========================================================================== */

const ENDPOINT = "/api/events";

/** Keep in sync with ALLOWED_EVENTS in artifacts/api-server/src/lib/analytics.ts. */
export type AnalyticsEventName =
  | "page_view"
  | "signup_started"
  | "signup_completed"
  | "onboarding_step_viewed"
  | "onboarding_step_completed"
  | "onboarding_abandoned"
  | "onboarding_completed"
  | "paywall_viewed"
  | "trial_started"
  | "subscription_started"
  | "feature_used";

export type EventProps = Record<string, string | number | boolean>;

/** The four credit-gated features, named once so panels can group on them. */
export type TrackedFeature =
  | "coach_chat"
  | "coach_voice"
  | "meal_photo"
  | "meal_text"
  | "body_scan"
  | "goal_photo"
  | "cardio_route";

const ANON_KEY = "allur_anon";
const SESSION_KEY = "allur_sid";
/** Rotate the anonymous id twice a year — long enough to see a funnel, short
 *  enough that it never becomes a durable identity. */
const ANON_TTL_MS = 180 * 24 * 60 * 60 * 1000;
/** A gap this long ends the session; the next event starts a new one. */
const SESSION_IDLE_MS = 30 * 60 * 1000;

const FLUSH_INTERVAL_MS = 5_000;
/** Flush early once the queue reaches this size. */
const FLUSH_AT = 20;
/** Server caps a batch at 50; never send more than it will accept. */
const MAX_BATCH = 50;
/** Hard ceiling on unsent events (e.g. a long offline stretch). Oldest go first. */
const MAX_PENDING = 200;

const enabled = (() => {
  try {
    return typeof window !== "undefined" && !import.meta.env.DEV;
  } catch {
    return false;
  }
})();

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** URL-safe random id. Matches the server's /^[A-Za-z0-9_-]{8,64}$/ envelope check. */
function randomId(): string {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    // Fallback for runtimes without WebCrypto. Lower quality, still opaque.
    return `f${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

// Safari private mode and locked-down webviews throw on storage access, so
// every read/write is guarded and falls back to memory for the tab's lifetime.
const memoryStore = new Map<string, string>();

function readStore(kind: "local" | "session", key: string): string | null {
  try {
    const store = kind === "local" ? window.localStorage : window.sessionStorage;
    return store.getItem(key);
  } catch {
    return memoryStore.get(`${kind}:${key}`) ?? null;
  }
}

function writeStore(kind: "local" | "session", key: string, value: string): void {
  try {
    const store = kind === "local" ? window.localStorage : window.sessionStorage;
    store.setItem(key, value);
  } catch {
    memoryStore.set(`${kind}:${key}`, value);
  }
}

interface StoredId {
  id: string;
  at: number;
}

function parseStoredId(raw: string | null): StoredId | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredId>;
    if (typeof parsed?.id !== "string" || typeof parsed?.at !== "number") return null;
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(parsed.id)) return null;
    return { id: parsed.id, at: parsed.at };
  } catch {
    return null;
  }
}

function anonId(): string {
  const now = Date.now();
  const stored = parseStoredId(readStore("local", ANON_KEY));
  if (stored && now - stored.at < ANON_TTL_MS) return stored.id;

  const fresh: StoredId = { id: randomId(), at: now };
  writeStore("local", ANON_KEY, JSON.stringify(fresh));
  return fresh.id;
}

function sessionId(): string {
  const now = Date.now();
  const stored = parseStoredId(readStore("session", SESSION_KEY));
  if (stored && now - stored.at < SESSION_IDLE_MS) {
    // Slide the idle window forward on every event.
    writeStore("session", SESSION_KEY, JSON.stringify({ id: stored.id, at: now }));
    return stored.id;
  }

  const fresh: StoredId = { id: randomId(), at: now };
  writeStore("session", SESSION_KEY, JSON.stringify(fresh));
  return fresh.id;
}

// ---------------------------------------------------------------------------
// Queue + flush
// ---------------------------------------------------------------------------

interface QueuedEvent {
  event: AnalyticsEventName;
  props: EventProps;
  path: string;
  referrer: string;
  ts: number;
}

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

function currentPath(): string {
  try {
    return `${window.location.pathname}${window.location.search}`.slice(0, 512);
  } catch {
    return "";
  }
}

function currentReferrer(): string {
  try {
    return (document.referrer || "").slice(0, 512);
  } catch {
    return "";
  }
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

function cancelScheduledFlush(): void {
  if (flushTimer === null) return;
  clearTimeout(flushTimer);
  flushTimer = null;
}

function payloadFor(batch: QueuedEvent[]): string {
  return JSON.stringify({
    anonId: anonId(),
    sessionId: sessionId(),
    events: batch,
  });
}

/**
 * Send everything queued.
 *
 * `useBeacon` is set on page unload: `sendBeacon` is the only transport a
 * browser reliably completes after the page goes away, which is exactly when
 * the most valuable event (`onboarding_abandoned`) fires.
 */
export function flush(useBeacon = false): void {
  if (!enabled || queue.length === 0) return;
  cancelScheduledFlush();

  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(batch.length);

  let body: string;
  try {
    body = payloadFor(batch);
  } catch {
    return; // Unserialisable payload — drop it rather than retry forever.
  }

  if (useBeacon) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      // If the beacon is refused (queue full / too large) the events are gone —
      // the page is unloading, so there is no second chance to take.
      navigator.sendBeacon?.(ENDPOINT, blob);
    } catch {
      /* best-effort */
    }
    return;
  }

  try {
    void fetch(ENDPOINT, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      requeue(batch);
    });
  } catch {
    requeue(batch);
  }

  if (queue.length > 0) scheduleFlush();
}

/** Put a failed batch back at the front so the next flush retries it. */
function requeue(batch: QueuedEvent[]): void {
  queue = [...batch, ...queue].slice(-MAX_PENDING);
  scheduleFlush();
}

function bindLifecycleListeners(): void {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;

  // `visibilitychange -> hidden` is the reliable "user is leaving" signal on
  // mobile (backgrounding an app never fires `beforeunload`); `pagehide`
  // covers bfcache navigations on desktop Safari.
  const onHide = () => {
    if (document.visibilityState === "hidden") flush(true);
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", () => flush(true));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record an event. Fire-and-forget: returns immediately, never throws, and
 * never awaits the network. Safe to call from a render path or an event
 * handler without a try/catch.
 */
export function track(event: AnalyticsEventName, props: EventProps = {}): void {
  if (!enabled) return;
  try {
    bindLifecycleListeners();
    queue.push({
      event,
      props,
      path: currentPath(),
      referrer: currentReferrer(),
      ts: Date.now(),
    });
    if (queue.length > MAX_PENDING) queue = queue.slice(-MAX_PENDING);
    if (queue.length >= FLUSH_AT) flush();
    else scheduleFlush();
  } catch {
    /* analytics must never break a screen */
  }
}

/** Convenience wrapper so route changes read the same everywhere. */
export function trackPageView(path?: string): void {
  track("page_view", path ? { route: path.slice(0, 120) } : {});
}

/** Convenience wrapper for the credit-gated features. */
export function trackFeature(feature: TrackedFeature, props: EventProps = {}): void {
  track("feature_used", { feature, ...props });
}
