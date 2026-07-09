import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Menu, X } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL;

const NAV_LINKS: [string, string][] = [
  ["Features", "/features"],
  ["Pricing", "/pricing"],
  ["About", "/about"],
];

// Global top nav — identical on EVERY page (landing included) so the whole
// site presents one menu: logo → /home, Features · Pricing · About, then
// Sign in + Start free trial. Transparent at the very top and frosted once
// scrolled, so it sits cleanly over the landing hero and normal pages alike.
export default function SiteNav() {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (path: string) => {
    setMenuOpen(false);
    setLocation(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? "bg-[var(--lp-bg)]/85 backdrop-blur-md border-b border-[var(--lp-border)]/70"
          : "bg-transparent"
      }`}
    >
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
  );
}
