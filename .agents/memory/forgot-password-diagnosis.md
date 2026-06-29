---
name: Forgot-password "email never arrived" diagnosis
description: How to tell a silent email-mismatch from a real send failure in the ALLUR password reset flow.
---

The `/api/auth/forgot-password` handler is anti-enumeration: it ALWAYS returns 200
`{success:true}`, and sends nothing when the submitted email doesn't match a row in
`users` (or the row has no `password_hash`). Send failures are caught and only logged
as "Password reset request failed" — never surfaced.

**Ground-truth diagnostic:** query the `password_reset_tokens` table in the relevant
environment (use the database skill, `environment:"production"`, read-only).
- A token row is inserted ONLY after a successful email+passwordHash match, just before
  the Gmail send. So:
  - **No token row for the attempt** → the entered email never matched an account
    (typo / different signup email / wrong case is NOT it — lookup lowercases+trims at
    register, login, AND forgot). This is the common "reset never arrived" cause; it is
    user error, not a bug.
  - **Token row exists but no email** → the send itself failed (check app pino logs for
    "Password reset request failed"; verify the google-mail connector is healthy +
    `environment:"production"`).

**Why:** spent a whole session chasing transient deploy `/api 500` healthcheck noise
(the probe hits `/api` root = 404; real probe is `/api/healthz` = 200) and Gmail
connector health before realizing the token table being empty proved the pipeline was
fine and the email simply never matched. Check the token table FIRST next time.

App-level pino logs ARE captured in deployment logs (e.g. `request completed ... url:
/api/auth/forgot-password`), so absence of a "Password reset request failed" line is
meaningful evidence the send didn't throw.
