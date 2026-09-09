// ---------------------------------------------------------------------------
// kit.tsx — the onboarding design system.
//
// Every onboarding screen is built from these pieces. That is the point: the
// old flow drifted because each step reimplemented its own layout, its own
// selected-state and its own Next button, so no two screens agreed. Putting the
// shell in one place is what stops that happening again.
//
// Design decisions this file encodes (design-system/MASTER.md, 2026-08-21):
//   - Accent intensity B: cyan carries progress, selection and the primary
//     action. Chrome carries everything secondary. Cyan is never decoration.
//   - Type: system stack for UI (SF Pro on iOS), Archivo for display.
//   - One primary CTA per screen, bottom-anchored, identical position.
//   - Reduced motion is a hard gate, not a nicety — every animation here
//     no-ops when the user asks for that.
// ---------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * One screen in the onboarding flow.
 *
 * The flow is a list of these, not a chain of `{step === N}` blocks. That is
 * the whole point: the plan calls for going from 8 screens to 22, and with a
 * list that is editing an array — inserting, reordering or cutting a screen
 * touches one entry. `render` is a closure over the page's state, so screens
 * still read and write the same answers without any prop plumbing.
 */
export interface ScreenDef {
  /** Stable key, also used for the animation key. */
  id: string;
  /** Short name for the DEV step-jumper. */
  label: string;
  render: () => React.ReactNode;
}

/**
 * The one selectable option in onboarding. Single- and multi-select both.
 *
 * There were three copies of this button — one in Onboarding.tsx, one in
 * WeekAct.tsx, one inline in the gender step — and they had already drifted
 * apart on text colour, height and tick behaviour. One component is the only
 * thing that keeps "selected" looking the same on every screen.
 *
 * Selection is carried by border + tint + tick. An unpicked option keeps
 * full-strength text: dimming it read as "disabled", so a step with nothing
 * chosen yet looked entirely inert.
 */
export function ChoiceCard({
  active,
  onClick,
  children,
  className,
  hideCheck,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  /** For small square tiles (day letters, digits) where a tick would crowd. */
  hideCheck?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        void tick();
        onClick();
      }}
      className={cn(
        "relative min-h-[52px] rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-medium transition-all",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-foreground hover:border-primary/40",
        className,
      )}
    >
      {children}
      {active && !hideCheck && <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />}
    </button>
  );
}

/** True when the OS asks for reduced motion. Re-evaluates if the user changes it. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/** Light haptic tap on native; silently does nothing on web. */
export async function tick(): Promise<void> {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* web, or the plugin isn't installed yet — not worth surfacing */
  }
}

// ---------------------------------------------------------------------------

/**
 * The question, spoken.
 *
 * Liftoff delivers every question through a cartoon mascot in a speech bubble,
 * which is most of why their flow reads as a conversation rather than a form.
 * We want that structure and not that character: ALLUR's copy is aimed at an
 * adult who has failed at this before ("It was never your fault"), and a
 * cartoon would break it instantly. So the speaker is the coach, represented by
 * the bolt mark — a signature, not a personality.
 */
export function CoachBubble({
  children,
  sub,
  className,
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full",
          "bg-primary/10 text-primary ring-1 ring-primary/25",
          !reduced && "animate-[coachpulse_420ms_var(--ease)_1]",
        )}
      >
        <Zap className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] leading-tight tracking-tight text-balance">{children}</h1>
        {sub && <p className="mt-1.5 text-sm leading-snug text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * A screen that asks nothing.
 *
 * These are the beats — "None of these were your fault", "Building your plan".
 * They cost a tap and buy pacing: without them a 22-step flow is a queue of
 * fields, and with them it reads as something with acts. The old 8-step flow
 * had none.
 */
export function BeatScreen({
  eyebrow,
  headline,
  body,
  visual,
  cta,
  onCta,
}: {
  eyebrow?: string;
  headline: React.ReactNode;
  body?: React.ReactNode;
  visual?: React.ReactNode;
  cta: string;
  onCta: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        {eyebrow && (
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        )}
        <h1 className="max-w-[18ch] text-[26px] leading-[1.15] tracking-tight text-balance">{headline}</h1>
        {body && <p className="mt-3 max-w-[30ch] text-[15px] leading-relaxed text-muted-foreground">{body}</p>}
        {visual && <div className="mt-8 w-full">{visual}</div>}
      </div>
      <Button onClick={onCta} className="h-12 w-full rounded-full text-lg font-medium">
        {cta}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The one forward CTA. Always enabled; the tap is intercepted when the step
 * isn't complete and `error` says what's missing.
 *
 * A disabled button here is just the primary colour at 50% opacity, which on a
 * dark canvas still reads as perfectly pressable — so tapping it early used to
 * give silence and no explanation. Enabled-plus-explain is the friendlier
 * contract, and it also means no screen ever opens looking dead.
 */
export function StepCta({
  onClick,
  error,
  label = "Next",
  icon,
  className,
}: {
  onClick: () => void;
  error?: string | null;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <Button onClick={onClick} className="h-12 w-full rounded-full text-lg font-medium">
        {label} {icon ?? <ChevronRight className="ml-2 h-5 w-5" />}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Back + forward row, same validate-on-tap contract as StepCta. */
export function StepNav({
  onBack,
  onNext,
  error,
  label = "Next",
  icon,
  busy,
  className,
}: {
  onBack: () => void;
  onNext: () => void;
  error?: string | null;
  label?: string;
  icon?: React.ReactNode;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mt-8", className)}>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onBack} className="h-12 rounded-full px-6">
          Back
        </Button>
        <Button onClick={onNext} disabled={busy} className="h-12 flex-1 rounded-full text-lg font-medium">
          {label} {icon ?? <ChevronRight className="ml-2 h-5 w-5" />}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * One question, one screen.
 *
 * This enforces the structural rule the old flow broke: an eyebrow, the
 * question spoken by the coach, the input, and exactly one bottom-anchored CTA
 * in the same place every time. The previous step 5 asked five things at once,
 * which is the single clearest reason it read as a form.
 */
export function StepShell({
  eyebrow,
  question,
  sub,
  children,
  onBack,
  onNext,
  error,
  cta,
  busy,
}: {
  eyebrow?: string;
  question: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
  onBack?: () => void;
  onNext: () => void;
  error?: string | null;
  cta?: string;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col">
      {eyebrow && (
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
      )}
      <CoachBubble sub={sub}>{question}</CoachBubble>
      <div className="mt-7 flex-1">{children}</div>
      {onBack ? (
        <StepNav onBack={onBack} onNext={onNext} error={error} label={cta} busy={busy} />
      ) : (
        <StepCta onClick={onNext} error={error} label={cta} className="mt-8" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface DialProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Rendered next to the number, e.g. "lb". */
  unit?: string;
  /** Formats the value for display; defaults to the raw number. */
  format?: (v: number) => string;
  label: string;
  /** Optional control rendered top-right, e.g. a kg/lb toggle. */
  aside?: React.ReactNode;
}

/**
 * Drag-to-set numeric input.
 *
 * Replaces `<Input type="number">` for height, weight and age. Typing a number
 * into a box summons the keyboard and feels like paperwork; dragging a rail
 * feels like using an app, and it is the clearest difference between ALLUR's
 * numbers step and Liftoff's.
 *
 * Accessibility is not sacrificed for the gesture: this is a real slider role
 * with full arrow-key support, and tapping the number opens a keyboard for
 * direct entry. Never trap someone who would rather type.
 */
export function Dial({ value, onChange, min, max, step = 1, unit, format, label, aside }: DialProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const lastEmitted = useRef(value);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step)),
    [min, max, step],
  );

  const setFromClientX = useCallback(
    (clientX: number) => {
      const rail = railRef.current;
      if (!rail) return;
      const r = rail.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const next = clamp(min + pct * (max - min));
      if (next !== lastEmitted.current) {
        lastEmitted.current = next;
        void tick(); // one haptic per unit crossed, not per pixel
        onChange(next);
      }
    },
    [clamp, min, max, onChange],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => dragging.current && setFromClientX(e.clientX);
    const up = () => (dragging.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [setFromClientX]);

  const commitTyped = () => {
    const n = Number(draft);
    if (Number.isFinite(n)) onChange(clamp(n));
    setTyping(false);
  };

  const pct = (value - min) / (max - min);
  const TICKS = 41;

  return (
    <div className="flex flex-col">
      <div className="mb-1 flex min-h-7 items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {aside}
      </div>

      {/* The number. Tap to type instead of drag. */}
      <div className="flex items-baseline justify-center gap-1.5 py-3">
        {typing ? (
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTyped}
            onKeyDown={(e) => e.key === "Enter" && commitTyped()}
            className="display w-40 bg-transparent text-center text-5xl font-extrabold tracking-tight outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(value));
              setTyping(true);
            }}
            className="display text-5xl font-extrabold tabular-nums tracking-tight"
            aria-label={`${label}: ${value}${unit ?? ""}. Activate to type a value.`}
          >
            {format ? format(value) : value}
          </button>
        )}
        {unit && <span className="text-base font-medium text-muted-foreground">{unit}</span>}
      </div>

      {/* The rail. */}
      <div
        ref={railRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${format ? format(value) : value}${unit ? ` ${unit}` : ""}`}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setFromClientX(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(value - step));
          } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onChange(clamp(value + step));
          }
        }}
        className="relative h-16 cursor-ew-resize touch-none select-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-1">
          {Array.from({ length: TICKS }, (_, i) => {
            const d = Math.abs(i / (TICKS - 1) - pct);
            const near = d < 0.03;
            return (
              <span
                key={i}
                className={cn("w-px rounded-full", i % 5 === 0 ? "h-5" : "h-3", near ? "bg-primary" : "bg-border")}
              />
            );
          })}
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-9 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.6)]"
          style={{ left: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Press and hold to commit.
 *
 * The gesture is the point: a promise made by holding your thumb down for two
 * seconds is harder to walk away from than a tapped checkbox. It lands right
 * before the numbers, where the flow turns from "tell us about your failures"
 * to "let's build it".
 *
 * Reduced motion collapses the hold to a plain button — the ring animation is
 * the whole affordance, so without it the gesture would be invisible.
 */
export function HoldToCommit({
  statement,
  hint = "Press and hold to begin",
  onComplete,
  holdMs = 1800,
}: {
  statement: React.ReactNode;
  hint?: string;
  onComplete: () => void;
  holdMs?: number;
}) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const done = useRef(false);

  const stop = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (!done.current) setProgress(0);
  }, []);

  const begin = useCallback(() => {
    if (done.current) return;
    start.current = performance.now();
    const frame = (t: number) => {
      const p = Math.min(1, (t - start.current) / holdMs);
      setProgress(p);
      if (p >= 1) {
        done.current = true;
        void tick();
        onComplete();
        return;
      }
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  }, [holdMs, onComplete]);

  useEffect(() => stop, [stop]);

  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="max-w-[26ch] text-[22px] font-semibold leading-snug tracking-tight text-balance">{statement}</p>

      {reduced ? (
        <Button onClick={onComplete} className="mt-10 h-12 rounded-full px-8 text-base font-semibold">
          I'm in
        </Button>
      ) : (
        <>
          <button
            type="button"
            onPointerDown={begin}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            className="relative mt-10 grid h-32 w-32 select-none place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={hint}
          >
            <svg viewBox="0 0 128 128" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="64" cy="64" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
              <circle
                cx="64"
                cy="64"
                r={R}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
              />
            </svg>
            <span className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25">
              <Zap className="h-8 w-8" />
            </span>
          </button>
          <p className="mt-5 text-sm text-muted-foreground">{hint}</p>
        </>
      )}
    </div>
  );
}
