---
name: Owner-only admin gate
description: How "admin mode" (owner-only access) is enforced in this project via Replit Auth
---

# Owner-only admin gate

Admin/owner-only features are gated by comparing the authenticated user's OIDC `sub`
(stored as `req.user.id` after Replit Auth) against the `REPL_OWNER_ID` environment
variable, server-side. The check lives in the API server's admin route and returns a
plain `{ isAdmin }` boolean; the frontend never decides admin status itself.

**Why:** `REPL_OWNER_ID` is the repl owner's Replit user id and equals the OIDC `sub`
for that user, so it gives a zero-config "only me" gate with no manual id capture and
no secret to manage. Doing the comparison on the client would be trivially bypassable.

**How to apply:**
- Enforce the `req.user.id === process.env.REPL_OWNER_ID` check in a server route, not the client.
- `REPL_OWNER_ID` must exist in the deployment environment too, or admin always denies.
- For a frontend login that must return to a specific page (e.g. `/admin`), pass an
  explicit `returnTo` to `/api/login` — the shared `useAuth().login()` returns to BASE_URL only.

## `isAdmin` is NOT owner-only — use `isOwner` for "only me"

`/admin/status` returns BOTH `isAdmin` and `isOwner`. `isAdmin = isOwner || isAllowlisted`
(the allowlist comes from the `ADMIN_EMAILS` env var). So any allowlisted email is `isAdmin`.

**Why:** A feature meant to be the repl owner's alone (e.g. unlimited test credits in the
fitcoach app) must gate on `isOwner`, not `isAdmin` — otherwise every allowlisted admin
inherits it. This exact mismatch failed a code review.

**How to apply:** "Available to only me" → gate on `isOwner`. "Available to any admin/staff"
→ gate on `isAdmin`. The fitcoach client reads `useGetAdminStatus().data?.isOwner` to grant
the owner unlimited credits (view-only inflation via `OWNER_CREDITS`; `useCredit` is a no-op
for the owner; real persisted credits are never overwritten).

## Admins (owner + ADMIN_EMAILS) are treated as Premium server-side

The single source of truth is `api-server/src/lib/admin.ts` (`isOwnerId`, `isAdminEmail`,
`isAdminUserId(userId)` — looks up the account email by id and matches `ADMIN_EMAILS`).
`credits.ts:getUserPlan` returns `"premium"` for any admin (unlimited usage, never
decremented) and `stripe/plan.ts:getSubscriptionSummary` returns a synthetic
`{plan:"premium",status:"active",hasEverSubscribed:true}` for admins — the `hasEverSubscribed`
flag is what bypasses the App.tsx RouteGuard post-onboarding paywall. No client change is
needed: the client derives plan/paywall entirely from `/me/subscription`.

**Why:** admins/staff need full unlimited access without paying or hitting the paywall. This
is intentionally granted to ALL admins (owner + allowlist), unlike the owner-only credit
inflation above.

**How to apply:** add an email to the `ADMIN_EMAILS` env var (comma-separated) and **restart
the API server** (env is read at module load). The email must already belong to that person's
account; the unique-email constraint on `users` prevents a different account from claiming an
already-registered email.
