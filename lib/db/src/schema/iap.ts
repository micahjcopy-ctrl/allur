import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

// ---------------------------------------------------------------------------
// In-app purchase entitlements (Apple App Store / Google Play).
//
// Why a separate table instead of columns on `users`:
//
//   Stripe is the source of truth for web subscriptions, and we read it live
//   from the Stripe API (see api-server/lib/stripe/plan.ts). Store purchases
//   work the other way round — Apple pushes state to us, so we have to persist
//   it. Keeping that in its own table means the Stripe path is untouched and a
//   user can, in principle, have both without either clobbering the other.
//
// One row per user per store. RevenueCat is the validator: it verifies the
// receipt with Apple, tracks renewals/cancellations/refunds/grace periods, and
// posts us a webhook with the resolved entitlement. We store only the resolved
// answer — never a raw receipt — so there is nothing here worth stealing.
//
// `hasEverSubscribed` is deliberately sticky: once true it stays true even
// after the subscription lapses. It drives the post-onboarding paywall gate,
// which must not re-trap a lapsed subscriber (same rule the Stripe path uses).
// ---------------------------------------------------------------------------

export const iapEntitlementsTable = pgTable(
  "iap_entitlements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /** "app_store" | "play_store" */
    store: varchar("store").notNull(),

    /** RevenueCat's opaque subscriber id (mirrors our userId, kept for support). */
    rcAppUserId: varchar("rc_app_user_id"),

    /** Store product identifier, e.g. "com.getallur.app.base.monthly". */
    productId: varchar("product_id"),

    /** RevenueCat entitlement identifier, e.g. "base" | "premium". */
    entitlement: varchar("entitlement"),

    /** Resolved lifecycle state: active | grace | expired | refunded | paused. */
    status: varchar("status").notNull().default("expired"),

    /** True while the user should have paid access right now. */
    isActive: boolean("is_active").notNull().default(false),

    /** Sticky: true once they have ever paid, even after the sub lapses. */
    hasEverSubscribed: boolean("has_ever_subscribed").notNull().default(false),

    /** True when the store reports the sub will not renew. */
    willRenew: boolean("will_renew").notNull().default(true),

    /** When paid access lapses. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /** "PRODUCTION" | "SANDBOX" — sandbox rows must never grant real access. */
    environment: varchar("environment"),

    /**
     * Apple's original_transaction_id (or Play's purchase token). Stable across
     * renewals, so it identifies the subscription for support and refunds.
     */
    originalTransactionId: varchar("original_transaction_id"),

    /**
     * Event timestamp of the last webhook we applied. Webhooks can arrive out
     * of order; we drop anything older than this so a late "expired" can't
     * overwrite a newer "renewed".
     */
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("IDX_iap_user").on(table.userId),
    index("IDX_iap_rc_user").on(table.rcAppUserId),
    index("IDX_iap_original_txn").on(table.originalTransactionId),
  ],
);

export type IapEntitlement = typeof iapEntitlementsTable.$inferSelect;
export type UpsertIapEntitlement = typeof iapEntitlementsTable.$inferInsert;
