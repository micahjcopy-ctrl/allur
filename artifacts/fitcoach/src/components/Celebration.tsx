import { useEffect, useRef, useState } from "react";
import {
  CELEBRATIONS,
  tierParticleCount,
  tierDurationMs,
  tierHasSound,
  type CelebrationTier,
} from "@/lib/celebration";
import {
  subscribeCelebration,
  type CelebrationEvent,
} from "@/lib/celebrationBus";

// ---------------------------------------------------------------------------
// CelebrationHost — mounted once at the app root. Listens on the celebration
// bus and renders the tiered payoff: a hand-rolled canvas confetti burst
// (zero deps), a banner, and a soft WebAudio chime. Celebrations queue so two
// firing at once don't stomp each other. prefers-reduced-motion drops the
// confetti + slide animation (the banner still appears); the chime is audio,
// not motion, so it stays.
// ---------------------------------------------------------------------------

const CONFETTI_COLORS = ["#57E0E6", "#38bdf8", "#22d3ee", "#ffffff", "#fbbf24"];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
}

function runConfetti(canvas: HTMLCanvasElement, count: number, durationMs: number): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx || count === 0) return () => {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth;
  const H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: W / 2 + (Math.random() - 0.5) * W * 0.5,
      y: H * 0.35 + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -9 - 3,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      size: 5 + Math.random() * 6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    });
  }

  let raf = 0;
  let start = 0;
  const gravity = 0.22;
  const step = (t: number) => {
    if (!start) start = t;
    const elapsed = t - start;
    ctx.clearRect(0, 0, W, H);
    const fade = Math.max(0, 1 - elapsed / durationMs);
    for (const p of particles) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (elapsed < durationMs) {
      raf = requestAnimationFrame(step);
    } else {
      ctx.clearRect(0, 0, W, H);
    }
  };
  raf = requestAnimationFrame(step);
  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, W, H);
  };
}

let audioCtx: AudioContext | null = null;
function playChime(tier: CelebrationTier): void {
  if (!tierHasSound(tier)) return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    const ac = audioCtx;
    if (ac.state === "suspended") void ac.resume();
    const notes = tier === "big" ? [523.25, 659.25, 783.99] : [659.25];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ac.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.55);
    });
  } catch {
    /* audio is a nicety, never a failure */
  }
}

export function CelebrationHost() {
  const [current, setCurrent] = useState<CelebrationEvent | null>(null);
  const queue = useRef<CelebrationEvent[]>([]);
  const busy = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pumpRef = useRef<() => void>(() => {});

  // Show the next queued celebration if we're idle.
  pumpRef.current = () => {
    if (busy.current) return;
    const next = queue.current.shift();
    if (!next) return;
    busy.current = true;
    setCurrent(next);
  };

  // Subscribe to the bus once; enqueue and kick the pump.
  useEffect(() => {
    const unsub = subscribeCelebration((event) => {
      queue.current.push(event);
      pumpRef.current();
    });
    return unsub;
  }, []);

  // When a celebration becomes current, fire confetti + chime + auto-dismiss.
  useEffect(() => {
    if (!current) return;
    const cfg = CELEBRATIONS[current.kind];
    const reduce = prefersReducedMotion();
    const duration = tierDurationMs(cfg.tier);

    playChime(cfg.tier);

    let cleanupConfetti = () => {};
    if (!reduce && canvasRef.current) {
      cleanupConfetti = runConfetti(
        canvasRef.current,
        tierParticleCount(cfg.tier),
        duration,
      );
    }

    const timer = window.setTimeout(() => {
      cleanupConfetti();
      busy.current = false;
      setCurrent(null);
      pumpRef.current();
    }, duration);

    return () => {
      window.clearTimeout(timer);
      cleanupConfetti();
    };
  }, [current]);

  const cfg = current ? CELEBRATIONS[current.kind] : null;
  const reduce = prefersReducedMotion();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[100] flex items-start justify-center overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ display: current ? "block" : "none" }}
      />
      {current && cfg && (
        <div
          className={
            "mt-24 mx-4 max-w-sm rounded-2xl border border-border bg-card/95 px-5 py-4 shadow-2xl backdrop-blur " +
            (reduce ? "" : "animate-in fade-in slide-in-from-top-4 duration-300")
          }
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none" aria-hidden="true">
              {cfg.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">
                {current.title || cfg.title}
              </p>
              {current.message && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {current.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
