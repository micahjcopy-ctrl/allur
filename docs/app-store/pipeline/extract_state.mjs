// Enter demo mode on the local build and dump the seeded context state to JSON.
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.argv[2];
const outFile = process.argv[3];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH /* optional: path to a local Chromium; omit to use Playwright's own */ });
const page = await browser.newPage({ viewport: { width: 440, height: 956 } });
await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /preview app as demo user/i }).click({ timeout: 20000 });
await page.waitForURL(/dashboard/, { timeout: 20000 });
await page.waitForTimeout(2000);
const state = await page.evaluate(() => {
  const rootEl = document.getElementById("root") || document.body.firstElementChild;
  const ck = Object.keys(rootEl).find((k) => k.startsWith("__reactContainer"));
  const stack = [rootEl[ck]];
  let n = 0;
  while (stack.length && n < 300000) {
    const f = stack.pop();
    if (!f) continue;
    n++;
    const v = f.memoizedProps && f.memoizedProps.value;
    if (v && typeof v === "object" && "workoutPlan" in v && "enterAdminMode" in v) {
      const keys = ["onboardingComplete", "programStartDate", "profile", "goal", "workoutPlan", "programMeta", "prs", "weightLogs", "progressPhotos", "meals", "physiqueAnalyses", "workoutSessions", "restDaysCompleted", "enhancedGoalPhoto", "notificationPrefs", "featureToggles", "cardioActivities", "chatMessages"];
      return Object.fromEntries(keys.map((k) => [k, v[k]]));
    }
    if (f.child) stack.push(f.child);
    if (f.sibling) stack.push(f.sibling);
  }
  return null;
});
fs.writeFileSync(outFile, JSON.stringify(state, null, 2));
console.log("wrote", outFile, Object.keys(state || {}));
await browser.close();
