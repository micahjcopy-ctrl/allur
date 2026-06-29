import React, { useEffect, useRef, useState } from "react";
import { motion, MotionConfig, AnimatePresence, useReducedMotion, useInView } from "framer-motion";
import { ChevronRight } from "lucide-react";

/* ===========================================================================
   ALLUR app-UI panels for the landing scroll-storytelling. These render REAL
   captured app screenshots (artifacts/fitcoach/public/screens/*.jpg) inside the
   phone frame and the command-center console panels, so the marketing page
   shows the actual product rather than hand-built mockups.
   =========================================================================== */

const CYAN = "var(--lp-cyan)";
const BASE_URL = import.meta.env.BASE_URL;

/* ---------- real screenshot renderer ---------- */

function AppScreenImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={`${BASE_URL}screens/${src}`}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className="w-full h-full object-cover object-top select-none"
    />
  );
}

/* ---------- screen states (real app captures) ---------- */

export function OnboardingScreen() {
  return <AppScreenImage src="onboarding.jpg" alt="ALLUR guided onboarding" />;
}

export function DashboardScreen() {
  return <AppScreenImage src="dashboard.jpg" alt="ALLUR dashboard command center" />;
}

export function CoachScreen() {
  return <AppScreenImage src="coach.jpg" alt="ALLUR AI coach conversation" />;
}

export function MealScreen() {
  return <AppScreenImage src="macros.jpg" alt="ALLUR meal logging and macros" />;
}

export function ProgressScreen() {
  return <AppScreenImage src="progress.jpg" alt="ALLUR progress analysis" />;
}

export function AdaptScreen() {
  return <AppScreenImage src="plan.jpg" alt="ALLUR adaptive training plan" />;
}

/* ---------- phone frame ---------- */

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative mx-auto"
      style={{
        width: "min(300px, calc(100vw - 2.5rem))",
        aspectRatio: "300 / 620",
        borderRadius: 44,
        padding: 12,
        background: "linear-gradient(155deg, #2a3346, #0c111d 55%)",
        boxShadow: "0 40px 90px -30px rgba(0,0,0,0.85), 0 0 0 1px rgba(110,231,242,0.08), inset 0 0 0 1.5px rgba(255,255,255,0.04)"
      }}
    >
      <div
        className="relative w-full h-full overflow-hidden"
        style={{ borderRadius: 33, backgroundColor: "var(--lp-bg)", boxShadow: "inset 0 0 40px rgba(0,0,0,0.6)" }}
      >
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full z-20" style={{ backgroundColor: "#05070d" }} />
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </div>
    </div>
  );
}

export const APP_SCREENS = [OnboardingScreen, DashboardScreen, CoachScreen, MealScreen, ProgressScreen, AdaptScreen];

/* ---------- auto-cycling screen (command center device) ----------
   Crossfades through every real app screen on a timer. Pauses when scrolled
   out of view and stays on a single static frame when the user prefers
   reduced motion. */

const CYCLE_SCREENS = [DashboardScreen, CoachScreen, MealScreen, ProgressScreen, AdaptScreen, OnboardingScreen];

export function AutoCyclingScreen({ interval = 1400 }: { interval?: number }) {
  const [index, setIndex] = useState(0);
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });

  useEffect(() => {
    if (prefersReduced || !inView) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % CYCLE_SCREENS.length);
    }, interval);
    return () => clearInterval(id);
  }, [prefersReduced, inView, interval]);

  const Current = CYCLE_SCREENS[index];

  return (
    <div ref={ref} className="absolute inset-0">
      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <Current />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ---------- floating contextual callout (desktop, beside the phone) ---------- */

export function FloatingCallout({
  icon: Icon,
  label,
  value,
  position
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  position: "tl" | "br";
}) {
  const pos = position === "tl" ? "-left-14 top-10" : "-right-16 bottom-24";
  return (
    <motion.div
      key={`${label}-${value}`}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`absolute ${pos} z-30 hidden xl:flex items-center gap-3 rounded-2xl px-4 py-3 backdrop-blur-md`}
      style={{ backgroundColor: "rgba(11,17,32,0.85)", border: "1px solid rgba(110,231,242,0.22)", boxShadow: "0 20px 50px -20px rgba(0,0,0,0.8)" }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(110,231,242,0.12)" }}>
        <Icon className="w-4 h-4" style={{ color: CYAN }} />
      </div>
      <div>
        <div className="text-[9px] text-[var(--lp-muted)] uppercase tracking-wide">{label}</div>
        <div className="lp-display text-sm font-bold text-[var(--lp-text)] flex items-center gap-1">
          {value}
          <ChevronRight className="w-3 h-3" style={{ color: CYAN }} />
        </div>
      </div>
    </motion.div>
  );
}
