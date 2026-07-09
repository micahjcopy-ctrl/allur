import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Menu, X, ChevronRight } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL;

const NAV_LINKS: [string, string][] = [
  ["Home", "/home"],
  ["Pricing", "/pricing"],
  ["About", "/about"],
];

// Shared premium chrome (nav + CTA band + footer) so every page matches the
// TITANIUM landing design. Wrap any marketing / legal page in <PageShell>.
export default function PageShell({
  children,
  cta = true,
}: {
  children: ReactNode;
  cta?: boolean;
}) {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (path: string) => {
    setMenuOpen(false);
    setLocation(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div
      className="allur-lp min-h-screen w-full"
      style={{ backgroundColor: "var(--lp-bg)" }}
    >
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--lp-bg)]/85 backdrop-blur-md border-b border-[var(--lp-border)]/70">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <button
            type="button"
            aria-label="ALLUR — home"
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => go("/home")}
          >
            <img
              src={`${BASE_URL}allur-logo.png`}
              alt="ALLUR"
              className="h-16 md:h-20 object-contain"
            />
          </button>

          <div className="hidden md:flex items-center gap-9 text-sm font-medium text-[var(--lp-muted)]">
            {NAV_LINKS.map(([label, path]) => (
              <button
                key={path}
                onClick={() => go(path)}
                className="hover:text-[var(--lp-text)] transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-5">
            <button
              onClick={() => go("/auth?mode=login")}
              className="text-sm font-medium text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => go("/auth?mode=signup")}
              className="lp-cta h-11 px-6 text-sm inline-flex items-center justify-center"
            >
              Start free trial
            </button>
          </div>

          <button
            className="md:hidden text-[var(--lp-text)]"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {menuOpen && (
          <div className="absolute top-20 left-0 right-0 bg-[var(--lp-bg)]/97 backdrop-blur-xl border-b border-[var(--lp-border)]/70 p-6 flex flex-col gap-6 md:hidden shadow-2xl">
            <div className="flex flex-col gap-4 text-lg font-medium">
              {NAV_LINKS.map(([label, path]) => (
                <button
                  key={path}
                  onClick={() => go(path)}
                  className="text-left text-[var(--lp-muted)] hover:text-[var(--lp-text)]"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="h-px lp-divider w-full" />
            <div className="flex flex-col gap-4">
              <button
                onClick={() => go("/auth?mode=login")}
                className="text-left text-lg font-medium text-[var(--lp-muted)] hover:text-[var(--lp-text)]"
              >
                Sign in
              </button>
              <button
                onClick={() => go("/auth?mode=signup")}
                className="lp-cta w-full py-4 text-base inline-flex items-center justify-center"
              >
                Start free trial
              </button>
            </div>
          </div>
        )}
      </nav>

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

      {/* FOOTER */}
      <footer
        className="border-t border-[var(--lp-border)] pt-16 pb-10"
        style={{ backgroundColor: "var(--lp-bg-footer)" }}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
            <div className="col-span-2 md:col-span-1">
              <img
                src={`${BASE_URL}allur-logo.png`}
                alt="ALLUR"
                className="h-6 mb-5"
              />
              <p className="text-[var(--lp-muted)] max-w-xs leading-relaxed text-sm">
                The premium AI body-transformation coach, built to adapt to real
                life.
              </p>
            </div>
            <FooterCol
              title="Product"
              links={[
                ["Home", "/home"],
                ["Pricing", "/pricing"],
                ["Get the app", "/get"],
              ]}
              go={go}
            />
            <FooterCol
              title="Company"
              links={[["About", "/about"]]}
              go={go}
              extra={
                <a
                  href="mailto:raiden@getallur.com"
                  className="hover:text-[var(--lp-text)] transition-colors"
                >
                  Contact
                </a>
              }
            />
            <FooterCol
              title="Legal"
              links={[
                ["Privacy Policy", "/privacy"],
                ["Terms of Service", "/terms"],
                ["Disclaimer", "/disclaimer"],
              ]}
              go={go}
            />
          </div>
          <div
            className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[var(--lp-muted)]"
            style={{ borderTop: "1px solid var(--lp-border)" }}
          >
            <p>© {new Date().getFullYear()} ALLUR. All rights reserved.</p>
            <button
              onClick={() => go("/auth?mode=signup")}
              className="font-medium transition-opacity hover:opacity-80"
              style={{ color: "var(--lp-cyan)" }}
            >
              Start free trial →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  title,
  links,
  go,
  extra,
}: {
  title: string;
  links: [string, string][];
  go: (path: string) => void;
  extra?: ReactNode;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--lp-text)] mb-4">
        {title}
      </h4>
      <ul className="space-y-3 text-sm text-[var(--lp-muted)]">
        {links.map(([label, path]) => (
          <li key={path}>
            <button
              onClick={() => go(path)}
              className="hover:text-[var(--lp-text)] transition-colors"
            >
              {label}
            </button>
          </li>
        ))}
        {extra && <li>{extra}</li>}
      </ul>
    </div>
  );
}
