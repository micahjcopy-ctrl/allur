import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";
import PageShell from "@/components/PageShell";
import { isNative } from "@/lib/native";

export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  // Inside the iOS app the legal pages are reached from the paywall and the
  // Account screen. They must read as part of the app: no website nav, no
  // footer, no Pricing / "Get the app" links (the web tiers are not sold
  // in-app — Apple guideline 3.1.1). `allur-lp` keeps the landing palette the
  // legal body is styled with.
  if (isNative()) {
    return <NativeLegalLayout title={title} updated={updated}>{children}</NativeLegalLayout>;
  }
  return (
    <PageShell>
      <div className="relative overflow-hidden border-b border-[var(--lp-border)]/60">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] lp-halo opacity-40" />
        <div className="mx-auto w-full max-w-3xl px-6 pt-14 md:pt-20 pb-12 relative z-10">
          <span className="lp-kicker mb-4 block">Legal</span>
          <h1
            className="lp-display text-4xl md:text-5xl font-bold"
            style={{ color: "var(--lp-text)" }}
          >
            {title}
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--lp-muted)" }}>
            Last updated {updated}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-6 py-14 md:py-16">
        <div
          className="legal-body space-y-7 text-[15px] leading-relaxed"
          style={{ color: "var(--lp-body)" }}
        >
          {children}
        </div>
      </div>
    </PageShell>
  );
}

function NativeLegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const [, setLocation] = useLocation();
  const back = () => {
    // The paywall / Account pushed this page; go back to it. A cold open
    // (no history) lands on the app root, which RouteGuard resolves.
    if (window.history.length > 1) window.history.back();
    else setLocation("/");
  };
  return (
    <div
      className="allur-lp min-h-screen w-full pt-[calc(1rem_+_env(safe-area-inset-top))] pb-[calc(2rem_+_env(safe-area-inset-bottom))]"
      style={{ backgroundColor: "var(--lp-bg)" }}
    >
      <div className="mx-auto w-full max-w-3xl px-6">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1 text-sm font-semibold py-2 -ml-1"
          style={{ color: "var(--lp-cyan)" }}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <span className="lp-kicker mt-6 mb-3 block">Legal</span>
        <h1 className="lp-display text-3xl font-bold" style={{ color: "var(--lp-text)" }}>
          {title}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--lp-muted)" }}>
          Last updated {updated}
        </p>
        <div
          className="legal-body mt-8 space-y-7 text-[15px] leading-relaxed"
          style={{ color: "var(--lp-body)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2
        className="lp-display text-xl font-semibold"
        style={{ color: "var(--lp-text)" }}
      >
        {heading}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
