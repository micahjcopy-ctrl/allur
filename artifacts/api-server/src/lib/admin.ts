import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Single source of truth for "who is an ALLUR admin".
 *
 * An admin is either the Repl owner (REPL_OWNER_ID) or an email on the
 * ADMIN_EMAILS allowlist (comma-separated). Admins get the owner-only admin
 * console AND are treated as Premium everywhere (unlimited usage, no paywall) —
 * see credits.ts (getUserPlan) and stripe/plan.ts (getSubscriptionSummary).
 */

const OWNER_ID = process.env["REPL_OWNER_ID"];

export const ADMIN_EMAILS: ReadonlySet<string> = new Set(
  (process.env["ADMIN_EMAILS"] ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isOwnerId(userId: string | null | undefined): boolean {
  return !!OWNER_ID && !!userId && userId === OWNER_ID;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}

/**
 * Resolve admin status for a userId. The owner is admin by id; everyone else is
 * matched by their account email against the allowlist. Defensive: any failure
 * resolves to false so access is never granted by accident.
 */
export async function isAdminUserId(userId: string): Promise<boolean> {
  if (isOwnerId(userId)) return true;
  if (ADMIN_EMAILS.size === 0) return false;
  try {
    const [user] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    return isAdminEmail(user?.email ?? null);
  } catch {
    return false;
  }
}
