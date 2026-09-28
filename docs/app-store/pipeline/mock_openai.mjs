// Minimal OpenAI-compatible mock for auditing the ALLUR API server offline.
// Records every call (model, tools, forced tool, sizes) to /calls for assertions.
// Set header "x-mock-fail: 1" on the API request? No — the API doesn't forward
// headers, so failure mode is toggled via POST /mock/fail {fail:true|false}.
import http from "node:http";
const PORT = Number(process.argv[2] || 5051);
let fail = false;
const calls = [];

const plan = (title) => [
  { dayName: "Monday", title: title || "Full Body — Squat Focus", exercises: [{ name: "Back Squat", sets: 3, reps: "6-8", rest: "2m" }, { name: "Bench Press", sets: 3, reps: "8-10", rest: "90s" }] },
  { dayName: "Wednesday", title: "Full Body — Press Focus", exercises: [{ name: "Overhead Press", sets: 3, reps: "6-8", rest: "90s" }] },
  { dayName: "Friday", title: "Full Body — Hinge & Pull Focus", exercises: [{ name: "Deadlift", sets: 3, reps: "5", rest: "2m" }] },
];

function toolReply(name) {
  switch (name) {
    case "update_training_plan":
      return { message: "Done — swapped in the change you asked for.", summary: "Swapped bench for incline", days: plan("Full Body — Squat Focus (mock updated)") };
    case "rebalance_training_plan":
      return { summary: "More back volume", explanation: "Your scan showed back lagging, so I added a row.", changes: ["Added Seated Row on Wednesday"], days: plan("Full Body — Squat Focus (rebalanced)") };
    case "report_body_fat_analysis":
      return { bodyFatLow: 18, bodyFatHigh: 22, confidence: "medium", markers: ["soft midsection", "no ab definition", "shoulder shape visible"], limitations: "Single front photo, indoor lighting.", suggestedDirection: "Modest deficit with 3x/week lifting.", summary: "You look to be around 18–22% body fat. Keep lifting, tighten nutrition.", scores: { abdominalDefinition: 2, waistLeanness: 3, muscleDefinition: 2, fatDistribution: 3, imageQuality: 4 }, parts: [{ part: "Shoulders", rating: 45, note: "Some cap" }, { part: "Chest", rating: 40, note: "Flat" }, { part: "Back", rating: 35, note: "Not visible" }, { part: "Arms", rating: 42, note: "Average" }, { part: "Core", rating: 30, note: "Soft" }, { part: "Legs", rating: 50, note: "Decent quads" }] };
    case "report_meal_analysis":
      return { isFood: true, name: "Burger & eggs", foods: [
        { detectedName: "wagyu beef patty", category: "protein", alternatives: ["80/20 ground beef"], confidence: 0.8, portionBasis: "8 oz stated → 227 g", grams: 227, portionConfidence: 0.7, cookingMethod: "grilled", skinOn: false, breaded: false, estCalories: 650, estProtein: 40, estCarbs: 0, estFat: 55 },
        { detectedName: "burger bun", category: "carb", alternatives: [], confidence: 0.9, portionBasis: "1 bun ~55 g", grams: 55, portionConfidence: 0.8, cookingMethod: "none", skinOn: false, breaded: false, estCalories: 150, estProtein: 5, estCarbs: 28, estFat: 2 },
        { detectedName: "eggs", category: "protein", alternatives: [], confidence: 0.9, portionBasis: "3 large × 50 g", grams: 150, portionConfidence: 0.8, cookingMethod: "fried", skinOn: false, breaded: false, estCalories: 240, estProtein: 19, estCarbs: 1, estFat: 17 },
      ], hiddenCalorieRisks: ["butter on the bun"], clarificationQuestions: [] };
    case "report_weight_reading":
      return { readable: true, weight: 100, unit: "kg", equipment: "barbell", confidence: "high", note: "" };
    default:
      return {};
  }
}

const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };

http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/mock/fail") { fail = JSON.parse(raw || "{}").fail === true; return json(res, 200, { fail }); }
    if (url.pathname === "/calls") { const out = calls.splice(0); return json(res, 200, out); }
    if (fail) { calls.push({ path: url.pathname, failed: true }); return json(res, 500, { error: { message: "mock failure" } }); }
    if (url.pathname === "/v1/chat/completions") {
      const body = JSON.parse(raw || "{}");
      const forced = body.tool_choice && typeof body.tool_choice === "object" ? body.tool_choice.function?.name : null;
      const toolNames = (body.tools || []).map((t) => t.function?.name);
      const msgs = body.messages || [];
      const lastUser = [...msgs].reverse().find((m) => m.role === "user");
      const lastText = typeof lastUser?.content === "string" ? lastUser.content : JSON.stringify(lastUser?.content || "");
      const imgCount = msgs.reduce((n, m) => n + (Array.isArray(m.content) ? m.content.filter((p) => p.type === "image_url").length : 0), 0);
      calls.push({ path: url.pathname, model: body.model, forced, toolNames, messages: msgs.length, imgCount, sysLen: (msgs[0]?.content || "").length, bytes: raw.length, modalities: body.modalities || null });
      let message;
      if (body.modalities?.includes("audio")) {
        message = { role: "assistant", content: null, audio: { id: "a1", data: Buffer.from("ID3mockmp3").toString("base64"), transcript: lastText, expires_at: 0 } };
      } else if (forced) {
        message = { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: forced, arguments: JSON.stringify(toolReply(forced)) } }] };
      } else if (toolNames.includes("update_training_plan") && /swap|change|replace|update my plan/i.test(lastText)) {
        message = { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "update_training_plan", arguments: JSON.stringify(toolReply("update_training_plan")) } }] };
      } else {
        message = { role: "assistant", content: `Mock coach reply to: ${lastText.slice(0, 60)}` };
      }
      return json(res, 200, { id: "chatcmpl-mock", object: "chat.completion", created: 0, model: body.model, choices: [{ index: 0, message, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } });
    }
    if (url.pathname === "/v1/audio/transcriptions") { calls.push({ path: url.pathname, bytes: raw.length }); return json(res, 200, { text: "swap bench press for incline dumbbell press" }); }
    if (url.pathname === "/v1/images/edits" || url.pathname === "/v1/images/generations") { calls.push({ path: url.pathname, bytes: raw.length }); return json(res, 200, { created: 0, data: [{ b64_json: Buffer.from("\x89PNGmock").toString("base64") }] }); }
    calls.push({ path: url.pathname, unknown: true });
    json(res, 404, { error: { message: "mock: unknown " + url.pathname } });
  });
}).listen(PORT, () => console.log("mock openai on", PORT));
