import { useEffect } from "react";

// Dependency-free per-page SEO. Sets document.title, meta description,
// canonical, and Open Graph/Twitter tags on mount / when inputs change.
// Used on the public marketing + legal pages so each route has unique,
// self-referencing metadata (react-helmet would require a dependency + a
// lockfile regen that isn't available in this deploy setup).

const SITE = "https://www.getallur.com";

interface SeoOptions {
  title: string;
  description?: string;
  /** Canonical path, e.g. "/about". Defaults to the current pathname. */
  path?: string;
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo({ title, description, path }: SeoOptions) {
  useEffect(() => {
    document.title = title;
    upsertMeta("property", "og:title", title);
    upsertMeta("name", "twitter:title", title);
    if (description) {
      upsertMeta("name", "description", description);
      upsertMeta("property", "og:description", description);
      upsertMeta("name", "twitter:description", description);
    }
    const url =
      SITE +
      (path ?? (typeof window !== "undefined" ? window.location.pathname : "/"));
    upsertMeta("property", "og:url", url);
    upsertCanonical(url);
  }, [title, description, path]);
}
