# ALLUR — iOS build & App Store submission

Everything needed to turn the web app into an iOS binary and get it through
review. **The web app is not affected by any of this** — the native code paths
are compiled out of the browser bundle entirely.

> **You need a Mac.** Apple only allows iOS apps to be built and uploaded from
> macOS with Xcode. There is no way around this on Linux or Windows. If you
> don't have one, see [No Mac?](#no-mac) at the bottom.

---

## 0. One-time accounts and keys

| What | Where | Notes |
|---|---|---|
| Apple Developer Program | developer.apple.com | ✅ already paid + Paid Apps Agreement active |
| Bundle ID `com.getallur.app` | App Store Connect → Identifiers | **Permanent.** Never changes. |
| RevenueCat account | revenuecat.com | Free under $2,500/mo tracked revenue |

### RevenueCat setup

1. Create a project, add an **App Store** app with bundle id `com.getallur.app`.
2. Upload your **App Store Connect API key** (RevenueCat needs it to read
   receipts) and your **App-Specific Shared Secret**.
3. Create an **entitlement** with identifier exactly `base`.
4. Create two **products** matching App Store Connect exactly:
   - `com.getallur.app.base.monthly`
   - `com.getallur.app.base.annual`
5. Create an **offering** with identifier `default` containing both packages,
   and attach both products to the `base` entitlement.
6. Copy the **Apple API key** (starts `appl_`) — this is `VITE_REVENUECAT_IOS_KEY`.
7. Add a **webhook**: URL `https://getallur.com/api/iap/webhook`, and set the
   Authorization header value to whatever you put in `REVENUECAT_WEBHOOK_SECRET`.

### Server environment variables

Set these in Vercel (Production **and** Preview):

```
REVENUECAT_WEBHOOK_SECRET=<any long random string; must match the RevenueCat webhook header>
REVENUECAT_SECRET_API_KEY=<RevenueCat "secret" API key, starts sk_>
```

Without these the webhook returns 503 and purchases will not stick.

---

## 1. App Store Connect: the subscription products

Create an **Auto-Renewable Subscription Group** (name it `ALLUR`), then two
subscriptions inside it. Prices match the web app exactly:

| Product ID | Duration | Price | Net after Apple's 15% |
|---|---|---|---|
| `com.getallur.app.base.monthly` | 1 month | **$10.99** | ~$9.34 |
| `com.getallur.app.base.annual` | 1 year | **$69.99** | ~$59.49 |

> Apply for the **Small Business Program** (App Store Connect → Agreements) or
> Apple takes 30% instead of 15%. It's a form, it takes minutes, and it applies
> to anyone under $1M/year. Do this before your first payout.

Each subscription needs a localized display name, description, and a review
screenshot of the paywall.

---

## 2. Build the iOS project

```bash
# from the repo root
pnpm install

# Build the web bundle FOR NATIVE. The env var is mandatory — the build will
# refuse to run without it, because a native bundle missing this key silently
# ships with no purchase path and gets rejected under Guideline 3.1.1.
cd artifacts/fitcoach
VITE_NATIVE_BUILD=1 VITE_REVENUECAT_IOS_KEY=appl_xxxxx pnpm build

# Generate the Xcode project (first time only)
npx cap add ios

# Copy the built web assets + plugins into it (every time you rebuild)
npx cap sync ios

# Open in Xcode
npx cap open ios
```

`ios/` is intentionally **not** committed — it is generated toolchain output.
Regenerating it is cheap and keeps hundreds of MB of Xcode artifacts out of git.

---

## 3. Info.plist — permission strings

Xcode → `App/Info.plist`. **Every one of these is required.** An app that
touches the camera or GPS without a purpose string is rejected immediately, and
vague strings ("we need camera access") get rejected too — Apple wants the
specific reason.

| Key | Value |
|---|---|
| `NSCameraUsageDescription` | ALLUR uses your camera to take progress photos and to log meals by photo so it can estimate macros for you. |
| `NSPhotoLibraryUsageDescription` | ALLUR lets you choose existing photos to log a meal or add a progress picture. |
| `NSPhotoLibraryAddUsageDescription` | ALLUR saves your progress photos back to your library when you ask it to. |
| `NSLocationWhenInUseUsageDescription` | ALLUR uses your location while you're running or walking to track your route, distance and pace. |
| `NSMicrophoneUsageDescription` | ALLUR uses your microphone so you can talk to your coach instead of typing. |

Also set in Xcode:

- **Display Name**: `ALLUR`
- **Version** `1.0.0`, **Build** `1`
- **Deployment target**: iOS 14.0 or later
- **Signing**: your team, automatic signing
- **Capabilities**: In-App Purchase, Push Notifications

---

## 4. Pre-submission checklist

Compliance items already handled in code:

- ✅ **3.1.1 In-App Purchase** — native buys through StoreKit, never Stripe
- ✅ **3.1.1 Restore Purchases** — on the paywall and in Account
- ✅ **3.1.2 Subscription disclosure** — length, price, auto-renewal and cancel
  instructions on the paywall, with Terms + Privacy links
- ✅ **5.1.1(v) Account deletion** — in Account, with a warning that deleting
  does not cancel an Apple subscription
- ✅ **1.4.1 Health disclaimers** — estimate notices on Dashboard, Progress and
  ALLUR Score
- ✅ **4.2 Not a repackaged website** — bundled assets, native camera/GPS,
  offline state

Still needs a human:

- [ ] App icon (1024×1024, no transparency, no rounded corners)
- [ ] Screenshots: 6.7" and 6.5" iPhone, at minimum
- [ ] App Store description, keywords, support URL, marketing URL
- [ ] Privacy "nutrition label" answers (App Store Connect → App Privacy)
- [ ] **Demo account for App Review** — a working email + password with an
      active subscription. Reviewers reject apps they can't get into. Put it in
      the "App Review Information" notes field.
- [ ] Age rating questionnaire

---

## 5. Test the purchase flow before submitting

In **Xcode → Product → Scheme → Edit Scheme → Run → Options**, set
**StoreKit Configuration** to none and instead use a **Sandbox Apple ID**
(App Store Connect → Users and Access → Sandbox Testers).

Test all of these on a real device:

1. Buy monthly → paywall drops, app unlocks
2. Buy annual → same
3. Kill the app, reopen → still unlocked (entitlement persisted server-side)
4. Delete + reinstall → **Restore Purchases** brings access back
5. Cancel in sandbox settings → access remains until period end, then lapses
6. Sign out, sign in as a different user → they do **not** inherit the sub

> Sandbox receipts are marked `SANDBOX` and are ignored in production by
> `getIapEntitlement()`. That is deliberate — a sandbox receipt is free to mint,
> so honouring one in production would be unlimited free Premium for anyone.

---

## 6. Upload

```bash
npx cap sync ios && npx cap open ios
```

Xcode → **Product → Archive** → **Distribute App** → **App Store Connect**.
Then TestFlight for internal testing, then Submit for Review.

First review typically takes **24–48 hours**.

---

## No Mac?

Options, cheapest first:

1. **Borrow one.** Any Mac from ~2018 on, with Xcode 15+, works. You only need
   it for the archive + upload step.
2. **Cloud Mac** — MacinCloud or MacStadium, roughly $20–30/month, pay for one
   month.
3. **CI build** — GitHub Actions has free macOS runners for public repos (and
   paid minutes for private). Codemagic and Xcode Cloud both have free tiers.
   This is the best long-term answer since it automates every future release,
   but it takes an afternoon to set up certificates and provisioning profiles.

Note that you will still need App Store Connect access from any browser — that
part is not Mac-only.
