import { motion, useReducedMotion } from "framer-motion";
import { Activity, Clock, Plane, RefreshCw, Check } from "lucide-react";

/* ===========================================================================
   ALLUR hero graphic — portrays the core idea: life throws things at you, and
   your plan ADAPTS in real time. Real-life signal chips flow into a live plan
   card that rewrites itself → "Plan updated · Live". Fully self-contained and
   width-contained (never clips off the edge). Reduced-motion safe.
   =========================================================================== */

const CYAN = "var(--lp-cyan)";
const TEAL = "var(--lp-teal)";

const SIGNALS = [
  { icon: Activity, label: "Shoulder tweak" },
  { icon: Clock, label: "Only 30 min" },
  { icon: Plane, label: "Traveling" },
];

const ROWS = [
  { name: "Incline DB Press", meta: "4 × 8", swapped: false },
  { name: "Landmine Press", meta: "shoulder-safe", swapped: true },
  { name: "Cable Fly", meta: "3 × 12", swapped: false },
];

export default function HeroGraphic() {
  const reduced = useReducedMotion();
  const float = (delay: number) =>
    reduced
      ? {}
      : { y: [0, -7, 0], transition: { duration: 3.6, repeat: Infinity, delay, ease: "easeInOut" } };

  return (
    <div className="relative w-full max-w-[440px] mx-auto select-none">
      {/* ambient glow */}
      <div
        className="absolute inset-0 -z-10 blur-3xl"
        style={{ background: "radial-gradient(circle at 50% 45%, rgba(110,231,242,0.20), transparent 70%)" }}
      />

      {/* life-signal chips flowing in */}
      <div className="flex flex-wrap justify-center gap-2.5 mb-5 relative z-10">
        {SIGNALS.map((s, i) => (
          <motion.div
            key={s.label}
            className="lp-card inline-flex items-center gap-2 px-3.5 py-2 rounded-full"
            initial={{ opacity: 0, y: -12 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
          >
            <motion.span className="inline-flex" animate={float(i * 0.5)}>
              <s.icon className="w-4 h-4" style={{ color: CYAN }} />
            </motion.span>
            <span className="text-sm font-medium text-[var(--lp-body)] whitespace-nowrap">{s.label}</span>
          </motion.div>
        ))}
      </div>

      {/* converging connectors */}
      <svg viewBox="0 0 440 46" className="w-full h-[46px] -mb-3 relative z-0" aria-hidden="true">
        {[90, 220, 350].map((x, i) => (
          <motion.path
            key={x}
            d={`M ${x} 0 C ${x} 22, 220 20, 220 44`}
            fill="none"
            stroke={CYAN}
            strokeWidth="1.5"
            strokeOpacity="0.35"
            initial={{ pathLength: 0 }}
            animate={reduced ? { pathLength: 1 } : { pathLength: 1 }}
            transition={{ delay: 0.7 + i * 0.15, duration: 0.6 }}
          />
        ))}
      </svg>

      {/* the live plan card */}
      <motion.div
        className="lp-card relative z-10 p-5 overflow-hidden"
        style={{ borderColor: "rgba(110,231,242,0.28)" }}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* adapting pulse ring */}
        {!reduced && (
          <motion.div
            className="absolute -top-16 -right-16 w-40 h-40 rounded-full"
            style={{ border: `1px solid ${CYAN}` }}
            animate={{ scale: [0.8, 1.15, 0.8], opacity: [0.25, 0, 0.25] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div>
            <div className="text-xs text-[var(--lp-muted)]">Your plan · Today</div>
            <div className="lp-display font-semibold text-[var(--lp-text)]">Push A</div>
          </div>
          <motion.div
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full"
            style={{ backgroundColor: "rgba(110,231,242,0.14)", color: CYAN }}
            animate={reduced ? {} : { opacity: [0.65, 1, 0.65] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Adapting
          </motion.div>
        </div>

        <div className="flex flex-col gap-2.5 relative z-10">
          {ROWS.map((r, i) => (
            <motion.div
              key={r.name}
              className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{
                backgroundColor: r.swapped ? "rgba(110,231,242,0.10)" : "rgba(148,163,184,0.06)",
                border: r.swapped ? "1px solid rgba(110,231,242,0.30)" : "1px solid transparent",
              }}
              initial={{ opacity: 0, x: -10 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
              transition={{ delay: 0.9 + i * 0.12, duration: 0.4 }}
            >
              <span className="text-sm text-[var(--lp-text)]">{r.name}</span>
              <span
                className="text-xs font-medium"
                style={{ color: r.swapped ? CYAN : "var(--lp-muted)" }}
              >
                {r.swapped ? "· swapped" : r.meta}
              </span>
            </motion.div>
          ))}
        </div>

        {/* weekly volume strip */}
        <div className="mt-4 flex items-end gap-1.5 h-10 relative z-10">
          {[40, 70, 55, 85, 60, 95, 35].map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-t"
              style={{ background: i === 5 ? `linear-gradient(180deg, ${CYAN}, ${TEAL})` : "rgba(148,163,184,0.28)" }}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: 1.1 + i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </div>
      </motion.div>

      {/* plan updated confirmation */}
      <motion.div
        className="mt-4 flex justify-center relative z-10"
        initial={{ opacity: 0, y: 8 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
      >
        <div
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full"
          style={{ backgroundColor: "rgba(110,231,242,0.12)", color: CYAN, border: "1px solid rgba(110,231,242,0.3)" }}
        >
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full" style={{ backgroundColor: CYAN }}>
            <Check className="w-3 h-3" style={{ color: "#04111A" }} />
          </span>
          Plan updated · Live
        </div>
      </motion.div>
    </div>
  );
}
