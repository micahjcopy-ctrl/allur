import { useLocation } from "wouter";
import {
  Zap,
  Target,
  Camera,
  RefreshCw,
  ChevronRight,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import PageShell from "@/components/PageShell";
import { useSeo } from "@/hooks/useSeo";

const DIFFERENTIATORS = [
  {
    icon: Zap,
    title: "It acts — it doesn't just talk",
    body: "Ask for a change and ALLUR rewrites your actual plan on the spot. No copy-pasting advice into another app. The plan updates the moment you agree.",
  },
  {
    icon: Target,
    title: "Built around your body, not a template",
    body: "Your plan is shaped by your goal, experience, injuries, equipment, and schedule — not a generic program with your name pasted on top.",
  },
  {
    icon: Camera,
    title: "Nutrition without the busywork",
    body: "Snap a photo of your meal and log calories and macros in seconds. Stay aware of your intake without turning food into a second job.",
  },
  {
    icon: RefreshCw,
    title: "It adapts when life changes",
    body: "Missed a week? Shoulder flaring up? Only 30 minutes today? The AI coach adjusts your plan so a bad week doesn't end your progress.",
  },
];

export default function About() {
  const [, setLocation] = useLocation();
  const go = (path: string) => {
    setLocation(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  useSeo({
    title: "About ALLUR — The Adaptive AI Fitness Coach",
    description:
      "ALLUR is an AI fitness coach that builds a personalized, research-backed training and nutrition plan and adapts it to your real life. Meet the team and the science behind it.",
    path: "/about",
  });

  return (
    <PageShell>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[900px] lp-halo opacity-60" />
        <div className="max-w-4xl mx-auto px-6 pt-16 md:pt-24 pb-16 md:pb-20 text-center relative z-10">
          <span className="lp-kicker mb-5 block">Our mission</span>
          <h1 className="lp-display text-4xl md:text-6xl font-bold leading-[1.05] mb-6">
            Fitness that finally{" "}
            <span style={{ color: "var(--lp-cyan)" }}>adapts to your life.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--lp-body)] max-w-2xl mx-auto leading-relaxed">
            We built ALLUR for the person who knows what to do in the gym but
            keeps falling off when real life gets in the way. Not because they're
            lazy — because every app they tried was a{" "}
            <span className="lp-underline">spectator, not a coach.</span>
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => go("/auth?mode=signup")}
              className="lp-cta h-14 px-8 text-lg inline-flex items-center justify-center gap-2 group"
            >
              Start your transformation
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => go("/pricing")}
              className="lp-cta-ghost h-14 px-8 text-lg inline-flex items-center justify-center"
            >
              See pricing
            </button>
          </div>
        </div>
      </section>

      {/* THE PROBLEM / ENEMY */}
      <section
        className="py-20 md:py-28 border-t border-[var(--lp-border)]/60"
        style={{ backgroundColor: "var(--lp-bg-alt)" }}
      >
        <div className="max-w-3xl mx-auto px-6">
          <span className="lp-kicker mb-4 block">The problem we set out to kill</span>
          <h2 className="lp-display text-3xl md:text-4xl font-semibold mb-6">
            You don't quit because you're weak. You quit because of friction.
          </h2>
          <div className="space-y-5 text-lg text-[var(--lp-body)] leading-relaxed">
            <p>
              You start motivated. Then your schedule shifts, you miss a few
              workouts, you second-guess your calories, and your plan stops
              matching your body. One app for workouts, another for food, random
              advice from social media — and nothing that adjusts when reality
              hits.
            </p>
            <p>
              Most fitness apps just sit there and track what already happened.
              They were never built for the moments people actually quit.{" "}
              <span className="text-[var(--lp-text)] font-medium">
                ALLUR was.
              </span>{" "}
              It removes the friction between you and your next rep — so progress
              gets easier to sustain, not harder.
            </p>
          </div>
        </div>
      </section>

      {/* WHAT MAKES ALLUR DIFFERENT */}
      <section className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <span className="lp-kicker mb-4 block">Why ALLUR is different</span>
            <h2 className="lp-display text-3xl md:text-4xl font-semibold">
              An operating system for your body — not another tracker.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DIFFERENTIATORS.map((d) => (
              <div key={d.title} className="lp-card lp-card-hover p-8">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{
                    backgroundColor: "rgba(110,231,242,0.1)",
                    border: "1px solid rgba(110,231,242,0.2)",
                  }}
                >
                  <d.icon className="w-6 h-6" style={{ color: "var(--lp-cyan)" }} />
                </div>
                <h3 className="lp-display text-xl font-semibold mb-3 text-[var(--lp-text)]">
                  {d.title}
                </h3>
                <p className="text-[var(--lp-muted)] leading-relaxed">{d.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EVIDENCE / E-E-A-T */}
      <section
        className="py-20 md:py-28 border-y border-[var(--lp-border)]/60"
        style={{ backgroundColor: "var(--lp-bg-feature)" }}
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="lp-kicker mb-4 block">Built on evidence, not hype</span>
              <h2 className="lp-display text-3xl md:text-4xl font-semibold mb-6">
                Real exercise science — not the fad of the week.
              </h2>
              <div className="space-y-4 text-lg text-[var(--lp-body)] leading-relaxed">
                <p>
                  ALLUR's programs are grounded in mainstream, citable research:
                  the American College of Sports Medicine's resistance-training
                  guidance, evidence-based weekly-volume landmarks popularized by
                  coaches like Jeff Nippard, and the International Society of
                  Sports Nutrition's protein recommendations.
                </p>
                <p>
                  The same framework is what the in-app AI coach reasons from — so
                  the advice you get always lines up with the plan you're
                  following.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <ProofCard
                icon={FlaskConical}
                stat="10–20"
                label="research-backed weekly hard sets per muscle, matched to your level"
              />
              <ProofCard
                icon={Target}
                stat="1.4–2.0"
                label="g/kg daily protein target, per ISSN guidance"
              />
              <ProofCard
                icon={ShieldCheck}
                stat="0–3"
                label="reps-in-reserve intensity, the sweet spot for growth"
              />
              <ProofCard
                icon={RefreshCw}
                stat="6"
                label="goal types: fat loss, muscle, recomp, strength, endurance & more"
              />
            </div>
          </div>
        </div>
      </section>

      {/* THE TEAM */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <span className="lp-kicker mb-4 block">Who's behind ALLUR</span>
          <h2 className="lp-display text-3xl md:text-4xl font-semibold mb-6">
            Built by people who were tired of starting over.
          </h2>
          <p className="text-lg text-[var(--lp-body)] leading-relaxed max-w-2xl mx-auto mb-10">
            ALLUR was founded by{" "}
            <span className="text-[var(--lp-text)] font-medium">Micah Jacobi</span>{" "}
            and{" "}
            <span className="text-[var(--lp-text)] font-medium">
              Raiden Nomura
            </span>
            , who lead product, engineering, and the coaching methodology behind
            the app. Our editorial content is written to reflect current,
            citable exercise-science research and reviewed for accuracy against
            published guidelines.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {[
              { name: "Micah Jacobi", role: "Co-founder" },
              { name: "Raiden Nomura", role: "Co-founder" },
            ].map((p) => (
              <div key={p.name} className="lp-card p-6 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center lp-display text-lg font-bold shrink-0"
                  style={{
                    backgroundImage: "linear-gradient(135deg, #6EE7F2, #2DD4BF)",
                    color: "#04111A",
                  }}
                >
                  {p.name.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="lp-display font-semibold text-[var(--lp-text)]">
                    {p.name}
                  </div>
                  <div className="text-sm text-[var(--lp-muted)]">{p.role}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-[var(--lp-muted)] mt-8 max-w-xl mx-auto">
            ALLUR provides general fitness and nutrition information and
            AI-generated estimates. It is not medical advice — please read our{" "}
            <button
              onClick={() => go("/disclaimer")}
              className="underline hover:text-[var(--lp-text)] transition-colors"
            >
              Medical Disclaimer
            </button>{" "}
            and consult a physician before starting any new program.
          </p>
        </div>
      </section>
    </PageShell>
  );
}

function ProofCard({
  icon: Icon,
  stat,
  label,
}: {
  icon: typeof Target;
  stat: string;
  label: string;
}) {
  return (
    <div className="lp-card p-5" style={{ borderTop: "2px solid rgba(45,212,191,0.5)" }}>
      <Icon className="w-5 h-5 mb-3" style={{ color: "var(--lp-cyan)" }} />
      <div className="lp-display text-2xl font-bold mb-1 text-[var(--lp-text)]">
        {stat}
      </div>
      <p className="text-xs text-[var(--lp-muted)] leading-relaxed">{label}</p>
    </div>
  );
}
