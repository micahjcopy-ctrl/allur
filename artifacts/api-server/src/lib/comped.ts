/**
 * Single source of truth for "who gets free (comped) ALLUR access".
 *
 * A comped user is any account whose email is on the COMPED_EMAILS allowlist.
 * They are treated as Premium everywhere — unlimited usage, no paywall, and no
 * post-onboarding payment — via credits.ts (getUserPlan) and
 * stripe/plan.ts (getSubscriptionSummary). This is the SAME entitlement admins
 * get, but WITHOUT the owner-only admin console.
 *
 * The list merges a hardcoded set (people we've personally comped) with an
 * optional COMPED_EMAILS env var (comma-separated), so more people can be
 * granted access by editing this file OR setting the env var.
 */
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// People given free access by hand. Add an email here to comp someone.
const HARDCODED_COMPED_EMAILS = [
  "lukerobertcolley@gmail.com",
  "thomastaylor115@gmail.com",
];

export const COMPED_EMAILS: ReadonlySet<string> = new Set(
  [
    ...HARDCODED_COMPED_EMAILS,
    ...(process.env["COMPED_EMAILS"] ?? "").split(","),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isCompedEmail(email: string | null | undefined): boolean {
  return !!email && COMPED_EMAILS.has(email.toLowerCase());
}

/**
 * Resolve comped status for a userId by matching the account email against the
 * allowlist. Defensive: any failure resolves to false so access is never
 * granted by accident.
 */
export async function isCompedUserId(userId: string): Promise<boolean> {
  if (COMPED_EMAILS.size === 0) return false;
  try {
    const [user] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    return isCompedEmail(user?.email ?? null);
  } catch {
    return false;
  }
}
