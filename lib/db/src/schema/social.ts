import { sql } from "drizzle-orm";
import { integer, pgTable, timestamp, varchar, uniqueIndex, index } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

/* ===========================================================================
   Squad (social + gamification) tables. All server-authoritative: Reps are
   awarded by the API with per-day caps so scores can't be spoofed by editing
   the client state blob.
   =========================================================================== */

// One row per accepted friendship. Stored once per pair (both directions are
// resolved in queries). Created by redeeming an invite code — no pending state.
export const friendshipsTable = pgTable(
  "friendships",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    friendId: varchar("friend_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [uniqueIndex("friendships_pair_idx").on(t.userId, t.friendId)],
);

// Personal invite codes. One reusable code per user (rotated on demand later).
export const squadInvitesTable = pgTable("squad_invites", {
  code: varchar("code").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// Every Reps award. `day` is the user's local YYYY-MM-DD (sent by the client,
// clamped server-side) so daily caps follow the user's day, not UTC.
export const pointsEventsTable = pgTable(
  "points_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: varchar("type").notNull(), // workout | meal | protein | checkin | coach_reply | weekly_bonus | duel_win
    points: integer("points").notNull(),
    day: varchar("day", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("points_events_user_day_idx").on(t.userId, t.day)],
);

// 1v1 duels. Week-long, async, scored from points_events between startAt/endAt.
export const duelsTable = pgTable("duels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  challengerId: varchar("challenger_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  opponentId: varchar("opponent_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: varchar("status").notNull().default("active"), // active | finished
  winnerId: varchar("winner_id"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// In-app notification center. Push delivery can attach later; nothing depends
// on push opt-in.
export const squadNotificationsTable = pgTable(
  "squad_notifications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: varchar("type").notNull(), // respect | friend_joined | duel_started | duel_won | duel_lost | weekly_bonus
    // The user who caused this notification (sender of Respect, duel challenger…).
    // Used for per-day caps and rendering names. Null for system notifications.
    actorId: varchar("actor_id"),
    body: varchar("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("squad_notifications_user_idx").on(t.userId, t.createdAt)],
);

export type Friendship = typeof friendshipsTable.$inferSelect;
export type PointsEvent = typeof pointsEventsTable.$inferSelect;
export type Duel = typeof duelsTable.$inferSelect;
export type SquadNotification = typeof squadNotificationsTable.$inferSelect;
