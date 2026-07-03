import type { Request, Response, NextFunction } from "express";
import { db, rateLimitsTable } from "@workspace/db";
import { lt, sql } from "drizzle-orm";

/**
 * Best client identifier for rate-limit bucketing. Prefer Vercel's trusted
 * `x-real-ip` (set by the platform edge, not spoofable via a client-supplied
 * X-Forwarded-For) and fall back to Express's computed `req.ip`.
 */
function clientKey(req: Request): string {
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) return realIp;
  return req.ip ?? "unknown";
}

/**
 * DB-backed fixed-window rate limiter middleware.
 *
 * Atomically increments a per-(bucket, window) counter in Postgres via a single
 * upsert, so the limit is enforced across ALL serverless instances rather than
 * per-instance (which the previous in-memory Map could not do on Vercel).
 *
 * Fails OPEN on any DB error: a limiter outage must never take down auth or the
 * AI endpoints. The counters self-expire (expiresAt) and stale rows are pruned
 * opportunistically.
 */
export function makeRateLimit(
  name: string,
  limit: number,
  windowMs: number,
  keyFn: (req: Request) => string = clientKey,
) {
  return async function rateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const bucket = `${name}:${keyFn(req)}`;
    const expiresAt = new Date(windowStart + windowMs * 2);

    try {
      const result = await db.execute(sql`
        INSERT INTO rate_limits (bucket, window_start, count, expires_at)
        VALUES (${bucket}, ${windowStart}, 1, ${expiresAt})
        ON CONFLICT (bucket, window_start)
        DO UPDATE SET count = rate_limits.count + 1
        RETURNING count
      `);
      const row = (result.rows ?? [])[0] as { count?: number } | undefined;
      const count = Number(row?.count ?? 0);

      if (count > limit) {
        res
          .status(429)
          .json({ error: "Too many attempts. Please wait a minute and try again." });
        return;
      }

      // Opportunistically prune expired windows (~1% of requests) so the table
      // doesn't grow unbounded. Fire-and-forget; never blocks the request.
      if (Math.random() < 0.01) {
        void db
          .delete(rateLimitsTable)
          .where(lt(rateLimitsTable.expiresAt, new Date()))
          .catch(() => {});
      }

      next();
    } catch (err) {
      // Fail open — availability over strictness for a limiter.
      (req as unknown as { log?: { error?: (o: unknown, m: string) => void } }).log?.error?.(
        { err },
        "rate limit check failed (failing open)",
      );
      next();
    }
  };
}
