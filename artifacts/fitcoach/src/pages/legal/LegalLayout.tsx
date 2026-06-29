import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  const [, setLocation] = useLocation();
  return (
    <div className="allur-lp min-h-screen w-full" style={{ backgroundColor: "var(--lp-bg)" }}>
      <div className="mx-auto w-full max-w-2xl px-5 pb-20 pt-6">
        <button
          onClick={() => setLocation("/home")}
          className="inline-flex items-center gap-2 text-sm transition-colors"
          style={{ color: "var(--lp-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mt-8">
          <h1 className="lp-display text-3xl sm:text-4xl" style={{ color: "var(--lp-text)" }}>
            {title}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--lp-muted)" }}>
            Last updated {updated}
          </p>
        </div>

        <div
          className="legal-body mt-8 space-y-6 text-[15px] leading-relaxed"
          style={{ color: "var(--lp-body)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold" style={{ color: "var(--lp-text)" }}>
        {heading}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
