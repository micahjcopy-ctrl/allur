import { useLocation } from "wouter";
import {
  Zap,
  Dumbbell,
  Camera,
  ScanLine,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Brain,
  LineChart,
  MessageSquare,
} from "lucide-react";
import PageShell from "@/components/PageShell";
import { useSeo } from "@/hooks/useSeo";
import {
  RadialHub,
  ComparisonTable,
  StatRow,
  FloatingChips,
  Reveal,
  FlowDiagram,
  BarChart,
  ScoreGauge,
  AdaptiveChart,
} from "@/components/marketing/Graphics";

// /features — hub page for the feature spokes (hub-and-spoke SEO architecture).
// Each feature is explained with an IDEA diagram (flow / chart / gauge / trend),
// not an app screenshot. Each section keeps a stable id so future spoke pages
// (/features/ai-coach etc.) can take over the deep links without breaking.

const FEATURES = [
  {
    id: "ai-coach",
    icon: Zap,
    kicker: "AI Coach",
    title: "Ask for a change.",
    highlight: "Watch your plan update.",
    body: "Most fitness apps hand you advice and leave the work to you. ALLUR's coach edits your actual plan. Tell it your shoulder's acting up, that you've only got 30 minutes, or that you're traveling all week — it rewrites your workouts and macros on the spot, and the new plan is live the moment you agree.",
    points: [
      "Talk to it like a real coach — it knows your history, injuries, and preferences",
      "Changes apply to your plan instantly, no copy-pasting advice between apps",
      "Answers grounded in a research-backed training knowledge base",
      "Available every day, not just at your weekly check-in",
    ],
  },
  {
    id: "workout-plans",
    icon: Dumbbell,
    kicker: "Personalized workout plans",
    title: "Built from your body.",
    highlight: "Not a template.",
    body: "Your plan starts with your goal, experience, equipment, schedule, and injuries — not a generic program with your name pasted on top. Training volume and progression follow published sports-science guidelines, the same evidence base behind our whole program engine. And when you miss a week, the plan recalibrates so a bad stretch doesn't turn into quitting.",
    points: [
      "Split, volume, and progression matched to your goal",
      "Works around injuries, equipment, and the time you actually have",
      "Progressive overload managed for you, session by session",
      "Recalibrates after missed workouts instead of guilt-tripping you",
    ],
  },
  {
    id: "macro-tracker",
    icon: Camera,
    kicker: "AI macro tracker",
    title: "Snap a photo.",
    highlight: "Macros in seconds.",
    body: "Logging food is where most people give up. ALLUR reads calories, protein, carbs, and fat from a photo of your plate, so staying aware of your intake takes seconds instead of a weigh-and-search session. Your targets stay tied to your plan — when your training changes, your macros follow.",
    points: [
      "Photo in, calories and macros out — no barcode hunting",
      "Review and adjust every meal before it's logged",
      "Targets set from your goal and updated with your plan",
      "Keeps nutrition awareness from becoming a second job",
    ],
  },
  {
    id: "physique-analysis",
    icon: ScanLine,
    kicker: "AI physique analysis",
    title: "See the progress",
    highlight: "the mirror hides.",
    body: "Progress photos tell you more than a scale, but your own eyes normalize change. ALLUR's physique analysis estimates body composition from a photo and tracks how it shifts over time, so you get objective feedback between milestones. Photos stay private to your account.",
    points: [
      "Body-composition estimate from a single photo",
      "Trend tracking across check-ins, not one-off snapshots",
      "Private to your account — analysis happens for your eyes only",
      "Informational estimates, not medical advice",
    ],
    disclaimer: true,
  },
];

function FeatureVisual({ id }: { id: string }) {
  if (id === "ai-coach") {
    return (
      <FlowDiagram
        steps={[
          { label: "You ask", sub: "text or voice", icon: MessageSquare },
          { label: "Reads your context", sub: "history, injuries", icon: Brain },
          { label: "Rewrites the plan", sub: "workouts + macros", icon: RefreshCw },
          { label: "Live", sub: "the moment you agree", icon: Zap },
        ]}
      />
    );
  }
  if (id === "workout-plans") {
    return (
      <BarChart
        data={[
          { label: "Wk 1", value: 60 },
          { label: "Wk 2", value: 72 },
          { label: "Wk 3", value: 84 },
          { label: "Wk 4", value: 64 },
          { label: "Wk 5", value: 92, highlight: true },
        ]}
        caption="Training volume ramps, then deloads — progressive overload, managed for you."
      />
    );
  }
  if (id === "macro-tracker") {
    return (
      <ScoreGauge
        value={92}
        label="On target today"
        caption="Snap a meal and your calories and macros are logged in seconds — no weighing or searching."
      />
    );
  }
  // physique-analysis
  return (
    <AdaptiveChart
      height={210}
      markers={[{ at: 2, label: "check-in" }, { at: 4, label: "check-in" }]}
      series={[
        { label: "What the mirror shows you", kind: "rigid", points: [40, 43, 39, 42, 40, 41] },
        { label: "What ALLUR measures", kind: "allur", points: [40, 47, 53, 60, 67, 74] },
      ]}
    />
  );
}

export default function Features() {
  const [, setLocation] = useLocation();
  const go = (path: string) => {
    setLocation(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  useSeo({
    title: "ALLUR Features — AI Coach, Macro Tracker & Adaptive Workout Plans",
    description:
      "Explore ALLUR's features: an AI coach that edits your plan in real time, photo-based calorie and macro tracking, AI physique analysis, and personalized workout plans that adapt when life changes.",
    path: "/features",
  });

  return (
    <PageShell>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[900px] lp-halo opacity-60" />
        <div className="max-w-4xl mx-auto px-6 pt-16 md:pt-24 pb-14 text-center relative z-10">
          <span className="lp-kicker mb-5 block">Features</span>
          <h1 className="lp-display text-4xl md:text-6xl font-bold leading-[1.05] mb-6">
            One coach.{" "}
            <span style={{ color: "var(--lp-cyan)" }}>Every tool that matters.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--lp-body)] max-w-2xl mx-auto leading-relaxed mb-8">
            ALLUR builds your training and nutrition around your body, then adapts it when
            life changes. Here's what's inside — and why it works when passive trackers don't.
          </p>
          <div className="mb-10">
            <FloatingChips chips={["AI Coach", "Adaptive plans", "Photo macros", "Physique scans"]} />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => go("/auth?mode=signup")}
              className="lp-cta h-14 px-8 text-lg inline-flex items-center justify-center gap-2 group"
            >
              Start free trial
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

      {/* FEATURE SECTIONS — alternating text / idea-diagram */}
      {FEATURES.map((f, i) => {
        const flip = i % 2 === 1;
        return (
          <section
            key={f.id}
            id={f.id}
            className="py-16 md:py-24 border-t border-[var(--lp-border)]/60"
            style={{ backgroundColor: i % 2 === 0 ? "var(--lp-bg-alt)" : "var(--lp-bg)" }}
          >
            <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* copy */}
              <div className={flip ? "lg:order-2" : ""}>
                <div className="w-12 h-12 rounded-xl lp-card flex items-center justify-center mb-6">
                  <f.icon className="w-6 h-6" style={{ color: "var(--lp-cyan)" }} />
                </div>
                <span className="lp-kicker mb-4 block">{f.kicker}</span>
                <h2 className="lp-display text-3xl md:text-4xl font-semibold mb-5">
                  {f.title} <span style={{ color: "var(--lp-cyan)" }}>{f.highlight}</span>
                </h2>
                <p className="text-lg text-[var(--lp-body)] leading-relaxed mb-6">{f.body}</p>
                <ul className="space-y-3">
                  {f.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <CheckCircle2
                        className="w-5 h-5 mt-0.5 shrink-0"
                        style={{ color: "var(--lp-teal)" }}
                      />
                      <span className="text-[var(--lp-body)]">{point}</span>
                    </li>
                  ))}
                </ul>
                {f.disclaimer && (
                  <p className="mt-6 text-sm text-[var(--lp-muted)]">
                    Estimates are informational only — read our{" "}
                    <button
                      onClick={() => go("/disclaimer")}
                      className="lp-underline hover:text-[var(--lp-text)] transition-colors"
                    >
                      health disclaimer
                    </button>
                    .
                  </p>
                )}
              </div>
              {/* idea diagram */}
              <Reveal delay={0.1} className={flip ? "lg:order-1" : ""}>
                <FeatureVisual id={f.id} />
              </Reveal>
            </div>
          </section>
        );
      })}

      {/* STAT ROW */}
      <section
        className="py-16 md:py-20 border-t border-[var(--lp-border)]/60"
        style={{ backgroundColor: "var(--lp-bg-proof)" }}
      >
        <div className="max-w-5xl mx-auto px-6">
          <StatRow
            stats={[
              { value: 3, label: "Free / Base / Premium tiers" },
              { value: 14, label: "Day free trial on Base" },
              { value: 4, label: "AI tools in one app" },
              { value: 24, suffix: "/7", label: "Coach in your pocket" },
            ]}
          />
        </div>
      </section>

      {/* ONE SYSTEM — radial hub */}
      <section
        className="py-20 md:py-24 border-t border-[var(--lp-border)]/60"
        style={{ backgroundColor: "var(--lp-bg-feature)" }}
      >
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="w-12 h-12 rounded-xl lp-card flex items-center justify-center mb-6">
              <RefreshCw className="w-6 h-6" style={{ color: "var(--lp-cyan)" }} />
            </div>
            <span className="lp-kicker mb-4 block">One system</span>
            <h2 className="lp-display text-3xl md:text-4xl font-semibold mb-6">
              Every feature feeds{" "}
              <span style={{ color: "var(--lp-cyan)" }}>the same loop.</span>
            </h2>
            <p className="text-lg text-[var(--lp-body)] leading-relaxed">
              Your plan drives your training. Your meals and photos feed your data. Your
              coach reads all of it and adjusts the plan. That's the whole point: you always
              know the next step, and the system flexes when life hits — so falling off for a
              week never means starting over.
            </p>
          </div>
          <Reveal delay={0.1}>
            <RadialHub
              center="Your plan"
              nodes={[
                { label: "AI Coach", icon: Brain },
                { label: "Workouts", icon: Dumbbell },
                { label: "Macros", icon: Camera },
                { label: "Physique", icon: ScanLine },
                { label: "Progress", icon: LineChart },
              ]}
            />
          </Reveal>
        </div>
      </section>

      {/* COMPARISON */}
      <section
        className="py-20 md:py-24 border-t border-[var(--lp-border)]/60"
        style={{ backgroundColor: "var(--lp-bg-alt)" }}
      >
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="lp-kicker mb-4 block">The difference</span>
            <h2 className="lp-display text-3xl md:text-4xl font-semibold">
              Not another <span style={{ color: "var(--lp-cyan)" }}>passive tracker.</span>
            </h2>
          </div>
          <ComparisonTable
            columns={["", "ALLUR", "Passive tracker", "Generic app"]}
            rows={[
              { label: "Edits your actual plan", cells: [true, false, false] },
              { label: "Adapts when you miss a week", cells: [true, false, false] },
              { label: "Photo calorie + macro logging", cells: [true, "Manual", false] },
              { label: "AI physique analysis", cells: [true, false, false] },
              { label: "Built around your body & injuries", cells: [true, false, "Template"] },
              { label: "Coaching, not just data", cells: [true, false, false] },
            ]}
          />
        </div>
      </section>
    </PageShell>
  );
}
