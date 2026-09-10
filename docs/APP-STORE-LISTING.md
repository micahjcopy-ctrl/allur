# ALLUR — App Store listing (v1.0)

Paste-ready copy for App Store Connect. Character limits are Apple's. Everything
here describes features that exist in the build; nothing is aspirational, because
reviewers test what the listing promises.

## App Information (already set in ASC)

| Field | Value |
|---|---|
| Name (30) | `ALLUR` |
| Subtitle (30) | `AI Fitness Coach That Adapts` |
| Primary category | Health & Fitness |
| Secondary category | Lifestyle |
| Age rating | 16+ (overridden up from the calculated 9+; matches the privacy policy) |
| Privacy Policy URL | https://getallur.com/privacy |
| Support URL | https://getallur.com/about |
| Marketing URL | https://getallur.com |
| Copyright | 2026 Michael Jacobi |

## Version 1.0 — Promotional Text (170)

```
Your plan bends when your week does. Onboard in 3 minutes, snap meals for macros, and let the AI coach rebuild your training around real life.
```
(142 chars)

## Version 1.0 — Description (4000)

```
ALLUR is an AI fitness coach that builds a personalized training and nutrition plan around your body, then adapts it when life changes — instead of waiting for you to quit.

START FROM YOUR REAL STARTING POINT
A guided onboarding learns your goals, experience, schedule, equipment, injuries and dietary restrictions. Your first plan is built from that — not from a template.

A PLAN THAT ADAPTS EVERY WEEK
As your logs come in, ALLUR rebalances volume toward lagging areas, progresses your loads, and trains around your limits automatically. Shorter session? Tweaky knee? Ask the coach — it answers, then updates your plan the moment you approve.

SNAP A MEAL, MACROS LOGGED
Take a photo of your food. ALLUR identifies it, estimates calories and macros, and logs it into your day in seconds. Or say it out loud and let the coach transcribe it.

SEE YOUR PHYSIQUE CHANGE
Log weight, personal records and progress photos. ALLUR estimates body composition from your photos and turns your data into visible, week-over-week feedback — including your ALLUR Score, one number for where your physique is heading.

TRAIN ANYWHERE
Full gym, a pair of dumbbells, or just the floor. Sessions are built for the equipment and the time you actually have. Track runs and walks with GPS route, distance and pace.

STAY ACCOUNTABLE
Forgiving streaks, personal-record celebrations, and a Squad of friends to trade respect and week-long duels with.

WHAT'S FREE AND WHAT'S NOT
Building your plan and tracking workouts, weight, PRs and progress photos is free. The AI coach, photo meal logging and body scans are part of ALLUR Base.

ALLUR BASE
$10.99 per month, or $69.00 per year. Payment is charged to your Apple ID account at confirmation of purchase. The subscription renews automatically unless auto-renew is turned off at least 24 hours before the end of the current period. You can manage or cancel in your Apple ID account settings at any time.

Terms: https://getallur.com/terms
Privacy: https://getallur.com/privacy

ALLUR provides general fitness and nutrition guidance for informational purposes only. Body-composition figures and calorie estimates are estimates, not medical measurements. Consult a professional before starting a new program.
```

## Keywords (100, comma-separated, no spaces after commas)

```
workout plan,macro tracker,calorie counter,body fat,meal photo,gym,strength,nutrition,physique,PRs
```
(98 chars.) Do not repeat words already in the name/subtitle — Apple indexes those for free.

## What's New in This Version

```
First release of ALLUR on iOS.
```

## Screenshots (6.9" 1320×2868 and 6.5" 1284×2778, portrait)

Order matters — the first three show on the install sheet.

1. Dashboard — "Mission control for today"
2. ALLUR Score reveal — "One number for where you're heading"
3. Coach conversation with a plan change — "Ask. Approve. Plan updated."
4. Meal photo → macros — "Snap a meal, macros logged"
5. Plan / session view — "Built for your equipment and your time"
6. Progress — "See the change, week over week"

Generated from the running app at iPhone dimensions and framed on the brand
background (#0b1120) with a one-line caption above the device.

## App Review Information

**Sign-in required:** Yes.

Demo account — create in the app before submitting, subscribe it to Base with a
sandbox Apple ID (or grant premium server-side), pre-seed a week of workouts,
meals, two progress photos and a weight log, so the reviewer sees a real
dashboard and not an empty app.

```
Username: (fill in)
Password: (fill in)
```

**Notes (4000):**

```
ALLUR is an AI fitness coach. The demo account above is on the ALLUR Base plan with data already logged, so every feature is unlocked.

Purchases: on iOS all subscriptions are sold through StoreKit / Apple In-App Purchase (RevenueCat SDK). There is no external purchase link or Stripe checkout in the iOS build; Stripe is used only on the website. Restore Purchases is available on the paywall and in Account.

Permissions and when they are asked for:
- Camera / Photo Library: logging a meal by photo (Nutrition tab → camera) and adding a progress photo (Progress tab).
- Microphone: dictating a meal or a message to the coach (mic icon in Nutrition).
- Location (while using): only when starting a run or walk in the Cardio screen, to record route, distance and pace.

Health content: body-fat and calorie figures are labelled as estimates in the app (Dashboard, Progress, ALLUR Score), and the app states it is not medical advice. Minimum age is 16 (privacy policy and onboarding).

Account deletion: Account → Delete account. It removes the user's data server-side.

Quick path to see everything: sign in → Dashboard → tap the ALLUR Score → back → Coach (bottom-right button) and send "I only have 25 minutes today" → approve the change → Nutrition → log a meal by photo.
```

**Contact:** Michael Jacobi, raiden@getallur.com, phone (fill in).

## If App Review asks (draft replies)

**1.4.1 — "Your app provides body-composition / health measurements. Please clarify methodology."**
> ALLUR's body-fat and calorie figures are estimates produced from user-entered data and photos; they are labelled "estimate" wherever they appear (Dashboard, Progress, ALLUR Score) with a note that they are not medical measurements. The methodology is a visual comparison against established body-fat reference ranges (ACE categories), combined with the user's stated weight, height, age and activity level. The app does not diagnose, treat or make medical claims, and the disclaimer at getallur.com/disclaimer is linked in-app.

**5.1.1 — "Your app requests permission without a clear purpose" / "why each permission".**
> Each permission is requested only at the moment the feature is used and the purpose string states the feature: camera and photo library for meal photos and progress photos; microphone for dictating to the coach; location (while in use) only when the user starts a run or walk to record route, distance and pace. None are required to use the app — declining any of them leaves every other feature working.

**3.1.1 — "Your app accesses digital content purchased outside the app" / mentions of other tiers.**
> All purchases in the iOS app go through Apple In-App Purchase (auto-renewable subscriptions com.getallur.app.base.monthly and .annual via StoreKit and the RevenueCat SDK). There is no external payment link in the binary. Subscriptions bought on the website are honoured in the app, as permitted for multiplatform services, but the app never directs users to the website to buy. Restore Purchases is on the paywall and in Account.

**2.1 — "We were unable to sign in / unable to access features."**
> The demo credentials in App Review Information are on an active ALLUR Base subscription with pre-seeded data; please retry with those. If the account shows "Free", the subscription state can be refreshed from Account → Restore purchases.

**5.1.1(v) — account deletion**
> Account → Delete account performs server-side deletion of the user's profile and durable fitness data. The confirmation explains that deleting the ALLUR account does not cancel an Apple subscription, which the user manages in their Apple ID settings.
