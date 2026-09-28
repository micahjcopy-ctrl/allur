// A signed-in account whose SAVED state has double-encoded plan titles must
// render clean titles (the repair runs on hydration) and write the clean text
// back to the server.
import { chromium, devices } from "playwright";
const base = process.argv[2] || "http://localhost:4182";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 15 Pro Max"], viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, colorScheme: "dark" });
await ctx.addInitScript(() => { window.webkit = { messageHandlers: { bridge: { postMessage: () => {} } } }; });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
// The native build talks to https://www.getallur.com — send that to the mock on this port.
await page.route("https://www.getallur.com/**", async (route) => {
  const req = route.request(); const u = new URL(req.url());
  const r = await fetch(base + u.pathname + u.search, { method: req.method(), headers: { "content-type": "application/json" }, body: req.method() === "GET" ? undefined : req.postData() });
  route.fulfill({ status: r.status, contentType: "application/json", body: await r.text() });
});
let lastPut = null;
page.on("request", (r) => { if (r.method() === "PUT" && r.url().includes("fitness-state")) lastPut = r.postData(); });
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const txt = await page.evaluate(() => document.body.innerText);
const m = txt.match(/Full Body[^\n]*/g) || [];
console.log("location:", await page.evaluate(() => location.pathname));
console.log("titles on screen:", JSON.stringify([...new Set(m)]));
console.log("mojibake on screen:", JSON.stringify((txt.match(/.{0,12}[\u00C2-\u00F4][\u0080-\u00BF].{0,6}/g) || [])));
await page.goto(base + "/plan", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const t2 = await page.evaluate(() => document.body.innerText);
console.log("plan page titles:", JSON.stringify([...new Set(t2.match(/Full Body[^\n]*|Upper[^\n]*|Lower[^\n]*/g) || [])].slice(0, 6)));
console.log("mojibake on plan page:", JSON.stringify((t2.match(/.{0,12}[\u00C2-\u00F4][\u0080-\u00BF].{0,6}/g) || [])));
await page.waitForTimeout(4000);
console.log("state written back clean:", lastPut ? !/[\u0080-¿]/.test(lastPut) && lastPut.includes("Full Body — Squat Focus") : "no PUT observed");
await page.screenshot({ path: "garbled-repaired.png" });
await browser.close();
