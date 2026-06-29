---
name: Gmail connector send
description: How transactional email is sent from the api-server via the Replit Gmail connector
---

# Sending email via the Gmail Replit connector

The app sends transactional email (e.g. admin "Send reminder" nudge) through the
**google-mail** Replit connector, not an external SMTP/API key.

**How it works:** `@replit/connectors-sdk` `ReplitConnectors().proxy("google-mail", "/gmail/v1/users/me/messages/send", {...})`.
The proxy injects/refreshes the connected Google account's OAuth token automatically.

**Why / gotchas (not obvious from code):**
- `proxy(...)` returns a **raw `fetch` Response**, not parsed JSON — call `.json()`/`.text()` and check `.ok` yourself.
- Gmail send wants a single `{ raw }` field = the full RFC 5322 message **base64url** encoded (use `Buffer.from(msg).toString("base64url")`).
- The connector is a runtime dep of api-server; installing it stops running workflows — restart after install.
- Mail sends **from the connected account's own address**; arbitrary-recipient sending works with no domain verification (unlike Resend). Good for low volume.
- Connector grants `gmail.send` scope; if runtime says "not connected", re-run proposeIntegration then restart.

**Why we chose Gmail over Resend:** user is non-technical and wanted zero domain setup; Gmail sends to anyone immediately at low volume.
