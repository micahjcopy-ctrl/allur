# Reply to App Review — Guideline 2.1 "Information Needed", 30 Sep 2026

Submission 2b56d1d8-b411-476f-b46a-45360892045d (iOS 1.0, build 9). Apple asked for
seven items; the screen recording (item 1) is Micah's, recorded on his iPhone; the
rest is below. The same content (condensed) goes into App Review Information → Notes.

---

## Reply text (paste into "Reply to App Review")

Thank you for the review. All seven items are below; the screen recording is attached
(captured on a physical iPhone on the current iOS release, one continuous take from
launch).

**1. Screen recording** — attached. It shows: launch → onboarding → creating a new
account → the paywall (both subscriptions with name, length and price, plus the Terms
and Privacy links opened from that screen) → completing the purchase → the dashboard,
starting a workout, logging a meal by photo and chatting with the coach → You →
Account → Restore Purchases → Delete account (completed, signed out) → signing in with
the demo account.

**2. Purpose and audience** — ALLUR is an AI fitness coach for adults (16+) who want a
personalised training and nutrition plan without hiring a coach. Onboarding builds a
plan from the user's goal, experience, schedule, equipment and injuries; the app then
runs daily workouts, tracks weight, personal records and progress photos, estimates
macros from meal photos, and provides a conversational coach that can adjust the plan.
The problem it solves is the gap between generic workout apps and a human coach: a
plan that is specific to the person and can be changed by talking to it.

**3. Setup and access** — No sample files are needed. Opening the app starts
onboarding (about 3 minutes) and ends at account creation. To skip that, sign in via
the "Already have an account? Log in" link on the first onboarding screen with the demo
account in App Review Information (username `allurreview`; password in the Sign-In
Information fields). That account is already subscribed and has a populated
profile: a 5-day plan, weeks of logged sessions, PRs, weights, meals, photos and a body
scan. Main features from the bottom tabs: Home (dashboard and today's session), Train
(the plan and today's workout), Nutrition (log a meal by camera or text), Progress
(weight, photos, PRs), You (account); the Coach (chat and voice) opens from the
floating coach button on Home.

**4. External services** — OpenAI API (plan generation, coach chat, meal-photo and
body-scan analysis, voice transcription); RevenueCat (StoreKit purchase tracking and
entitlements); Neon (PostgreSQL database) and Vercel (hosting/API at
www.getallur.com); SMTP email (verification and password-reset mail); push notifications for optional
reminders; OpenRouteService (optional outdoor-cardio route
suggestions when the user grants location). Stripe is used only on the website for web
subscriptions and is never presented inside the iOS app; all in-app purchases are Apple
In-App Purchase.

**5. Regional differences** — None. The app functions identically in all regions;
the only regional variation is App Store pricing/currency handled by Apple.

**6. Regulated industry / third-party material** — Not applicable. ALLUR is general
fitness guidance, not a medical device or medical service (declared as such in App
Store Connect); it does not diagnose or treat conditions and tells users to consult a
doctor before starting. All content, exercise descriptions and images are our own or
generated for us; no licensed third-party material.

**7. In-App Purchases** — One subscription group, "ALLUR Base", with two options:
ALLUR Base Monthly ($10.99/month) and ALLUR Base Annual ($69.00/year). Both unlock
the same thing: the full app after onboarding (workouts and tracking, the AI coach,
photo meal logging, body scans). There is no free tier and no trial. Navigation: the
paywall appears immediately after account creation at the end of onboarding, and at
any time from the subscription card on You (Account) while not subscribed; once
subscribed that card shows Manage subscription (opens Apple ID settings). Restore
Purchases is on the paywall and on the Account screen. Terms and Privacy are linked from the paywall.

Additional notes for the reviewer: the Squad feature is opt-in and private — users
connect only by exchanging an invite code, see each other's weekly activity counts and
streaks, and can send a "respect" tap or start a 7-day rep duel. There is no
user-generated text, media, or public content anywhere in the app, so there is no
feed to moderate. Account deletion is available in You → Account → Delete account and
removes the account, its data and any active subscription record immediately.

---

## Condensed version for App Review Information → Notes (append to existing notes)

REVIEWER BRIEF (added 30 Sep 2026 per Guideline 2.1 request):
PURPOSE: AI fitness coach for adults 16+; onboarding builds a personalised training +
nutrition plan; daily workouts, weight/PR/photo tracking, macro estimates from meal
photos, and a conversational coach that adjusts the plan.
ACCESS: onboarding (3 min) ends at account creation; or tap "Already have an account?
Log in" on the first screen and use the demo account above (already subscribed,
populated). Tabs: Home, Train (today's workout), Nutrition (log meal), Progress, You
(account); Coach via the floating button on Home.
SERVICES: OpenAI (plan/coach/meal + scan analysis/transcription), RevenueCat
(StoreKit entitlements), Neon Postgres + Vercel (backend at www.getallur.com), SMTP
email (verification/reset), push notifications (optional reminders), OpenRouteService
(optional outdoor cardio routes). Stripe is web-only and never shown in the iOS app.
REGIONS: identical everywhere. REGULATED: no — general fitness, not medical; no
licensed third-party material.
IAP: group "ALLUR Base" — Monthly $10.99/mo, Annual $69/yr; same access; no free
tier, no trial. Paywall appears after account creation and from the You (Account) subscription
card while unsubscribed; Restore Purchases on both; Terms/Privacy linked on the paywall.
SOCIAL: Squad is invite-code only, private, no user text/media/public content.
Account deletion: You > Account > Delete account.
