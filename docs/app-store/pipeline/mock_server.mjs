// Serves the built ALLUR web app with a tiny mock API so the admin demo mode
// can be rendered offline for App Store screenshots. Nothing here talks to
// production.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 4173);
const STATE = process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4], "utf8")) : null;
const periodEnd = new Date(Date.now() + 19 * 864e5).toISOString();
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".map": "application/json" };

const now = new Date();
const user = { id: "demo-owner", email: "owner@example.com", username: "owner", firstName: "Demo", lastName: "Owner", profileImageUrl: null };
const api = {
  "GET /api/auth/user": { user },
  "GET /api/admin/status": { isAdmin: !STATE, isOwner: !STATE },
  "GET /api/me/fitness-state": { state: STATE },
  "PUT /api/me/fitness-state": { success: true, updatedAt: now.toISOString() },
  "GET /api/me/subscription": STATE ? { plan: "base", status: "active", trialEnd: null, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false, hasEverSubscribed: true } : { plan: "premium", status: "active", trialEnd: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, hasEverSubscribed: true },
  "GET /api/me/credits": { plan: STATE ? "base" : "premium", credits: { coaching: 42, photo: 27, bodyScan: 3 }, periodStart: new Date(now.getTime() - 5 * 864e5).toISOString() },
  "GET /api/squad/overview": { plan: "premium", inviteCode: "ALLUR-DEMO", reps: { week: 340 }, momentum: { weeks: 4, state: "active", currentWeekReps: 340 }, soloChallenge: null, friends: [], duels: [], notifications: [], unreadCount: 0, quests: ["tour_complete","first_meal","first_workout","first_scan","first_friend"] },
  "GET /api/healthz": { ok: true },
};

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const key = `${req.method} ${url.pathname}`;
  if (url.pathname.startsWith("/api/")) {
    const body = api[key];
    res.writeHead(body ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body ?? { error: "mock: not found" }));
    return;
  }
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");
  const ext = path.extname(file);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log("mock on", PORT));
