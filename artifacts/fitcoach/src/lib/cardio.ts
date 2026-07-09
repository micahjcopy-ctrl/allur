// ---------------------------------------------------------------------------
// ALLUR cardio/activity engine — pure logic, no React.
//
// Everything numerical lives here so it is unit-testable (bun test):
//   * GPS track accumulation (distance, moving time, speed, elevation,
//     uphill/downhill split) with accuracy + jitter filtering
//   * MET-based calorie estimation from type/pace/elevation/body weight
//   * The explicit macro adjustment (activity calories → daily targets)
//   * The CardioLoadSummary data contract handed to the AI coach/planner
//
// Route *suggestions* (scenic routing) are Phase 2 and live behind the
// RouteProvider interface at the bottom (OpenRouteService planned).
// ---------------------------------------------------------------------------

import type { MacroBreakdown } from "@/context/FitCoachContext";

// --- Types ------------------------------------------------------------------

export type ActivityType = "run" | "cycle" | "walk" | "hike";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run: "Run",
  cycle: "Ride",
  walk: "Walk",
  hike: "Hike",
};

export interface TrackPoint {
  /** ms since epoch */
  t: number;
  lat: number;
  lon: number;
  /** metres, if the device reports it */
  alt?: number;
  /** reported horizontal accuracy in metres (used for filtering, not persisted) */
  acc?: number;
}

export interface CardioActivity {
  id: string;
  type: ActivityType;
  startedAt: string; // ISO
  finishedAt: string; // ISO
  source: "gps" | "manual";
  distanceM: number;
  /** wall-clock seconds between start and finish (pauses included) */
  elapsedSec: number;
  /** seconds actually moving */
  movingSec: number;
  avgSpeedMps: number;
  maxSpeedMps: number;
  elevGainM: number;
  elevLossM: number;
  uphillDistM: number;
  downhillDistM: number;
  calories: number;
  /** downsampled trace for the route sketch; empty for manual entries */
  points: TrackPoint[];
}

// --- Geo math ----------------------------------------------------------------

const R_EARTH = 6371000;

export function haversineM(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Filtering thresholds — tuned for battery-reasonable phone GPS.
export const GPS_MAX_ACCURACY_M = 35; // drop fixes worse than this
export const GPS_MIN_STEP_M = 3; // ignore sub-jitter movement
export const MOVING_SPEED_MPS = 0.5; // below this we're "paused"
export const ELEV_NOISE_M = 1.5; // altitude changes under this are noise

export interface TrackStats {
  distanceM: number;
  movingSec: number;
  elapsedSec: number;
  avgSpeedMps: number;
  maxSpeedMps: number;
  elevGainM: number;
  elevLossM: number;
  uphillDistM: number;
  downhillDistM: number;
}

/**
 * Fold a raw GPS track into session stats. Pure — feed it the same points,
 * get the same stats. Applies accuracy filtering, jitter suppression,
 * moving-time detection and elevation smoothing.
 */
export function computeTrackStats(points: TrackPoint[]): TrackStats {
  const pts = points.filter((p) => p.acc == null || p.acc <= GPS_MAX_ACCURACY_M);
  const zero: TrackStats = {
    distanceM: 0,
    movingSec: 0,
    elapsedSec: pts.length >= 2 ? (pts[pts.length - 1].t - pts[0].t) / 1000 : 0,
    avgSpeedMps: 0,
    maxSpeedMps: 0,
    elevGainM: 0,
    elevLossM: 0,
    uphillDistM: 0,
    downhillDistM: 0,
  };
  if (pts.length < 2) return zero;

  let dist = 0;
  let movingMs = 0;
  let maxSpeed = 0;
  let gain = 0;
  let loss = 0;
  let up = 0;
  let down = 0;
  let lastAlt = pts[0].alt ?? null;
  let prev = pts[0];

  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i];
    const step = haversineM(prev, cur);
    const dtMs = cur.t - prev.t;
    if (step < GPS_MIN_STEP_M && dtMs < 60000) continue; // jitter — wait for real movement
    const speed = dtMs > 0 ? step / (dtMs / 1000) : 0;
    if (speed > 30) { prev = cur; continue; } // teleport/glitch guard (>108 km/h)

    dist += step;
    if (speed >= MOVING_SPEED_MPS) {
      movingMs += dtMs;
      if (speed > maxSpeed) maxSpeed = speed;
    }
    if (cur.alt != null && lastAlt != null) {
      const dAlt = cur.alt - lastAlt;
      if (Math.abs(dAlt) >= ELEV_NOISE_M) {
        if (dAlt > 0) {
          gain += dAlt;
          up += step;
        } else {
          loss += -dAlt;
          down += step;
        }
        lastAlt = cur.alt;
      }
    } else if (cur.alt != null) {
      lastAlt = cur.alt;
    }
    prev = cur;
  }

  const movingSec = movingMs / 1000;
  return {
    distanceM: dist,
    movingSec,
    elapsedSec: (pts[pts.length - 1].t - pts[0].t) / 1000,
    avgSpeedMps: movingSec > 0 ? dist / movingSec : 0,
    maxSpeedMps: maxSpeed,
    elevGainM: gain,
    elevLossM: loss,
    uphillDistM: up,
    downhillDistM: down,
  };
}

// --- Calories ----------------------------------------------------------------

/**
 * MET for an activity at a given speed (m/s). Piecewise tables condensed from
 * the Compendium of Physical Activities; intentionally simple + monotonic.
 */
export function metFor(type: ActivityType, speedMps: number): number {
  const kmh = speedMps * 3.6;
  switch (type) {
    case "run":
      if (kmh < 6.5) return 6;
      if (kmh < 8) return 8.3;
      if (kmh < 9.7) return 9.8;
      if (kmh < 11.3) return 11;
      if (kmh < 12.9) return 11.8;
      return 12.8;
    case "cycle":
      if (kmh < 16) return 4;
      if (kmh < 19) return 6.8;
      if (kmh < 22.5) return 8;
      if (kmh < 25.7) return 10;
      return 12;
    case "walk":
      if (kmh < 3.2) return 2.8;
      if (kmh < 4.8) return 3.5;
      if (kmh < 5.6) return 4.3;
      return 5;
    case "hike":
      return 6; // grade handled by the elevation bonus below
  }
}

/**
 * Estimated energy burned for a session. Explicit and testable:
 *   base  = MET × weightKg × movingHours
 *   climb = elevGainM × weightKg × 0.00477 kcal (vertical work at ~24% efficiency)
 * Manual entries (no elevation) simply get the base term.
 */
export function estimateCalories(args: {
  type: ActivityType;
  movingSec: number;
  distanceM: number;
  elevGainM: number;
  weightKg: number;
}): number {
  const { type, movingSec, distanceM, elevGainM, weightKg } = args;
  if (movingSec <= 0 || weightKg <= 0) return 0;
  const avgSpeed = distanceM / movingSec;
  const met = metFor(type, avgSpeed);
  const base = met * weightKg * (movingSec / 3600);
  const climb = elevGainM > 0 ? elevGainM * weightKg * 0.00477 : 0;
  return Math.round(base + climb);
}

export function lbsToKg(lbs: number): number {
  return lbs * 0.45359237;
}

// --- Macro integration --------------------------------------------------------

/**
 * The explicit "activity calories → daily targets" rule.
 * Protein stays fixed (it is body-mass driven, not output driven); the earned
 * calories are refilled 60% carbs / 40% fat — carbs to restock glycogen spent
 * doing cardio, fat for the remainder. Returns a NEW breakdown.
 */
export function applyActivityCalories(
  target: MacroBreakdown,
  activityCalories: number,
): MacroBreakdown {
  if (!activityCalories || activityCalories <= 0) return { ...target };
  const carbsKcal = activityCalories * 0.6;
  const fatKcal = activityCalories * 0.4;
  return {
    ...target,
    calories: Math.round(target.calories + activityCalories),
    carbs: Math.round(target.carbs + carbsKcal / 4),
    fat: Math.round(target.fat + fatKcal / 9),
    protein: target.protein,
  };
}

/** Sum of calories from activities finished on the given local calendar day. */
export function activityCaloriesOn(activities: CardioActivity[], day: Date): number {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();
  return activities.reduce((sum, a) => {
    const f = new Date(a.finishedAt);
    return f.getFullYear() === y && f.getMonth() === m && f.getDate() === d
      ? sum + (a.calories || 0)
      : sum;
  }, 0);
}

// --- AI coach data contract ----------------------------------------------------

/**
 * CardioLoadSummary — the typed contract handed to the AI coach / program
 * builder so training adjusts for cardio-induced fatigue. Relative effort is
 * a TRIMP-style score: moving minutes × MET-derived intensity factor, plus an
 * elevation kicker; ~60 ≈ an easy 45-min walk, ~300+ ≈ a hard long run.
 */
export interface CardioLoadSummary {
  days: number;
  sessions: number;
  totalMovingMin: number;
  totalKm: number;
  totalElevGainM: number;
  relativeEffort: number;
  byType: Partial<Record<ActivityType, number>>;
  lastActivityAt: string | null;
}

export function buildCardioLoadSummary(
  activities: CardioActivity[],
  now: Date,
  days = 7,
): CardioLoadSummary {
  const cutoff = now.getTime() - days * 86400000;
  const recent = activities.filter((a) => new Date(a.finishedAt).getTime() >= cutoff);
  let movingMin = 0;
  let km = 0;
  let elev = 0;
  let effort = 0;
  const byType: Partial<Record<ActivityType, number>> = {};
  let last: string | null = null;
  for (const a of recent) {
    const min = a.movingSec / 60;
    movingMin += min;
    km += a.distanceM / 1000;
    elev += a.elevGainM;
    const met = metFor(a.type, a.movingSec > 0 ? a.distanceM / a.movingSec : 0);
    effort += min * (met / 6) + a.elevGainM / 20;
    byType[a.type] = (byType[a.type] ?? 0) + 1;
    if (!last || a.finishedAt > last) last = a.finishedAt;
  }
  return {
    days,
    sessions: recent.length,
    totalMovingMin: Math.round(movingMin),
    totalKm: Math.round(km * 10) / 10,
    totalElevGainM: Math.round(elev),
    relativeEffort: Math.round(effort),
    byType,
    lastActivityAt: last,
  };
}

/** One-line rendering of the contract for coach prompts. */
export function describeCardioLoad(s: CardioLoadSummary): string {
  if (s.sessions === 0) return "No cardio sessions in the last 7 days.";
  const types = Object.entries(s.byType)
    .map(([t, n]) => `${n} ${ACTIVITY_LABELS[t as ActivityType].toLowerCase()}${n === 1 ? "" : "s"}`)
    .join(", ");
  return `Cardio last ${s.days} days: ${types} — ${s.totalMovingMin} min moving, ${s.totalKm} km, ${s.totalElevGainM} m climbed, relative effort ${s.relativeEffort}${s.relativeEffort >= 250 ? " (high — consider extra recovery)" : ""}.`;
}

// --- Persistence hygiene --------------------------------------------------------

const MAX_PERSISTED_POINTS = 160;

/** Downsample a track for storage; keeps first/last, uniform stride between. */
export function slimTrack(points: TrackPoint[]): TrackPoint[] {
  if (points.length <= MAX_PERSISTED_POINTS) {
    return points.map(({ t, lat, lon, alt }) => ({ t, lat, lon, alt }));
  }
  const stride = (points.length - 1) / (MAX_PERSISTED_POINTS - 1);
  const out: TrackPoint[] = [];
  for (let i = 0; i < MAX_PERSISTED_POINTS; i++) {
    const { t, lat, lon, alt } = points[Math.round(i * stride)];
    out.push({ t, lat, lon, alt });
  }
  return out;
}

export function slimCardioForPersist(activities: CardioActivity[]): CardioActivity[] {
  return activities.map((a) => ({ ...a, points: slimTrack(a.points) }));
}

// --- Units ----------------------------------------------------------------------

export type UnitSystem = "imperial" | "metric";

export function fmtDistance(m: number, units: UnitSystem): string {
  return units === "imperial"
    ? `${(m / 1609.344).toFixed(2)} mi`
    : `${(m / 1000).toFixed(2)} km`;
}

export function fmtElevation(m: number, units: UnitSystem): string {
  return units === "imperial" ? `${Math.round(m * 3.28084)} ft` : `${Math.round(m)} m`;
}

export function fmtSpeed(mps: number, units: UnitSystem): string {
  return units === "imperial"
    ? `${(mps * 2.236936).toFixed(1)} mph`
    : `${(mps * 3.6).toFixed(1)} km/h`;
}

/** Pace (time per unit distance) — the runner's view of speed. */
export function fmtPace(mps: number, units: UnitSystem): string {
  if (mps <= 0.1) return "--:--";
  const secPerUnit = (units === "imperial" ? 1609.344 : 1000) / mps;
  const mm = Math.floor(secPerUnit / 60);
  const ss = Math.round(secPerUnit % 60);
  return `${mm}:${String(ss).padStart(2, "0")} /${units === "imperial" ? "mi" : "km"}`;
}

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

// --- Phase 2: scenic route suggestions (provider interface) ----------------------

/**
 * Scenic route suggestions are provider-backed (planned: OpenRouteService —
 * free key, green/quiet routing preference for foot profiles, elevation
 * included; swap-in Mapbox later if map polish matters). Anything that
 * implements this interface can power the "suggest a route" UI.
 */
export interface RouteSuggestion {
  name: string;
  distanceM: number;
  elevGainM: number;
  polyline: { lat: number; lon: number }[];
  scenicScore: number; // 0-1, provider-defined (parks/trails/water density)
}

export interface RouteProvider {
  suggestRoutes(args: {
    start: { lat: number; lon: number };
    type: ActivityType;
    targetDistanceM?: number;
  }): Promise<RouteSuggestion[]>;
}
