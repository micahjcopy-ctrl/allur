// ---------------------------------------------------------------------------
// Streak engine — pure, deterministic logic over the data the app already logs.
//
// Four everyday actions keep the fire alive and earn "streak points":
//   • a finished workout session      (workoutSessions[].finishedAt)
//   • a logged cardio session         (cardioActivities[].startedAt)
//   • a logged meal                   (meals[].date)
//   • a weekly body-composition scan  (physiqueAnalyses[].date)
//
// Two linked mechanics fall out of that:
//   • LEVEL   — cumulative streak points. Permanent, monotonic, never resets.
//               The blue bar fills toward the next level.
//   • MOMENTUM— a live multiplier that grows the longer the current 🔥 streak
//               runs. It scales the points each active day is worth AND lifts
//               the Allur Score's Potential. Miss a day and the streak (and so
//               the momentum) collapses to baseline — the level is untouched;
//               you simply rebuild the momentum.
//
// Everything here is derived from stored data (like the existing workoutStreak
// memo) — no server call, offline-safe, and unit-tested. "now" is injectable
// so the tests are deterministic.
// ---------------------------------------------------------------------------

/** Minimal structural shapes — the real context types satisfy these. */
export interface StreakInputs {
  meals: { date: string }[];
  workoutSessions: { finishedAt: string | null }[];
  cardioActivities: { startedAt: string }[];
  physiqueAnalyses: { date: string }[];
  now?: Date;
}

export type StreakSourceKey = "workout" | "cardio" | "meal" | "scan";

export interface StreakSourceToday {
  key: StreakSourceKey;
  label: string;
  count: number; // how many logged today
  cap: number; // how many count toward points per day
  per: number; // points per counted unit
  points: number; // base points earned today from this source
  capped: boolean; // true if today's count hit the cap
}

export interface StreakDay {
  day: string; // YYYY-MM-DD (local)
  active: boolean;
  points: number; // momentum-adjusted points earned that day
}

export interface StreakState {
  currentStreak: number; // consecutive active days (held through today-not-yet-logged)
  longestStreak: number;
  activeToday: boolean;

  momentum: number; // live multiplier, 1.0 .. MOMENTUM_MAX
  momentumPct: number; // 0..100 progress toward the momentum cap (for a meter)

  lifetimePoints: number; // cumulative, momentum-weighted — drives the level
  level: number;
  tier: string;

  levelStart: number; // lifetime points at the start of the current level
  nextLevelPoints: number; // lifetime points needed to reach the next level
  levelSpan: number; // points between this level and the next
  pointsIntoLevel: number;
  pointsToNext: number;
  progressPct: number; // 0..100 fill of the blue bar within the current level

  todayPoints: number; // momentum-adjusted points earned today
  todaySources: StreakSourceToday[];
  recentDays: StreakDay[]; // last 14 calendar days incl. today, oldest → newest
}

// --- tunable config --------------------------------------------------------

/** Points per counted unit + how many of each count toward points per day. */
export const SOURCE_CONFIG: Record<
  StreakSourceKey,
  { label: string; per: number; cap: number }
> = {
  scan: { label: "Body scan", per: 40, cap: 1 },
  workout: { label: "Workout", per: 30, cap: 1 },
  cardio: { label: "Cardio", per: 20, cap: 2 },
  meal: { label: "Meal", per: 10, cap: 3 },
};

export const MOMENTUM_MAX = 2.0;
const MOMENTUM_PER_DAY = 0.05; // +0.05× for each day PAST the first …
const MOMENTUM_CAP_DAYS = 20; // … until 2.0× at a 21-day streak

// --- date helpers ----------------------------------------------------------

/** Local YYYY-MM-DD for a Date. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

/** Parse a stored date string as a LOCAL day (avoids a UTC off-by-one for
 *  bare YYYY-MM-DD values, which Date parses as UTC midnight). */
function parseLocal(value: string): Date | null {
  if (!value) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(value + "T00:00:00")
    : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(key: string, delta: number): string {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

// --- level + momentum curves ----------------------------------------------

/** Cost, in lifetime points, to advance FROM "level" to "level + 1". */
export function levelCost(level: number): number {
  return 100 + Math.max(0, level - 1) * 50;
}

/** Cumulative lifetime points required to have REACHED "level" (level 1 = 0). */
export function levelThreshold(level: number): number {
  let total = 0;
  for (let k = 1; k < level; k++) total += levelCost(k);
  return total;
}

export function levelForPoints(points: number): number {
  let level = 1;
  while (points >= levelThreshold(level + 1)) level++;
  return level;
}

export function tierForLevel(level: number): string {
  if (level <= 2) return "Ember";
  if (level <= 4) return "Kindling";
  if (level <= 7) return "Blaze";
  if (level <= 11) return "Wildfire";
  if (level <= 16) return "Inferno";
  return "Supernova";
}

export function momentumForStreak(streak: number): number {
  if (streak <= 1) return 1;
  const extra = Math.min(streak - 1, MOMENTUM_CAP_DAYS);
  const m = 1 + extra * MOMENTUM_PER_DAY;
  return Math.round(Math.min(MOMENTUM_MAX, m) * 100) / 100;
}

// --- main ------------------------------------------------------------------

export function computeStreak(inputs: StreakInputs): StreakState {
  const now = inputs.now ?? new Date();
  const todayKey = dayKey(now);

  // 1. Tally per-source counts per local day.
  type Counts = { workout: number; cardio: number; meal: number; scan: number };
  const byDay = new Map<string, Counts>();
  const bump = (value: string | null, key: StreakSourceKey) => {
    if (!value) return;
    const d = parseLocal(value);
    if (!d) return;
    const k = dayKey(d);
    const c = byDay.get(k) ?? { workout: 0, cardio: 0, meal: 0, scan: 0 };
    c[key] += 1;
    byDay.set(k, c);
  };
  for (const s of inputs.workoutSessions) bump(s.finishedAt, "workout");
  for (const c of inputs.cardioActivities) bump(c.startedAt, "cardio");
  for (const m of inputs.meals) bump(m.date, "meal");
  for (const p of inputs.physiqueAnalyses) bump(p.date, "scan");

  const basePointsFor = (c: Counts): number =>
    Math.min(c.workout, SOURCE_CONFIG.workout.cap) * SOURCE_CONFIG.workout.per +
    Math.min(c.cardio, SOURCE_CONFIG.cardio.cap) * SOURCE_CONFIG.cardio.per +
    Math.min(c.meal, SOURCE_CONFIG.meal.cap) * SOURCE_CONFIG.meal.per +
    Math.min(c.scan, SOURCE_CONFIG.scan.cap) * SOURCE_CONFIG.scan.per;

  // 2. Chronological active days (any qualifying action).
  const activeDays = [...byDay.keys()].sort();

  // 3. Walk forward, tracking the running streak length at each active day,
  //    and accumulate momentum-weighted lifetime points.
  let lifetimePoints = 0;
  let longestStreak = 0;
  let prevKey: string | null = null;
  let run = 0;
  const streakAtDay = new Map<string, number>();
  for (const key of activeDays) {
    run = prevKey && addDays(prevKey, 1) === key ? run + 1 : 1;
    streakAtDay.set(key, run);
    if (run > longestStreak) longestStreak = run;
    const base = basePointsFor(byDay.get(key)!);
    lifetimePoints += Math.round(base * momentumForStreak(run));
    prevKey = key;
  }

  // 4. Current streak — the run ending today, or held from yesterday if today
  //    isn't logged yet. A fully missed day drops it to 0.
  const yesterdayKey = addDays(todayKey, -1);
  const activeToday = byDay.has(todayKey);
  let currentStreak = 0;
  if (activeToday) currentStreak = streakAtDay.get(todayKey)!;
  else if (byDay.has(yesterdayKey)) currentStreak = streakAtDay.get(yesterdayKey)!;

  const momentum = momentumForStreak(currentStreak);
  const momentumPct = Math.round(
    (Math.min(Math.max(currentStreak - 1, 0), MOMENTUM_CAP_DAYS) /
      MOMENTUM_CAP_DAYS) *
      100,
  );

  // 5. Level + blue-bar progress.
  const level = levelForPoints(lifetimePoints);
  const levelStart = levelThreshold(level);
  const nextLevelPoints = levelThreshold(level + 1);
  const levelSpan = nextLevelPoints - levelStart;
  const pointsIntoLevel = lifetimePoints - levelStart;
  const pointsToNext = Math.max(0, nextLevelPoints - lifetimePoints);
  const progressPct =
    levelSpan > 0
      ? Math.min(100, Math.round((pointsIntoLevel / levelSpan) * 100))
      : 0;

  // 6. Today's per-source breakdown.
  const todayCounts = byDay.get(todayKey) ?? {
    workout: 0,
    cardio: 0,
    meal: 0,
    scan: 0,
  };
  const order: StreakSourceKey[] = ["workout", "cardio", "meal", "scan"];
  const todaySources: StreakSourceToday[] = order.map((key) => {
    const cfg = SOURCE_CONFIG[key];
    const count = todayCounts[key];
    const counted = Math.min(count, cfg.cap);
    return {
      key,
      label: cfg.label,
      count,
      cap: cfg.cap,
      per: cfg.per,
      points: counted * cfg.per,
      capped: count >= cfg.cap,
    };
  });
  const todayBase = basePointsFor(todayCounts);
  const todayPoints = Math.round(todayBase * momentum);

  // 7. Last 14 calendar days for the mini-calendar, oldest → newest.
  const recentDays: StreakDay[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = addDays(todayKey, -i);
    const counts = byDay.get(key);
    recentDays.push({
      day: key,
      active: !!counts,
      points: counts
        ? Math.round(basePointsFor(counts) * momentumForStreak(streakAtDay.get(key) ?? 0))
        : 0,
    });
  }

  return {
    currentStreak,
    longestStreak,
    activeToday,
    momentum,
    momentumPct,
    lifetimePoints,
    level,
    tier: tierForLevel(level),
    levelStart,
    nextLevelPoints,
    levelSpan,
    pointsIntoLevel,
    pointsToNext,
    progressPct,
    todayPoints,
    todaySources,
    recentDays,
  };
}
