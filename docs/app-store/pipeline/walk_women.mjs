import { chromium, devices } from "playwright";
const base = process.argv[2] || "http://localhost:4180";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 15 Pro Max"], viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, colorScheme: "dark" });
await ctx.addInitScript(() => { window.webkit = { messageHandlers: { bridge: { postMessage: () => {} } } }; });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.route("https://www.getallur.com/**", (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === "/api/auth/user") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthenticated" }) });
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
});
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const imgs = async (tag) => {
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => [...document.querySelectorAll("img[src*='bodytypes']")].map((i) => ({ src: i.getAttribute("src").split("/").pop(), ok: i.complete && i.naturalWidth > 0, w: i.naturalWidth, h: i.naturalHeight })));
  console.log(tag, r.length, "imgs, rendered:", r.filter((i) => i.ok).length, r.map((i) => `${i.src}:${i.ok ? i.w + "x" + i.h : "FAIL"}`).join(" "));
};
await page.getByRole("button", { name: /^Female$/ }).first().click(); await imgs("Female:");
await page.screenshot({ path: "women-bodytypes.png" });
await page.getByRole("button", { name: /^Male$/ }).first().click(); await imgs("Male:  ");
await page.getByRole("button", { name: /^Female$/ }).first().click(); await imgs("Female:");
await browser.close();
