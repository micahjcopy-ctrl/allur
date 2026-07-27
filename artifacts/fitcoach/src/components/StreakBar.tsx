import { Link } from "wouter";
import { useFitCoach } from "@/context/FitCoachContext";

// ---------------------------------------------------------------------------
// StreakBar — the always-visible streak strip. Mounted once in MobileLayout so
// it rides above the scrollable content on every app screen. Tapping it opens
// the full breakdown at /streak.
//
//   🔥 <streak>   [ Lv N · Tier ══════════▁▁▁ ]   <momentum>×
//
// The blue fill is the progress through the current level; the fire counts the
// consecutive-day streak; the momentum pill shows the live multiplier.
// ---------------------------------------------------------------------------

export function StreakBar() {
  const { streak } = useFitCoach();
  const boosted = streak.momentum > 1;

  return (
    <Link
      href="/streak"
      aria-label={
        "Streak: " +
        streak.currentStreak +
        " day" +
        (streak.currentStreak === 1 ? "" : "s") +
        ", level " +
        streak.level +
        " " +
        streak.tier +
        ". Open streak details."
      }
      className="block flex-shrink-0 border-b border-border bg-card/70 backdrop-blur-sm active:bg-card/90 transition-colors"
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="flex items-center gap-1 shrink-0 tabular-nums">
          <span className="text-base leading-none" aria-hidden="true">
            🔥
          </span>
          <span className="text-sm font-bold">{streak.currentStreak}</span>
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Lv {streak.level} · {streak.tier}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
              {streak.pointsIntoLevel}/{streak.levelSpan}
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: streak.progressPct + "%" }}
            />
          </div>
        </div>

        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums " +
            (boosted
              ? "bg-primary/15 text-primary"
              : "bg-secondary text-muted-foreground")
          }
        >
          {streak.momentum.toFixed(2)}×
        </span>
      </div>
    </Link>
  );
}
