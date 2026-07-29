import { Router, type IRouter, type Request, type Response } from "express";
import { makeRateLimit } from "../lib/rateLimit";
import {
  ID_PATTERN,
  MAX_EVENTS_PER_BATCH,
  normalizeEvent,
  writeEvents,
  type IncomingEvent,
  type NormalizedEvent,
} from "../lib/analytics";

const router: IRouter = Router();

/* ===========================================================================
   Batched analytics ingest.

   Design rules, in priority order:
   1. It must never affect the user. Every response is 204 (or 429 from the
      limiter). No error body, no 4xx for malformed payloads — the client is
      fire-and-forget and has nothing useful to do with a failure, and a
      talkative endpoint just invites probing.
   2. It must never trust the client. `userId` comes from the session cookie
      and is never read from the body; event names are allowlisted; props are
      stripped to short scalars.
   3. It must be cheap. One multi-row insert per batch, no reads.
   =========================================================================== */

// 60 batches per minute per IP. At the client's flush cadence that's ~20x
// headroom for a busy single user, while bounding what one IP can write.
const eventsRateLimit = makeRateLimit("events", 60, 60_000);

router.post("/events", eventsRateLimit, async (req: Request, res: Response): Promise<void> => {
  // Answer first, write after. `sendBeacon` fires during page unload, so the
  // faster this returns the more reliably the browser lets the request finish.
  const body = (req.body ?? {}) as {
    anonId?: unknown;
    sessionId?: unknown;
    events?: unknown;
  };

  const anonId = typeof body.anonId === "string" ? body.anonId : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

  // A batch without a usable identity envelope can't be joined to anything, so
  // it's worthless rather than merely imperfect. Drop it silently.
  if (!ID_PATTERN.test(anonId) || !ID_PATTERN.test(sessionId)) {
    res.status(204).end();
    return;
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    res.status(204).end();
    return;
  }

  const userId = req.isAuthenticated() ? req.user.id : null;
  const ctx = { userId, anonId, sessionId };

  const rows: NormalizedEvent[] = [];
  for (const raw of body.events.slice(0, MAX_EVENTS_PER_BATCH)) {
    const normalized = normalizeEvent(raw as IncomingEvent, ctx);
    if (normalized) rows.push(normalized);
  }

  res.status(204).end();

  // The insert is awaited (so the serverless function stays alive until it
  // lands) but its failure is already unobservable to the client.
  await writeEvents(rows);
});

export default router;
