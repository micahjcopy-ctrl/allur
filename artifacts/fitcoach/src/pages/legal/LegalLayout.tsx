import type { ReactNode } from "react";
import PageShell from "@/components/PageShell";

export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
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
