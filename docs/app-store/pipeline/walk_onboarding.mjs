import { chromium, devices } from "playwright";
const base = process.argv[2] || "http://localhost:4180";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 15 Pro Max"], viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, colorScheme: "dark" });
await ctx.addInitScript(() => { window.webkit = { messageHandlers: { bridge: { postMessage: () => {} } } }; });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
// signed out: auth/user → 401, everything else 404 (the funnel runs client-side)
await page.route("https://www.getallur.com/**", (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === "/api/auth/user") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthenticated" }) });
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const log = async (tag) =>
  console.log(
    tag.padEnd(12),
    (await page.evaluate(() => (document.querySelector("h1")?.textContent || "").slice(0, 55))).padEnd(56),
    "|",
    await page.evaluate(() => document.querySelector(".text-destructive")?.textContent?.trim() || ""),
  );
const next = async () => { await page.getByRole("button", { name: /^(next|continue)/i }).last().click(); await page.waitForTimeout(700); };
const pick = async (re) => { await page.getByRole("button", { name: re }).first().click(); await page.waitForTimeout(250); };

await log("start");
await pick(/^Female$/); await pick(/^Male$/);
const imgs = await page.evaluate(() => [...document.querySelectorAll("img[src*='bodytypes']")].map((i) => ({ src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0 })));
console.log("male photos after Female→Male toggle:", imgs.length, "rendered:", imgs.filter((i) => i.ok).length);
await pick(/Lean/); await next();
await log("goal"); await pick(/Muscle Gain/);
// physique cards are image buttons; click the first one that isn't a goal chip
const phys = page.locator("button:has(img[src*='physiques'])").first(); if (await phys.count()) { await phys.click(); await page.waitForTimeout(250); }
await next();
await log("why"); await pick(/Started strong/); await next();
await log("best-self"); await pick(/A few years back/); await next();
for (let i = 0; i < 4; i++) { await log("week" + i); await next(); }
await log("week4"); await pick(/Bodyweight|Home|Gym/i); await next();
await log("around"); await next();
await log("name"); await page.getByPlaceholder("John").fill("Test"); await next();
await log("age"); await next();      // accept the dial default, no drag
await log("height"); await next();   // accept the dial default
await log("weight"); await next();   // accept the dial default
await log("experience"); await pick(/Beginner/); await next();
await log("activity"); await pick(/Sedentary/);
await page.getByRole("button", { name: /build my plan/i }).click();
await page.waitForTimeout(6000);
await log("after build");
await page.screenshot({ path: "onboarding-after-build.png" });
await browser.close();
