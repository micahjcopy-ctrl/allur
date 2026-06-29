---
name: Stripe go-live (stripe-replit-sync) in deployments
description: Three non-obvious failures that silently break production Stripe checkout and how to avoid them
---

Three independent traps caused production checkout to silently break (each returned "success" while doing nothing). All confirmed live on the ALLUR app.

## 1. esbuild bundle drops the library's .sql migrations
`stripe-replit-sync`'s `runMigrations()` reads its `.sql` files via `path.resolve(__dirname, "./migrations")`. An esbuild `bundle:true` build only emits JS, so those `.sql` files are absent at runtime → `runMigrations()` creates ZERO tables and still resolves successfully.
**Fix:** after esbuild, copy the lib's `dist/migrations` into the app's `dist/migrations` (see `build.mjs` `copyStripeMigrations`). Verify the count of copied `.sql` files after every build.

## 2. syncBackfill() with no args is a silent no-op
`stripeSync.syncBackfill()` called with NO argument sets the internal `object` param to a getter reference (not `"all"`), so its `switch` falls through to `default: break` and nothing syncs — yet the promise resolves. Result: 0 products/prices in every environment.
**Fix:** always call `stripeSync.syncBackfill({ object: "all" })`.

## 3. Connector returns the wrong Stripe account in deployments
The Replit Stripe connector has TWO connections: `environment: "development"` (test/sandbox account) and `environment: "production"` (live account). Which one the connection API returns depends on the auth token:
- `"repl " + REPL_IDENTITY` → development (sandbox)
- `"depl " + WEB_REPL_RENEWAL` → production (live)

Preferring `REPL_IDENTITY` first means a deployment fetches SANDBOX keys → live checkout silently runs against the test account (0 live products synced).
**Fix (fail-closed):** when `process.env.REPLIT_DEPLOYMENT === "1"`, require `WEB_REPL_RENEWAL` and require a connection item whose `environment === "production"` — throw rather than fall back to the `repl` token or `items[0]`. The raw `/api/v2/connection?include_secrets=true&connector_names=stripe` items DO include an `environment` field; settings hold `account_id`, `secret`/`secret_key`, `webhook_secret`. Log the resolved `{environment, account_id}` at startup (non-secret) so misbinding is visible.

## App-side product matching
`resolvePriceId` matches plans by Stripe product `metadata.plan` (`"base"`/`"premium"`). A live product without that metadata (e.g. named "Allur Fit AI", not "ALLUR Base") won't resolve → "That plan is not available yet." Set `metadata.plan` on the live product (the managed webhook syncs the update into the local `stripe.products` table within seconds).

## Debugging note
The code_execution sandbox has NO `process.env` access — inspect connections with `listConnections('stripe')` instead. Prod DB reads via `executeSql({environment:"production"})` are wrapped in a transaction and ROLLBACK on any SQL error (e.g. wrong table name `stripe.sync_status` vs real `stripe._sync_status`), surfacing as "START TRANSACTION / ROLLBACK".
