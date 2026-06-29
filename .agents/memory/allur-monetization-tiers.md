---
name: ALLUR monetization tiers
description: 3-tier plan model (Free/Base/Premium) — access derivation, enforcement boundary, and dual-source constants
---

# ALLUR 3-tier monetization

Tiers: **Free** (lapsed/never-paid — data kept but AI Coach, new workouts, macro/meal tracking, physique analysis all locked), **Base $12.99/mo** (14-day trial, card required up front via Stripe Checkout `payment_method_collection:"always"` + `trial_period_days:14` only on first sub) with raised credit limits, **Premium $29.99/mo** (unlimited). Plan tag lives in Stripe product `metadata.plan`; untagged legacy products map to premium.

## Access tier is derived from the subscription summary, not credits
**Rule:** the client's `plan`/`isSubscribed`/`isPremium` derive from the `/me/subscription` summary first, falling back to `/me/credits` plan, then `"free"`. Do NOT default to `free` solely on a credits-fetch failure.
**Why:** credits fetch can fail transiently or lag right after a fresh checkout; defaulting to free would falsely lock a paying user out of Coach/Macros.
**How to apply:** when touching plan derivation in `FitCoachContext`, keep subscription as the authoritative source. `/me/subscription` reads straight from Stripe-sync (active/trialing/past_due → base|premium).

## The server creditGuard is the real enforcement; client locks are UX
**Rule:** client paywall (post-onboarding gate in `App.tsx`) and feature locks are UX only; they may fail-open on infra failure. Server `creditGuard` (free→403 `needs_subscription`, base-exhausted→402, premium→pass) is authoritative.
**Why:** hard fail-closed on the client would lock out paying users during an endpoint hiccup, which is worse than the funnel briefly not showing — and unpaid usage is still rejected server-side regardless.
**How to apply:** don't make the client paywall fail-closed; rely on the gated endpoints to reject.

## BASE_MONTHLY_CREDITS is a dual-source constant
Base monthly grant (coaching 50 / photo 150 / bodyScan 20) is encoded in BOTH server `artifacts/api-server/src/lib/credits.ts` (authoritative grant/decrement) AND client `artifacts/fitcoach/src/lib/subscription.ts` (display copy only). Edit both in lockstep.

## Feature-lock placement
Coach + Macros pages: full-page `LockedFeature` for non-subscribers. Plan AI-adjust + "Start Workout" + Progress physique-scan: action-level guard with `needsSubscriptionToast()`. New users forced to `Paywall` after onboarding via `App.tsx` RouteGuard (`subscription.hasEverSubscribed`); lapsed Free users are NOT re-gated (limited access + resubscribe CTAs in Account).
