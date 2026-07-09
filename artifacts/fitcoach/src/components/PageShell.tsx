import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

// Shared premium chrome (nav + CTA band + footer) so every page matches the
// TITANIUM landing design. Wrap any marketing / legal page in <PageShell>.
// The nav and footer themselves live in SiteNav / SiteFooter so the landing
// page (which manages its own sections) can use the exact same chrome.
export default function PageShell({
  children,
  cta = true,
}: {
  children: ReactNode;
  cta?: boolean;
}) {
  const [, setLocation] = useLocation();

  const go = (path: string) => {
    setLocation(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div
      className="allur-lp min-h-screen w-full"
      style={{ backgroundColor: "var(--lp-bg)" }}
    >
      <SiteNav />

      {/* CONTENT (offset for the fixed nav) */}
      <main className="pt-20">{children}</main>

      {/* CTA BAND */}
      {cta && (
        <section
          className="py-24 md:py-28 relative overflow-hidden border-t border-[var(--lp-border)]/60"
          style={{ backgroundColor: "var(--lp-bg-cta)" }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] lp-halo opacity-70" />
          <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
            <span className="lp-kicker mb-4 block">Start today</span>
            <h2 className="lp-display text-4xl md:text-5xl font-bold mb-5">
              Stop guessing.{" "}
              <span style={{ color: "var(--lp-cyan)" }}>Start progressing.</span>
            </h2>
            <p className="text-lg md:text-xl text-[var(--lp-body)] mb-9 max-w-xl mx-auto">
              Get a plan built around your body — one that adapts the moment life
              changes.
            </p>
            <button
              onClick={() => go("/auth?mode=signup")}
              className="lp-cta h-14 px-10 text-lg inline-flex items-center justify-center gap-2 group"
            >
              Start your transformation
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-sm text-[var(--lp-muted)] mt-5 font-medium">
              <span className="text-[var(--lp-text)]">14-day free trial</span> ·
              Cancel anytime
            </p>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
