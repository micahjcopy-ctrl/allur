---
name: Credential auth + OIDC coexistence
description: Rules for keeping custom email/password accounts and Replit OIDC sharing one users table without breaking each other.
---

When a single `users` table backs BOTH Replit OIDC auth and custom email/password/username accounts, three collisions must be guarded or one auth path silently breaks the other.

**Rule 1 — email namespace collision (the dangerous one).**
OIDC upsert keys on the OIDC `sub` as the row id; a credential signup generates its own uuid id. If a person signs up with credentials using email X, then later logs in via OIDC with the same email X, a plain id-based insert trips the table's unique-email constraint and the OIDC callback 500s. Fix: in OIDC `upsertUser`, when an email is present, first look up any existing row by email; if it exists under a different id, UPDATE that row (link) and return it instead of inserting.
**Why:** unique email + two id sources = guaranteed conflict for dual-identity users.
**How to apply:** any time you add a second auth provider on a shared users table, link by a shared natural key (email) before inserting.

**Rule 2 — identifier ambiguity at login.**
If login accepts "email OR username" and queries `email = id OR username = id`, a username equal to someone else's email string matches two rows nondeterministically. Fix: constrain usernames to exclude `@` (OpenAPI `pattern` on the register schema) and at login route `@`-containing identifiers to the email column, others to username. The two namespaces then never overlap.

**Rule 3 — session shape.**
Credential sessions must be created WITHOUT `access_token`/`expires_at` so the OIDC refresh path (`refreshIfExpired`) leaves them untouched. Make those fields optional on `SessionData`.

Also: gate the web app behind auth but BYPASS the admin route, or the OIDC owner-preview flow becomes unreachable. Add a per-IP rate limiter to the credential login/register endpoints (online password guessing).

## Username login must be case-insensitive (June 2026)

Usernames are stored case-preserved at registration (e.g. "Micah", "Raiden"), but
email login lowercases its identifier. Login by username MUST compare
`lower(username) = lower(identifier)` (Drizzle `sql\`lower(${usersTable.username}) = ${id.toLowerCase()}\``),
otherwise a user who signs up as "Micah" and types "micah" gets 401 "Invalid
credentials" — and will misread it as a broken password reset.

**Why:** a real user reset their password fine (reset→login-by-email verified working)
but couldn't log in afterward because they typed their username in a different case.

**How to apply:**
- Registration must also dedupe usernames case-insensitively (lower() in the WHERE +
  the in-memory `.some` check) so "Micah"/"micah" can't both exist.
- Because case-insensitive lookup can return >1 row on legacy data, login fetches all
  matches and rejects (401 + logs "Ambiguous login") when `matches.length > 1` rather
  than `[0]`-selecting and risking authenticating the wrong account. There is no
  `lower(username)` unique index yet — current prod has no collisions and registration
  now blocks new ones, so the runtime guard is the safeguard.
