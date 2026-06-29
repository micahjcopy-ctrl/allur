import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// Per-user persisted fitness state. One row per user holds the entire
// serializable FitCoach app state (profile, goal, plan, PRs, weight logs,
// progress photos, meals, physique analysis, workout sessions) as a JSON blob so
// the data survives logout. Chat history stays session-scoped and is NOT stored.
// NOTE: usage credits are deliberately NOT stored here — they are
// server-authoritative in `userCreditsTable` so the limits can't be bypassed by
// editing the client-supplied blob.
export const userFitnessStateTable = pgTable("user_fitness_state", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  state: jsonb("state").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
});

export type UserFitnessState = typeof userFitnessStateTable.$inferSelect;
export type UpsertUserFitnessState = typeof userFitnessStateTable.$inferInsert;

// Server-authoritative usage credits. One row per user. The coach/vision
// endpoints check and decrement these on the server so the monthly limits can't
// be bypassed by a crafted client. `periodStart` anchors the monthly reset:
// once 30 days elapse the balance is refilled to the free-tier defaults.
// Premium subscribers and the repl owner are exempted in code (never decremented).
export const userCreditsTable = pgTable("user_credits", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  coaching: integer("coaching").notNull().default(4),
  photo: integer("photo").notNull().default(4),
  bodyScan: integer("body_scan").notNull().default(3),
  periodStart: timestamp("period_start", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type UserCredits = typeof userCreditsTable.$inferSelect;
export type UpsertUserCredits = typeof userCreditsTable.$inferInsert;
