import { type Request } from "express";

/**
 * The app's public origin (e.g. https://allur.vercel.app), host-agnostic.
 *
 * Preference order:
 *   1. APP_URL            — explicit, set this in production for stable links.
 *   2. VERCEL_URL         — auto-injected by Vercel (no protocol), per-deploy.
 *   3. REPLIT_DOMAINS     — legacy Replit hosting.
 *
 * Returns undefined if none are set; callers that have a Request can fall back
 * to the incoming host via publicBaseUrlFor().
 */
export function publicBaseUrl(): string | undefined {
  const appUrl = process.env["APP_URL"];
  if (appUrl) return appUrl.replace(/\/+$/, "");

  const vercel = process.env["VERCEL_URL"];
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  const replit = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  if (replit) return `https://${replit}`;

  return undefined;
}

/** Like publicBaseUrl(), but falls back to the incoming request's host. */
export function publicBaseUrlFor(req: Request): string {
  return publicBaseUrl() ?? `${req.protocol}://${req.get("host")}`;
}
