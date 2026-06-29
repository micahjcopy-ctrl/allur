# Deploying ALLUR to Vercel

This project was migrated off Replit. The frontend (`artifacts/fitcoach`, a Vite
React SPA) and the backend (`artifacts/api-server`, an Express app) deploy
together as **one Vercel project**: the API runs as a single serverless function
at `/api/*` and the SPA is served for everything else.

## What changed from the Replit version

- **OpenAI** now uses `OPENAI_API_KEY` directly (was the Replit AI proxy). Chat
  model is configurable via `OPENAI_CHAT_MODEL` (default `gpt-4o`).
- **Stripe** now uses `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` directly
  (was the Replit connector API). The webhook is configured manually (below).
- **Email** (password reset) now uses SMTP via `SMTP_*` env vars (was the Replit
  Gmail connector). Optional — the app works without it.
- **Auth**: email/username/password is the only login path. Replit SSO routes
  return 404 off Replit. Admins are set via `ADMIN_EMAILS`.
- **Serverless entry**: `api/index.mjs` → `artifacts/api-server/dist/handler.mjs`
  (built by `pnpm run vercel-build`). `vercel.json` wires up routing.

Every integration **fails soft**: with no keys the server still boots and
auth/DB work; the AI/billing/email features just stay disabled until you add keys.

## Step 1 — Push to GitHub

From this folder (`app/`) on your machine:

```bash
git init
git add .
git commit -m "ALLUR: Vercel migration"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

(`node_modules`, `dist`, `.env`, the demo `.mp4`, and `.zip` archives are
git-ignored.)

## Step 2 — Import into Vercel

1. vercel.com → **Add New → Project** → import the GitHub repo.
2. Framework preset: **Other** (settings come from `vercel.json` — don't override
   the build/output settings).
3. Don't deploy yet — add storage + env first (Steps 3–4), or deploy once and
   redeploy after.

## Step 3 — Add Vercel Postgres

1. Project → **Storage → Create Database → Postgres** → attach to the project.
   This injects `DATABASE_URL` (and friends) automatically.
2. Push the schema to it. Locally, with the database URL exported:
   ```bash
   # copy the connection string from Vercel → Storage → .env.local
   export DATABASE_URL="postgres://..."
   pnpm install
   pnpm --filter @workspace/db run push
   ```
   This creates the users/sessions/fitness/password-reset tables. The Stripe
   mirror tables (`stripe.*`) are created automatically on first boot when a
   Stripe key is present.

## Step 4 — Environment variables

Set these in Project → **Settings → Environment Variables** (see `.env.example`):

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | provided by Vercel Postgres |
| `APP_URL` | recommended | your production URL, e.g. `https://allur.vercel.app` |
| `OPENAI_API_KEY` | for AI | coach, vision, voice |
| `OPENAI_CHAT_MODEL` | no | defaults to `gpt-4o` |
| `STRIPE_SECRET_KEY` | for billing | from Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | for billing | from the webhook you create in Step 6 |
| `ADMIN_EMAILS` | no | comma-separated admin emails (unlimited access + `/admin`) |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM` | for email | password-reset delivery |

Then **Deploy** (or Redeploy).

## Step 5 — Stripe products (for billing)

Create two recurring products in Stripe with a `plan` metadata key:
- "ALLUR Base" → `metadata.plan = base` ($12.99/mo)
- "ALLUR Premium" → `metadata.plan = premium` ($29.99/mo)

The price lookup matches on `metadata.plan` (or the legacy product names above).

## Step 6 — Stripe webhook

In Stripe → Developers → Webhooks → add an endpoint:
- URL: `https://<your-domain>/api/stripe/webhook`
- Send all events (or at least `customer.*`, `checkout.*`, `invoice.*`,
  `product.*`, `price.*`, `subscription.*`).
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

## Verify

- `https://<domain>/api/healthz` → `{"status":"ok"}`
- Open the site, register an account, complete onboarding.
- With `OPENAI_API_KEY` set, the Coach/Macros/Progress AI features work.

## Known limitations on serverless

- **Voice**: Whisper accepts webm/mp4/mp3/wav/ogg directly (covers Chrome &
  Safari). Truly exotic containers need `ffmpeg`, which isn't in the Vercel
  runtime — those fail with a clear message instead of converting.
- **AI latency**: vision/voice calls can be slow; the function `maxDuration` is
  set to 60s in `vercel.json` (Hobby/Pro permitting).
