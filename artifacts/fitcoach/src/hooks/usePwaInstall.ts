import { useEffect, useMemo, useState } from "react";

export type PwaPlatform = "ios" | "android" | "desktop";

/**
 * The URL a QR code / shared link should encode so a phone lands directly on the
 * install walkthrough (`/get`), NOT the marketing landing. Scanning the landing
 * root just opened the homepage with no install guidance — which read as "nothing
 * downloaded." `/get` shows platform-specific Add-to-Home-Screen steps (iOS) and
 * the native install button (Android). Built off the runtime origin so it works
 * in both the dev preview and the published deploy.
 */
/**
 * Canonical production origin for install links. Vercel PREVIEW deployments
 * (e.g. allur-git-branch-xxx.vercel.app) sit behind Vercel Authentication, so a
 * QR scanned while viewing a preview sent phones to a Vercel login screen.
 * Any *.vercel.app origin that isn't production is rewritten to production;
 * localhost and custom domains pass through unchanged.
 */
const PROD_ORIGIN = "https://allur-mauve.vercel.app";

export function buildInstallUrl(): string {
  if (typeof window === "undefined") return "";
  const base = import.meta.env.BASE_URL || "/";
  const path = base.endsWith("/") ? base : `${base}/`;
  const { origin, hostname } = window.location;
  const isVercelPreview = hostname.endsWith(".vercel.app") && origin !== PROD_ORIGIN;
  return `${isVercelPreview ? PROD_ORIGIN : origin}${path}get?utm_source=qr`;
}

export function detectPlatform(): PwaPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (
    /macintosh/i.test(ua) &&
    typeof document !== "undefined" &&
    "ontouchend" in document
  ) {
    return "ios"; // iPadOS masquerades as desktop Safari
  }
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export type IosBrowser = "safari" | "chrome" | "firefox" | "edge" | "opera" | "inapp";

/**
 * Which iOS browser is rendering us. This matters because "Add to Home Screen"
 * ONLY exists in real Safari on iOS — it is absent in Chrome (CriOS), Firefox
 * (FxiOS), Edge (EdgiOS), Opera, and the in-app WKWebViews that links open in
 * when tapped from inside another app (Instagram, Messages link previews, most
 * third-party QR scanners). A user in any of those literally has no install
 * option, so /get must steer them into Safari first.
 *
 * Note: Chrome/Edge/etc. on iOS still include the "Safari" token in their UA
 * (they're all WebKit), so the branded tokens must be checked BEFORE the bare
 * Safari check. A genuine Safari UA carries both "Version/" and "Safari".
 */
export function detectIosBrowser(): IosBrowser {
  if (typeof navigator === "undefined") return "safari";
  const ua = navigator.userAgent || "";
  if (/CriOS/i.test(ua)) return "chrome";
  if (/FxiOS/i.test(ua)) return "firefox";
  if (/EdgiOS/i.test(ua)) return "edge";
  if (/OPiOS|OPT\//i.test(ua)) return "opera";
  if (/(FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|Snapchat|LinkedInApp|Pinterest|GSA\/|MicroMessenger|TikTok|musical_ly)/i.test(ua)) {
    return "inapp";
  }
  if (/Safari/i.test(ua) && /Version\//i.test(ua)) return "safari";
  // WKWebView in-app browsers typically drop the Safari/Version tokens entirely.
  return "inapp";
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * True when the app is running as an installed PWA (launched from the home
 * screen in standalone display mode) rather than in a normal browser tab.
 * Used to branch the signed-out entry experience: the installed app opens to a
 * minimal branded welcome screen, while the browser shows the full marketing
 * landing page.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Shared PWA install state used by both the full "Get the app" page and the
 * post-onboarding install prompt. Tracks the deferred `beforeinstallprompt`
 * event (Android / desktop Chrome), whether the app is already installed
 * (standalone display mode or a prior `appinstalled`), and exposes a single
 * `promptInstall()` that fires the native install dialog when available.
 */
export function usePwaInstall() {
  const platform = useMemo(detectPlatform, []);
  const iosBrowser = useMemo(detectIosBrowser, []);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isStandalone()) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    await deferredPrompt.prompt();
    let outcome: "accepted" | "dismissed" = "dismissed";
    try {
      ({ outcome } = await deferredPrompt.userChoice);
    } catch {
      /* user dismissed */
    }
    setDeferredPrompt(null);
    return outcome;
  };

  return {
    platform,
    iosBrowser,
    installed,
    canInstall: !!deferredPrompt,
    promptInstall,
  };
}
