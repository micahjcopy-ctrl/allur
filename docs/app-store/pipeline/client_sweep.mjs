// Client sweep: signed-in, subscribed demo account on the mock server, native
// shim on. Every screen is loaded (page errors + console errors captured), and
// the core interactions are exercised with stubbed AI endpoints. Prints
// PASS/FAIL/INFO lines; screenshots go to sweep/<name>.png.
import { chromium, devices } from "playwright";
import fs from "node:fs";
const base = process.argv[2] || "http://localhost:4182";
fs.mkdirSync("sweep", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok === null ? "INFO" : ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ ...devices["iPhone 15 Pro Max"], viewport: { width: 440, height: 956 }, deviceScaleFactor: 2, colorScheme: "dark", permissions: ["geolocation"], geolocation: { latitude: 40.72, longitude: -74.04 } });
await ctx.addInitScript(() => { window.webkit = { messageHandlers: { bridge: { postMessage: () => {} } } }; });
const page = await ctx.newPage();
const pageErrors = []; const consoleErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
const failedReqs = []; page.on("requestfailed", (r) => failedReqs.push(r.url().slice(0, 100) + " " + (r.failure()?.errorText || "")));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });

// ---- API: proxy to the mock, with overrides for AI endpoints and a mutable subscription
let sub = { plan: "base", status: "app_store", trialEnd: null, currentPeriodEnd: new Date(Date.now() + 19 * 864e5).toISOString(), cancelAtPeriodEnd: false, hasEverSubscribed: true };
let credits = { plan: "base", credits: { coaching: 50, photo: 150, bodyScan: 20 }, periodStart: new Date().toISOString() };
const puts = []; const posts = [];
let chatMode = "reply"; // reply | plan | 402 | 500
let saveFail = false;
const plan3 = [
  { dayName: "Monday", title: "Full Body — Squat Focus (updated by coach)", exercises: [{ name: "Back Squat", sets: 3, reps: "6-8", rest: "2m" }, { name: "Incline DB Press", sets: 3, reps: "8-10", rest: "90s" }] },
  { dayName: "Wednesday", title: "Full Body — Press Focus", exercises: [{ name: "Overhead Press", sets: 3, reps: "6-8", rest: "90s" }] },
  { dayName: "Friday", title: "Full Body — Hinge & Pull Focus", exercises: [{ name: "Deadlift", sets: 3, reps: "5", rest: "2m" }] },
];
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
await page.route("https://www.getallur.com/**", async (route) => {
  const req = route.request(); const u = new URL(req.url()); const p = u.pathname; const m = req.method();
  if (m === "POST") posts.push({ p, body: req.postData()?.slice(0, 300) });
  if (p === "/api/me/subscription") return json(route, 200, sub);
  if (p === "/api/me/credits") return json(route, 200, credits);
  if (p === "/api/me/fitness-state" && m === "PUT") { puts.push(req.postData()); return saveFail ? json(route, 500, { error: "boom" }) : json(route, 200, { success: true, updatedAt: new Date().toISOString() }); }
  if (p === "/api/coach/chat") {
    if (chatMode === "402") return json(route, 402, { error: "You're out of credits for this feature.", type: "out_of_credits" });
    if (chatMode === "500") return json(route, 500, { error: "The coach is unavailable right now." });
    if (chatMode === "plan") return json(route, 200, { reply: "Done — swapped bench for incline.", planUpdated: true, planSummary: "Swapped bench for incline", updatedPlan: plan3 });
    return json(route, 200, { reply: "Mock coach: keep protein high and sleep 8h.", planUpdated: false });
  }
  if (p === "/api/coach/analyze-meal-text" || p === "/api/coach/analyze-meal") return json(route, 200, { name: "Chicken & rice bowl", items: ["grilled chicken breast", "white rice"], foods: [{ detectedName: "grilled chicken breast", dbMatch: "Chicken breast", foodId: "chicken-breast", category: "protein", alternatives: [], confidence: 0.9, portionConfidence: 0.8, grams: 180, source: "internal", cookingMethod: "grilled", skinOn: false, breaded: false, calories: 297, protein: 56, carbs: 0, fat: 6 }, { detectedName: "white rice", dbMatch: "White rice", foodId: "white-rice", category: "carb", alternatives: [], confidence: 0.9, portionConfidence: 0.7, grams: 200, source: "internal", cookingMethod: "boiled", skinOn: false, breaded: false, calories: 260, protein: 5, carbs: 57, fat: 0.6 }], clarifications: [], hiddenRisks: [], calories: 620, protein: 61, carbs: 57, fat: 7, confidence: "medium", biggestUncertainty: "rice portion", note: null });
  if (p === "/api/coach/analyze-physique") return json(route, 200, { bodyFatLow: 18, bodyFatHigh: 22, confidence: "medium", markers: ["soft midsection"], limitations: "single photo", suggestedDirection: "modest deficit", summary: "Around 18–22%.", scores: { abdominalDefinition: 2, waistLeanness: 3, muscleDefinition: 2, fatDistribution: 3, imageQuality: 4 }, parts: [{ part: "Shoulders", rating: 45, note: "ok" }, { part: "Chest", rating: 40, note: "ok" }, { part: "Back", rating: 35, note: "ok" }, { part: "Arms", rating: 42, note: "ok" }, { part: "Core", rating: 30, note: "ok" }, { part: "Legs", rating: 50, note: "ok" }] });
  if (p === "/api/coach/personalize-plan") return json(route, 200, { summary: "More back", explanation: "Added rows", changes: ["Added Seated Row"], updatedPlan: plan3, planUpdated: true });
  if (p === "/api/coach/analyze-weight") return json(route, 200, { readable: true, weight: 100, unit: "kg", equipment: "barbell", confidence: "high" });
  if (p === "/api/coach/transcribe") return json(route, 200, { text: "swap bench for incline" });
  if (p === "/api/squad/points-event") return json(route, 200, { awarded: 50, bonus: 0, capped: false, weekReps: 50 });
  if (p === "/api/squad/quest") return json(route, 200, { awarded: 25 });
  if (p === "/api/referral/status") return json(route, 200, { code: "ALLURX", link: "https://www.getallur.com/?ref=ALLURX", pending: 0, rewarded: 0, premiumUntil: null });
  if (p === "/api/stripe/checkout") return json(route, 200, { url: "https://checkout.stripe.com/mock" });
  if (p === "/api/stripe/plan-prices") return json(route, 200, { monthly: { amount: 1099, currency: "usd", interval: "month" }, annual: { amount: 6900, currency: "usd", interval: "year" } });
  if (p === "/api/cardio/route-suggestions") return json(route, 501, { error: "Route suggestions are not configured." });
  const r = await fetch(base + p + u.search, { method: m, headers: { "content-type": "application/json" }, body: m === "GET" ? undefined : req.postData() });
  return route.fulfill({ status: r.status, contentType: "application/json", body: await r.text() });
});

const text = () => page.evaluate(() => document.body.innerText);
const snap = (name) => page.screenshot({ path: `sweep/${name}.png` });
const errsSince = (n) => ({ pe: pageErrors.slice(n.pe), ce: consoleErrors.slice(n.ce) });
const mark = () => ({ pe: pageErrors.length, ce: consoleErrors.length });
async function visit(path, expectText, name) {
  const m = mark();
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const t = await text(); const loc = await page.evaluate(() => location.pathname);
  const e = errsSince(m);
  const ok = loc === path && (expectText ? new RegExp(expectText, "i").test(t) : true) && e.pe.length === 0;
  check(`route ${path} renders${expectText ? ` (“${expectText}”)` : ""}`, ok, `at ${loc}; pageErrors=${e.pe.length}${e.pe[0] ? " " + e.pe[0].slice(0, 80) : ""}; consoleErrors=${e.ce.length}`);
  await snap(name || path.replace(/\W+/g, "_").replace(/^_/, "") || "root");
  return t;
}

// ---------------------------------------------------------------- every route
await visit("/dashboard", "Hey|Ready", "dashboard");
{
  const t = await text();
  const m = t.match(/(\d+)\s*\/\s*4\b/);
  check("dashboard credits card shows a sane denominator (Base = 50/150/20)", !m, m ? `found “${m[0]}” — hard-coded /4` : "");
  check("dashboard shows Up Next workout", /UP NEXT|Start Today/i.test(t));
}
await visit("/plan", "Your Plan", "plan");
await visit("/progress", "Progress|Photo|Weight", "progress");
await visit("/score", "Score", "score");
await visit("/streak", "Streak|Momentum|Level", "streak");
await visit("/macros", "Nutrition|Macros|meal", "macros");
await visit("/coach", "Coach|Ask", "coach");
await visit("/squad", "Squad|Momentum|Invite", "squad");
await visit("/cardio", "Cardio|Run|Walk", "cardio");
await visit("/refer", "Refer|Invite|friend", "refer");
await visit("/account", "Account|Subscription|Plan", "account");
await visit("/settings", "Settings|Profile", "settings");
await visit("/paywall", "Start ALLUR|Restore", "paywall");
{
  const t = await text();
  check("paywall shows both prices from the store/plan-prices", /10\.99|69/.test(t), t.match(/\$[\d.]+[^\n]*/g)?.slice(0, 3).join(" | "));
  check("paywall has Restore Purchases (Apple 3.1.1)", /restore/i.test(t));
  check("paywall has Terms and Privacy links", /terms/i.test(t) && /privacy/i.test(t));
}
await visit("/nope-404", "", "notfound");
{
  const t = await text();
  check("unknown route shows a not-found screen, not blank", /not found|404|doesn.t exist/i.test(t), t.slice(0, 80).replace(/\n/g, " "));
}

// ---------------------------------------------------------------- workout session end-to-end
{
  await page.goto(base + "/plan", { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  const start = page.getByRole("button", { name: /start workout/i }).first();
  check("plan has Start Workout", (await start.count()) > 0);
  const m = mark(); puts.length = 0;
  await start.click(); await page.waitForTimeout(1500);
  const loc = await page.evaluate(() => location.pathname);
  check("Start Workout navigates to /session/:id", /^\/session\//.test(loc), loc);
  await snap("session");
  const t0 = await text();
  const exCount = (t0.match(/sets/gi) || []).length;
  check("session lists the day's exercises", exCount >= 3, `${exCount} “sets” rows`);
  // toggle complete on every exercise: click checkboxes / complete buttons
  const boxes = page.locator("button[role=checkbox], [data-state][role=checkbox], button:has(svg.lucide-circle), button:has(svg.lucide-check-circle-2), button:has(svg.lucide-check)");
  const n = await boxes.count();
  for (let i = 0; i < n; i++) { try { await boxes.nth(i).click({ timeout: 800 }); } catch {} }
  // weight input
  const inputs = page.locator("input[type=number], input[inputmode=decimal]");
  const ni = await inputs.count();
  if (ni) { await inputs.first().fill("120"); await page.waitForTimeout(300); }
  check("session has weight inputs", ni > 0, `${ni} numeric inputs`);
  check("session has no reps input (reps are never logged)", null, `${ni} numeric inputs total for ${exCount} exercises`);
  const hasTimer = /rest timer|\b\d{1,2}:\d{2}\b/.test(await text());
  check("session offers a rest timer", hasTimer, "none found");
  const finish = page.getByRole("button", { name: /finish/i }).first();
  check("session has Finish", (await finish.count()) > 0);
  await finish.click(); await page.waitForTimeout(2500);
  await snap("session-finished");
  const t1 = await text(); const loc2 = await page.evaluate(() => location.pathname);
  check("Finish leaves the session (PR overlay or back to plan)", /new pr|personal record|nice work|workout complete|done|Your Plan/i.test(t1) || loc2 === "/plan", `at ${loc2}: ${t1.slice(0, 100).replace(/\n/g, " ")}`);
  await page.waitForTimeout(1500);
  const saved = puts.map((p) => { try { return JSON.parse(p); } catch { return null; } }).filter(Boolean);
  const last = saved[saved.length - 1]?.state;
  const finished = (last?.workoutSessions || []).filter((s) => s.finishedAt).length;
  check("finished session persisted to the server blob", finished >= 1, `PUTs=${puts.length}, finished sessions in last PUT=${finished}`);
  const wPost = posts.find((x) => x.p === "/api/squad/points-event" && /workout/.test(x.body || ""));
  check("workout Reps posted after finish", !!wPost);
  const e = errsSince(m); check("no page errors during the session flow", e.pe.length === 0, e.pe[0]);
  // resume: is there a way back to an unfinished session?
  await page.goto(base + "/plan", { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  await page.getByRole("button", { name: /start workout/i }).first().click(); await page.waitForTimeout(800);
  await page.goto(base + "/plan", { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  const t2 = await text();
  check("plan offers to resume an unfinished session", /resume|in progress|continue workout/i.test(t2), "no resume affordance");
}

// ---------------------------------------------------------------- coach
{
  await page.goto(base + "/coach", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  const box = page.getByPlaceholder(/ask anything/i);
  check("coach input present", (await box.count()) > 0);
  chatMode = "reply";
  await box.fill("what should I eat"); await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
  let t = await text();
  check("coach reply rendered", /Mock coach: keep protein/.test(t));
  chatMode = "plan"; puts.length = 0;
  await box.fill("swap bench for incline"); await page.keyboard.press("Enter"); await page.waitForTimeout(2000);
  t = await text();
  check("coach plan update applied without an approve step", /Swapped bench|updated/i.test(t), t.match(/[^\n]*(Swapped|updated)[^\n]*/i)?.[0]);
  await page.waitForTimeout(1200);
  const last = puts.map((p) => JSON.parse(p)).pop()?.state;
  check("updated plan persisted", last?.workoutPlan?.[0]?.title?.includes("updated by coach"), last?.workoutPlan?.[0]?.title);
  chatMode = "402";
  await box.fill("hi"); await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
  t = await text();
  check("402 → out-of-credits toast", /out of credits|credits/i.test(t), t.match(/[^\n]*credit[^\n]*/i)?.[0]);
  chatMode = "500";
  await box.fill("hi again"); await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
  t = await text();
  check("500 → graceful coach error", /couldn.t reach|unavailable|try again/i.test(t), t.match(/[^\n]*(reach|unavailable|try again)[^\n]*/i)?.[0]);
  chatMode = "reply";
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  t = await text();
  check("chat history survives a reload", /Mock coach: keep protein/.test(t), "history is in-memory only");
  await snap("coach-after");
}

// ---------------------------------------------------------------- macros
{
  await page.goto(base + "/macros", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  const describe = page.getByRole("button", { name: /describe your meal|describe/i }).first();
  if (await describe.count()) { await describe.click(); await page.waitForTimeout(500); }
  const ta = page.getByPlaceholder(/grilled chicken breast/i);
  check("macros: describe-a-meal textarea present", (await ta.count()) > 0);
  await ta.fill("grilled chicken and rice");
  const analyze = page.getByRole("button", { name: /estimate|analyze|get macros|count/i }).first();
  check("macros: analyze button present", (await analyze.count()) > 0, (await analyze.count()) ? await analyze.textContent() : "");
  await analyze.click(); await page.waitForTimeout(2000);
  let t = await text();
  check("macros: MealReview shows the estimate", /620|Chicken/i.test(t), t.match(/[^\n]*(620|Chicken)[^\n]*/)?.[0]);
  await snap("meal-review");
  const log = page.getByRole("button", { name: /^log meal$/i }).first();
  check("macros: log button in review", (await log.count()) > 0);
  puts.length = 0;
  if (await log.count()) { await log.click(); await page.waitForTimeout(2000); }
  t = await text();
  check("macros: meal appears in today's list", /Chicken/i.test(t), t.match(/[^\n]*Chicken[^\n]*/)?.[0]);
  const last = puts.map((p) => JSON.parse(p)).pop()?.state;
  check("macros: meal persisted", (last?.meals || []).some((m) => /Chicken/.test(m.name)), `meals in blob: ${last?.meals?.length}`);
  const del = page.getByRole("button", { name: /delete|remove/i });
  check("macros: a logged meal can be deleted", (await del.count()) > 0, `${await del.count()} delete/remove buttons`);
  await snap("macros-after");
}

// ---------------------------------------------------------------- progress: weight, photo, scan
{
  await page.goto(base + "/progress", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  const w = page.getByPlaceholder(/enter weight/i).first();
  check("progress: weight input present", (await w.count()) > 0);
  puts.length = 0;
  if (await w.count()) { await w.fill("81.4"); await page.waitForTimeout(300); const b = page.getByRole("button", { name: /^log$/i }).first(); if (await b.count()) await b.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1500); }
  let last = puts.map((p) => JSON.parse(p)).pop()?.state;
  check("progress: weight log persisted", (last?.weightLogs || []).some((l) => Math.abs(l.weight - 81.4) < 0.01), `logs=${last?.weightLogs?.length}`);
  check("progress: profile.weight updated from the log (macros 'adjust from logged weight')", last?.profile?.weight === "81.4" || Number(last?.profile?.weight) === 81.4, `profile.weight=${last?.profile?.weight}`);
  // photo upload
  const fileInputs = page.locator("input[type=file]");
  check("progress: photo upload inputs present", (await fileInputs.count()) > 0, `${await fileInputs.count()}`);
  // make a real jpeg
  const jpg = fs.readFileSync("allur/artifacts/fitcoach/public/bodytypes/men-start-fit.jpg");
  if (await fileInputs.count()) {
    const before = (puts.map((p) => JSON.parse(p)).pop()?.state?.progressPhotos || []).length;
    puts.length = 0;
    const tile = page.locator("button:has(svg.lucide-upload-cloud), button:has(svg.lucide-cloud-upload)").first();
    check("progress: an empty photo slot (upload tile) exists", (await tile.count()) > 0, `${await tile.count()} tiles`);
    if (await tile.count()) await tile.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    await fileInputs.first().setInputFiles({ name: "front.jpg", mimeType: "image/jpeg", buffer: jpg });
    await page.waitForTimeout(3500);
    const allPuts = puts.map((p) => JSON.parse(p).state);
    const maxPhotos = Math.max(0, ...allPuts.map((st) => (st?.progressPhotos || []).length));
    check("progress: uploaded photo persisted", maxPhotos > before, `photos before=${before}, max after=${maxPhotos}, PUTs=${puts.length}`);
    const scan = page.getByRole("button", { name: /analyze week|re-analyze week/i }).first();
    check("progress: scan button present after upload", (await scan.count()) > 0);
    if (await scan.count()) { await scan.click(); await page.waitForTimeout(3000); const t = await text(); check("progress: physique analysis rendered", /18.?[–-].?22|body.?fat/i.test(t), t.match(/[^\n]*(18|body fat)[^\n]*/i)?.[0]); }
    await snap("progress-after");
  }
}

// ---------------------------------------------------------------- refer/squad link domain + cardio manual entry
{
  await page.goto(base + "/refer", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  const t = await text(); const html = await page.content();
  check("refer: share link uses getallur.com (not a vercel preview domain)", !/allur-mauve\.vercel\.app/.test(html), (html.match(/https?:\/\/[a-z0-9.-]*vercel\.app[^"' <]*/) || [])[0] || "");
  check("refer: no '14-day free trial' promise (no trial exists)", !/14.day free trial/i.test(t), t.match(/[^\n]*trial[^\n]*/i)?.[0] || "");
  await page.goto(base + "/cardio", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  const turnOn = page.getByRole("button", { name: /turn on cardio/i }).first();
  if (await turnOn.count()) { await turnOn.click(); await page.waitForTimeout(1200); check("cardio: module toggle guard works (was off → turned on in place)", /Start (run|walk|ride|hike)|Log a session manually/i.test(await text())); }
  const manual = page.getByRole("button", { name: /log a session manually|manual/i }).first();
  check("cardio: manual entry available", (await manual.count()) > 0);
  if (await manual.count()) { await manual.click(); await page.waitForTimeout(600); const nums = page.locator("input[type=number], input[inputmode=decimal], input[inputmode=numeric]"); const n = await nums.count(); for (let i = 0; i < Math.min(n, 2); i++) await nums.nth(i).fill(String(30 + i)); puts.length = 0; const saveB = page.getByRole("button", { name: /^save/i }).last(); if (await saveB.count()) await saveB.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1800); const last = puts.map((p) => JSON.parse(p)).pop()?.state; check("cardio: manual activity persisted", (last?.cardioActivities || []).length > 0, `activities=${last?.cardioActivities?.length}`); await snap("cardio-manual"); }
}

// ---------------------------------------------------------------- settings / account
{
  await page.goto(base + "/settings", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  const t = await text();
  check("settings: goal/experience editable", /goal|experience/i.test(t));
  const lb = page.getByRole("button", { name: /^lb$|^lbs$/i }).first();
  if (await lb.count()) {
    const wIn = page.locator("input").filter({ has: page.locator("xpath=.") }).nth(3);
    const beforeVal = await page.evaluate(() => [...document.querySelectorAll("input")].map((i) => i.value));
    await lb.click(); await page.waitForTimeout(600);
    const afterVal = await page.evaluate(() => [...document.querySelectorAll("input")].map((i) => i.value));
    const wBefore = beforeVal.find((v) => /^8\d(\.\d+)?$/.test(v)); const idx = beforeVal.indexOf(wBefore); const wAfter = afterVal[idx];
    check("settings: switching kg→lb converts the displayed weight (84 kg → ~185 lb)", Number(wAfter) > 150, `weight field ${wBefore} → ${wAfter}`);
    puts.length = 0;
    const save = page.getByRole("button", { name: /save/i }).first(); if (await save.count()) { await save.click(); await page.waitForTimeout(1800); }
    const last = puts.map((p) => JSON.parse(p)).pop()?.state;
    check("settings: unit change saved to the profile", last?.profile?.weightUnit === "lb", `unit=${last?.profile?.weightUnit} weight=${last?.profile?.weight}`);
    check("settings: saving goal/experience rebuilds the plan", null, `plan unchanged by design — see Settings.tsx:79-89`);
  }
  await page.goto(base + "/account", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  const ta = await text();
  check("account: shows current plan + manage/cancel", /base|manage|cancel/i.test(ta));
  check("account: Restore Purchases present (native)", /restore/i.test(ta));
  check("account: no Stripe/Premium upsell on native", !/premium/i.test(ta) || !/upgrade to premium/i.test(ta), ta.match(/[^\n]*premium[^\n]*/i)?.[0]);
  check("account: delete account present", /delete/i.test(ta));
}

// ---------------------------------------------------------------- lapsed subscriber: LockedFeature CTA on native
{
  sub = { ...sub, plan: "free", status: null, hasEverSubscribed: true }; credits = { ...credits, plan: "free", credits: { coaching: 0, photo: 0, bodyScan: 0 } };
  await page.goto(base + "/coach", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
  const t = await text();
  check("lapsed user on /coach sees a locked screen", /reactivate|subscribe|unlock|locked/i.test(t), t.slice(0, 120).replace(/\n/g, " "));
  await snap("coach-locked");
  posts.length = 0;
  const cta = page.getByRole("button", { name: /reactivate|subscribe|unlock|start allur|get base/i }).first();
  if (await cta.count()) {
    await cta.click(); await page.waitForTimeout(2000);
    const loc = await page.evaluate(() => location.pathname);
    const stripe = posts.find((x) => x.p === "/api/stripe/checkout");
    check("lapsed native user CTA goes to /paywall (IAP), NOT Stripe checkout", loc === "/paywall" && !stripe, `at ${loc}; stripe checkout called=${!!stripe}`);
  }
  await page.goto(base + "/plan", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  const tp = await text();
  const sw = page.getByRole("button", { name: /start workout/i }).first();
  posts.length = 0;
  if (await sw.count()) { await sw.click(); await page.waitForTimeout(1200); }
  const loc = await page.evaluate(() => location.pathname);
  check("lapsed (free) user: Start Workout is blocked", loc === "/plan", `at ${loc}`);
  check("lapsed user still sees their plan (limited free access)", /Your Plan/i.test(tp));
  sub = { ...sub, plan: "base", status: "app_store" }; credits = { ...credits, plan: "base", credits: { coaching: 50, photo: 150, bodyScan: 20 } };
}

// ---------------------------------------------------------------- save failure + offline
{
  await page.goto(base + "/progress", { waitUntil: "networkidle" }); await page.waitForTimeout(1000);
  saveFail = true; puts.length = 0;
  const w = page.getByPlaceholder(/enter weight/i).first();
  await w.fill("82"); await page.waitForTimeout(300); const b = page.getByRole("button", { name: /^log$/i }).first(); if (await b.count()) await b.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const t = await text();
  check("save failure surfaces a toast", /couldn.t save|save failed|not saved|retry/i.test(t), t.match(/[^\n]*(save|saved|retry)[^\n]*/i)?.[0]);
  const n1 = puts.length; await page.waitForTimeout(6000); const n2 = puts.length;
  check("save is retried after failure (PUT count keeps rising)", null, `PUTs after fail: ${n1} → ${n2} over 6s`);
  saveFail = false;
}

// ---------------------------------------------------------------- native-specific: install prompt text, marketing chrome via paywall links
{
  await page.goto(base + "/paywall", { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  const terms = page.getByRole("link", { name: /terms/i }).first();
  if (await terms.count()) { await terms.click(); await page.waitForTimeout(1500); const t = await text(); const loc = await page.evaluate(() => location.pathname); check("paywall Terms link stays inside the app (no web nav/pricing/Get the app)", loc === "/terms" && !/get the app|pricing|premium \$29/i.test(t), `at ${loc}; marketing chrome present=${/get the app|pricing/i.test(t)}`); await snap("terms-from-paywall"); }
}

// ---------------------------------------------------------------- summary
console.log("\nconsole errors (unique):", [...new Set(consoleErrors)].slice(0, 12));
console.log("page errors:", pageErrors.slice(0, 5));
console.log("failed requests (unique):", [...new Set(failedReqs)].slice(0, 8));
const fails = results.filter((x) => x.ok === false);
console.log(`\n== ${results.filter((x) => x.ok === true).length} pass, ${fails.length} fail, ${results.filter((x) => x.ok === null).length} info`);
await browser.close();
