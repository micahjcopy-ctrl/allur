// Capture App Store screens from the state-serving mock (no admin mode).
// Usage: node shoot_state.mjs <base_url> <out_dir> <chat.json> [route ...]
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [base, out, chatFile, ...rest] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const routes = rest.length ? rest : ["dashboard", "score", "coach", "macros", "plan", "progress"];
const chat = JSON.parse(fs.readFileSync(chatFile, "utf8"));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH /* optional: path to a local Chromium; omit to use Playwright's own */ });
const ctx = await browser.newContext({
  ...devices["iPhone 15 Pro Max"],
  viewport: { width: 440, height: 956 },
  deviceScaleFactor: 3,
  colorScheme: "dark",
  locale: "en-US",
  timezoneId: "America/New_York",
});
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("allur_tour_v1", "1");
    localStorage.setItem("allur:giftWelcomeDismissed", "1");
  } catch {}
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));

await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const findCtx = `(() => {
  const rootEl = document.getElementById("root") || document.body.firstElementChild;
  const ck = Object.keys(rootEl).find((k) => k.startsWith("__reactContainer"));
  const stack = [rootEl[ck]]; let n = 0;
  while (stack.length && n < 300000) { const f = stack.pop(); if (!f) continue; n++;
    const v = f.memoizedProps && f.memoizedProps.value;
    if (v && typeof v === "object" && "workoutPlan" in v && "addChatMessage" in v) return v;
    if (f.child) stack.push(f.child); if (f.sibling) stack.push(f.sibling); }
  return null; })()`;

// Seed the coach conversation through the app's own API (in-memory only).
await page.evaluate(([expr, msgs]) => {
  const c = eval(expr);
  if (!c) throw new Error("ctx not found");
  for (const m of msgs) c.addChatMessage(m);
}, [findCtx, chat]);
await page.waitForTimeout(500);

const go = async (route) => {
  await page.evaluate((r) => { history.pushState({}, "", "/" + r); dispatchEvent(new PopStateEvent("popstate")); }, route);
  await page.waitForTimeout(2500);
};

let i = 1;
for (const r of routes) {
  await go(r);
  await page.waitForTimeout(1200);
  if (r === "coach") {
    await page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); const m = document.querySelector("main"); if (m) m.scrollTop = m.scrollHeight; });
    await page.waitForTimeout(600);
  }
  const file = path.join(out, `${String(i).padStart(2, "0")}-${r}.png`);
  await page.screenshot({ path: file });
  console.log("saved", file, await page.evaluate(() => location.pathname));
  i++;
}
await browser.close();
