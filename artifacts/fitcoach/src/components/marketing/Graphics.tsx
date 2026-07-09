import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ElementType,
} from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/* ===========================================================================
   ALLUR marketing graphics library — TITANIUM (cyan-on-navy).
   Premium, data-viz-style SVG/CSS components. One idea + one motion per
   section. Every animation is gated on scroll-reveal and honors
   prefers-reduced-motion (degrades to the finished/visible state instantly).
   Colors come from the .allur-lp CSS vars, so these render on-brand inside
   PageShell or the Landing wrapper.
   =========================================================================== */

const CYAN = "var(--lp-cyan)";
const TEAL = "var(--lp-teal)";
const MUTED = "var(--lp-muted)";

// Count a number up to `target` once `active` flips true. Reduced-motion jumps
// straight to the target.
function useCountUp(target: number, active: boolean, duration = 1400, decimals = 0) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;
    if (reduced) {
      setVal(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration, reduced]);
  return decimals ? val.toFixed(decimals) : Math.round(val).toString();
}

// --- Scorecard gauge -------------------------------------------------------
// Animated semicircle arc that fills + counts up. The "know where you stand"
// data-viz moment.
export function ScoreGauge({
  value = 62,
  max = 100,
  label = "Plan fit",
  caption,
}: {
  value?: number;
  max?: number;
  label?: string;
  caption?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();
  const pct = Math.min(1, value / max);
  const R = 80;
  const CX = 100;
  const CY = 100;
  const circ = Math.PI * R; // half-circle length
  const shown = useCountUp(value, inView, 1500);

  return (
    <div ref={ref} className="lp-card p-8 flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-full max-w-[280px]">
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="var(--lp-border)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <motion.path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={inView || reduced ? { strokeDashoffset: circ * (1 - pct) } : {}}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={CYAN} />
            <stop offset="100%" stopColor={TEAL} />
          </linearGradient>
        </defs>
        <text
          x="100"
          y="92"
          textAnchor="middle"
          className="lp-display"
          fontSize="42"
          fontWeight="700"
          fill="var(--lp-text)"
        >
          {shown}
        </text>
        <text x="100" y="112" textAnchor="middle" fontSize="12" fill={MUTED}>
          / {max}
        </text>
      </svg>
      <div className="lp-kicker mt-2">{label}</div>
      {caption && (
        <p className="text-sm text-[var(--lp-muted)] mt-2 text-center max-w-xs">
          {caption}
        </p>
      )}
    </div>
  );
}

// --- Animated bar chart ----------------------------------------------------
export function BarChart({
  data,
  caption,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  caption?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();
  const maxV = Math.max(...data.map((d) => d.value));

  return (
    <div ref={ref} className="lp-card p-7">
      <div className="flex items-end gap-4 h-48">
        {data.map((d, i) => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <span className="text-sm font-semibold" style={{ color: d.highlight ? CYAN : "var(--lp-body)" }}>
              {d.value}%
            </span>
            <motion.div
              className="w-full rounded-t-md"
              style={{
                background: d.highlight
                  ? `linear-gradient(180deg, ${CYAN}, ${TEAL})`
                  : "rgba(148,163,184,0.25)",
              }}
              initial={{ height: 0 }}
              animate={inView || reduced ? { height: `${(d.value / maxV) * 100}%` } : {}}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            />
            <span className="text-xs text-[var(--lp-muted)] text-center">{d.label}</span>
          </div>
        ))}
      </div>
      {caption && <p className="text-sm text-[var(--lp-muted)] mt-5 text-center">{caption}</p>}
    </div>
  );
}

// --- Radial hub diagram ----------------------------------------------------
// Center core + orbiting nodes with connector lines drawing in on scroll.
export function RadialHub({
  center = "Your plan",
  nodes,
}: {
  center?: string;
  nodes: { label: string; icon?: ElementType }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();
  const n = nodes.length;
  const CX = 200;
  const CY = 200;
  const radius = 140;

  return (
    <div ref={ref} className="relative w-full max-w-[420px] mx-auto aspect-square">
      <svg viewBox="0 0 400 400" className="w-full h-full">
        <defs>
          <radialGradient id="hubCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={CYAN} stopOpacity="0.35" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r="120" fill="url(#hubCore)" />
        {nodes.map((node, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const x = CX + Math.cos(angle) * radius;
          const y = CY + Math.sin(angle) * radius;
          return (
            <motion.line
              key={`line-${node.label}`}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke={CYAN}
              strokeWidth="1.5"
              strokeOpacity="0.4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView || reduced ? { pathLength: 1, opacity: 0.4 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.12 }}
            />
          );
        })}
      </svg>

      {/* center core */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="lp-card w-28 h-28 rounded-full flex items-center justify-center text-center px-3"
          style={{ borderColor: "rgba(110,231,242,0.4)" }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={inView || reduced ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
        >
          <span className="lp-display font-semibold text-[var(--lp-text)] text-sm leading-tight">
            {center}
          </span>
        </motion.div>
      </div>

      {/* orbiting nodes */}
      {nodes.map((node, i) => {
        const angle = (i / n) * 360 - 90;
        const Icon = node.icon;
        return (
          <motion.div
            key={node.label}
            className="absolute top-1/2 left-1/2"
            style={{
              transform: `rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg)`,
              marginLeft: -44,
              marginTop: -44,
            }}
            initial={{ opacity: 0 }}
            animate={inView || reduced ? { opacity: 1 } : {}}
            transition={{ duration: 0.45, delay: 0.4 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="lp-card lp-card-hover w-[88px] h-[88px] rounded-2xl flex flex-col items-center justify-center gap-1 px-2">
              {Icon && <Icon className="w-5 h-5" style={{ color: CYAN }} />}
              <span className="text-[11px] font-medium text-[var(--lp-body)] text-center leading-tight">
                {node.label}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// --- Flow diagram (sequential nodes light up) ------------------------------
export function FlowDiagram({
  steps,
}: {
  steps: { label: string; sub?: string; icon?: ElementType }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();

  return (
    <div ref={ref} className="flex flex-col md:flex-row items-stretch gap-3 md:gap-2">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="flex md:flex-col items-center gap-3 md:gap-0 flex-1">
            <motion.div
              className="lp-card w-full md:text-center p-4 flex md:flex-col items-center gap-3 md:gap-2"
              initial={{ opacity: 0, y: 16 }}
              animate={inView || reduced ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.18 }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(110,231,242,0.12)" }}
              >
                {Icon ? (
                  <Icon className="w-5 h-5" style={{ color: CYAN }} />
                ) : (
                  <span className="lp-display font-bold" style={{ color: CYAN }}>
                    {i + 1}
                  </span>
                )}
              </div>
              <div className="md:mt-1">
                <div className="font-semibold text-[var(--lp-text)] text-sm">{s.label}</div>
                {s.sub && <div className="text-xs text-[var(--lp-muted)]">{s.sub}</div>}
              </div>
            </motion.div>
            {i < steps.length - 1 && (
              <motion.div
                className="hidden md:block h-px flex-1 self-center"
                style={{ background: `linear-gradient(90deg, ${CYAN}, transparent)`, minWidth: 16 }}
                initial={{ scaleX: 0 }}
                animate={inView || reduced ? { scaleX: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.18 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Big stat callouts -----------------------------------------------------
export function StatRow({
  stats,
}: {
  stats: { value: number; suffix?: string; prefix?: string; label: string; decimals?: number }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  return (
    <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {stats.map((s, i) => (
        <Stat key={s.label} {...s} active={inView} index={i} />
      ))}
    </div>
  );
}

function Stat({
  value,
  suffix,
  prefix,
  label,
  decimals = 0,
  active,
  index,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  decimals?: number;
  active: boolean;
  index: number;
}) {
  const shown = useCountUp(value, active, 1400, decimals);
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="text-center md:text-left"
      initial={{ opacity: 0, y: 16 }}
      animate={active || reduced ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      <div className="lp-display text-4xl md:text-5xl font-bold" style={{ color: "var(--lp-text)" }}>
        {prefix}
        <span style={{ color: CYAN }}>{shown}</span>
        {suffix}
      </div>
      <div className="text-sm text-[var(--lp-muted)] mt-2">{label}</div>
    </motion.div>
  );
}

// --- Floating chips --------------------------------------------------------
export function FloatingChips({ chips }: { chips: string[] }) {
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {chips.map((c, i) => (
        <motion.span
          key={c}
          className="lp-card px-4 py-2 text-sm font-medium text-[var(--lp-body)] rounded-full"
          animate={reduced ? {} : { y: [0, -6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
        >
          {c}
        </motion.span>
      ))}
    </div>
  );
}

// --- Comparison table ------------------------------------------------------
export function ComparisonTable({
  columns,
  rows,
}: {
  columns: string[]; // first is row label col header (can be "")
  rows: { label: string; cells: (boolean | string)[] }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduced = useReducedMotion();
  return (
    <div ref={ref} className="lp-card overflow-hidden">
      <div
        className="grid text-sm"
        style={{ gridTemplateColumns: `1.6fr repeat(${columns.length - 1}, 1fr)` }}
      >
        {columns.map((c, i) => (
          <div
            key={c + i}
            className={`p-4 font-semibold ${i === 1 ? "text-[var(--lp-text)]" : "text-[var(--lp-muted)]"}`}
            style={i === 1 ? { backgroundColor: "rgba(110,231,242,0.06)" } : undefined}
          >
            {c}
          </div>
        ))}
        {rows.map((row, ri) => (
          <motion.div
            key={row.label}
            className="contents"
            initial={{ opacity: 0 }}
            animate={inView || reduced ? { opacity: 1 } : {}}
            transition={{ duration: 0.4, delay: ri * 0.06 }}
          >
            <div className="p-4 border-t border-[var(--lp-border)] text-[var(--lp-body)]">
              {row.label}
            </div>
            {row.cells.map((cell, ci) => (
              <div
                key={ci}
                className="p-4 border-t border-[var(--lp-border)] flex items-center justify-center"
                style={ci === 0 ? { backgroundColor: "rgba(110,231,242,0.06)" } : undefined}
              >
                {typeof cell === "boolean" ? (
                  cell ? (
                    <span style={{ color: CYAN }} className="text-lg">✓</span>
                  ) : (
                    <span className="text-[var(--lp-muted)]">—</span>
                  )
                ) : (
                  <span className="text-[var(--lp-body)] text-center">{cell}</span>
                )}
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Phone frame + faux UI screens (replaces AI product photos) ------------
export function PhoneMock({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 268 }}>
      <div
        className="absolute inset-0 -z-10 blur-3xl rounded-full"
        style={{ background: "radial-gradient(circle, rgba(110,231,242,0.22), transparent 70%)" }}
      />
      <div
        className="rounded-[2.6rem] p-2.5 border"
        style={{ backgroundColor: "#0A0F1F", borderColor: "rgba(110,231,242,0.18)" }}
      >
        <div
          className="rounded-[2.1rem] overflow-hidden relative"
          style={{ backgroundColor: "var(--lp-bg)", height: 540 }}
        >
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full bg-black/60 z-20" />
          {children}
        </div>
      </div>
    </div>
  );
}

// Reveal wrapper for a single element
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView || reduced ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// --- Vertical timeline -----------------------------------------------------
export function Timeline({
  steps,
}: {
  steps: { title: string; body: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduced = useReducedMotion();
  return (
    <div ref={ref} className="relative pl-8">
      <div
        className="absolute left-[7px] top-1 bottom-1 w-px"
        style={{ background: "linear-gradient(180deg, var(--lp-cyan), transparent)" }}
      />
      <div className="flex flex-col gap-8">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            className="relative"
            initial={{ opacity: 0, x: 12 }}
            animate={inView || reduced ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.12 }}
          >
            <div
              className="absolute -left-8 top-1 w-4 h-4 rounded-full border-2"
              style={{ borderColor: CYAN, backgroundColor: "var(--lp-bg)" }}
            />
            <h4 className="lp-display font-semibold text-[var(--lp-text)] mb-1">{s.title}</h4>
            <p className="text-[var(--lp-body)] text-sm leading-relaxed">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Adaptive progress line chart -----------------------------------------
// The core-idea visual. A rigid plan stalls / drops the moment life hits;
// ALLUR dips but adapts and keeps climbing. Two series + disruption markers.
// Explains the value with a picture instead of an app screenshot.
export function AdaptiveChart({
  series,
  markers = [],
  height = 230,
  legend = true,
}: {
  series: { label: string; kind: "allur" | "rigid"; points: number[] }[];
  markers?: { at: number; label: string }[];
  height?: number;
  legend?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();
  const W = 440;
  const H = 200;
  const pad = { l: 10, r: 14, t: 18, b: 18 };
  const n = Math.max(...series.map((s) => s.points.length));
  const xAt = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const yAt = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const pathFor = (pts: number[]) =>
    pts.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(" ");

  return (
    <div ref={ref} className="lp-card p-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="adaptGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={CYAN} />
            <stop offset="100%" stopColor={TEAL} />
          </linearGradient>
        </defs>
        {/* disruption markers */}
        {markers.map((m) => (
          <line
            key={m.label}
            x1={xAt(m.at)}
            y1={pad.t - 4}
            x2={xAt(m.at)}
            y2={H - pad.b}
            stroke="var(--lp-border)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        ))}
        {markers.map((m) => (
          <text
            key={`t-${m.label}`}
            x={xAt(m.at)}
            y={pad.t - 8}
            textAnchor="middle"
            fontSize="9"
            fill={MUTED}
          >
            {m.label}
          </text>
        ))}
        {/* series */}
        {series.map((s, si) => (
          <motion.path
            key={s.label}
            d={pathFor(s.points)}
            fill="none"
            stroke={s.kind === "allur" ? "url(#adaptGrad)" : MUTED}
            strokeWidth={s.kind === "allur" ? 3 : 2}
            strokeOpacity={s.kind === "allur" ? 1 : 0.55}
            strokeDasharray={s.kind === "rigid" ? "5 5" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView || reduced ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 1.4, delay: 0.2 + si * 0.35, ease: "easeInOut" }}
          />
        ))}
        {/* endpoint dot on the ALLUR series */}
        {series
          .filter((s) => s.kind === "allur")
          .map((s) => (
            <motion.circle
              key={`dot-${s.label}`}
              cx={xAt(s.points.length - 1)}
              cy={yAt(s.points[s.points.length - 1])}
              r="4"
              fill={CYAN}
              initial={{ opacity: 0 }}
              animate={inView || reduced ? { opacity: 1 } : {}}
              transition={{ delay: 1.5 }}
            />
          ))}
      </svg>
      {legend && (
        <div className="flex items-center justify-center gap-6 mt-3 text-sm">
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span
                className="inline-block w-5 h-0.5 rounded-full"
                style={{
                  background: s.kind === "allur" ? `linear-gradient(90deg, ${CYAN}, ${TEAL})` : MUTED,
                  opacity: s.kind === "allur" ? 1 : 0.55,
                }}
              />
              <span
                style={{ color: s.kind === "allur" ? "var(--lp-text)" : "var(--lp-muted)" }}
                className="font-medium"
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- SystemHub — all-in-one system map (hero-scale) -------------------------
// A bigger, richer version of RadialHub for the landing hero. ALLUR sits at
// the centre; every real feature orbits it, wired in with animated beams and
// data pulses travelling from the core to each node. Reads instantly as
// "one system that runs everything."
export function SystemHub({
  centerTitle = "ALLUR",
  centerSub = "one system",
  nodes,
}: {
  centerTitle?: string;
  centerSub?: string;
  nodes: { label: string; sub?: string; icon: ElementType }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();
  const R = 41; // orbit radius in viewBox units
  const pos = nodes.map((_, i) => {
    const a = (-90 + i * (360 / nodes.length)) * (Math.PI / 180);
    return { x: 50 + R * Math.cos(a), y: 50 + R * Math.sin(a) };
  });

  return (
    <div ref={ref} className="relative aspect-square w-full max-w-[600px] mx-auto select-none">
      {/* slow-rotating dashed orbit */}
      <motion.div
        className="absolute inset-[7%] rounded-full border border-dashed pointer-events-none"
        style={{ borderColor: "rgba(110,231,242,0.16)" }}
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
      />
      {/* beams + rings + pulses */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <linearGradient id="hubBeam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={CYAN} />
            <stop offset="100%" stopColor={TEAL} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(110,231,242,0.10)" strokeWidth="0.3" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(110,231,242,0.07)" strokeWidth="0.3" strokeDasharray="1.5 2.5" />
        {pos.map((p, i) => (
          <motion.line
            key={`b-${i}`}
            x1={50}
            y1={50}
            x2={p.x}
            y2={p.y}
            stroke="url(#hubBeam)"
            strokeWidth="0.45"
            strokeOpacity="0.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView || reduced ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 0.9, delay: 0.25 + i * 0.12, ease: "easeOut" }}
          />
        ))}
        {/* data pulses travelling core → node */}
        {!reduced &&
          pos.map((p, i) => (
            <motion.circle
              key={`p-${i}`}
              r="1"
              fill={CYAN}
              initial={{ opacity: 0 }}
              animate={
                inView
                  ? { cx: [50, p.x], cy: [50, p.y], opacity: [0, 0.9, 0] }
                  : {}
              }
              transition={{
                duration: 2.1,
                delay: 1.2 + i * 0.7,
                repeat: Infinity,
                repeatDelay: nodes.length * 0.7 - 2.1 + 1.4,
                ease: "easeInOut",
              }}
            />
          ))}
      </svg>

      {/* centre core */}
      <div
        className="absolute"
        style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={inView || reduced ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-32 h-32 md:w-36 md:h-36 rounded-full flex flex-col items-center justify-center text-center"
          style={{
            background: "radial-gradient(circle at 50% 35%, rgba(110,231,242,0.14), rgba(11,17,32,0.9) 70%)",
            border: "1px solid rgba(110,231,242,0.45)",
            boxShadow: "0 0 60px -10px rgba(110,231,242,0.45), inset 0 0 30px -12px rgba(110,231,242,0.35)",
          }}
        >
          <span className="lp-display text-xl md:text-2xl font-bold tracking-[0.18em] text-[var(--lp-text)]">
            {centerTitle}
          </span>
          <span className="text-[10px] md:text-[11px] uppercase tracking-[0.22em] mt-1" style={{ color: CYAN }}>
            {centerSub}
          </span>
        </motion.div>
      </div>

      {/* feature nodes */}
      {nodes.map((n, i) => {
        const Icon = n.icon;
        return (
          <div
            key={n.label}
            className="absolute"
            style={{ left: `${pos[i].x}%`, top: `${pos[i].y}%`, transform: "translate(-50%, -50%)" }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={inView || reduced ? { opacity: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.45 + i * 0.12 }}
              className="lp-card flex items-center gap-2.5 md:gap-3 rounded-2xl px-3.5 py-2.5 md:px-4 md:py-3 whitespace-nowrap"
              style={{ borderColor: "rgba(110,231,242,0.28)", backgroundColor: "rgba(11,17,32,0.92)" }}
            >
              <span
                className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(110,231,242,0.12)" }}
              >
                <Icon className="w-4 h-4 md:w-[18px] md:h-[18px]" style={{ color: CYAN }} />
              </span>
              <span className="flex flex-col leading-tight text-left">
                <span className="lp-display text-sm md:text-[15px] font-semibold text-[var(--lp-text)]">{n.label}</span>
                {n.sub && (
                  <span className="text-[10px] md:text-[11px] text-[var(--lp-muted)]">{n.sub}</span>
                )}
              </span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
