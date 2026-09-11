# ALLUR — App Store Handoff

> **Status update 2026-09-11 (chat 2, later).** Supersedes the 09-10 block below
> where they differ.
>
> RevenueCat ↔ server is done: secret API key and webhook exist, both env vars
> are in Vercel (Production + Preview) and deployed, the webhook URL is
> `https://www.getallur.com/api/iap/webhook` (the apex URL 308-redirects and
> RevenueCat does not follow redirects), test event returns **200**.
>
> **Production bug found and fixed on `store-prep` (not yet on main):** after
> "Build my plan", new signups were sent to the "busiest day" screen instead of
> the plan reveal, so nobody could finish onboarding (hardcoded `setStep(8)`
> left over when the flow grew to 17 screens). Commit 5f21d3c. Until
> `store-prep` is merged, web signups are broken. Merge needs Micah's go.
>
> Reviewer demo account exists on production: email
> `micahjcopy+appreview@gmail.com`, username `allurreview`, password given to
> Micah in chat (never in the repo). Its saved state is a complete, populated
> profile ("Alex", Muscle Gain, 5-day plan, 3 weeks of sessions, PRs, weights,
> photos, meals, a scan). It is comped in `api-server/src/lib/comped.ts`
> (commit 1f0d396) so it is Premium with no purchase — live once main deploys.
> Until then it lands on the paywall.
>
> Screenshots are DONE: `docs/app-store/screenshots/` (6 screens, 6.9" and
> 6.5"), rendered offline at true iPhone resolution — see
> `docs/app-store/README.md`. They still need uploading to App Store Connect
> (needs Micah's Chrome).
>
> Small fix: the floating Coach button no longer shows on the Coach screen,
> where it covered the send button (83787c5). Known, unfixed: on the Coach
> screen a long conversation pushes the composer under the bottom nav until the
> page is scrolled (`MobileLayout` `min-h-[100dvh]` lets `main` grow).
>
> Still open, in order: (1) Micah says "merge" → merge `store-prep` into main
> via GitHub in his Chrome; (2) upload screenshots + App Review info (phone
> 805 220 8303, demo credentials, notes from APP-STORE-LISTING.md) in ASC;
> (3) sandbox tester in ASC; (4) macOS update → Xcode → Archive → TestFlight
> (reminder scheduled); (5) sandbox purchase tests; (6) submit only on Micah's
> explicit go.

> **Status update 2026-09-10 (chat 2).** Read this before Part 3.
>
> Done: PR #36 + #37 merged and live. Branch `store-prep` (from main) holds
> everything since: privacy-policy amendments, age minimum 16, the committed
> Xcode project at `artifacts/fitcoach/ios/`, a 3.1.1 fix (Account no longer
> opens Stripe inside the iOS app; `/paywall` is a real route), the listing copy
> at `docs/APP-STORE-LISTING.md`, and `docs/app-store/make_screens.py` (turns
> phone captures into framed 6.5"/6.9" screenshots). **Merge `store-prep` into
> main before the next build.**
>
> App Store Connect: app record, subscriptions ($10.99 / $69.00), group display
> name, subtitle, categories, content rights, age rating 16+, App Privacy
> (published), price Free, availability all countries, promo text, description,
> keywords, URLs, copyright are all set. Still empty because they need Micah:
> App Review contact phone, demo account credentials (the review notes are in
> APP-STORE-LISTING.md — ASC refuses to save that section without phone +
> credentials), sandbox tester, screenshots, build.
>
> RevenueCat: catalog is right, but there was **no secret API key and no
> webhook** — Micah must create both and put `REVENUECAT_SECRET_API_KEY` and
> `REVENUECAT_WEBHOOK_SECRET` into Vercel. Webhook still returns 503 until then.
>
> Build: **Xcode is not installed on the Mac** and Xcode Cloud's first workflow
> can only be created from Xcode, so a local Xcode is required once. The Cowork
> Linux VM on the Mac builds the web bundle fine (strip the `linux-arm64` /
> `darwin-arm64` `'-'` overrides from `pnpm-workspace.yaml` locally first). A
> self-contained, ready-to-archive project with the real RevenueCat public key
> is at `~/Downloads/allur-ios` on the Mac (Package.swift points at vendored
> `Plugins/`, no node_modules needed). Next: install Xcode, add Apple ID in
> Xcode → Accounts, open that project, Archive, Distribute → TestFlight.
>
> Working notes: GitHub pushes go through Micah's Chrome only (his rule); the
> web upload drops the +x bit, so `ci_scripts/ci_post_clone.sh` on GitHub is
> mode 644 — irrelevant for the local-Xcode path. The Mac mount cannot delete
> files (mv aside instead).


**Written 9 September 2026, for the chat that takes this to the App Store.**
Micah's goal, in his words: *get the app in the App Store as fast as possible.*

> This document is the memory of the previous chat. It says where everything is,
> what is actually done versus claimed, the plan in order, and the things that
> went wrong so they are not repeated. Read Part 1 before doing anything.

---

## Part 1 — Read this first

**Micah is not a developer.** Explain things the way you'd explain them to a smart
friend who runs a business. No jargon dumps. He has said, verbatim: *"explain
things to me as such I dont know 90% of the shit you're talking about"* and *"If you
can do the work just do it and stop giving me bs."* Do the work; don't narrate it.

**Where the code is.** `github.com/micahjcopy-ctrl/allur`. Three branches matter:

| Branch | What it is | State |
|---|---|---|
| `main` | Production. Last commit 19 Aug 2026 (PR #35 merge). | Deployed to getallur.com via Vercel |
| `ios-in-app-purchases` | **PR #36** — Apple IAP via RevenueCat, 10 commits, 1,673 lines. | Ready. 0 behind main. **Not merged.** |
| `design/screen-fixes` | Onboarding redesign, 9 commits. | 0 behind main, fast-forward mergeable. **Not merged.** |

Both unmerged branches sit directly on top of main's tip. The only files they both
touch are `package.json` and `pnpm-lock.yaml` (each adds one dependency). Merging
both is low-risk.

**What's actually done for the App Store** (verified in code, not from memory):

- Capacitor shell configured, bundle ID `com.getallur.app` locked (PR #25)
- API origin + bearer-token auth for native — the two "app can't reach its own
  backend" blockers (PR #34, `native-ios-foundation`)
- Health disclaimers for Guideline 1.4.1 (PR #35, `compliance/health-disclosures`)
- In-app account deletion for 5.1.1(v) (PR #23)
- Legal pages: Privacy, Terms, About, Disclaimer — all routable
- Apple Developer account: **paid, Paid Apps Agreement active**, Individual
  enrolment under Micah's legal name (team shows as "Michael Jacobi")
- RevenueCat: project created, App Store app added, entitlement + products +
  offering configured, Apple API key pasted in, App Store Connect API key (.p8)
  uploaded. A Key ID mismatch was caught and fixed during setup.
- IAP code complete on the branch (PR #36): native purchase client, server
  entitlement table, RevenueCat webhook, Restore Purchases on paywall and Account,
  3.1.2 subscription disclosure copy

**What is not done** — see Part 3. The short version: nobody has ever run
`npx cap add ios`. The app has never been built as an iOS binary. Everything
from here is Mac work plus store paperwork.

**First thing to do in the new chat:** merge PR #36 and `design/screen-fixes` into
main (in that order), confirm the Vercel deploy is green, then go to Part 3.

---

## Part 2 — Where everything lives

### Code and docs (in the repo)

- `NATIVE_SETUP.md` (root, on the `ios-in-app-purchases` branch) — **the
  authoritative iOS build guide.** Exact commands, Info.plist strings, RevenueCat
  product IDs, sandbox test script. Once PR #36 merges it's on main.
- `docs/ONBOARDING-REDESIGN-PLAN.md` — the design plan (22 screens, decisions locked)
- `docs/allur-onboarding-phase2.patch` — the three original redesign commits with
  full messages, recoverable via `git am`
- `artifacts/fitcoach/src/pages/onboarding/kit.tsx` — the onboarding design system
- `artifacts/fitcoach/capacitor.config.ts` — correct as-is; do not add `server.url`
- `artifacts/fitcoach/src/lib/native.ts` — the pattern every native code path follows
- `artifacts/fitcoach/src/lib/apiOrigin.ts` — the native/web origin switch

### Google Drive (micahjcopy@gmail.com)

| Doc | Why it matters |
|---|---|
| **ALLURiOSLaunchPlan.md** (18 Aug) | The previous audit and 5-phase plan. Phases 0 and 2 are now done. |
| **R4 — App Store + Google Play launch runbook** (29 Jul) | Guideline text, asset specs, the litigation status on external payment links |
| **🚨 DO TODAY — Developer account setup** (29 Jul) | Individual vs Organization enrolment trade-offs. Micah chose Individual. |
| **⚠ Reconciliation — plan vs what the app does** (29 Jul) | Free tier gets no AI features; matters for the demo account and the review notes |
| **ALLURScreenbyScreenDesignReport.md**, **ALLUROnboardingRedesignPlan.md** | Design context, not launch-blocking |
| **Liftoff Onboarding Teardown — reference screens** (folder) | 26 competitor screens used for the redesign |
| **ALLUR-vapid-keys.txt** | Web-push keys. Do not open in chat; note it exists. |
| **Claude-OBS-Sync** (folder) | July social-media content. Not relevant to launch. |

### Accounts and keys

| Thing | Where | Status |
|---|---|---|
| Apple Developer Program | developer.apple.com, Micah's Apple ID | Active, Individual |
| App Store Connect API key (.p8) | Micah has the file. **Apple lets you download it exactly once.** | Uploaded to RevenueCat. Must be kept somewhere safe. |
| RevenueCat project | app.revenuecat.com | Configured. Confirm the account email was verified (was outstanding). |
| RevenueCat Apple API key (`appl_…`) | RevenueCat → API keys | This is `VITE_REVENUECAT_IOS_KEY` at build time |
| RevenueCat secret key (`sk_…`) | RevenueCat → API keys | This is `REVENUECAT_SECRET_API_KEY` in Vercel |
| RevenueCat webhook secret | Micah generated it with `openssl rand -base64 36` on the Mac (late Aug) and asked Claude to hand it back when needed. **The value is in the previous chat's history, not here.** | Must match in two places: RevenueCat's webhook Authorization header and Vercel's `REVENUECAT_WEBHOOK_SECRET`. **Verify both are set.** |
| Vercel | Project for getallur.com | Needs the two RevenueCat env vars in Production *and* Preview |
| Obsidian vault | `C:\Users\Micah\Documents\Claude OBS` on the Windows machine | `03_Projects/ALLUR/`, `AppDev/`. The device bridge has failed 6+ times; do not depend on it. |

### Pricing (verify before submitting — two docs disagree)

- `NATIVE_SETUP.md` (later, in code): **$10.99/mo, $69.99/yr**, "match the web app exactly"
- ALLURiOSLaunchPlan (Aug 18): $12.99/mo
- Product IDs: `com.getallur.app.base.monthly`, `com.getallur.app.base.annual`
- Subscription group name: `ALLUR`. Entitlement: `base`. Offering: `default`.

Check what getallur.com actually charges today and make App Store Connect match.
Web and app prices are allowed to differ, but it should be a decision, not an accident.

---

## Part 3 — The plan, in order

Each step says who does it. "Claude" means the new chat. "Mac" means Micah at his
Mac with Claude driving via the browser or dictating commands.

### Step 1 — Merge and deploy (Claude, 30 min)

1. Merge PR #36 (`ios-in-app-purchases`) into main via the GitHub UI.
2. Merge `design/screen-fixes` into main (open a PR, merge). Resolve the trivial
   `package.json` / lockfile overlap if GitHub flags it — both sides add a dep,
   keep both.
3. Confirm Vercel deploys green. Open getallur.com, run onboarding end to end.
4. Set `REVENUECAT_WEBHOOK_SECRET` and `REVENUECAT_SECRET_API_KEY` in Vercel
   (Micah pastes; Claude never sees them). Without these the webhook returns 503
   and **purchases will not stick**.

### Step 2 — App Store Connect setup (Micah, browser, Claude driving, 45 min)

1. Create the app record: name **ALLUR**, bundle `com.getallur.app`, SKU anything.
2. Auto-Renewable Subscription Group `ALLUR` → two subscriptions with the exact
   product IDs above. Each needs a display name, description, and a paywall
   screenshot (can be a placeholder until Step 4 produces a real one).
3. **Apply for the Small Business Program** (App Store Connect → Agreements). It is
   a form. It drops Apple's cut from 30% to 15%. Not automatic. Do it now.
4. Create a **Sandbox Tester** (Users and Access → Sandbox) for purchase testing.

### Step 3 — First iOS build (Mac, 1–2 hours first time)

Follow `NATIVE_SETUP.md` §2–3 exactly. In short:

```
pnpm install
cd artifacts/fitcoach
VITE_NATIVE_BUILD=1 VITE_REVENUECAT_IOS_KEY=appl_xxxxx pnpm build
npx cap add ios          # first time only
npx cap sync ios
npx cap open ios
```

In Xcode: paste the five Info.plist purpose strings from `NATIVE_SETUP.md` §3
(camera, photo library, photo add, location-when-in-use, microphone), set Display
Name `ALLUR`, Version `1.0.0`, Build `1`, automatic signing, enable In-App Purchase
and Push Notifications capabilities. Run on the simulator, then on Micah's iPhone.

**Exit criterion:** on a real phone — sign in, finish onboarding, send a coach
message, log a meal photo. If any of those fails, stop and fix before anything else.

### Step 4 — Purchase test in sandbox (Mac + iPhone, 1 hour)

`NATIVE_SETUP.md` §5, all six cases: buy monthly, buy annual, kill/reopen still
unlocked, delete/reinstall + Restore Purchases, cancel → lapses at period end,
different user doesn't inherit. **If Restore Purchases fails, Apple rejects.**

### Step 5 — TestFlight (Mac, 30 min)

Product → Archive → Distribute → App Store Connect → TestFlight internal testing.
No review needed. This is the first real milestone: ALLUR on Micah's phone from
the store pipeline. Get two or three friends on it for a day.

### Step 6 — Store listing (Claude drafts, Micah approves, 2 hours)

- App icon 1024×1024, no alpha, no rounded corners
- Screenshots: **6.9" (1320×2868) and 6.5" (1284×2778)**, from a real device.
  Onboarding, ALLUR Score reveal, coach, macros, dashboard.
- Name, subtitle (30 chars), keywords (100 chars), description, promotional text
- Support URL, marketing URL (getallur.com), privacy policy URL (getallur.com/privacy)
- **App Privacy questionnaire** — declare health/fitness data, photos, coarse
  location, identifiers, usage analytics. Must match the privacy page. Reviewers
  cross-check; a mismatch is a top rejection cause.
- Age rating questionnaire — expect 12+ or 17+ for health content
- **EU trader status: select "not distributing in the EU."** Micah has no LLC;
  the alternative publishes his home address on every EU listing.
- **Demo account for App Review** with an active subscription and pre-seeded
  data, in the review notes. Free tier has no AI features (see Reconciliation
  doc), so a free demo account means the reviewer sees a locked app.

### Step 7 — Submit

Bump nothing. Submit the TestFlight build. Typical first review: 24–48 hours,
budget a week. Have replies drafted for the three likely questions: 1.4.1 (body
composition is an estimate, methodology disclosed), 5.1.1 (why each permission),
3.1.1 (purchase is StoreKit via RevenueCat; Stripe is web-only).

### Realistic timeline

| Day | Milestone |
|---|---|
| 1 | Steps 1–2. Merges live, ASC configured, Small Business applied |
| 2 | Step 3. **ALLUR running on Micah's iPhone.** |
| 3 | Steps 4–5. Sandbox purchases pass, TestFlight out |
| 4–5 | Step 6. Listing assets and questionnaires |
| 6 | Submit |
| 7–10 | Review. Expect one round of questions. |

**~2 weeks to live is realistic.** The last plan said the same and it was right
about what remained; what changed is that Phases 0 and 2 shipped.

---

## Part 4 — Watch-outs

### Things that will bite the new chat

1. **The sandbox cannot push to GitHub.** `git push` is denied by the proxy
   ("not in this session's authorized repository set"). Fetch works. The working
   method is: commit locally → drive Micah's Chrome to
   `github.com/micahjcopy-ctrl/allur/upload/<branch>/<dir>` → upload the changed
   files → commit in the browser → `git fetch` and `git diff` to verify
   byte-identical. Files must be staged in the session's scratchpad for the
   browser upload tool to accept them. The first click after an upload lands on
   the "choose your files" link instead of the message field; click again.
2. **The device bridge to Micah's computer does not connect.** Six-plus attempts
   over three weeks, both his Mac and Windows machine. Do not build a plan that
   depends on it. Drive and the browser are the channels that work.
3. **The sandbox git clone is shallow.** `git merge-base` returns nothing and
   ahead/behind counts are wrong until you `git fetch --deepen=50`. One wrong
   "286 commits behind" reading came from this.
4. **Prices disagree between docs** (see Part 2). Resolve before creating the
   subscriptions — product prices can be changed later but it triggers a
   subscriber notification flow.
5. **RevenueCat webhook secret must match in two places** or purchases silently
   don't persist. The symptom is: buy succeeds on device, app unlocks, kill and
   reopen → locked again.
6. **`ios/` is deliberately not committed.** Regenerate with `npx cap add ios`.
   Don't try to upload it through the browser — it's hundreds of MB.
7. **The App Store Connect API key (.p8) downloads once.** If it's lost, revoke
   and reissue in ASC → Users and Access → Integrations, then re-upload to
   RevenueCat.
8. **Individual account = "Michael Jacobi" as the seller name** on the public
   listing. Micah accepted this for speed. Apps can be transferred to an
   Organization account later once the LLC exists.

### Things that already bit us (don't repeat)

- **Backup discipline.** Three commits sat only in the sandbox for 11 days.
  Micah's reaction: *"its part of the fucking SOP that you back EVERYTHING we do
  up."* A patch file pasted into chat does **not** count. Push to GitHub via the
  browser the moment a commit exists.
- **Rebuilding work that already existed.** A previous session wrote a
  `purchases.ts` from scratch and estimated "several hours remain" when PR #36
  already had all of it. **Check every branch before building anything.**
  `git ls-remote --heads origin` lists 34 branches; many contain finished work.
- **Stating stale readings as current fact.** Told Micah the session was bound to
  Windows based on a week-old reading; it was his Mac. Told him tabular-nums was
  missing when it was set globally. Told him a "muted teal" button existed when it
  was `disabled:opacity-50`. He noticed every one. Verify before asserting;
  screenshot before describing.
- **Telling him to "open the desktop app" while he was in the desktop app.**
- **Assuming the transcript covers the whole project.** After a context
  compaction, the JSONL only holds the recent part. Drive and the repo are the
  durable memory; the chat is not.

### Apple review risks, ranked (from the R4 runbook, still current)

| Risk | Guideline | Status |
|---|---|---|
| Stripe paywall in-app | 3.1.1 | **Fixed** in PR #36 — StoreKit on native, Stripe web-only |
| Health claims without disclaimer | 1.4.1 | **Fixed** in PR #35 |
| Privacy questionnaire ≠ policy | 5.1.1 | Open — Step 6 |
| Reviewer can't access features | 2.1 | Open — demo account, Step 6 |
| Missing permission strings | 5.1.1 | Open — Step 3 |
| Restore Purchases missing/broken | 3.1.1 | Built; **must pass Step 4** |
| "Repackaged website" | 4.2 | Mitigated — bundled assets, native camera/GPS |
| No account deletion | 5.1.1(v) | **Fixed** in PR #23 |

### Payment-link litigation (informational)

Apple currently charges 0% on US external purchase links (Epic v. Apple, pending
Supreme Court petition as of July 2026). **Don't build on it.** IAP via RevenueCat
at 15% under the Small Business Program is the stable path and it's already coded.

---

## Part 5 — Working rules Micah requires

1. **Back everything up the moment it exists.** GitHub via browser. Verify with
   fetch + diff. Every chunk, not every session.
2. **Build → typecheck → screenshot → commit → push.** He chose "build and
   screenshot each fix" after two wrong claims. Show, don't describe.
3. **Do the work. Don't ask permission for things you can do.** Ask a lot of
   questions only when they're real decisions (design taste, money, his accounts).
4. **Plain language.** He'll tell you when he wants depth.
5. **Don't fluff.** *"Your job isnt to agree and fluff me up its to make the app
   amazing."* Objective ratings, real problems, no padding.
6. **Own mistakes in one sentence and fix them.** Don't spiral.

### Security constraints (non-negotiable)

- Never handle his government ID, bank details, SSN, or tax forms. Those are
  his actions alone, in his browser, with Claude not watching.
- Never click "Generate token" or enter credentials, passwords, or API keys.
  He pastes; Claude directs.
- Never put secret values in files, docs, or the repo. Env vars go into Vercel
  by his hand.
- An old GitHub PAT (`github_pat_11CG4BSZI0…`) from a dead container should be
  revoked if it hasn't been. Ask him.

---

## Part 6 — Parked: the onboarding redesign

**Not a launch blocker.** Apple does not review design taste. Ship what's on
`design/screen-fixes` — it is better than main — and continue in v1.1.

State: 17 of 22 planned screens. Flow is a `screens: ScreenDef[]` config array
(adding a screen is one entry). The five-question "real week" step and the
seven-input "numbers" step are split. Design system in `kit.tsx`: `ChoiceCard`,
`StepShell`, `CoachBubble`, `Dial`, `BeatScreen`, `HoldToCommit`, `useReducedMotion`.

Remaining (in order per the plan): split screen 1 (gender + physique → 3–6),
promote "none of these were your fault" to its own screen, split screen 10
(injuries + dietary), then new screens 1–2 (splash + Score preview), 10
(hold-to-commit), 22 (building), 24 (trial reminder), then rebuild the reveal
with the NOW → GOAL physique pair.

Known bugs, none blocking: Score animation ignores `prefers-reduced-motion`;
rest days render START WORKOUT; bodyweight chart doesn't plot bodyweight;
contradictory progress deltas; some sub-44pt tap targets; 14 radius variants /
10 shadow tiers; 21 hardcoded hex values.

Locked design decisions (don't relitigate): accent intensity B (balanced cyan),
system font stack for UI + Archivo for display, chrome tokens for secondary
text, no mascot — *"no teal elephant bs thats not our vibe."*

---

## Part 7 — Micah's outstanding items

- Confirm the RevenueCat account email (verification was pending)
- Apply for the Apple Small Business Program (Step 2.3)
- Store the .p8 file somewhere durable (password manager, not Downloads)
- Paste the two RevenueCat env vars into Vercel (Step 1.4)
- Revoke the old GitHub PAT
- Decide: keep web and app prices identical, or not

---

*Sources: repo state verified 2026-09-09 (`git ls-remote`, branch diffs, PR list);
Drive docs ALLURiOSLaunchPlan (2026-08-18), R4 runbook (2026-07-29), DO TODAY
(2026-07-29), Reconciliation (2026-07-29); `NATIVE_SETUP.md` on
`ios-in-app-purchases`; previous chat history through 2026-09-09.*
