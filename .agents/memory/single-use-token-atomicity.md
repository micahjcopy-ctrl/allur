---
name: Single-use token atomicity
description: Password-reset (and similar single-use) tokens must be consumed via one atomic conditional UPDATE, not select-then-update.
---

Consuming a single-use token (password reset, email verification, magic link) with a
`SELECT ... WHERE used_at IS NULL` followed by a separate `UPDATE ... SET used_at` is a
race: two concurrent requests with the same token both pass the SELECT before either
UPDATE lands, so the token is used twice.

**Rule:** claim the token in ONE conditional update that returns the row:
`UPDATE ... SET used_at = now() WHERE token_hash = ? AND used_at IS NULL AND expires_at > now() RETURNING user_id`.
Only proceed (e.g. set the new password) if a row came back — the loser of the race gets
zero rows and is rejected. Drizzle: `.update(...).set(...).where(and(...)).returning({...})`.

**Why:** the DB row update is the serialization point; the app-level read check is not.
Same principle for the issuance side — wrap delete-old-tokens + insert-new in a
`db.transaction` so concurrent "forgot" requests can't leave multiple valid tokens.

**How to apply:** any time a DB row encodes "can be redeemed at most once," flip its
state with a conditional UPDATE...RETURNING and branch on whether a row was returned.

In ALLUR this lives in `artifacts/api-server/src/routes/auth.ts` (`/auth/reset-password`,
`/auth/forgot-password`). Tokens are 32-byte CSPRNG, stored only as SHA-256 hash, 1h TTL;
forgot-password is non-enumerating (always 200) and only issues for accounts that have a
`passwordHash` (OIDC-only accounts excluded).
