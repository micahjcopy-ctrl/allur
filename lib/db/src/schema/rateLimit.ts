import { bigint, integer, pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";

// Shared, DB-backed fixed-window rate limiter store.
//
// In-memory limiting is per-serverless-instance and therefore ineffective on
// Vercel (each concurrent/cold instance has its own counter). This table gives
// every instance one authoritative counter, keyed by (bucket, windowStart).
// Rows carry an expiresAt and are pruned opportunistically by the limiter.
export const rateLimitsTable = pgTable(
  "rate_limits",
  {
    bucket: varchar("bucket").notNull(),
    windowStart: bigint("window_start", { mode: "number" }).notNull(),
    count: integer("count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.bucket, table.windowStart] })],
);

export type RateLimitRow = typeof rateLimitsTable.$inferSelect;
