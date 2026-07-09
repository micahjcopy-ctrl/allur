import { motion, useReducedMotion } from "framer-motion";

/* ===========================================================================
   ALLUR faux-UI screens — drawn in React (divs/SVG), not photos. These REPLACE
   the generic AI product images. Cyan-on-navy TITANIUM. Meant to sit inside
   <PhoneMock> or a bordered card.
   =========================================================================== */

const CYAN = "var(--lp-cyan)";
const TEAL = "var(--lp-teal)";

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-2 text-[10px] text-[var(--lp-muted)]">
      <span>9:41</span>
      <span className="tracking-widest">ALLUR</span>
      <span>●●●</span>
    </div>
  );
}

// AI coach chat — bubbles + a "plan updated" confirmation
export function CoachChatMock() {
  const reduced = useReducedMotion();
  const bubbles = [
    { me: true, t: "Shoulder's flaring up and I only have 30 min today" },
    { me: false, t: "Got it. Swapping overhead press for landmine press and trimming to a 30-min push session." },
    { me: false, t: "", chip: "Plan updated · Live" },
  ];
  return (
    <div className="h-full flex flex-col">
      <StatusBar />
      <div className="px-4 py-2 border-b border-[var(--lp-border)] flex items-center gap-2">
        <div className="w-7 h-7 rounded-full" style={{ background: `linear-gradient(135deg, ${CYAN}, ${TEAL})` }} />
        <div className="text-xs font-semibold text-[var(--lp-text)]">ALLUR Coach</div>
      </div>
      <div className="flex-1 px-4 py-4 flex flex-col gap-3 justify-end">
        {bubbles.map((b, i) => (
          <motion.div
            key={i}
            className={`max-w-[85%] ${b.me ? "self-end" : "self-start"}`}
            initial={{ opacity: 0, y: 8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.5, duration: 0.4 }}
          >
            {b.chip ? (
              <div
                className="text-[11px] font-medium px-3 py-1.5 rounded-full inline-flex items-center gap-1.5"
                style={{ backgroundColor: "rgba(110,231,242,0.14)", color: CYAN }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CYAN }} />
                {b.chip}
              </div>
            ) : (
              <div
                className="text-[11px] leading-snug px-3 py-2 rounded-2xl"
                style={
                  b.me
                    ? { background: `linear-gradient(135deg, ${CYAN}, ${TEAL})`, color: "#04111A" }
                    : { backgroundColor: "var(--lp-card)", color: "var(--lp-body)" }
                }
              >
                {b.t}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Photo macro scan — plate + detected macros counting in
export function MacroScanMock() {
  const reduced = useReducedMotion();
  const macros = [
    { k: "Calories", v: "620", w: "62%" },
    { k: "Protein", v: "48g", w: "80%" },
    { k: "Carbs", v: "54g", w: "45%" },
    { k: "Fat", v: "22g", w: "35%" },
  ];
  return (
    <div className="h-full flex flex-col">
      <StatusBar />
      <div className="px-4">
        <div
          className="rounded-xl h-32 relative overflow-hidden flex items-center justify-center"
          style={{ background: "radial-gradient(circle at 50% 40%, #1b2740, #0A0F1F)" }}
        >
          {/* plate */}
          <div className="w-20 h-20 rounded-full border-2" style={{ borderColor: "rgba(110,231,242,0.35)" }}>
            <div className="w-full h-full rounded-full grid grid-cols-2 gap-1 p-2">
              <div className="rounded-sm" style={{ backgroundColor: "rgba(45,212,191,0.5)" }} />
              <div className="rounded-sm" style={{ backgroundColor: "rgba(110,231,242,0.4)" }} />
              <div className="rounded-sm" style={{ backgroundColor: "rgba(148,163,184,0.4)" }} />
              <div className="rounded-sm" style={{ backgroundColor: "rgba(14,165,198,0.5)" }} />
            </div>
          </div>
          <motion.div
            className="absolute left-0 right-0 h-0.5"
            style={{ backgroundColor: CYAN, boxShadow: `0 0 12px ${CYAN}` }}
            initial={{ top: "10%" }}
            animate={reduced ? { top: "50%" } : { top: ["10%", "90%", "10%"] }}
            transition={{ duration: 2.4, repeat: reduced ? 0 : Infinity, ease: "easeInOut" }}
          />
          <div
            className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(110,231,242,0.16)", color: CYAN }}
          >
            Analyzing…
          </div>
        </div>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2.5">
        {macros.map((m, i) => (
          <div key={m.k}>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-[var(--lp-muted)]">{m.k}</span>
              <span className="text-[var(--lp-text)] font-semibold">{m.v}</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--lp-border)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${CYAN}, ${TEAL})` }}
                initial={{ width: 0 }}
                animate={{ width: m.w }}
                transition={{ duration: 1, delay: 0.4 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Physique scan — silhouette + body-comp readout
export function PhysiqueScanMock() {
  const reduced = useReducedMotion();
  return (
    <div className="h-full flex flex-col">
      <StatusBar />
      <div className="px-4 flex-1 flex flex-col">
        <div
          className="rounded-xl flex-1 relative overflow-hidden flex items-end justify-center"
          style={{ background: "linear-gradient(180deg, #0E1730, #0A0F1F)" }}
        >
          {/* silhouette */}
          <svg viewBox="0 0 100 160" className="h-[85%]" style={{ opacity: 0.85 }}>
            <path
              d="M50 8 a10 10 0 1 0 0.1 0 M38 34 h24 l6 34 -8 2 -4 -22 v40 l6 40 h-8 l-6-38 -6 38 h-8 l6-40 v-40 l-4 22 -8-2 z"
              fill="rgba(110,231,242,0.18)"
              stroke="rgba(110,231,242,0.5)"
              strokeWidth="1"
            />
          </svg>
          {[26, 46, 66].map((top, i) => (
            <motion.div
              key={top}
              className="absolute right-3 flex items-center gap-1"
              style={{ top: `${top}%` }}
              initial={{ opacity: 0, x: 8 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.25 }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CYAN }} />
              <span className="text-[9px] text-[var(--lp-body)]">
                {["Shoulders", "Core", "Legs"][i]}
              </span>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 py-3">
          {[
            { k: "Body fat (est.)", v: "14.8%" },
            { k: "Lean mass", v: "+2.1 lb" },
          ].map((s) => (
            <div key={s.k} className="lp-card p-2.5 !rounded-xl">
              <div className="text-[9px] text-[var(--lp-muted)]">{s.k}</div>
              <div className="text-sm font-bold" style={{ color: CYAN }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Adaptive plan / dashboard — today's session + weekly bars
export function PlanMock() {
  const reduced = useReducedMotion();
  const days = [40, 70, 55, 85, 60, 95, 30];
  return (
    <div className="h-full flex flex-col">
      <StatusBar />
      <div className="px-4 py-1">
        <div className="text-[10px] text-[var(--lp-muted)]">Today · Push A</div>
        <div className="text-sm font-bold text-[var(--lp-text)] mb-3">Chest · Shoulders · Triceps</div>
        {["Incline DB Press", "Landmine Press", "Cable Fly", "Triceps Rope"].map((ex, i) => (
          <motion.div
            key={ex}
            className="flex items-center justify-between py-2 border-b border-[var(--lp-border)]"
            initial={{ opacity: 0, x: -8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
          >
            <span className="text-[11px] text-[var(--lp-body)]">{ex}</span>
            <span className="text-[10px] text-[var(--lp-muted)]">{[4, 3, 3, 3][i]} × {[8, 10, 12, 15][i]}</span>
          </motion.div>
        ))}
      </div>
      <div className="px-4 mt-auto pb-4">
        <div className="text-[10px] text-[var(--lp-muted)] mb-2">This week's volume</div>
        <div className="flex items-end gap-1.5 h-14">
          {days.map((h, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-t"
              style={{ background: i === 5 ? `linear-gradient(180deg, ${CYAN}, ${TEAL})` : "rgba(148,163,184,0.28)" }}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ duration: 0.7, delay: 0.3 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
