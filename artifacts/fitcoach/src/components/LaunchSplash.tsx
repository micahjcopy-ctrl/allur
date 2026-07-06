import React, { useEffect, useMemo, useState } from "react";
import { isStandalone } from "@/hooks/usePwaInstall";

const ALLUR_LOGO = `${import.meta.env.BASE_URL}allur-logo.png`;

// How long the splash stays up. Long enough for two tips and to cover the
// account-data load happening underneath.
const SPLASH_MS = 5000;
// How often the tip rotates while the splash is visible.
const TIP_MS = 2500;
// Fade-out duration once time is up.
const FADE_MS = 450;

const TIPS = [
  "Snap a photo of any meal — the AI counts calories and macros for you.",
  "Rest days count. Check them off to keep your streak alive.",
  "Ask the Coach anything — it can rewrite your training plan on the spot.",
  "Add Front, Side, and Back photos each week, then run a physique scan.",
  "Sore or injured? Tell the Coach — your plan adapts around it.",
  "Start today's workout right from the home screen — one tap.",
  "Snap the weight plate during a set to log it hands-free.",
  "Generate an AI goal photo to see the future you you're training toward.",
  "Refer a friend — you both get a free month of Premium.",
];

// One splash per app launch: module-level so SPA navigation never re-triggers
// it, while a real cold start (fresh JS context) always shows it.
let shownThisLaunch = false;

/**
 * Branded launch screen for the INSTALLED app (standalone mode only — a
 * browser tab never sees it, and it has nothing to do with onboarding).
 * Shows the ALLUR logo, a progress bar, and rotating usage tips for ~5s while
 * auth + saved state load underneath, then fades away.
 */
export function LaunchSplash() {
  const [visible, setVisible] = useState(() => {
    if (shownThisLaunch) return false;
    if (typeof window === "undefined") return false;
    return isStandalone();
  });
  const [fading, setFading] = useState(false);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [tipVisible, setTipVisible] = useState(true);
  // Kicks the progress bar's CSS transition from 0 → 100% after mount.
  const [started, setStarted] = useState(false);

  const initialVisible = useMemo(() => visible, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialVisible) return;
    shownThisLaunch = true;

    // Start the progress animation on the next frame so the 0% width paints first.
    const raf = requestAnimationFrame(() => setStarted(true));

    // Rotate tips with a quick fade between them.
    const tipTimer = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIndex((i) => (i + 1) % TIPS.length);
        setTipVisible(true);
      }, 250);
    }, TIP_MS);

    // Time's up → fade out, then unmount.
    const doneTimer = setTimeout(() => {
      setFading(true);
      setTimeout(() => setVisible(false), FADE_MS);
    }, SPLASH_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(tipTimer);
      clearTimeout(doneTimer);
    };
  }, [initialVisible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-between px-8 pt-safe pb-safe transition-opacity"
      style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
      aria-label="ALLUR is loading"
    >
      {/* Logo — vertically centered */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <img src={ALLUR_LOGO} alt="ALLUR" className="w-48 select-none" draggable={false} />
        <p className="text-muted-foreground text-sm mt-3">Your AI transformation coach</p>
      </div>

      {/* Tip + progress bar pinned toward the bottom */}
      <div className="w-full max-w-sm pb-14 space-y-6">
        <div className="min-h-[48px] flex items-end justify-center">
          <p
            className="text-center text-sm text-muted-foreground leading-relaxed transition-opacity duration-250"
            style={{ opacity: tipVisible ? 1 : 0 }}
          >
            <span className="text-primary font-semibold uppercase tracking-wider text-[10px] block mb-1">
              Tip
            </span>
            {TIPS[tipIndex]}
          </p>
        </div>

        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{
              width: started ? "100%" : "0%",
              transition: `width ${SPLASH_MS}ms linear`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
