import { db, analyticsEventsTable } from "@workspace/db";

/* ===========================================================================
   Analytics write path — server side.

   Modelled on lib/push.ts: this is a companion signal, never a dependency.
   Nothing in here is allowed to throw, and nothing in here is allowed to
   change the outcome of the request that triggered it. If the events table is
   unreachable, the product keeps working and we lose a data point.
   =========================================================================== */

/**
 * The canonical event vocabulary. Anything not on this list is dropped at
 * ingest — an allowlist rather than a denylist, so a compromised or buggy
 * client can't fill the table with arbitrary names, and so the funnel queries
 * can rely on these strings existing exactly as written.
 *
 * Keep in sync with `artifacts/fitcoach/src/lib/analytics.ts`.
 */
export const ALLOWED_EVENTS = new Set<string>([
  // Traffic
  "page_view",
  // Signup
  "signup_started",
  "signup_completed",
  // Onboarding — the seven-step wizard. props: { step: 1..7 }
  "onboarding_step_viewed",
  "onboarding_step_completed",
  "onboarding_abandoned",
  "onboarding_completed",
  // Monetisation
  "paywall_viewed",
  "trial_started",
  "subscription_started",
  // Usage — the credit-gated features. props: { feature }
  "feature_used",
]);

/** Hard caps. A batch that exceeds any of these is trimmed, never rejected. */
export const MAX_EVENTS_PER_BATCH = 50;
const MAX_PROPS_KEYS = 12;
const MAX_KEY_LEN = 40;
const MAX_STRING_VALUE_LEN = 120;
const MAX_PATH_LEN = 512;
const MAX_REFERRER_LEN = 512;
/** Reject timestamps outside this window rather than trusting the client clock. */
const MAX_CLOCK_SKEW_MS = 7 * 24 * 60 * 60 * 1000;

export const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Strip a client-supplied props bag down to low-cardinality scalars.
 *
 * This is the privacy chokepoint: the table must never accumulate free text,
 * health values, or anything resembling PII, and the only way to guarantee
 * that is to refuse to store anything that isn't a short scalar under a known
 * shape. Objects, arrays, and long strings are dropped silently.
 */
export function sanitizeProps(input: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;

  let kept = 0;
  for (const [rawKey, value] of Object.entries(input as Record<string, unknown>)) {
    if (kept >= MAX_PROPS_KEYS) break;
    const key = rawKey.slice(0, MAX_KEY_LEN);
    if (!key) continue;

    if (typeof value === "string") {
      if (value.length === 0 || value.length > MAX_STRING_VALUE_LEN) continue;
      out[key] = value;
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) continue;
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    } else {
      continue;
    }
    kept++;
  }
  return out;
}

function clampString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function clampTimestamp(value: unknown): Date {
  const now = Date.now();
  if (typeof value !== "number" || !Number.isFinite(value)) return new Date(now);
  // Batches can be flushed after an offline gap, so past timestamps are legal;
  // future ones never are. A clock that's wildly off falls back to server time.
  if (value > now + 60_000) return new Date(now);
  if (value < now - MAX_CLOCK_SKEW_MS) return new Date(now);
  return new Date(value);
}

export interface IncomingEvent {
  event: string;
  props?: unknown;
  path?: unknown;
  referrer?: unknown;
  ts?: unknown;
}

export interface NormalizedEvent {
  userId: string | null;
  anonId: string;
  sessionId: string;
  event: string;
  props: Record<string, string | number | boolean>;
  path: string | null;
  referrer: string | null;
  ts: Date;
}

/**
 * Validate + normalise one incoming event. Returns null when the event should
 * be dropped (unknown name, unusable envelope) — dropping is always preferred
 * to storing something the funnel queries can't trust.
 */
export function normalizeEvent(
  raw: IncomingEvent,
  ctx: { userId: string | null; anonId: string; sessionId: string },
): NormalizedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.event !== "string" || !ALLOWED_EVENTS.has(raw.event)) return null;

  return {
    userId: ctx.userId,
    anonId: ctx.anonId,
    sessionId: ctx.sessionId,
    event: raw.event,
    props: sanitizeProps(raw.props),
    path: clampString(raw.path, MAX_PATH_LEN),
    referrer: clampString(raw.referrer, MAX_REFERRER_LEN),
    ts: clampTimestamp(raw.ts),
  };
}

/** Insert a batch. Never throws — a failed write is a lost data point, not an error. */
export async function writeEvents(rows: NormalizedEvent[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    await db.insert(analyticsEventsTable).values(rows);
  } catch {
    /* best-effort by design; see file header */
  }
}

/**
 * Record a single server-originated event (e.g. a credit spend, a Stripe
 * webhook). Fire-and-forget: callers use `void recordServerEvent(...)` so the
 * request path never waits on analytics.
 *
 * Server events have no browser session, so they carry a synthetic
 * `anonId`/`sessionId` of "server" — which also makes them trivially
 * separable from client traffic in queries.
 */
export async function recordServerEvent(
  event: string,
  opts: { userId?: string | null; props?: Record<string, string | number | boolean> } = {},
): Promise<void> {
  if (!ALLOWED_EVENTS.has(event)) return;
  await writeEvents([
    {
      userId: opts.userId ?? null,
      anonId: "server",
      sessionId: "server",
      event,
      props: sanitizeProps(opts.props),
      path: null,
      referrer: null,
      ts: new Date(),
    },
  ]);
}
