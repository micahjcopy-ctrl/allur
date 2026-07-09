import { useEffect, useMemo, useRef, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFitCoach } from "@/context/FitCoachContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_LABELS,
  activityCaloriesOn,
  computeTrackStats,
  estimateCalories,
  fmtDistance,
  fmtDuration,
  fmtElevation,
  fmtPace,
  fmtSpeed,
  lbsToKg,
  slimTrack,
  type ActivityType,
  type CardioActivity,
  type TrackPoint,
  type UnitSystem,
} from "@/lib/cardio";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  EyeOff,
  Flame,
  Footprints,
  MapPin,
  MapPinOff,
  Mountain,
  Pause,
  Play,
  Plus,
  Square,
  Timer,
  Trash2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// /cardio — GPS activity tracking (Strava-style, phase 1: no external maps).
// Live session metrics come straight from watchPosition; all math lives in
// @/lib/cardio so it is unit-tested. Finished sessions persist through the
// fitness-state blob and feed the macro targets + AI coach automatically via
// FitCoachContext.
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<ActivityType, typeof Activity> = {
  run: Footprints,
  cycle: Bike,
  walk: Footprints,
  hike: Mountain,
};

const UNITS_KEY = "allur-cardio-units";

type Phase = "idle" | "tracking" | "paused";

function useUnits(): [UnitSystem, (u: UnitSystem) => void] {
  const [units, setUnits] = useState<UnitSystem>(() => {
    try {
      return localStorage.getItem(UNITS_KEY) === "metric" ? "metric" : "imperial";
    } catch {
      return "imperial";
    }
  });
  return [
    units,
    (u) => {
      setUnits(u);
      try {
        localStorage.setItem(UNITS_KEY, u);
      } catch { /* private mode */ }
    },
  ];
}

/** Minimal dependency-free sketch of the recorded route. */
function RouteTrace({ points, className }: { points: TrackPoint[]; className?: string }) {
  const d = useMemo(() => {
    if (points.length < 2) return null;
    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    const minLa = Math.min(...lats), maxLa = Math.max(...lats);
    const minLo = Math.min(...lons), maxLo = Math.max(...lons);
    const spanLa = Math.max(maxLa - minLa, 1e-5);
    const spanLo = Math.max(maxLo - minLo, 1e-5);
    // keep aspect ratio: fit into 100x100 with padding
    const s = 88 / Math.max(spanLa, spanLo);
    return points
      .map((p, i) => {
        const x = 6 + (p.lon - minLo) * s + (88 - spanLo * s) / 2;
        const y = 6 + (maxLa - p.lat) * s + (88 - spanLa * s) / 2;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [points]);
  if (!d) return null;
  return (
    <svg viewBox="0 0 100 100" className={cn("w-full h-full", className)}>
      <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <circle cx={d.split(" ")[1]} cy={d.split(" ")[2]} r="2.5" fill="hsl(var(--primary))" opacity="0.5" />
    </svg>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function Cardio() {
  const {
    profile,
    featureToggles,
    setFeatureToggle,
    cardioActivities,
    addCardioActivity,
    removeCardioActivity,
  } = useFitCoach();
  const { toast } = useToast();
  const [units, setUnits] = useUnits();
  const [type, setType] = useState<ActivityType>("run");
  const [phase, setPhase] = useState<Phase>("idle");
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMin, setManualMin] = useState("30");
  const [manualDist, setManualDist] = useState("2.0");

  const watchIdRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedMsRef = useRef<number>(0);
  const pauseStartRef = useRef<number>(0);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const weightKg = useMemo(() => {
    const w = parseFloat(profile.weight);
    if (!Number.isFinite(w) || w <= 0) return 75;
    return profile.weightUnit === "lb" ? lbsToKg(w) : w;
  }, [profile.weight, profile.weightUnit]);

  // live clock while tracking
  useEffect(() => {
    if (phase === "idle") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const stopWatching = () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    void wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  };

  useEffect(() => () => stopWatching(), []);

  const beginWatch = () => {
    if (!("geolocation" in navigator)) {
      setGpsError("This device doesn't expose GPS to the app.");
      return false;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null);
        const { latitude, longitude, altitude, accuracy } = pos.coords;
        setPoints((prev) => [
          ...prev,
          { t: pos.timestamp || Date.now(), lat: latitude, lon: longitude, alt: altitude ?? undefined, acc: accuracy ?? undefined },
        ]);
      },
      (err) => {
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — you can still log the session manually below."
            : "GPS signal lost — keep moving, we'll re-acquire.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    // keep the screen awake during a session (best-effort)
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => { wakeLockRef.current = l; }).catch(() => {});
    return true;
  };

  const start = () => {
    setPoints([]);
    setGpsError(null);
    startedAtRef.current = Date.now();
    pausedMsRef.current = 0;
    if (beginWatch()) setPhase("tracking");
  };

  const pause = () => {
    stopWatching();
    pauseStartRef.current = Date.now();
    setPhase("paused");
  };

  const resume = () => {
    pausedMsRef.current += Date.now() - pauseStartRef.current;
    if (beginWatch()) setPhase("tracking");
  };

  const liveStats = useMemo(() => computeTrackStats(points), [points]);
  const sessionSec = phase === "idle" ? 0 : Math.max(0, (now - startedAtRef.current - pausedMsRef.current) / 1000);
  const curSpeed = useMemo(() => {
    if (points.length < 2) return 0;
    const a = points[points.length - 2];
    const b = points[points.length - 1];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return 0;
    return Math.min(30, computeTrackStats([{ ...a, acc: 5 }, { ...b, acc: 5 }]).distanceM / dt);
  }, [points]);

  const finish = () => {
    stopWatching();
    const stats = computeTrackStats(points);
    const finishedAt = new Date().toISOString();
    const calories = estimateCalories({
      type,
      movingSec: stats.movingSec,
      distanceM: stats.distanceM,
      elevGainM: stats.elevGainM,
      weightKg,
    });
    const activity: CardioActivity = {
      id: `cardio-${Date.now()}`,
      type,
      startedAt: new Date(startedAtRef.current).toISOString(),
      finishedAt,
      source: "gps",
      distanceM: Math.round(stats.distanceM),
      elapsedSec: Math.round(sessionSec),
      movingSec: Math.round(stats.movingSec),
      avgSpeedMps: stats.avgSpeedMps,
      maxSpeedMps: stats.maxSpeedMps,
      elevGainM: Math.round(stats.elevGainM),
      elevLossM: Math.round(stats.elevLossM),
      uphillDistM: Math.round(stats.uphillDistM),
      downhillDistM: Math.round(stats.downhillDistM),
      calories,
      points: slimTrack(points),
    };
    setPhase("idle");
    setPoints([]);
    if (stats.distanceM < 30 && stats.movingSec < 60) {
      toast({ title: "Session too short to save", description: "Move a little further next time and we'll log it." });
      return;
    }
    addCardioActivity(activity);
    toast({
      title: `${ACTIVITY_LABELS[type]} saved — ${calories} kcal`,
      description: "Added to today's macro targets and your coach's recovery picture.",
    });
  };

  const saveManual = () => {
    const min = parseFloat(manualMin);
    const dist = parseFloat(manualDist);
    if (!Number.isFinite(min) || min <= 0) {
      toast({ variant: "destructive", title: "Enter the minutes you moved" });
      return;
    }
    const distanceM = Number.isFinite(dist) && dist > 0 ? dist * (units === "imperial" ? 1609.344 : 1000) : 0;
    const movingSec = min * 60;
    const finishedAt = new Date().toISOString();
    const calories = estimateCalories({ type, movingSec, distanceM, elevGainM: 0, weightKg });
    addCardioActivity({
      id: `cardio-${Date.now()}`,
      type,
      startedAt: new Date(Date.now() - movingSec * 1000).toISOString(),
      finishedAt,
      source: "manual",
      distanceM: Math.round(distanceM),
      elapsedSec: Math.round(movingSec),
      movingSec: Math.round(movingSec),
      avgSpeedMps: movingSec > 0 ? distanceM / movingSec : 0,
      maxSpeedMps: 0,
      elevGainM: 0,
      elevLossM: 0,
      uphillDistM: 0,
      downhillDistM: 0,
      calories,
      points: [],
    });
    setManualOpen(false);
    toast({ title: `${ACTIVITY_LABELS[type]} logged — ${calories} kcal`, description: "Added to today's macro targets." });
  };

  const todayKcal = activityCaloriesOn(cardioActivities, new Date());
  const history = useMemo(
    () => [...cardioActivities].sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1)),
    [cardioActivities],
  );

  // Direct visit while the module is toggled off → offer to re-enable.
  if (featureToggles.cardio === false) {
    return (
      <MobileLayout>
        <div className="p-6 flex-1 flex items-center justify-center">
          <Card className="border-border w-full">
            <CardContent className="p-8 text-center space-y-4">
              <Activity className="w-10 h-10 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-bold">Cardio is turned off</h2>
              <p className="text-sm text-muted-foreground">
                Your activity history is saved. Turn the module back on to keep tracking.
              </p>
              <Button className="w-full" onClick={() => setFeatureToggle("cardio", true)}>
                Turn on cardio tracking
              </Button>
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  // ---- live session screen ----
  if (phase !== "idle") {
    return (
      <MobileLayout showNav={false}>
        <div className="p-6 space-y-6 flex-1 flex flex-col">
          <header className="pt-2 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" /> {ACTIVITY_LABELS[type]}
            </h1>
            <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", phase === "tracking" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
              {phase === "tracking" ? "RECORDING" : "PAUSED"}
            </span>
          </header>

          <div className="text-center py-2">
            <p className="text-6xl font-bold tabular-nums tracking-tight">{fmtDuration(sessionSec)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {fmtDistance(liveStats.distanceM, units)} · moving {fmtDuration(liveStats.movingSec)}
            </p>
          </div>

          <Card className="border-border">
            <CardContent className="p-5 grid grid-cols-2 gap-x-4 gap-y-5">
              <Stat label={type === "cycle" ? "Speed" : "Pace"} value={type === "cycle" ? fmtSpeed(curSpeed, units) : fmtPace(liveStats.avgSpeedMps, units)} sub={type === "cycle" ? `avg ${fmtSpeed(liveStats.avgSpeedMps, units)}` : `now ${fmtSpeed(curSpeed, units)}`} />
              <Stat label="Distance" value={fmtDistance(liveStats.distanceM, units)} />
              <Stat label="Climb" value={`▲ ${fmtElevation(liveStats.elevGainM, units)}`} sub={`▼ ${fmtElevation(liveStats.elevLossM, units)}`} />
              <Stat label="Up / down" value={fmtDistance(liveStats.uphillDistM, units)} sub={`${fmtDistance(liveStats.downhillDistM, units)} down`} />
            </CardContent>
          </Card>

          <Card className="border-border flex-1 min-h-36">
            <CardContent className="p-3 h-full">
              {points.length > 1 ? (
                <RouteTrace points={points} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <MapPin className="w-6 h-6 animate-pulse" />
                  <p className="text-xs">Acquiring GPS…</p>
                </div>
              )}
            </CardContent>
          </Card>

          {gpsError && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <MapPinOff className="w-3.5 h-3.5 shrink-0" /> {gpsError}
            </p>
          )}

          <div className="flex gap-3 pb-2">
            {phase === "tracking" ? (
              <Button variant="secondary" className="flex-1 h-14 text-base" onClick={pause}>
                <Pause className="w-5 h-5 mr-2" /> Pause
              </Button>
            ) : (
              <Button variant="secondary" className="flex-1 h-14 text-base" onClick={resume}>
                <Play className="w-5 h-5 mr-2" /> Resume
              </Button>
            )}
            <Button className="flex-1 h-14 text-base" onClick={finish}>
              <Square className="w-5 h-5 mr-2" /> Finish
            </Button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // ---- idle: picker + history ----
  return (
    <MobileLayout>
      <div className="p-6 space-y-6 pb-24">
        <header className="pt-2 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="w-7 h-7 text-primary" /> Cardio
            </h1>
            <p className="text-muted-foreground">Track it — your macros and coach adjust</p>
          </div>
          <button
            className="text-xs font-medium text-muted-foreground border border-border rounded-full px-3 py-1.5"
            onClick={() => setUnits(units === "imperial" ? "metric" : "imperial")}
          >
            {units === "imperial" ? "mi / ft" : "km / m"}
          </button>
        </header>

        {todayKcal > 0 && (
          <Card className="border-border bg-hero-gradient">
            <CardContent className="p-4 flex items-center gap-3">
              <Flame className="w-6 h-6 text-primary shrink-0" />
              <div>
                <p className="font-semibold">{todayKcal} kcal earned today</p>
                <p className="text-xs text-muted-foreground">Already added to today's macro targets</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((t) => {
            const Icon = TYPE_ICONS[t];
            const active = t === type;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition-colors",
                  active ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground",
                )}
              >
                <Icon className="w-5 h-5" />
                {ACTIVITY_LABELS[t]}
              </button>
            );
          })}
        </div>

        <Button className="w-full h-14 text-base" onClick={start}>
          <Play className="w-5 h-5 mr-2" /> Start {ACTIVITY_LABELS[type].toLowerCase()}
        </Button>

        <button
          className="w-full text-center text-xs text-muted-foreground underline underline-offset-4"
          onClick={() => setManualOpen((v) => !v)}
        >
          No GPS? Log a session manually
        </button>

        {manualOpen && (
          <Card className="border-border">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  Minutes
                  <input
                    inputMode="decimal"
                    value={manualMin}
                    onChange={(e) => setManualMin(e.target.value)}
                    className="w-full h-11 rounded-lg border border-border bg-background px-3 text-base text-foreground"
                  />
                </label>
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  Distance ({units === "imperial" ? "mi" : "km"})
                  <input
                    inputMode="decimal"
                    value={manualDist}
                    onChange={(e) => setManualDist(e.target.value)}
                    className="w-full h-11 rounded-lg border border-border bg-background px-3 text-base text-foreground"
                  />
                </label>
              </div>
              <Button variant="secondary" className="w-full" onClick={saveManual}>
                <Plus className="w-4 h-4 mr-2" /> Save {ACTIVITY_LABELS[type].toLowerCase()}
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Timer className="w-4 h-4" /> History
          </h2>
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No sessions yet — your first one starts above.</p>
          )}
          {history.map((a) => {
            const Icon = TYPE_ICONS[a.type];
            return (
              <Card key={a.id} className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </span>
                      <div>
                        <p className="font-semibold leading-tight">{ACTIVITY_LABELS[a.type]}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {a.source === "manual" ? "manual" : "GPS"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-primary flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" /> {a.calories}
                      </span>
                      <button
                        aria-label="Delete activity"
                        className="text-muted-foreground/60 hover:text-destructive"
                        onClick={() => removeCardioActivity(a.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dist</p>
                      <p className="text-sm font-semibold tabular-nums">{fmtDistance(a.distanceM, units)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Time</p>
                      <p className="text-sm font-semibold tabular-nums">{fmtDuration(a.movingSec)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.type === "cycle" ? "Speed" : "Pace"}</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {a.type === "cycle" ? fmtSpeed(a.avgSpeedMps, units) : fmtPace(a.avgSpeedMps, units).replace(/ \/.+/, "")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Climb</p>
                      <p className="text-sm font-semibold tabular-nums flex items-center justify-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3 text-primary" /> {fmtElevation(a.elevGainM, units)}
                      </p>
                    </div>
                  </div>
                  {a.points.length > 1 && (
                    <div className="h-20 rounded-lg bg-secondary/50">
                      <RouteTrace points={a.points} />
                    </div>
                  )}
                  {(a.uphillDistM > 0 || a.downhillDistM > 0) && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span className="flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> {fmtDistance(a.uphillDistM, units)} uphill</span>
                      <span className="flex items-center gap-0.5"><ArrowDownRight className="w-3 h-3" /> {fmtDistance(a.downhillDistM, units)} downhill</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        <button
          className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-2"
          onClick={() => {
            setFeatureToggle("cardio", false);
            toast({ title: "Cardio hidden", description: "Turn it back on anytime in Account → Customize your app." });
          }}
        >
          <EyeOff className="w-3.5 h-3.5" /> Hide this feature
        </button>
      </div>
    </MobileLayout>
  );
}
