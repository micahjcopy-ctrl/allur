import { useLocation } from "wouter";
import { CheckCircle2, Minus, ChevronRight } from "lucide-react";
import PageShell from "@/components/PageShell";
import { useSeo } from "@/hooks/useSeo";
import { StatRow } from "@/components/marketing/Graphics";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Build your plan and start tracking.",
    cta: "Get started free",
    highlight: false,
    features: [
      "Personalized training plan",
      "Guided onboarding",
      "Daily dashboard",
      "Weight, PR & progress-photo tracking",
    ],
  },
  {
    name: "Base",
    price: "$12.99",
    cadence: "/mo",
    tagline: "Your AI coach, unlocked.",
    cta: "Start 14-day free trial",
    highlight: false,
    note: "14-day free trial included",
    features: [
      "Everything in Free",
      "AI Coach (50 conversations / mo)",
      "Photo meal logging (150 / mo)",
      "AI body scans (20 / mo)",
      "AI plan adjustments",
    ],
  },
  {
    name: "Premium",
    price: "$29.99",
    cadence: "/mo",
    tagline: "Maximum adaptation, no limits.",
    cta: "Get Premium",
    highlight: true,
    features: [
      "Everything in Base",
      "Unlimited AI coach conversations",
      "Unlimited photo meal logging",
      "Unlimited AI body scans",
      "Voice notes with the AI coach",
      "Priority plan rebalancing",
    ],
  },
];

const COMPARISON: { label: string; free: string | boolean; base: string | boolean; premium: string | boolean }[] = [
  { label: "Personalized training plan", free: true, base: true, premium: true },
  { label: "Dashboard & progress tracking", free: true, base: true, premium: true },
  { label: "AI Coach conversations", free: false, base: "50 / mo", premium: "Unlimited" },
  { label: "Photo meal logging", free: false, base: "150 / mo", premium: "Unlimited" },
  { label: "AI physique / body scans", free: false, base: "20 / mo", premium: "Unlimited" },
  { label: "AI plan adjustments", free: false, base: true, premium: true },
  { label: "Voice coaching", free: false, base: false, premium: true },
  { label: "Priority rebalancing", free: false, base: false, premium: true },
];

const FAQ = [
  {
    q: "Is there really a free plan?",
    a: "Yes. You can build your personalized plan and track your workouts, weight, PRs, and progress photos for free — no card required. The AI coach, photo meal logging, and body scans are part of the paid plans.",
  },
  {
    q: "How does the free trial work?",
    a: "Base comes with a 14-day free trial. You get full AI access for two weeks. Cancel anytime before the trial ends from your account and you won't be charged.",
  },
  {
    q: "What happens if I hit my Base limits?",
    a: "Base includes a generous monthly allowance (50 coach conversations, 150 meal logs, 20 body scans). If you want no limits at all, you can upgrade to Premium anytime for unlimited everything.",
  },
  {
    q: "Can I cancel or switch plans anytime?",
    a: "Absolutely. Upgrade, downgrade, or cancel from your account in a couple of taps. If you cancel, you keep access through the end of your billing period and your data stays put.",
  },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const go = (path: string) => {
    setLocation(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const signup = () => go("/auth?mode=signup");

  useSeo({
    title: "Pricing — ALLUR AI Fitness Coach ($0, $12.99, $29.99)",
    description:
      "Simple ALLUR pricing: a free plan to build and track, Base at $12.99/mo with a 14-day free trial for full AI coaching, and Premium at $29.99/mo for unlimited everything.",
    path: "/pricing",
  });

  return (
    <PageShell>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[900px] lp-halo opacity-60" />
        <div className="max-w-3xl mx-auto px-6 pt-16 md:pt-24 pb-10 text-center relative z-10">
          <span className="lp-kicker mb-5 block">Pricing</span>
          <h1 className="lp-display text-4xl md:text-6xl font-bold leading-[1.05] mb-6">
            Elite coaching,{" "}
            <span style={{ color: "var(--lp-cyan)" }}>accessible pricing.</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--lp-body)] max-w-2xl mx-auto">
            You're not paying for more information. You're paying for{" "}
            <span className="lp-underline">less friction</span> — and a system
            that keeps you moving when life gets messy.
          </p>
        </div>
      </section>

      {/* STAT ROW */}
      <section className="pb-10 pt-2">
        <div className="max-w-4xl mx-auto px-6">
          <StatRow
            stats={[
              { value: 0, prefix: "$", label: "Free plan, forever" },
              { value: 12.99, prefix: "$", decimals: 2, label: "Base per month" },
              { value: 14, label: "Day free trial on Base" },
              { value: 29.99, prefix: "$", decimals: 2, label: "Premium per month" },
            ]}
          />
        </div>
      </section>

      {/* TIERS */}
      <section className="pb-8 md:pb-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className="lp-card p-8 flex flex-col relative overflow-hidden"
                style={
                  t.highlight
                    ? {
                        borderColor: "rgba(110,231,242,0.4)",
                        boxShadow: "0 0 50px -18px rgba(110,231,242,0.4)",
                      }
                    : undefined
                }
              >
                {t.highlight && (
                  <div
                    className="absolute top-0 right-0 text-xs font-semibold px-4 py-1 rounded-bl-xl uppercase tracking-wide"
                    style={{
                      backgroundImage: "linear-gradient(135deg, #6EE7F2, #2DD4BF)",
                      color: "#04111A",
                    }}
                  >
                    Recommended
                  </div>
                )}
                <div className="mb-7 relative z-10">
                  <h3 className="lp-display text-2xl font-semibold mb-2">
                    {t.name}
                  </h3>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="lp-display text-5xl font-bold">{t.price}</span>
                    <span className="text-[var(--lp-muted)] mb-1">{t.cadence}</span>
                  </div>
                  {t.note ? (
                    <p className="font-medium" style={{ color: "var(--lp-cyan)" }}>
                      {t.note}
                    </p>
                  ) : (
                    <p className="text-[var(--lp-muted)]">{t.tagline}</p>
                  )}
                </div>

                <ul className="space-y-3.5 mb-9 flex-1 relative z-10 text-[var(--lp-body)]">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <CheckCircle2
                        className="w-5 h-5 shrink-0"
                        style={{
                          color: t.highlight
                            ? "var(--lp-cyan)"
                            : "var(--lp-muted)",
                        }}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={signup}
                  className={`${
                    t.highlight ? "lp-cta" : "lp-cta-ghost"
                  } w-full h-14 text-lg inline-flex items-center justify-center relative z-10`}
                >
                  {t.cta}
                </button>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-[var(--lp-muted)] mt-8">
            All plans are month-to-month. Cancel anytime. Prices in USD.
          </p>
        </div>
      </section>

      {/* COMPARISON */}
      <section
        className="py-20 md:py-28 border-y border-[var(--lp-border)]/60"
        style={{ backgroundColor: "var(--lp-bg-feature)" }}
      >
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="lp-kicker mb-4 block">Compare plans</span>
            <h2 className="lp-display text-3xl md:text-4xl font-semibold">
              Everything, side by side.
            </h2>
          </div>
          <div className="lp-card overflow-hidden">
            <div className="grid grid-cols-4 px-5 py-4 text-sm font-semibold text-[var(--lp-text)] border-b border-[var(--lp-border)]">
              <div className="col-span-1">Feature</div>
              <div className="text-center">Free</div>
              <div className="text-center">Base</div>
              <div className="text-center" style={{ color: "var(--lp-cyan)" }}>
                Premium
              </div>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.label}
                className="grid grid-cols-4 px-5 py-4 text-sm items-center"
                style={{
                  borderBottom:
                    i < COMPARISON.length - 1
                      ? "1px solid var(--lp-border)"
                      : undefined,
                  backgroundColor: i % 2 === 1 ? "rgba(255,255,255,0.015)" : undefined,
                }}
              >
                <div className="col-span-1 text-[var(--lp-body)]">{row.label}</div>
                <Cell value={row.free} />
                <Cell value={row.base} />
                <Cell value={row.premium} highlight />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="lp-kicker mb-4 block">Pricing questions</span>
            <h2 className="lp-display text-3xl md:text-4xl font-semibold">
              Good to know.
            </h2>
          </div>
          <div className="space-y-4">
            {FAQ.map((f) => (
              <div key={f.q} className="lp-card p-6">
                <h3 className="lp-display text-lg font-semibold text-[var(--lp-text)] mb-2">
                  {f.q}
                </h3>
                <p className="text-[var(--lp-muted)] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <button
              onClick={signup}
              className="lp-cta h-14 px-10 text-lg inline-flex items-center justify-center gap-2 group"
            >
              Start your 14-day free trial
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Cell({ value, highlight }: { value: string | boolean; highlight?: boolean }) {
  if (value === true) {
    return (
      <div className="text-center">
        <CheckCircle2
          className="w-5 h-5 mx-auto"
          style={{ color: highlight ? "var(--lp-cyan)" : "var(--lp-teal)" }}
        />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="text-center">
        <Minus className="w-4 h-4 mx-auto" style={{ color: "var(--lp-border)" }} />
      </div>
    );
  }
  return (
    <div
      className="text-center text-xs font-medium"
      style={{ color: highlight ? "var(--lp-cyan)" : "var(--lp-body)" }}
    >
      {value}
    </div>
  );
}
