import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft,
  Download,
  Share,
  SquarePlus,
  MoreVertical,
  Smartphone,
  ShieldCheck,
  Compass,
  Copy,
  Check,
} from "lucide-react";
import { usePwaInstall, buildInstallUrl } from "@/hooks/usePwaInstall";

export default function GetApp() {
  const [, setLocation] = useLocation();
  const { platform, iosBrowser, installed, canInstall, promptInstall } = usePwaInstall();
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const installUrl = useMemo(() => buildInstallUrl(), []);

  // On iPhone/iPad, "Add to Home Screen" exists ONLY in Safari. If the page was
  // opened in Chrome/Firefox/Edge or an in-app browser (very common when a link
  // or QR is opened from inside another app), there is genuinely no install
  // option — so we steer the user into Safari instead of showing dead steps.
  const needsSafari = platform === "ios" && !installed && iosBrowser !== "safari";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(installUrl || window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can still long-press the URL */
    }
  };

  // Older iOS captures the *current* URL on "Add to Home Screen" instead of the
  // manifest start_url, so a user who installed while on /get would relaunch the
  // PWA straight back into this install page. If we're running standalone (an
  // already-installed launch), send them into the actual app instead.
  useEffect(() => {
    if (installed) setLocation("/");
  }, [installed, setLocation]);

  const downloadQr = () => {
    const src = qrRef.current?.querySelector("canvas");
    if (!src) return;
    // Compose a padded canvas so the downloaded PNG keeps a scannable quiet zone.
    const pad = Math.round(src.width * 0.08);
    const out = document.createElement("canvas");
    out.width = src.width + pad * 2;
    out.height = src.height + pad * 2;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, pad, pad);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = "allur-qr-code.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const steps: { icon: typeof Share; text: string }[] =
    platform === "ios"
      ? [
          { icon: Compass, text: "Make sure this page is open in Safari (not Chrome or an in-app browser)." },
          { icon: Share, text: "Tap the Share button — the square with an up arrow in Safari's toolbar." },
          { icon: SquarePlus, text: "Scroll down and choose “Add to Home Screen,” then tap Add." },
          { icon: Smartphone, text: "Open ALLUR from your home screen like any app." },
        ]
      : platform === "android"
        ? [
            { icon: MoreVertical, text: "Tap the ⋮ menu in Chrome (top-right)." },
            { icon: SquarePlus, text: "Choose “Install app” or “Add to Home screen.”" },
            { icon: Smartphone, text: "Open ALLUR from your home screen like any app." },
          ]
        : [
            { icon: Smartphone, text: "Point your phone camera at the QR code." },
            { icon: Share, text: "Open the link, then use your browser's Share / menu." },
            { icon: SquarePlus, text: "Choose “Add to Home Screen” to install ALLUR." },
          ];

  return (
    <div className="allur-lp min-h-screen w-full" style={{ backgroundColor: "var(--lp-bg)" }}>
      <div className="mx-auto w-full max-w-xl px-5 pb-16 pt-6">
        <button
          onClick={() => setLocation("/home")}
          className="inline-flex items-center gap-2 text-sm transition-colors"
          style={{ color: "var(--lp-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mt-8 text-center">
          <div
            className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "var(--lp-elevated)", border: "1px solid var(--lp-border)" }}
          >
            <Smartphone className="h-6 w-6" style={{ color: "var(--lp-cyan)" }} />
          </div>
          <p className="lp-kicker">GET THE APP</p>
          <h1 className="lp-display mt-2 text-3xl sm:text-4xl" style={{ color: "var(--lp-text)" }}>
            ALLUR on your phone
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base" style={{ color: "var(--lp-body)" }}>
            {platform === "desktop"
              ? "Scan the code with your phone, then add ALLUR to your home screen — it opens just like a native app."
              : "Add ALLUR to your home screen and it opens just like a native app, full-screen and one tap away."}
          </p>
        </div>

        {/* iOS non-Safari warning: "Add to Home Screen" only exists in Safari */}
        {needsSafari && (
          <div
            className="mt-8 rounded-2xl p-5"
            style={{
              backgroundColor: "rgba(34, 211, 238, 0.08)",
              border: "1px solid var(--lp-cyan)",
            }}
          >
            <div className="flex items-start gap-3">
              <Compass className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--lp-cyan)" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--lp-text)" }}>
                  Open this page in Safari to install
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--lp-body)" }}>
                  On iPhone, “Add to Home Screen” is only available in Safari — not in
                  {iosBrowser === "chrome"
                    ? " Chrome"
                    : iosBrowser === "firefox"
                      ? " Firefox"
                      : iosBrowser === "edge"
                        ? " Edge"
                        : " this browser"}
                  . Tap the menu and choose <strong>“Open in Safari,”</strong> or copy the link below and paste it into Safari.
                </p>
                <button
                  onClick={copyLink}
                  className="lp-cta-ghost mt-3 inline-flex h-10 items-center gap-2 px-4 text-sm"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Link copied" : "Copy install link"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QR card */}
        <div className="lp-card mt-8 flex flex-col items-center p-6 sm:p-8">
          <div ref={qrRef} className="rounded-2xl bg-white p-4">
            {installUrl ? (
              <QRCodeCanvas
                value={installUrl}
                size={1024}
                level="M"
                bgColor="#ffffff"
                fgColor="#0b1120"
                style={{ width: 220, height: 220 }}
              />
            ) : (
              <div style={{ width: 220, height: 220 }} />
            )}
          </div>
          <p className="mt-4 text-center text-sm" style={{ color: "var(--lp-muted)" }}>
            {platform === "desktop"
              ? "Scan with your phone camera"
              : "Share this code so others can install ALLUR"}
          </p>
          <button
            onClick={downloadQr}
            className="lp-cta-ghost mt-4 inline-flex h-11 items-center gap-2 px-6"
          >
            <Download className="h-4 w-4" />
            Download QR code
          </button>
        </div>

        {/* Install button (Android / desktop Chrome when available) */}
        {!installed && canInstall && (
          <button
            onClick={() => { void promptInstall(); }}
            className="lp-cta mt-6 flex h-14 w-full items-center justify-center gap-2 text-lg"
          >
            <SquarePlus className="h-5 w-5" />
            Install ALLUR
          </button>
        )}
        {installed && (
          <p className="mt-6 text-center text-sm font-medium" style={{ color: "var(--lp-cyan)" }}>
            ALLUR is installed on this device.
          </p>
        )}

        {/* Step-by-step instructions */}
        <div className="lp-card mt-6 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--lp-muted)" }}>
            {platform === "ios"
              ? "Install on iPhone / iPad"
              : platform === "android"
                ? "Install on Android"
                : "How to install"}
          </h2>
          <ol className="space-y-4">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: "var(--lp-elevated)",
                      border: "1px solid var(--lp-border)",
                      color: "var(--lp-cyan)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-2 pt-1">
                    <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--lp-muted)" }} />
                    <span className="text-sm" style={{ color: "var(--lp-body)" }}>
                      {s.text}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Subscription reassurance */}
        <div
          className="mt-6 flex items-start gap-3 rounded-2xl p-4"
          style={{ backgroundColor: "var(--lp-elevated)", border: "1px solid var(--lp-border)" }}
        >
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--lp-cyan)" }} />
          <p className="text-sm" style={{ color: "var(--lp-body)" }}>
            Installing ALLUR just adds it to your home screen. You'll create your account and choose a
            plan inside the app — the same secure sign-up and subscription as on the web.
          </p>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => setLocation("/auth?mode=signup")}
            className="text-sm font-medium underline-offset-4 hover:underline"
            style={{ color: "var(--lp-cyan)" }}
          >
            Or start now in your browser →
          </button>
        </div>
      </div>
    </div>
  );
}
