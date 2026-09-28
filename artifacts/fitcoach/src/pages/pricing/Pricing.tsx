import { useLocation } from "wouter";
import { CheckCircle2, Minus, ChevronRight } from "lucide-react";
import PageShell from "@/components/PageShell";
import { useSeo } from "@/hooks/useSeo";
import { StatRow } from "@/components/marketing/Graphics";

const TIERS = [
  {
    name: "Base",
    price: "$10.99",
    cadence: "/mo",
    tagline: "Your plan, your AI coach, your tracking.",
    cta: "Get ALLUR Base",
    highlight: true,
    note: "Or $69/year — save ~48%. Cancel anytime.",
    features: [
      "Personalized training plan and daily dashboard",
      "Workout logging with PR detection",
      "Weight, progress-photo and cardio tracking",
      "AI Coach, text and voice (50 conversations / mo)",
      "Photo and text meal logging (150 / mo)",
      "AI body scans with plan rebalancing (20 / mo)",
    ],
  },
  {
    name: "Premium",
    price: "$29.99",
    cadence: "/mo",
    tagline: "No monthly limits.",
    cta: "Get Premium",
    highlight: false,
    note: "Available on the web.",
    features: [
      "Everything in Base",
      "Unlimited AI coach conversations",
      "Unlimited meal logging",
      "Unlimited AI body scans",
      "Unlimited squad duels",
    ],
  },
];

const COMPARISON: { label: string; base: string | boolean; premium: string | boolean }[] = [
  { label: "Personalized training plan", base: true, premium: true },
  { label: "Dashboard & progress tracking", base: true, premium: true },
  { label: "AI Coach conversations (text & voice)", base: "50 / mo", premium: "Unlimited" },
  { label: "Meal logging (photo & text)", base: "150 / mo", premium: "Unlimited" },
  { label: "AI physique / body scans", base: "20 / mo", premium: "Unlimited" },
  { label: "AI plan adjustments", base: true, premium: true },
  { label: "Squad duels", base: "1 at a time", premium: "Unlimited" },
];

const FAQ = [
  {
    q: "Is there a free plan or a trial?",
    a: "No. You build your plan first, then subscribe to ALLUR Base to start training with it. Billing starts the day you subscribe, and you can cancel anytime.",
  },
  {
    q: "Can I pay monthly or yearly?",
    a: "Base is $10.99/month, or $69/year — about $5.75/month, roughly 48% off. You're billed today and can cancel anytime in two taps from your account.",
  },
  {
    q: "What happens if I hit my Base limits?",
    a: "Base includes a monthly allowance (50 coach conversations, 150 meal logs, 20 body scans). If you want no limits, Premium is available on the web for unlimited everything.",
  },
  {
    q: "Can I cancel or switch plans anytime?",
    a: "Yes. On the web, manage your plan from your account. In the iOS app, subscriptions are managed through your Apple ID. If you cancel, you keep access through the end of your billing period and your data stays put.",
  },
];

export default function Pricing() {
  const [, setLocation] = useLocation();
  const go = (path: string) => {
    setLocation(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const signup = () => go("/onboarding");

  useSeo({
    title: "Pricing — ALLUR AI Fitness Coach ($10.99/mo or $69/yr)",
    description:
      "Simple ALLUR pricing: Base at $10.99/mo (or $69/yr) for your plan, AI coaching and tracking, and Premium at $29.99/mo on the web for unlimited everything.",
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
              { value: 10.99, prefix: "$", decimals: 2, label: "Base per month" },
              { value: 69, prefix: "$", decimals: 0, label: "Base per year" },
              { value: 29.99, prefix: "$", decimals: 2, label: "Premium per month" },
            ]}
          />
        </div>
      </section>

      {/* TIERS */}
      <section className="pb-8 md:pb-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch max-w-3xl mx-auto">
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
            Monthly or annual. Cancel anytime. Prices in USD.
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
            <div className="grid grid-cols-3 px-5 py-4 text-sm font-semibold text-[var(--lp-text)] border-b border-[var(--lp-border)]">
              <div className="col-span-1">Feature</div>
              <div className="text-center">Base</div>
              <div className="text-center" style={{ color: "var(--lp-cyan)" }}>
                Premium
              </div>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.label}
                className="grid grid-cols-3 px-5 py-4 text-sm items-center"
                style={{
                  borderBottom:
                    i < COMPARISON.length - 1
                      ? "1px solid var(--lp-border)"
                      : undefined,
                  backgroundColor: i % 2 === 1 ? "rgba(255,255,255,0.015)" : undefined,
                }}
              >
                <div className="col-span-1 text-[var(--lp-body)]">{row.label}</div>
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
              Get ALLUR Base
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
