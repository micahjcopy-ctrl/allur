// End-to-end audit of the ALLUR API against a local server (port 5050) with a
// local Postgres and a mock OpenAI (port 5051). Every check prints
// PASS/FAIL/INFO with what was expected vs. observed.
import { execSync } from "node:child_process";
const API = process.argv[2] || "http://localhost:5050";
const MOCK = "http://localhost:5051";
const SQL = (q) => execSync(`psql -h /tmp -p 5499 -U allur -d allur_test -tAc ${JSON.stringify(q)}`).toString().trim();

const results = [];
SQL("delete from users"); SQL("delete from rate_limits"); SQL("delete from referrals"); SQL("delete from premium_grants");
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok === null ? "INFO" : ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

async function call(method, path, { body, token, headers = {}, raw = false } = {}) {
  const h = { "content-type": "application/json", ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  const r = await fetch(API + "/api" + path, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  let json = null; const text = await r.text();
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json, headers: r.headers };
}
const resetRL = () => SQL("delete from rate_limits");
const uniq = () => Math.random().toString(36).slice(2, 8);
async function register(email, username, password = "password123") {
  const r = await call("POST", "/auth/register", { body: { email, username, password }, headers: { "x-allur-client": "native" } });
  return r;
}
async function login(login_, password = "password123") {
  return call("POST", "/auth/login", { body: { identifier: login_, password }, headers: { "x-allur-client": "native" } });
}
const mockCalls = async () => (await fetch(MOCK + "/calls")).json();
const mockFail = async (fail) => fetch(MOCK + "/mock/fail", { method: "POST", body: JSON.stringify({ fail }) });
const tinyJpeg = "data:image/jpeg;base64," + Buffer.from("\xff\xd8\xff\xe0mockjpeg").toString("base64");
const profile = { name: "Aud", experience: "Beginner", targetPhysique: "athletic", activityLevel: "Sedentary", injuries: "lower back", dietary: "", equipment: "full gym" };
const plan = [{ dayName: "Monday", title: "Full Body — Squat Focus", exercises: [{ name: "Back Squat", sets: 3, reps: "6-8", rest: "2m" }] }];
const chatBody = { messages: [{ role: "user", content: "hello coach" }], goal: "Muscle Gain", profile, plan };

// ---------------------------------------------------------------- health
{
  const r = await call("GET", "/healthz");
  check("healthz 200", r.status === 200 && r.json.status === "ok");
}

// ---------------------------------------------------------------- auth
const u = uniq();
const A = { email: `a-${u}@audit.test`, username: `a_${u}` };
{
  let r = await register(A.email, A.username, "short");
  check("register rejects 5-char password (400)", r.status === 400, `status ${r.status}`);
  r = await register("not-an-email", A.username);
  check("register rejects bad email (400)", r.status === 400, `status ${r.status}`);
  r = await register(A.email, A.username);
  check("register native returns user + token", r.status === 200 && r.json.user?.id && typeof r.json.token === "string", `status ${r.status} keys ${Object.keys(r.json || {})}`);
  A.token = r.json.token; A.id = r.json.user?.id;
  const setCookie = r.headers.get("set-cookie") || "";
  check("register sets httpOnly sid cookie", /sid=/.test(setCookie) && /HttpOnly/i.test(setCookie), setCookie.slice(0, 80));
  r = await register(A.email, `x_${u}`);
  check("duplicate email rejected (409)", r.status === 409, `status ${r.status}`);
  r = await register(`y-${u}@audit.test`, A.username.toUpperCase());
  check("duplicate username (case-insensitive) rejected (409)", r.status === 409, `status ${r.status}`);
  r = await login(A.email, "wrongpass");
  check("login wrong password 401", r.status === 401, `status ${r.status}`);
  r = await login(A.username);
  check("login by username works", r.status === 200 && r.json.token, `status ${r.status}`);
  A.token2 = r.json.token;
  r = await login(A.email.toUpperCase());
  check("login by EMAIL is case-insensitive", r.status === 200, `status ${r.status} (upper-cased email)`);
  r = await call("GET", "/auth/user", { token: A.token });
  check("auth/user with bearer returns user", r.status === 200 && r.json.user?.id === A.id);
  r = await call("GET", "/auth/user");
  check("auth/user without session returns null user", r.status === 200 && r.json.user === null, JSON.stringify(r.json).slice(0, 60));
  r = await call("GET", "/auth/user", { token: "deadbeef" });
  check("auth/user with bogus bearer -> null user, not 500", r.status === 200 && r.json.user === null, `status ${r.status}`);
}

// ---------------------------------------------------------------- me
{
  let r = await call("GET", "/me/credits");
  check("me/credits unauthenticated 401", r.status === 401, `status ${r.status}`);
  r = await call("GET", "/me/credits", { token: A.token });
  check("me/credits free user 200", r.status === 200, `status ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  check("me/credits free user shows plan free", r.json?.plan === "free", JSON.stringify(r.json?.plan));
  r = await call("GET", "/me/subscription", { token: A.token });
  check("me/subscription free user 200 + hasEverSubscribed false", r.status === 200 && r.json.hasEverSubscribed === false, JSON.stringify(r.json).slice(0, 140));
  r = await call("GET", "/me/fitness-state", { token: A.token });
  check("fitness-state empty -> state null", r.status === 200 && r.json.state === null, JSON.stringify(r.json).slice(0, 60));
  r = await call("PUT", "/me/fitness-state", { token: A.token, body: { state: { onboardingComplete: true, workoutPlan: plan, meals: [] } } });
  check("fitness-state PUT 200", r.status === 200, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("GET", "/me/fitness-state", { token: A.token });
  check("fitness-state round-trips", r.json?.state?.workoutPlan?.[0]?.title === "Full Body — Squat Focus", JSON.stringify(r.json).slice(0, 80));
  r = await call("PUT", "/me/fitness-state", { token: A.token, body: { state: "nope" } });
  check("fitness-state PUT rejects non-object (400)", r.status === 400, `status ${r.status}`);
  // big blob: 3 MB
  const big = { onboardingComplete: true, workoutPlan: plan, progressPhotos: [{ url: "data:image/jpeg;base64," + "A".repeat(3_000_000) }] };
  r = await call("PUT", "/me/fitness-state", { token: A.token, body: { state: big } });
  check("fitness-state accepts a 3 MB blob locally (Vercel caps at 4.5 MB)", r.status === 200, `status ${r.status}`);
  const big6 = { onboardingComplete: true, progressPhotos: [{ url: "A".repeat(6_000_000) }] };
  r = await call("PUT", "/me/fitness-state", { token: A.token, body: { state: big6 } });
  check(null === null ? "INFO fitness-state 6 MB blob locally" : "", null, `status ${r.status} (Vercel would reject >4.5 MB with 413 before Express sees it)`);
  await call("PUT", "/me/fitness-state", { token: A.token, body: { state: { onboardingComplete: true, workoutPlan: plan } } });
}

// ---------------------------------------------------------------- coach gating (free user)
{
  let r = await call("POST", "/coach/chat", { token: A.token, body: chatBody });
  check("coach/chat free user -> 403 needs subscription", r.status === 403, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("POST", "/coach/chat", { body: chatBody });
  check("coach/chat unauthenticated -> 401", r.status === 401, `status ${r.status}`);
  await mockCalls();
  r = await call("POST", "/coach/adapt-plan", { token: A.token, body: chatBody });
  const calls = await mockCalls();
  check("coach/adapt-plan FREE user gets a real LLM reply (no credit, no plan check)", r.status === 200 && calls.some((c) => c.path === "/v1/chat/completions"), `status ${r.status}, openai calls ${calls.length} — this is the free-coaching backdoor`);
  await mockCalls();
  r = await call("POST", "/coach/personalize-plan", { body: { goal: "Muscle Gain", profile, plan, physique: { bodyFatLow: 18, bodyFatHigh: 22, bodyFatMidpoint: 20, overallScore: 40, parts: [{ part: "Back", rating: 30, status: "weak", note: "x" }] } } });
  const calls2 = await mockCalls();
  check("coach/personalize-plan UNAUTHENTICATED still calls OpenAI", r.status === 200 && calls2.some((c) => c.path === "/v1/chat/completions"), `status ${r.status}, openai calls ${calls2.length}`);
  await mockCalls();
  r = await call("POST", "/coach/transcribe", { body: { audio: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(80)]).toString("base64"), audioFormat: "wav" } });
  const calls3 = await mockCalls();
  check("coach/transcribe UNAUTHENTICATED still calls OpenAI STT", calls3.some((c) => c.path === "/v1/audio/transcriptions"), `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}, openai calls ${calls3.map((c) => c.path)}`);
  await mockCalls();
  r = await call("POST", "/coach/analyze-weight", { token: A.token, body: { photo: tinyJpeg } });
  const calls4 = await mockCalls();
  check("coach/analyze-weight free user -> gpt vision call with no credit charge", r.status === 200 && calls4.some((c) => c.path === "/v1/chat/completions"), `status ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  r = await call("POST", "/coach/analyze-meal-text", { token: A.token, body: { description: "a tortilla, 3 eggs, 2 slices of ham" } });
  check("coach/analyze-meal-text free user -> 403", r.status === 403, `status ${r.status}`);
  r = await call("POST", "/coach/analyze-physique", { token: A.token, body: { photos: [tinyJpeg], profile: { gender: "Male", age: "30", height: "180", heightUnit: "cm", weight: "80", weightUnit: "kg", experience: "Beginner", targetPhysique: "athletic", goal: "Muscle Gain" } } });
  check("coach/analyze-physique free user -> 403", r.status === 403, `status ${r.status}`);
  r = await call("POST", "/coach/enhance-goal-photo", { token: A.token, body: { photo: tinyJpeg, targetPhysique: "athletic", goal: "Muscle Gain", gender: "Male" } });
  check("coach/enhance-goal-photo free user -> 403", r.status === 403, `status ${r.status}`);
}

resetRL();
// ---------------------------------------------------------------- premium user via COMPED_EMAILS
const C = { email: "comped@audit.test", username: `c_${u}` };
{
  let r = await register(C.email, C.username);
  C.token = r.json.token; C.id = r.json.user?.id;
  r = await call("GET", "/me/credits", { token: C.token });
  check("COMPED_EMAILS address registers straight into premium (no email verification)", r.json?.plan === "premium", JSON.stringify(r.json).slice(0, 120));
  r = await call("GET", "/me/subscription", { token: C.token });
  check("comped subscription summary hasEverSubscribed true", r.json?.hasEverSubscribed === true && r.json?.plan === "premium", JSON.stringify(r.json).slice(0, 120));
  const before = (await call("GET", "/me/credits", { token: C.token })).json;
  await mockCalls();
  r = await call("POST", "/coach/chat", { token: C.token, body: chatBody });
  const calls = await mockCalls();
  check("coach/chat premium -> 200 reply", r.status === 200 && typeof r.json.reply === "string" && r.json.planUpdated === false, `status ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  check("coach/chat sends tools + profile in system prompt", calls[0]?.toolNames?.includes("update_training_plan") && calls[0]?.sysLen > 500, JSON.stringify(calls[0]).slice(0, 160));
  const after = (await call("GET", "/me/credits", { token: C.token })).json;
  check("premium chat does not decrement credits (unlimited)", JSON.stringify(before.credits) === JSON.stringify(after.credits), `${JSON.stringify(before.credits)} -> ${JSON.stringify(after.credits)}`);
  r = await call("POST", "/coach/chat", { token: C.token, body: { ...chatBody, messages: [{ role: "user", content: "please swap bench press for incline dumbbell press, yes do it" }] } });
  check("coach/chat plan update via tool -> planUpdated + updatedPlan", r.status === 200 && r.json.planUpdated === true && Array.isArray(r.json.updatedPlan) && r.json.updatedPlan.length === 3, `status ${r.status} planUpdated=${r.json.planUpdated} days=${r.json.updatedPlan?.length} summary=${r.json.planSummary}`);
  check("updated plan re-keyed today-first (normalizeCoachPlan)", Array.isArray(r.json.updatedPlan) && r.json.updatedPlan.every((d) => typeof d.dayName === "string" && d.exercises?.length > 0), JSON.stringify(r.json.updatedPlan?.map((d) => d.dayName)));
  // failure path: OpenAI 500 -> 502/500 with no crash
  await mockFail(true);
  r = await call("POST", "/coach/chat", { token: C.token, body: chatBody });
  await mockFail(false);
  check("coach/chat when OpenAI fails -> 5xx JSON error, server alive", r.status >= 500 && r.status < 600 && typeof r.json === "object", `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  const alive = await call("GET", "/healthz");
  check("server still healthy after upstream failure", alive.status === 200);
  // voice
  r = await call("POST", "/coach/voice", { token: C.token, body: { ...chatBody, audio: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(80)]).toString("base64"), audioFormat: "wav" } });
  check("coach/voice premium -> transcript + reply + audio", r.status === 200 && r.json.userTranscript && r.json.reply && r.json.audio, `status ${r.status} keys ${Object.keys(r.json || {})} ${JSON.stringify(r.json).slice(0, 100)}`);
  // physique
  r = await call("POST", "/coach/analyze-physique", { token: C.token, body: { photos: [tinyJpeg], profile: { gender: "Male", age: "30", height: "180", heightUnit: "cm", weight: "80", weightUnit: "kg", experience: "Beginner", targetPhysique: "athletic", goal: "Muscle Gain" } } });
  check("coach/analyze-physique premium -> structured analysis", r.status === 200 && r.json.bodyFatLow === 18 && Array.isArray(r.json.parts) && r.json.parts.length === 6, `status ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  r = await call("POST", "/coach/analyze-physique", { token: C.token, body: { photos: ["data:text/plain;base64,QUJD"], profile: { gender: "Male", age: "30", height: "180", heightUnit: "cm", weight: "80", weightUnit: "kg", experience: "Beginner", targetPhysique: "athletic", goal: "Muscle Gain" } } });
  check("analyze-physique rejects non-image data URL (400)", r.status === 400, `status ${r.status}`);
  r = await call("POST", "/coach/analyze-physique", { token: C.token, body: { photos: [], profile: { gender: "Male", age: "30", height: "180", heightUnit: "cm", weight: "80", weightUnit: "kg", experience: "Beginner", targetPhysique: "athletic", goal: "Muscle Gain" } } });
  check("analyze-physique rejects empty photos (400)", r.status === 400, `status ${r.status}`);
  // meals
  resetRL();
  r = await call("POST", "/coach/analyze-meal", { token: C.token, body: { photo: tinyJpeg } });
  check("coach/analyze-meal premium -> grounded foods with macros", r.status === 200 && Array.isArray(r.json.foods ?? r.json.items) , `status ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  const meal = r.json;
  check("meal analysis totals look sane for burger+eggs (>800 kcal)", (meal.calories ?? meal.totals?.calories ?? 0) > 800, `calories=${meal.calories ?? meal.totals?.calories} protein=${meal.protein ?? meal.totals?.protein}`);
  r = await call("POST", "/coach/analyze-meal-text", { token: C.token, body: { description: "a tortilla, 3 eggs, 2 slices of ham plus an 8 oz wagyu beef burger with cheese, very oily" } });
  check("coach/analyze-meal-text premium -> 200", r.status === 200, `status ${r.status} calories=${r.json?.calories ?? r.json?.totals?.calories}`);
  r = await call("POST", "/coach/analyze-meal-text", { token: C.token, body: { description: "ab" } });
  check("analyze-meal-text rejects <3 chars (400)", r.status === 400, `status ${r.status}`);
  r = await call("POST", "/coach/analyze-meal-text", { token: C.token, body: { description: "x".repeat(2001) } });
  check("analyze-meal-text rejects >2000 chars (400)", r.status === 400, `status ${r.status}`);
  // goal photo
  resetRL();
  r = await call("POST", "/coach/enhance-goal-photo", { token: C.token, body: { photo: tinyJpeg, targetPhysique: "athletic", goal: "Muscle Gain", gender: "Male" } });
  check("coach/enhance-goal-photo premium -> image", r.status === 200 && (r.json.image || r.json.url || r.json.imageUrl), `status ${r.status} keys ${Object.keys(r.json || {})}`);
  // 20k-char message: accepted?
  r = await call("POST", "/coach/chat", { token: C.token, body: { ...chatBody, messages: [{ role: "user", content: "x".repeat(200_000) }] } });
  check("coach/chat accepts a 200,000-char message (no length cap)", r.status === 200, `status ${r.status} — uncontrolled token spend`);
}

resetRL();
// ---------------------------------------------------------------- credits decrement for a BASE user (premium_grants → premium; use IAP row for base)
const B = { email: `b-${u}@audit.test`, username: `b_${u}` };
{
  let r = await register(B.email, B.username);
  B.token = r.json.token; B.id = r.json.user?.id;
  // simulate an App Store purchase via the RevenueCat webhook
  r = await call("POST", "/iap/webhook", { body: { event: { type: "INITIAL_PURCHASE", app_user_id: B.id, store: "APP_STORE", product_id: "com.getallur.app.base.monthly", entitlement_ids: ["base"], environment: "SANDBOX", expiration_at_ms: Date.now() + 30 * 864e5, event_timestamp_ms: Date.now() } }, headers: { authorization: "wrong" } });
  check("iap/webhook wrong secret -> 401", r.status === 401, `status ${r.status}`);
  r = await call("POST", "/iap/webhook", { body: { event: { type: "INITIAL_PURCHASE", app_user_id: B.id, store: "APP_STORE", product_id: "com.getallur.app.base.monthly", entitlement_ids: ["base"], environment: "SANDBOX", expiration_at_ms: Date.now() + 30 * 864e5, event_timestamp_ms: Date.now() } }, headers: { authorization: "rc-secret-123" } });
  check("iap/webhook INITIAL_PURCHASE (sandbox) -> 200", r.status === 200, `status ${r.status} ${JSON.stringify(r.json)}`);
  r = await call("GET", "/me/subscription", { token: B.token });
  check("App Store sandbox purchase -> plan base, hasEverSubscribed true, status app_store", r.json?.plan === "base" && r.json?.hasEverSubscribed === true, JSON.stringify(r.json).slice(0, 160));
  r = await call("GET", "/me/credits", { token: B.token });
  check("base user credits = 50/150/20", r.json?.credits?.coaching === 50 && r.json?.credits?.photo === 150 && r.json?.credits?.bodyScan === 20, JSON.stringify(r.json?.credits));
  const before = r.json.credits;
  r = await call("POST", "/coach/chat", { token: B.token, body: chatBody });
  const after = (await call("GET", "/me/credits", { token: B.token })).json.credits;
  check("base chat decrements coaching credit by 1", r.status === 200 && after.coaching === before.coaching - 1, `${before.coaching} -> ${after.coaching}`);
  await mockFail(true);
  r = await call("POST", "/coach/chat", { token: B.token, body: chatBody });
  await mockFail(false);
  const after2 = (await call("GET", "/me/credits", { token: B.token })).json.credits;
  check("failed chat refunds the credit", after2.coaching === after.coaching, `${after.coaching} -> ${after2.coaching} (status ${r.status})`);
  // exhaust: set coaching to 0 and check 402
  SQL(`update user_credits set coaching=0 where user_id='${B.id}'`);
  r = await call("POST", "/coach/chat", { token: B.token, body: chatBody });
  check("out of coaching credits -> 402", r.status === 402, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  SQL(`update user_credits set coaching=50 where user_id='${B.id}'`);
  // concurrency: 10 parallel chats with 3 credits left — should not go negative
  SQL(`update user_credits set coaching=3 where user_id='${B.id}'`);
  const rs = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/coach/chat", { token: B.token, body: chatBody })));
  const okCount = rs.filter((x) => x.status === 200).length;
  const left = Number(SQL(`select coaching from user_credits where user_id='${B.id}'`));
  check("10 parallel chats with 3 credits: exactly 3 succeed, balance never negative", okCount === 3 && left === 0, `ok=${okCount} left=${left} statuses=${rs.map((x) => x.status)}`);
  SQL(`update user_credits set coaching=50 where user_id='${B.id}'`);
  // expiration event
  r = await call("POST", "/iap/webhook", { body: { event: { type: "EXPIRATION", app_user_id: B.id, store: "APP_STORE", product_id: "com.getallur.app.base.monthly", entitlement_ids: ["base"], environment: "SANDBOX", event_timestamp_ms: Date.now() + 1000 } }, headers: { authorization: "rc-secret-123" } });
  r = await call("GET", "/me/subscription", { token: B.token });
  check("EXPIRATION -> plan free but hasEverSubscribed stays true (lapsed)", r.json?.plan === "free" && r.json?.hasEverSubscribed === true, JSON.stringify(r.json).slice(0, 160));
  // older event must not override newer
  r = await call("POST", "/iap/webhook", { body: { event: { type: "RENEWAL", app_user_id: B.id, store: "APP_STORE", product_id: "com.getallur.app.base.monthly", entitlement_ids: ["base"], environment: "SANDBOX", expiration_at_ms: Date.now() + 30 * 864e5, event_timestamp_ms: Date.now() - 100000 } }, headers: { authorization: "rc-secret-123" } });
  r = await call("GET", "/me/subscription", { token: B.token });
  check("stale RENEWAL (older timestamp) does not resurrect an expired sub", r.json?.plan === "free", JSON.stringify(r.json).slice(0, 120));
  // unknown user id -> FK
  r = await call("POST", "/iap/webhook", { body: { event: { type: "INITIAL_PURCHASE", app_user_id: "$RCAnonymousID:abc", store: "APP_STORE", product_id: "p", entitlement_ids: ["base"], event_timestamp_ms: Date.now() } }, headers: { authorization: "rc-secret-123" } });
  check("iap/webhook with an anonymous/unknown app_user_id", r.status === 200, `status ${r.status} (500 = RevenueCat retries forever) ${JSON.stringify(r.json).slice(0, 60)}`);
  r = await call("POST", "/iap/webhook", { body: { event: { type: "TEST" } }, headers: { authorization: "rc-secret-123" } });
  check("iap/webhook TEST event -> 200", r.status === 200);
  r = await call("POST", "/iap/refresh", { token: B.token });
  check("iap/refresh without RevenueCat key -> clean error not 500", r.status !== 500, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
}

// ---------------------------------------------------------------- rate limiting
{
  const rs = [];
  for (let i = 0; i < 13; i++) rs.push((await call("POST", "/auth/login", { body: { identifier: `nobody-${u}`, password: "x" } })).status);
  check("auth rate limit: 13 rapid logins -> some 429", rs.includes(429), `statuses ${rs.join(",")}`);
}

resetRL();
// ---------------------------------------------------------------- squad / referral / points
const D = { email: `d-${u}@audit.test`, username: `d_${u}` };
resetRL();
{
  let r = await register(D.email, D.username);
  D.token = r.json.token; D.id = r.json.user?.id;
  r = await call("GET", "/squad/overview", { token: A.token });
  check("squad/overview 200 with invite code", r.status === 200 && typeof r.json.inviteCode === "string", `status ${r.status} keys ${Object.keys(r.json || {})}`);
  const codeA = r.json.inviteCode;
  r = await call("GET", "/squad/overview");
  check("squad/overview unauthenticated 401", r.status === 401, `status ${r.status}`);
  r = await call("POST", "/squad/invite/accept", { token: D.token, body: { code: codeA } });
  check("invite accept -> friendship", r.status === 200, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("POST", "/squad/invite/accept", { token: D.token, body: { code: codeA } });
  check("invite accept twice is idempotent (no 500)", r.status !== 500, `status ${r.status}`);
  r = await call("POST", "/squad/invite/accept", { token: A.token, body: { code: codeA } });
  check("accepting your own code is refused", r.status >= 400 && r.status < 500, `status ${r.status}`);
  r = await call("GET", "/squad/overview", { token: D.token });
  check("friend appears in overview", Array.isArray(r.json.friends) && r.json.friends.length === 1, `friends=${r.json.friends?.length}`);
  // points caps
  resetRL();
  const p = [];
  for (let i = 0; i < 4; i++) p.push((await call("POST", "/squad/points-event", { token: D.token, body: { type: "workout" } })).json);
  const awarded = p.filter((x) => x?.awarded !== false && x?.points > 0).length;
  check("workout Reps capped at 2/day", awarded <= 2, `awarded ${awarded}/4 ${JSON.stringify(p).slice(0, 160)}`);
  r = await call("POST", "/squad/points-event", { token: D.token, body: { type: "workout", day: "2020-01-01" } });
  check("points-event rejects a far-past day", r.status >= 400 || r.json?.awarded === false, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  const yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  r = await call("POST", "/squad/points-event", { token: D.token, body: { type: "workout", day: yday } });
  check("points-event for YESTERDAY accepted after today's cap (cap doubling)", r.status === 200 && r.json?.points > 0, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("POST", "/squad/points-event", { token: D.token, body: { type: "hack" } });
  check("points-event unknown type rejected", r.status >= 400, `status ${r.status}`);
  // quest race
  const qs = await Promise.all(Array.from({ length: 5 }, () => call("POST", "/squad/quest", { token: D.token, body: { key: "first_meal" } })));
  const questRows = Number(SQL(`select count(*) from points_events where user_id='${D.id}' and type='quest:first_meal'`));
  check("5 parallel quest claims award once", questRows === 1, `rows=${questRows} statuses=${qs.map((x) => x.status)}`);
  // respect + duel
  r = await call("POST", "/squad/respect", { token: D.token, body: { friendId: A.id } });
  check("respect a friend -> 200", r.status === 200, `status ${r.status}`);
  r = await call("POST", "/squad/duel", { token: D.token, body: { friendId: A.id } });
  check("duel as FREE user -> 403", r.status === 403, `status ${r.status} ${JSON.stringify(r.json).slice(0, 60)}`);
  r = await call("POST", "/squad/duel", { token: C.token, body: { friendId: A.id } });
  check("duel with a non-friend refused", r.status >= 400, `status ${r.status}`);
  r = await call("GET", "/squad/overview", { token: A.token });
  check("A has an unread 'respect' notification", (r.json.unreadCount ?? 0) >= 1, `unread=${r.json.unreadCount}`);
  r = await call("POST", "/squad/notifications/read", { token: A.token });
  r = await call("GET", "/squad/overview", { token: A.token });
  check("notifications marked read", r.json.unreadCount === 0, `unread=${r.json.unreadCount}`);
  // push
  r = await call("GET", "/squad/push/public-key");
  check("push public key endpoint answers (no VAPID configured)", r.status === 200, `status ${r.status} ${JSON.stringify(r.json).slice(0, 60)}`);
  r = await call("POST", "/squad/push/subscribe", { token: A.token, body: { endpoint: "http://insecure", keys: { p256dh: "a", auth: "b" } } });
  check("push subscribe rejects non-https endpoint", r.status >= 400, `status ${r.status}`);
  r = await call("POST", "/squad/push/subscribe", { token: A.token, body: { endpoint: "https://push.example/x", keys: { p256dh: "a", auth: "b" } } });
  check("push subscribe https -> 200", r.status === 200, `status ${r.status}`);
  r = await call("POST", "/squad/push/unsubscribe", { token: A.token, body: { endpoint: "https://push.example/x" } });
  check("push unsubscribe -> 200", r.status === 200, `status ${r.status}`);
}

// referral cascade
resetRL();
{
  // R1 refers R2; R2 refers R3. R2 "subscribes" via IAP (base). Expect: R1+R2 rewarded. Then check whether R3 gets rewarded off R2's grant.
  const mk = async (tag) => { const r = await register(`${tag}-${u}@audit.test`, `${tag}_${u}`); return { id: r.json.user.id, token: r.json.token }; };
  const R1 = await mk("r1"), R2 = await mk("r2"), R3 = await mk("r3");
  let r = await call("GET", "/referral/status", { token: R1.token });
  check("referral/status 200 with code", r.status === 200 && r.json.code, `status ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  const code1 = r.json.code;
  r = await call("POST", "/referral/claim", { token: R2.token, body: { code: code1 } });
  check("referral claim R2<-R1 -> 200", r.status === 200, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  const code2 = (await call("GET", "/referral/status", { token: R2.token })).json.code;
  r = await call("POST", "/referral/claim", { token: R3.token, body: { code: code2 } });
  r = await call("POST", "/referral/claim", { token: R1.token, body: { code: code2 } });
  check("referrer cannot be 'referred' by their own referee (loop)", r.status >= 400 || r.json?.claimed === false, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  // R2 buys Base
  await call("POST", "/iap/webhook", { body: { event: { type: "INITIAL_PURCHASE", app_user_id: R2.id, store: "APP_STORE", product_id: "com.getallur.app.base.monthly", entitlement_ids: ["base"], environment: "SANDBOX", expiration_at_ms: Date.now() + 30 * 864e5, event_timestamp_ms: Date.now() } }, headers: { authorization: "rc-secret-123" } });
  await call("GET", "/referral/status", { token: R2.token }); // settles
  const p1 = (await call("GET", "/me/credits", { token: R1.token })).json.plan;
  const p2 = (await call("GET", "/me/credits", { token: R2.token })).json.plan;
  check("R2 buys Base -> R1 (referrer) rewarded", p1 !== "free", `R1 plan=${p1}`);
  check("reward tier: R1 gets Premium for a Base purchase", null, `R1 plan=${p1}, R2 plan=${p2} (paid for base)`);
  await call("GET", "/referral/status", { token: R3.token }); // settle R3's row: referred=R3 (free) → should NOT reward
  await call("GET", "/referral/status", { token: R2.token });
  const p3 = (await call("GET", "/me/credits", { token: R3.token })).json.plan;
  const rewarded = SQL(`select referred_id, status from referrals where referrer_id='${R2.id}'`);
  check("R3 (never paid) not rewarded", p3 === "free", `R3 plan=${p3} row=${rewarded}`);
  // cascade: R3 referred by R2 — now R2 is premium (via grant). Does R2's grant count as R2 'starting a trial' for R1? already rewarded. Check chain: make R4 referred by R3, then give R3 a referral grant by having R3 refer someone who buys.
  const R4 = await mk("r4"), R5 = await mk("r5");
  const code3 = (await call("GET", "/referral/status", { token: R3.token })).json.code;
  await call("POST", "/referral/claim", { token: R4.token, body: { code: code3 } });
  const code4 = (await call("GET", "/referral/status", { token: R4.token })).json.code;
  await call("POST", "/referral/claim", { token: R5.token, body: { code: code4 } });
  // R5 buys base -> R4 and R5 rewarded (premium grants). Now R4 is premium via GRANT: does R3 get rewarded for R4 "starting a trial"?
  await call("POST", "/iap/webhook", { body: { event: { type: "INITIAL_PURCHASE", app_user_id: R5.id, store: "APP_STORE", product_id: "com.getallur.app.base.monthly", entitlement_ids: ["base"], environment: "SANDBOX", expiration_at_ms: Date.now() + 30 * 864e5, event_timestamp_ms: Date.now() } }, headers: { authorization: "rc-secret-123" } });
  await call("GET", "/referral/status", { token: R5.token });
  await call("GET", "/referral/status", { token: R4.token });
  await call("GET", "/referral/status", { token: R3.token });
  const p3b = (await call("GET", "/me/credits", { token: R3.token })).json.plan;
  check("referral cascade: R3 gets rewarded because R4 became premium via a GRANT (nobody R3 referred paid)", p3b === "free", `R3 plan=${p3b} — one purchase (R5) rewarded R4, R5 and then R3`);
}

resetRL();
// ---------------------------------------------------------------- cron
{
  let r = await call("GET", "/cron/daily-reminders");
  check("cron/daily-reminders without secret/UA -> 401", r.status === 401, `status ${r.status}`);
  r = await call("GET", "/cron/daily-reminders", { headers: { "user-agent": "vercel-cron/1.0" } });
  check("cron/daily-reminders with spoofed User-Agent (CRON_SECRET unset) -> runs", r.status === 200, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("GET", "/cron/weekly-recap", { headers: { "user-agent": "vercel-cron/1.0" } });
  const r2 = await call("GET", "/cron/weekly-recap", { headers: { "user-agent": "vercel-cron/1.0" } });
  check("cron/weekly-recap runs twice with spoofed UA (no dedup)", r.status === 200 && r2.status === 200, `statuses ${r.status},${r2.status}`);
}

resetRL();
// ---------------------------------------------------------------- stripe / support / cardio / admin
{
  let r = await call("GET", "/stripe/plan-prices");
  check("stripe/plan-prices without stripe tables -> not 500", r.status !== 500, `status ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  r = await call("POST", "/stripe/checkout", { token: A.token, body: { plan: "base", interval: "monthly" } });
  check("stripe/checkout without STRIPE key -> clean error not 500", r.status !== 500, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("POST", "/stripe/cancel", { token: A.token });
  check("stripe/cancel without STRIPE key -> clean error not 500", r.status !== 500, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("POST", "/support/bug-report", { body: { message: "it broke", email: "x@y.z", page: "/plan" } });
  check("support/bug-report without SMTP -> clean error not 500", r.status !== 500, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("POST", "/cardio/route-suggestions", { token: A.token, body: { lat: 40.72, lon: -74.04, type: "run", targetDistanceM: 5000 } });
  check("cardio/route-suggestions without ORS key -> 501", r.status === 501, `status ${r.status}`);
  r = await call("GET", "/admin/status", { token: A.token });
  check("admin/status normal user -> isAdmin false", r.status === 200 && r.json.isAdmin === false);
  r = await call("GET", "/admin/users", { token: A.token });
  check("admin/users normal user -> 403", r.status === 403, `status ${r.status}`);
  const ad = await register("admin@audit.test", `adm_${u}`);
  r = await call("GET", "/admin/users", { token: ad.json.token });
  check("ADMIN_EMAILS address registers straight into admin (no verification) and lists all users", r.status === 200 && Array.isArray(r.json.users ?? r.json) , `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("POST", "/auth/forgot-password", { body: { email: A.email } });
  check("forgot-password without SMTP -> 200 (never reveals) and no crash", r.status === 200, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  const tok = SQL(`select count(*) from password_reset_tokens where user_id='${A.id}'`);
  check("forgot-password created a reset token row", Number(tok) >= 1, `rows=${tok}`);
}

resetRL();
// ---------------------------------------------------------------- sessions: reset + delete
{
  // reset password does not revoke sessions
  SQL(`delete from password_reset_tokens where user_id='${A.id}'`);
  await call("POST", "/auth/forgot-password", { body: { email: A.email } });
  // we can't read the raw token (hashed) — instead test delete-account session survival
  let r = await call("GET", "/auth/user", { token: A.token2 });
  check("second session valid before delete", r.json.user?.id === A.id);
  r = await call("POST", "/auth/delete-account", { token: A.token });
  check("delete-account -> 200", r.status === 200, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  const userRow = SQL(`select count(*) from users where id='${A.id}'`);
  check("user row deleted", userRow === "0", `rows=${userRow}`);
  r = await call("GET", "/auth/user", { token: A.token2 });
  check("other sessions of a deleted user are dead", r.json.user === null, `auth/user with 2nd token -> ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("PUT", "/me/fitness-state", { token: A.token2, body: { state: { onboardingComplete: true } } });
  check("deleted user's other session cannot write (no 500)", r.status === 401, `status ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
  r = await call("POST", "/auth/logout", { token: B.token });
  check("logout -> 200", r.status === 200);
  r = await call("GET", "/auth/user", { token: B.token });
  check("token dead after logout", r.json.user === null);
}

// ---------------------------------------------------------------- summary
const fails = results.filter((x) => x.ok === false);
console.log(`\n== ${results.filter((x) => x.ok === true).length} pass, ${fails.length} fail, ${results.filter((x) => x.ok === null).length} info`);
