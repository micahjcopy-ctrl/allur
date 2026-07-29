import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

/* ===========================================================================
   Self-hosted product analytics.

   Every funnel/usage event the app emits lands here. Deliberately NOT a
   third-party SDK: behavioural data on health-adjacent features stays on our
   own infrastructure, which keeps the Apple App Privacy questionnaire simple
   and avoids Guideline 5.1.3 exposure.

   Privacy contract for this table:
   - `userId` is nullable — signed-out funnel steps (landing, signup) are real
     events and must be captured.
   - `userId` cascades on user delete, so account deletion takes the events
     with it. Nothing else is needed in the delete-account path.
   - `anonId` is a rotating random value minted client-side. It is never
     derived from an email, a device fingerprint, or anything stable about the
     person, and it rotates on a fixed schedule so it can't act as a permanent
     identifier.
   - `props` holds only low-cardinality funnel metadata (e.g. `{ step: 3 }`).
     No free text, no health values, no PII. The ingest route enforces this by
     allowlisting event names and capping payload size.
   =========================================================================== */
export const analyticsEventsTable = pgTable(
  "analytics_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => usersTable.id, {
      onDelete: "cascade",
    }),
    anonId: varchar("anon_id").notNull(),
    sessionId: varchar("session_id").notNull(),
    event: varchar("event").notNull(),
    props: jsonb("props").notNull().default(sql`'{}'::jsonb`),
    path: varchar("path"),
    referrer: varchar("referrer"),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Every panel is a time-bounded aggregate, so `ts` leads each index.
    index("IDX_events_ts").on(table.ts),
    // Per-step funnel drop-off: WHERE event = ? AND ts BETWEEN ? AND ?
    index("IDX_events_event_ts").on(table.event, table.ts),
    // Anonymous funnel stitching (landing -> signup, before a user exists).
    index("IDX_events_anon_ts").on(table.anonId, table.ts),
    // Per-user retention / feature adoption.
    index("IDX_events_user_ts").on(table.userId, table.ts),
  ],
);

export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEventsTable.$inferInsert;
