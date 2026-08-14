import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";

const ALLUR_LOGO = `${import.meta.env.BASE_URL}allur-logo.png`;
const HERO = `${import.meta.env.BASE_URL}hero-bg.png`;

// The brand panel narrates alongside the quiz — each step gets its own line so the
// left side feels like it's responding to the answers, not sitting there static.
const PANEL_COPY: { title: string; sub: string }[] = [
  { title: "This starts with you.", sub: "No judgment — just a starting line. Everything we build begins here." },
  { title: "Aim at something real.", sub: "Your training and nutrition get built around the goal you pick." },
  { title: "It was never your fault.", sub: "Old plans couldn't bend to your life. That's the part we fixed." },
  { title: "Remember that version of you?", sub: "We'll build the path back to it — and then past it." },
  { title: "Your real week. Not a fantasy one.", sub: "The part every other plan skipped is where yours starts." },
  { title: "Trained around your limits.", sub: "Injuries, equipment, the days you actually have — all of it." },
  { title: "Calibrated to you.", sub: "Down to your numbers, so nothing here is a template." },
  { title: "Built. Just for you.", sub: "Every choice came from something you told us." },
];

/**
 * Premium responsive frame for the onboarding funnel.
 *
 * Mobile: renders the quiz as a single centered app-width column (unchanged).
 * Desktop (md+): a two-panel split — a cinematic brand panel that narrates the
 * current step on the left, and the quiz on the right — so the funnel reads as a
 * designed experience instead of a phone-width column stranded in a black void.
 */
export function OnboardingShell({
  step,
  totalSteps,
  children,
}: {
  step: number;
  totalSteps: number;
  children: React.ReactNode;
}) {
  const copy = PANEL_COPY[Math.min(step, PANEL_COPY.length) - 1] ?? PANEL_COPY[0];

  return (
    <div className="allur-app min-h-[100dvh] bg-background text-foreground">
      <div className="md:grid md:grid-cols-[1.05fr_minmax(440px,600px)] min-h-[100dvh]">
        {/* LEFT — cinematic brand panel (desktop only), pinned while the quiz scrolls */}
        <aside className="relative hidden md:flex md:sticky md:top-0 md:h-[100dvh] md:self-start flex-col justify-between overflow-hidden p-12 lg:p-16">
          <img
            src={HERO}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover object-center opacity-70"
          />
          {/* Scrims: darken for legibility + fade toward the quiz panel + a brand glow. */}
          <div className="absolute inset-0 bg-gradient-to-br from-background/60 via-background/80 to-background" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
          <div className="pointer-events-none absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />

          <div className="relative">
            <img src={ALLUR_LOGO} alt="ALLUR" className="w-28 select-none" draggable={false} />
          </div>

          <div className="relative max-w-md">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <p className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> Building your plan
                </p>
                <h2 className="text-4xl lg:text-5xl font-bold leading-[1.05] tracking-tight">
                  {copy.title}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{copy.sub}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
              <ShieldCheck className="h-4 w-4 text-primary" /> Built on sports science
            </span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            <span>Cancel anytime</span>
          </div>
        </aside>

        {/* RIGHT — the quiz */}
        <main className="relative flex min-h-[100dvh] w-full flex-col md:border-l md:border-border/60">
          {/* faint atmosphere so the panel isn't flat black on wide screens */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/[0.06] to-transparent" />
          <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col">{children}</div>
        </main>
      </div>
    </div>
  );
}
