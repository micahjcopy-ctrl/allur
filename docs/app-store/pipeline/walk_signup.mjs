// Native funnel end-to-end: signed-out onboarding → sign up → paywall → (purchase
// completes) → must land in the app, not on onboarding step 1.
// The purchase itself can't run in a browser, so the "purchase" is simulated by
// flipping the fake server's subscription to hasEverSubscribed and re-fetching,
// which is exactly what refreshSubscription() does after a real StoreKit buy.
import { chromium, devices } from "playwright";
const base = process.argv[2] || "http://localhost:4180";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 15 Pro Max"], viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, colorScheme: "dark" });
await ctx.addInitScript(() => { window.webkit = { messageHandlers: { bridge: { postMessage: () => {} } } }; });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));

// ---- fake API with mutable state ----
let user = null;
let fitnessState = null;
let subscribed = false;
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
await page.route("https://www.getallur.com/**", async (route) => {
  const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const m = req.method();
  if (p === "/api/auth/user") return json(route, user ? 200 : 401, user ? { user } : { error: "unauthenticated" });
  if (p === "/api/auth/register" && m === "POST") { user = { id: "u1", email: "t@x.com", username: "tester", firstName: null, lastName: null, profileImageUrl: null }; return json(route, 200, { user, token: "sid-1" }); }
  if (p === "/api/me/fitness-state" && m === "GET") return json(route, 200, { state: fitnessState });
  if (p === "/api/me/fitness-state" && m === "PUT") { fitnessState = JSON.parse(req.postData() || "{}").state ?? fitnessState; return json(route, 200, { success: true, updatedAt: new Date().toISOString() }); }
  if (p === "/api/me/subscription") return json(route, 200, subscribed ? { plan: "base", status: "app_store", trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, hasEverSubscribed: true } : { plan: "free", status: null, trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, hasEverSubscribed: false });
  if (p === "/api/me/credits") return json(route, 200, { plan: subscribed ? "base" : "free", credits: { coaching: 0, photo: 0, bodyScan: 0 }, periodStart: new Date().toISOString() });
  if (p === "/api/admin/status") return json(route, 200, { isAdmin: false, isOwner: false });
  if (p === "/api/squad/overview") return json(route, 200, { plan: "free", inviteCode: "X", reps: { week: 0 }, momentum: { weeks: 0, state: "idle", currentWeekReps: 0 }, soloChallenge: null, friends: [], duels: [], notifications: [], unreadCount: 0, quests: [] });
  if (p === "/api/iap/refresh") return json(route, 200, { active: subscribed, plan: subscribed ? "base" : "free", expiresAt: null });
  return json(route, 404, {});
});

const where = () => page.evaluate(() => location.pathname);
const h1 = () => page.evaluate(() => (document.querySelector("h1")?.textContent || "").slice(0, 60));
const next = async () => { await page.getByRole("button", { name: /^(next|continue)/i }).last().click(); await page.waitForTimeout(600); };
const pick = async (re) => { await page.getByRole("button", { name: re }).first().click(); await page.waitForTimeout(200); };

await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await pick(/^Male$/); await pick(/Lean/); await next();
await pick(/Muscle Gain/); const phys = page.locator("button:has(img[src*='physiques'])").first(); if (await phys.count()) await phys.click(); await next();
await pick(/Started strong/); await next();
await pick(/A few years back/); await next();
for (let i = 0; i < 4; i++) await next();
await pick(/Bodyweight|Home|Gym/i); await next();
await next(); // around
await page.getByPlaceholder("John").fill("Test"); await next();
await next(); await next(); await next(); // age/height/weight defaults
await pick(/Beginner/); await next();
await pick(/Sedentary/); await page.getByRole("button", { name: /build my plan/i }).click();
await page.waitForTimeout(5000);
console.log("reveal:", await h1(), "@", await where());
await page.getByRole("button", { name: /unlock my plan and coach|this looks right/i }).click();
await page.waitForTimeout(800);
console.log("after CTA:", await where());

// sign up
await page.locator("#su-email").fill("t@x.com");
await page.locator("#su-username").fill("tester");
await page.locator("#su-password").fill("password123");
await page.getByRole("button", { name: /create account/i }).click();
await page.waitForTimeout(3500);
console.log("after signup:", await where(), "| h1:", await h1(), "| stash consumed:", await page.evaluate(() => !sessionStorage.getItem("allur.onboardingStash.v1")), "| onboardingComplete persisted:", !!fitnessState?.onboardingComplete);
const paywallVisible = await page.getByRole("button", { name: /start allur/i }).count();
console.log("paywall visible:", paywallVisible > 0);

// "purchase": flip the server, then trigger the same refetch refreshSubscription() does
subscribed = true;
await page.evaluate(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
await page.waitForTimeout(500);
// react-query's refetchOnWindowFocus may be off; force it the way the app does after a buy — via a page reload the
// subscription is re-read too. Prefer the in-app path: click nothing, just re-read via a soft navigation.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
console.log("after purchase:", await where(), "| h1:", await h1());
await page.screenshot({ path: "after-purchase.png" });
await browser.close();
