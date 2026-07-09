import { type ReactNode } from "react";
import { useLocation } from "wouter";

const BASE_URL = import.meta.env.BASE_URL;

// Global footer — identical on EVERY page. This is the site's full sitemap:
// every public page gets an internal link here (hub-and-spoke SEO) without
// cluttering the top nav. New sections (For your goal · Guides) get their own
// columns as those pages ship.
export default function SiteFooter() {
  const [, setLocation] = useLocation();

  const go = (path: string) => {
    setLocation(path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
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
              ["Features", "/features"],
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
