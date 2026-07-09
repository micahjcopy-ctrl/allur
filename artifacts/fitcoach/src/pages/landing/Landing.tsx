import React, { useEffect, useRef, useState } from "react";
import { useSeo } from "@/hooks/useSeo";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { PhoneMock } from "@/components/marketing/Graphics";
import { CoachChatMock, MacroScanMock } from "@/components/marketing/Mocks";
import { useLocation } from "wouter";
import { motion, MotionConfig, useScroll, useTransform, useMotionValueEvent, useReducedMotion, useInView, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  Activity,
  Brain,
  Camera,
  Target,
  Zap,
  CheckCircle2,
  Menu,
  X,
  Minus,
  ArrowDown,
  Dumbbell,
  LineChart,
  ScanLine,
  Flame,
  Smartphone,
  Download
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { usePwaInstall, buildInstallUrl } from "@/hooks/usePwaInstall";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  PhoneFrame,
  FloatingCallout,
  OnboardingScreen,
  DashboardScreen,
  CoachScreen,
  MealScreen,
  ProgressScreen,
  AdaptScreen,
  AutoCyclingScreen
} from "./AppScreens";

const BASE_URL = import.meta.env.BASE_URL;

const JOURNEY = [
  {
    step: "01",
    title: "Build your profile",
    desc: "A guided onboarding learns your body, goals, experience, injuries, and restrictions — so your plan starts from your real starting point, not a template.",
    Screen: OnboardingScreen,
    callout: { icon: Target, label: "Goal locked", value: "Build muscle" }
  },
  {
    step: "02",
    title: "Open your command center",
    desc: "Your dashboard becomes mission control: today's workout, macro targets, and weekly structure on one calm, focused screen.",
    Screen: DashboardScreen,
    callout: { icon: Flame, label: "Streak", value: "12 days" }
  },
  {
    step: "03",
    title: "Coach through anything",
    desc: "Shorter session? Tweaky knee? Not sure what to change? Ask the AI coach — it answers, then updates your plan the moment you approve.",
    Screen: CoachScreen,
    callout: { icon: Brain, label: "Plan updated", value: "Live" }
  },
  {
    step: "04",
    title: "Log meals with a photo",
    desc: "Snap a photo of your meal. ALLUR identifies the food, estimates calories and macros, and logs it into your day in seconds.",
    Screen: MealScreen,
    callout: { icon: Camera, label: "Logged", value: "620 kcal" }
  },
  {
    step: "05",
    title: "See progress, measured",
    desc: "Log weight, PRs, and progress photos. ALLUR estimates body fat and tracks how your physique is actually changing over time.",
    Screen: ProgressScreen,
    callout: { icon: Activity, label: "Body fat", value: "14.8%" }
  },
  {
    step: "06",
    title: "Your plan adapts itself",
    desc: "As your data comes in, ALLUR rebalances volume toward lagging areas and trains around your limits — automatically.",
    Screen: AdaptScreen,
    callout: { icon: Zap, label: "Rebalanced", value: "Auto" }
  }
];

const SHOWCASE_FEATURES = [
  {
    icon: LineChart,
    label: "Live dashboard",
    tagline: "Your whole transformation at a glance",
    Screen: DashboardScreen,
    bullets: [
      "See training, nutrition & progress in one view",
      "Always know your next action",
      "Stay motivated by momentum you can actually see"
    ]
  },
  {
    icon: Brain,
    label: "AI Coach",
    tagline: "A coach in your pocket, 24/7",
    Screen: CoachScreen,
    bullets: [
      "Answers your training & nutrition questions instantly",
      "Adapts your plan when life gets in the way",
      "Talk to it by text or voice"
    ]
  },
  {
    icon: Flame,
    label: "Photo meal logging",
    tagline: "Nutrition without the spreadsheet",
    Screen: MealScreen,
    bullets: [
      "Snap a photo to log calories & macros",
      "No manual searching or guesswork",
      "Stay on target with zero friction"
    ]
  },
  {
    icon: ScanLine,
    label: "Physique analysis",
    tagline: "See the changes the mirror hides",
    Screen: ProgressScreen,
    bullets: [
      "AI physique scans estimate body-fat & muscle",
      "Track real change from your progress photos",
      "Know what's working — and what to adjust"
    ]
  },
  {
    icon: Activity,
    label: "Adaptive plan",
    tagline: "A plan that bends so you don't break",
    Screen: AdaptScreen,
    bullets: [
      "Rebalances when you miss days or plateau",
      "Works around injuries & your equipment",
      "Always know your next move"
    ]
  },
  {
    icon: Target,
    label: "Guided onboarding",
    tagline: "Built around your body & goal",
    Screen: OnboardingScreen,
    bullets: [
      "A plan personalized to you in minutes",
      "Tuned to your experience & schedule",
      "Set your goal — ALLUR builds the path"
    ]
  }
];

function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const interactedRef = useRef(false);
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });

  useEffect(() => {
    if (prefersReduced || !inView || interactedRef.current) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SHOWCASE_FEATURES.length);
    }, 3500);
    return () => clearInterval(id);
  }, [prefersReduced, inView, active]);

  const select = (i: number) => {
    interactedRef.current = true;
    setActive(i);
  };

  const Current = SHOWCASE_FEATURES[active].Screen;

  return (
    <div ref={ref} className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center max-w-5xl mx-auto">
      {/* device preview */}
      <div className="flex justify-center">
        <div className="relative">
          <div
            className="absolute inset-0 -z-10 blur-3xl rounded-full"
            style={{ background: "radial-gradient(circle, rgba(110,231,242,0.2), transparent 70%)" }}
          />
          <PhoneFrame>
            <div className="absolute inset-0">
              <AnimatePresence initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="absolute inset-0"
                >
                  <Current />
                </motion.div>
              </AnimatePresence>
            </div>
          </PhoneFrame>
        </div>
      </div>

      {/* clickable feature list */}
      <div className="flex flex-col gap-3">
        {SHOWCASE_FEATURES.map((f, i) => {
          const isActive = i === active;
          const Icon = f.icon;
          return (
            <div
              key={f.label}
              className="rounded-2xl border transition-colors"
              style={{
                backgroundColor: isActive ? "rgba(110,231,242,0.08)" : "rgba(11,17,32,0.5)",
                borderColor: isActive ? "rgba(110,231,242,0.4)" : "rgba(110,231,242,0.12)"
              }}
            >
              <button
                type="button"
                onClick={() => select(i)}
                aria-pressed={isActive}
                className="w-full text-left flex items-center gap-3 p-4 cursor-pointer"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: isActive ? "rgba(110,231,242,0.16)" : "rgba(255,255,255,0.04)" }}
                >
                  <Icon className="w-5 h-5" style={{ color: isActive ? "var(--lp-cyan)" : "var(--lp-muted)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="lp-display font-semibold text-[var(--lp-text)]">{f.label}</div>
                  <div className="text-sm text-[var(--lp-muted)] truncate">{f.tagline}</div>
                </div>
                <ChevronRight
                  className="w-4 h-4 shrink-0 transition-transform"
                  style={{ color: "var(--lp-cyan)", transform: isActive ? "rotate(90deg)" : "none" }}
                />
              </button>

              <AnimatePresence initial={false}>
                {isActive && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <ul className="pr-4 pb-4 pl-[68px] space-y-2">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-sm text-[var(--lp-body)] leading-snug">
                          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--lp-cyan)" }} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Navbar = () => {
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNav = (path: string) => {
    setLocation(path);
    setMobileMenuOpen(false);
  };

  const handleScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { id: "how-it-works", label: "System" },
    { id: "difference", label: "Difference" },
    { id: "pricing", label: "Pricing" },
    { id: "faq", label: "FAQ" }
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--lp-bg)]/85 backdrop-blur-md border-b border-[var(--lp-border)]/70"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <button
          type="button"
          aria-label="ALLUR — back to top"
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <img src={`${BASE_URL}allur-logo.png`} alt="ALLUR" className="h-16 md:h-20 object-contain" />
        </button>

        <div className="hidden md:flex items-center gap-9 text-sm font-medium text-[var(--lp-muted)]">
          {navLinks.map((l) => (
            <button
              key={l.id}
              onClick={() => handleScrollTo(l.id)}
              className="hover:text-[var(--lp-text)] transition-colors"
            >
              {l.label}
            </button>
          ))}
          <button
            onClick={() => handleNav("/about")}
            className="hover:text-[var(--lp-text)] transition-colors"
          >
            About
          </button>
        </div>

        <div className="hidden md:flex items-center gap-5">
          <button
            onClick={() => handleNav("/auth?mode=login")}
            className="text-sm font-medium text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={() => handleNav("/auth?mode=signup")}
            className="lp-cta h-11 px-6 text-sm inline-flex items-center justify-center"
          >
            Start free trial
          </button>
        </div>

        <button
          className="md:hidden text-[var(--lp-text)]"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-0 right-0 bg-[var(--lp-bg)]/97 backdrop-blur-xl border-b border-[var(--lp-border)]/70 p-6 flex flex-col gap-6 md:hidden shadow-2xl"
          >
            <div className="flex flex-col gap-4 text-lg font-medium">
              {navLinks.map((l) => (
                <button
                  key={l.id}
                  onClick={() => handleScrollTo(l.id)}
                  className="text-left text-[var(--lp-muted)] hover:text-[var(--lp-text)]"
                >
                  {l.label}
                </button>
              ))}
              <button
                onClick={() => handleNav("/about")}
                className="text-left text-[var(--lp-muted)] hover:text-[var(--lp-text)]"
              >
                About
              </button>
            </div>
            <div className="h-px lp-divider w-full" />
            <div className="flex flex-col gap-4">
              <button
                onClick={() => handleNav("/auth?mode=login")}
                className="text-left text-lg font-medium text-[var(--lp-muted)] hover:text-[var(--lp-text)]"
              >
                Sign in
              </button>
              <button
                onClick={() => handleNav("/auth?mode=signup")}
                className="lp-cta w-full py-4 text-base inline-flex items-center justify-center"
              >
                Start free trial
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

type ImageCardProps = {
  image: string;
  eyebrow: string;
  title: string;
  highlight: string;
  desc: React.ReactNode;
  icon: React.ElementType;
  delay?: number;
};

const ImageCard = ({ image, eyebrow, title, highlight, desc, icon: Icon, delay = 0 }: ImageCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    className="lp-card lp-card-hover group relative aspect-[4/5] sm:aspect-[4/3] lg:aspect-[3/4] overflow-hidden !rounded-3xl"
  >
    <div className="absolute inset-0 bg-grid opacity-40" />
    <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[420px] h-[420px] lp-halo opacity-70" />
    <div className="absolute inset-0 card-scrim" />
    <div className="absolute inset-0 p-7 md:p-9 flex flex-col justify-end">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 border"
        style={{ backgroundColor: "rgba(110,231,242,0.10)", borderColor: "rgba(110,231,242,0.28)" }}
      >
        <Icon className="w-5 h-5" style={{ color: "var(--lp-cyan)" }} />
      </div>
      <span className="lp-kicker mb-2 block">{eyebrow}</span>
      <h3 className="lp-display text-3xl md:text-4xl font-semibold mb-3">
        {title} <span style={{ color: "var(--lp-cyan)" }}>{highlight}</span>
      </h3>
      <p className="text-[var(--lp-body)] text-base leading-relaxed max-w-md">{desc}</p>
    </div>
  </motion.div>
);

// The four value blurbs that radiate out from the QR code. Copy is carried over
// from the original two feature cards in this section.
const QR_BLURBS = [
  {
    icon: Dumbbell,
    title: "Any equipment, anywhere",
    desc: "Full gym, a pair of dumbbells, or just the floor.",
  },
  {
    icon: Activity,
    title: "Train on your terms",
    desc: "A plan built around the time you actually have.",
  },
  {
    icon: LineChart,
    title: "Track every change",
    desc: "Log weight, PRs, and progress photos.",
  },
  {
    icon: Camera,
    title: "See it working",
    desc: "Your data becomes visible feedback, week over week.",
  },
] as const;

// Endpoints (in a 0–100 viewBox) for the connector line that runs from the QR
// centre out to each corner blurb. Order matches QR_BLURBS. The middle of each
// line is hidden behind the opaque QR card, so they read as beams radiating out
// of the code toward each blurb.
const QR_LINE_ENDS = [
  { x: 28, y: 12 }, // top-left
  { x: 72, y: 12 }, // top-right
  { x: 28, y: 88 }, // bottom-left
  { x: 72, y: 88 }, // bottom-right
];

// Secondary "sellable feature / outcome" copy. These sit in a faint inner ring
// in the *gaps between* the four bold blurbs (which live at the corners), so the
// whole composition reads as one all-in-one system. They are intentionally low
// contrast — legible only when you look closely — and brighten on hover/focus.
// `top`/`left` are percentages of the 1040x600 desktop canvas. Positions are
// chosen to clear the corner blurbs, the centre QR card, and the connector beams.
const QR_OUTCOMES = [
  { text: "Your AI coach, always on", top: 15, left: 50 }, // N
  { text: "Snap a meal, get macros", top: 27, left: 79 }, // NE gap
  { text: "Body-fat scan from a photo", top: 50, left: 86 }, // E
  { text: "Plans that adapt every week", top: 73, left: 79 }, // SE gap
  { text: "Lose fat, build lean muscle", top: 85, left: 50 }, // S
  { text: "Voice coaching, hands-free", top: 73, left: 21 }, // SW gap
  { text: "Auto-tracked PRs & weight", top: 50, left: 14 }, // W
  { text: "Train safely around injuries", top: 27, left: 21 }, // NW gap
] as const;

function QrShowcase() {
  const [, setLocation] = useLocation();
  const { platform, canInstall, promptInstall } = usePwaInstall();
  const reduceMotion = useReducedMotion();

  const installUrl = React.useMemo(() => buildInstallUrl(), []);

  const isMobile = platform === "ios" || platform === "android";

  // On mobile, tapping the code should get them into the app immediately: fire the
  // native install prompt when the browser offers one, otherwise route to the full
  // install instructions (iOS can't be installed programmatically). On desktop the
  // code is meant to be scanned, but a click still routes to the get-the-app page.
  const handleActivate = () => {
    if (isMobile && canInstall) {
      void promptInstall();
      return;
    }
    setLocation("/get");
  };

  const caption = isMobile ? "Tap to install ALLUR" : "Scan with your phone camera";

  const Qr = (
    <div className="rounded-2xl bg-white p-3 sm:p-4">
      {installUrl ? (
        <QRCodeCanvas
          value={installUrl}
          size={1024}
          level="M"
          bgColor="#ffffff"
          fgColor="#0b1120"
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <div className="h-full w-full" />
      )}
    </div>
  );

  const QrCard = (
    <motion.button
      type="button"
      onClick={handleActivate}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="group relative block rounded-3xl text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--lp-bg-feature)]"
      aria-label={isMobile ? "Install ALLUR" : "Get the ALLUR app"}
    >
      <span
        className="absolute -inset-5 -z-10 rounded-[2rem] blur-2xl transition-opacity duration-500 opacity-70 group-hover:opacity-100"
        style={{ background: "radial-gradient(circle, rgba(110,231,242,0.28), transparent 70%)" }}
        aria-hidden
      />
      <span
        className="lp-card relative mx-auto flex aspect-square w-44 items-center justify-center !rounded-3xl p-3 transition-transform duration-300 group-hover:-translate-y-1 sm:w-52"
        style={{ borderColor: "rgba(110,231,242,0.35)" }}
      >
        {Qr}
      </span>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--lp-cyan)" }}>
        {isMobile ? <Download className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
        {caption}
      </span>
    </motion.button>
  );

  return (
    <div>
      {/* DESKTOP / TABLET (lg+): radial layout with connector lines */}
      <div className="group relative mx-auto hidden lg:block" style={{ maxWidth: 1040, height: 600 }}>
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {/* soft glow underlay */}
          {QR_LINE_ENDS.map((p, i) => (
            <motion.line
              key={`glow-${i}`}
              x1={50}
              y1={50}
              x2={p.x}
              y2={p.y}
              stroke="var(--lp-cyan)"
              strokeWidth={5}
              strokeOpacity={0.1}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease: "easeOut" }}
            />
          ))}
          {/* crisp beam */}
          {QR_LINE_ENDS.map((p, i) => (
            <motion.line
              key={`beam-${i}`}
              x1={50}
              y1={50}
              x2={p.x}
              y2={p.y}
              stroke="var(--lp-cyan)"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease: "easeOut" }}
            />
          ))}
        </svg>

        {/* faint inner ring of sellable-feature / outcome copy, sitting in the
            gaps between the four bold blurbs. Decorative + low contrast. */}
        {QR_OUTCOMES.map((o, i) => (
          <motion.span
            key={o.text}
            className="pointer-events-none absolute block -translate-x-1/2 -translate-y-1/2"
            style={{ top: `${o.top}%`, left: `${o.left}%`, maxWidth: 170 }}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.35 + i * 0.05, ease: "easeOut" }}
          >
            <span className="block text-center text-[11px] font-medium uppercase leading-snug tracking-[0.16em] text-[var(--lp-text)] opacity-30 transition-opacity duration-500 group-hover:opacity-80 group-focus-within:opacity-80">
              {o.text}
            </span>
          </motion.span>
        ))}

        {/* centre QR */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{QrCard}</div>

        {/* corner blurbs */}
        {QR_BLURBS.map((b, i) => {
          const left = i % 2 === 0;
          const top = i < 2;
          const pos: React.CSSProperties = {
            width: 300,
            ...(left ? { left: 0 } : { right: 0 }),
            ...(top ? { top: 0 } : { bottom: 0 }),
          };
          return (
            <motion.div
              key={b.title}
              className="absolute"
              style={pos}
              initial={reduceMotion ? false : { opacity: 0, x: left ? -24 : 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: 0.3 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            >
              <QrBlurb icon={b.icon} title={b.title} desc={b.desc} align={left ? "right" : "left"} />
            </motion.div>
          );
        })}
      </div>

      {/* MOBILE / SMALL (below lg): QR on top, blurbs stacked in a grid */}
      <div className="lg:hidden">
        <div className="flex justify-center">{QrCard}</div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {QR_BLURBS.map((b) => (
            <QrBlurb key={b.title} icon={b.icon} title={b.title} desc={b.desc} align="left" />
          ))}
        </div>
        {/* the same sellable-feature copy, kept subtle, since the circular ring
            can't translate to a stacked mobile layout */}
        <p className="mx-auto mt-10 max-w-md text-center text-[11px] font-medium uppercase leading-relaxed tracking-[0.16em] text-[var(--lp-text)] opacity-40">
          {QR_OUTCOMES.map((o) => o.text).join("  ·  ")}
        </p>
      </div>
    </div>
  );
}

function QrBlurb({
  icon: Icon,
  title,
  desc,
  align,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  align: "left" | "right";
}) {
  const right = align === "right";
  return (
    <div
      className={`flex items-start gap-3 ${right ? "lg:flex-row-reverse lg:text-right" : ""}`}
    >
      <span
        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
        style={{ backgroundColor: "rgba(110,231,242,0.10)", borderColor: "rgba(110,231,242,0.28)" }}
      >
        <Icon className="h-5 w-5" style={{ color: "var(--lp-cyan)" }} />
      </span>
      <div>
        <h3 className="lp-display text-lg md:text-xl font-semibold" style={{ color: "var(--lp-text)" }}>
          {title}
        </h3>
        <p className="mt-1 text-[var(--lp-body)] text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const heroRef = useRef<HTMLElement>(null);
  useSeo({
    title: "ALLUR — AI Fitness Coach That Adapts Your Plan to Real Life",
    description:
      "An AI fitness coach that builds a personalized training and nutrition plan around your body and adapts it when life changes. Photo meal macros, AI physique scans. Start free.",
    path: "/home",
  });

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  const heroImageY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroTextY = useTransform(scrollYProgress, [0, 1], ["0%", "60%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const heroPhoneY = useTransform(scrollYProgress, [0, 1], ["0%", "-18%"]);

  const prefersReduced = useReducedMotion();

  const stepsRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const { scrollYProgress: stepsProgress } = useScroll({
    target: stepsRef,
    offset: ["start start", "end end"]
  });
  useMotionValueEvent(stepsProgress, "change", (v) => {
    const n = JOURNEY.length;
    setActiveStep(Math.min(n - 1, Math.max(0, Math.floor(v * n))));
  });

  const sysRef = useRef<HTMLElement>(null);
  const { scrollYProgress: sysProgress } = useScroll({
    target: sysRef,
    offset: ["start end", "end start"]
  });
  const sysLeftY = useTransform(sysProgress, [0, 1], [70, -70]);
  const sysRightY = useTransform(sysProgress, [0, 1], [-50, 70]);
  const sysCenterY = useTransform(sysProgress, [0, 1], [30, -30]);

  const handleSignup = () => setLocation("/auth?mode=signup");

  const marqueeItems = [
    "Adaptive Training",
    "AI Coach",
    "Photo Macro Logging",
    "Physique Analysis",
    "Progress Tracking",
    "Built On Sports Science",
    "Real-Life Ready"
  ];

  return (
    <div className="allur-lp w-full min-h-screen overflow-x-clip">
      <SiteNav />

      {/* HERO — #050816 with a faint cyan halo echoing the logo ring */}
      <section ref={heroRef} className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden flex items-center min-h-[100vh]">
        <motion.div style={{ y: heroImageY }} className="absolute inset-0 z-0 scale-110">
          <div className="w-full h-full bg-grid opacity-30" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] lp-halo opacity-80" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--lp-bg) 8%, rgba(5,8,22,0.72) 45%, rgba(5,8,22,0.35) 100%)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, var(--lp-bg) 0%, rgba(5,8,22,0.4) 45%, transparent 100%)" }} />
          <div className="absolute inset-0 lp-halo opacity-80" />
        </motion.div>

        <motion.div style={{ y: heroTextY, opacity: heroOpacity }} className="max-w-7xl mx-auto px-6 relative z-10 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl"
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7 backdrop-blur-sm border lp-kicker"
              style={{ backgroundColor: "rgba(110,231,242,0.08)", borderColor: "rgba(110,231,242,0.25)" }}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>The adaptive body transformation app</span>
            </div>

            <h1 className="lp-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold mb-7">
              Stop guessing your way
              <br />
              to a <span style={{ color: "var(--lp-cyan)" }}>better body.</span>
            </h1>

            <p className="text-lg md:text-xl text-[var(--lp-body)] mb-10 leading-relaxed max-w-2xl">
              ALLUR gives you a <strong className="text-[var(--lp-text)] font-semibold">personalized training and nutrition system</strong> that{" "}
              <span className="lp-underline">adapts in real time</span> — so you make progress faster, with far less friction.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={handleSignup}
                className="lp-cta w-full sm:w-auto h-16 px-10 text-lg inline-flex items-center justify-center gap-2 group"
              >
                Start your transformation
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => setLocation("/auth?mode=login")}
                className="lp-cta-ghost w-full sm:w-auto h-16 px-10 text-lg inline-flex items-center justify-center backdrop-blur-sm"
              >
                Sign in
              </button>
            </div>

            <p className="text-sm text-[var(--lp-muted)] mt-6 font-medium">
              <span className="text-[var(--lp-text)]">14-day free trial</span> · Cancel anytime
            </p>
          </motion.div>
        </motion.div>

        {/* floating live app console — sets the command-center tone */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={prefersReduced ? undefined : { y: heroPhoneY }}
          className="absolute right-12 top-1/2 -translate-y-1/2 z-[6] hidden 2xl:block"
        >
          <div className="relative">
            <div
              className="absolute inset-0 -z-10 blur-3xl rounded-full"
              style={{ background: "radial-gradient(circle, rgba(110,231,242,0.18), transparent 70%)" }}
            />
            <PhoneFrame>
              <DashboardScreen />
            </PhoneFrame>
            <FloatingCallout icon={Activity} label="Adapting now" value="Live" position="tl" />
            <FloatingCallout icon={Flame} label="Streak" value="12 days" position="br" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          style={{ color: "rgba(110,231,242,0.7)" }}
        >
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.8, repeat: Infinity }}>
            <ArrowDown className="w-6 h-6" />
          </motion.div>
        </motion.div>
      </section>

      {/* MARQUEE BAND */}
      <div
        className="relative py-5 overflow-hidden border-y"
        style={{ backgroundColor: "rgba(110,231,242,0.04)", borderColor: "rgba(110,231,242,0.12)" }}
      >
        <div className="flex w-max animate-marquee">
          {[...marqueeItems, ...marqueeItems].map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-8 shrink-0">
              <Zap className="w-4 h-4 shrink-0" style={{ color: "var(--lp-cyan)" }} />
              <span className="lp-display text-lg md:text-xl font-medium text-[var(--lp-body)] whitespace-nowrap">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* THE PROBLEM — #0A0F1F, flatter, calmer, text-heavy to build tension */}
      <section className="py-24 md:py-32 border-b border-[var(--lp-border)]/60 relative overflow-hidden" style={{ backgroundColor: "var(--lp-bg-alt)" }}>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="lp-kicker mb-4 block">The real problem</span>
              <h2 className="lp-display text-4xl md:text-5xl font-semibold mb-8">
                You don't need more
                <br />
                <span className="text-[var(--lp-muted)]">fitness information.</span>
              </h2>

              <div className="space-y-6 text-lg text-[var(--lp-body)]">
                <p>Most people already know the basics: train, eat better, stay consistent.</p>
                <p>
                  That isn't the real problem. The real problem is that body transformation gets{" "}
                  <strong className="text-[var(--lp-text)] font-semibold">messy in real life.</strong>
                </p>

                <div className="pl-6 space-y-3 my-8" style={{ borderLeft: "2px solid var(--lp-border)" }}>
                  <p>Your schedule changes.</p>
                  <p>You miss workouts.</p>
                  <p>You get busy.</p>
                  <p>You second-guess your calories.</p>
                  <p>You lose momentum. And eventually… you stop.</p>
                </div>

                <p>
                  Not because you don't care — because{" "}
                  <span className="lp-underline">the path is fragmented.</span>
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative flex justify-center"
            >
              <div
                className="absolute inset-0 -z-10 blur-3xl rounded-full"
                style={{ background: "radial-gradient(circle, rgba(110,231,242,0.18), transparent 70%)" }}
              />
              <PhoneFrame>
                <DashboardScreen />
              </PhoneFrame>
            </motion.div>
          </div>
        </div>
      </section>

      {/* THE SOLUTION / MECHANISM — back to #050816, bring the light back */}
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ backgroundColor: "var(--lp-bg)" }}>
        <div className="absolute inset-0 lp-vlines opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] lp-halo opacity-70" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <img
              src={`${BASE_URL}allur-logo.png`}
              alt="ALLUR"
              className="h-16 md:h-20 object-contain mx-auto mb-8"
            />
            <h2 className="lp-display text-5xl md:text-6xl font-bold mb-8">
              ALLUR <span style={{ color: "var(--lp-cyan)" }}>fixes that.</span>
            </h2>
            <p className="text-xl md:text-2xl text-[var(--lp-body)] mb-12 leading-relaxed">
              Instead of piecing your transformation together from scattered tools and generic advice, ALLUR gives you{" "}
              <strong className="text-[var(--lp-text)] font-semibold">one intelligent system</strong> that guides you from start to finish.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
            {[
              {
                icon: Activity,
                title: "A personalized plan",
                outcomes: ["Built around your body, goal & equipment", "Starts from your real level — never a template"]
              },
              {
                icon: Target,
                title: "A daily action path",
                outcomes: ["Know exactly what to do each day", "No more decision fatigue or guesswork"]
              },
              {
                icon: Camera,
                title: "Easy nutrition tracking",
                outcomes: ["Snap a photo to log any meal", "Calories & macros estimated in seconds"]
              },
              {
                icon: LineChart,
                title: "Visible progress feedback",
                outcomes: ["Track weight, PRs & progress photos", "See what's actually working over time"]
              },
              {
                icon: Brain,
                title: "An AI coach that adapts",
                outcomes: ["Answers questions in your context", "Updates your plan the moment you approve"]
              },
              {
                icon: Zap,
                title: "A self-adjusting system",
                outcomes: ["Rebalances volume toward lagging areas", "Trains around injuries & busy weeks"]
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="lp-card lp-card-hover p-6 flex flex-col"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(110,231,242,0.10)" }}
                  >
                    <feature.icon className="w-5 h-5" style={{ color: "var(--lp-cyan)" }} />
                  </div>
                  <span className="lp-display font-semibold text-[var(--lp-text)] text-lg">{feature.title}</span>
                </div>
                <ul className="space-y-2.5">
                  {feature.outcomes.map((o) => (
                    <li key={o} className="flex items-start gap-2.5 text-sm text-[var(--lp-body)] leading-snug">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--lp-cyan)" }} />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <p className="text-xl text-[var(--lp-muted)] mb-8">
              So instead of trying to "figure fitness out"…
              <br className="hidden sm:block" />
              <span className="text-[var(--lp-text)]">you follow a system that keeps getting smarter around you.</span>
            </p>
            <button
              onClick={handleSignup}
              className="lp-cta h-14 px-8 text-lg inline-flex items-center justify-center"
            >
              Get started now
            </button>
          </motion.div>
        </div>
      </section>

      {/* FEATURE PAIR 1 — #0B1120 */}
      <section className="py-24 md:py-32 border-y border-[var(--lp-border)]/60 relative overflow-hidden" style={{ backgroundColor: "var(--lp-bg-feature)" }}>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mb-14"
          >
            <span className="lp-kicker mb-4 block">Built around you</span>
            <h2 className="lp-display text-4xl md:text-5xl font-semibold">
              Progress should be <span className="lp-underline">predictable.</span>
            </h2>
          </motion.div>

          <QrShowcase />
        </div>
      </section>

      {/* HOW IT WORKS — #050816 */}
      {/* THE SYSTEM — sticky scroll-storytelling through live app screen states */}
      <section id="how-it-works" ref={stepsRef} className="relative" style={{ backgroundColor: "var(--lp-bg)" }}>
        <div className="max-w-7xl mx-auto px-6 pt-24 md:pt-32 text-center">
          <span className="lp-kicker mb-4 block">The system</span>
          <h2 className="lp-display text-4xl md:text-5xl font-semibold mb-4">Step inside the system</h2>
          <p className="text-xl text-[var(--lp-muted)] max-w-2xl mx-auto">
            Scroll to watch ALLUR move from setup to a living, self-adjusting transformation engine.
          </p>
        </div>

        {/* desktop: sticky device, copy scrolls, screen states swap with the narrative */}
        <div className="hidden lg:grid grid-cols-2 gap-16 max-w-7xl mx-auto px-6">
          <div>
            {JOURNEY.map((s, i) => (
              <div key={i} className="min-h-[78vh] flex flex-col justify-center">
                <motion.div animate={{ opacity: activeStep === i ? 1 : 0.3 }} transition={{ duration: 0.4 }}>
                  <div className="flex items-center gap-3 mb-5">
                    <span
                      className="lp-display text-2xl font-bold"
                      style={{ color: activeStep === i ? "var(--lp-cyan)" : "var(--lp-muted)" }}
                    >
                      {s.step}
                    </span>
                    <motion.span
                      className="h-px block"
                      style={{ backgroundColor: "var(--lp-cyan)" }}
                      animate={{ width: activeStep === i ? 64 : 0 }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                  <h3 className="lp-display text-3xl md:text-4xl font-semibold mb-5">{s.title}</h3>
                  <p className="text-[var(--lp-body)] text-lg leading-relaxed max-w-md">{s.desc}</p>
                </motion.div>
              </div>
            ))}
          </div>

          <div className="relative">
            <div className="sticky top-20 h-[calc(100vh-5rem)] flex items-center justify-center">
              <div className="relative">
                <div
                  className="absolute inset-0 -z-10 blur-3xl rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(110,231,242,0.18), transparent 70%)" }}
                />
                <PhoneFrame>
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.35, ease: "easeInOut" }}
                      className="absolute inset-0"
                    >
                      {React.createElement(JOURNEY[activeStep].Screen)}
                    </motion.div>
                  </AnimatePresence>
                </PhoneFrame>
                <AnimatePresence mode="wait">
                  <FloatingCallout
                    key={activeStep}
                    icon={JOURNEY[activeStep].callout.icon}
                    label={JOURNEY[activeStep].callout.label}
                    value={JOURNEY[activeStep].callout.value}
                    position="br"
                  />
                </AnimatePresence>
                <div className="absolute -left-10 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-2">
                  {JOURNEY.map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-full transition-all duration-300"
                      style={{
                        height: activeStep === i ? 28 : 8,
                        backgroundColor: activeStep === i ? "var(--lp-cyan)" : "rgba(255,255,255,0.15)"
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* mobile: stacked steps, each paired with its live screen */}
        <div className="lg:hidden max-w-md mx-auto px-6 mt-16 space-y-20">
          {JOURNEY.map((s, i) => (
            <div key={i}>
              <div className="flex items-center gap-3 mb-4">
                <span className="lp-display text-xl font-bold" style={{ color: "var(--lp-cyan)" }}>{s.step}</span>
                <span className="h-px w-12" style={{ backgroundColor: "var(--lp-cyan)" }} />
              </div>
              <h3 className="lp-display text-2xl font-semibold mb-3">{s.title}</h3>
              <p className="text-[var(--lp-body)] text-base leading-relaxed mb-8">{s.desc}</p>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6 }}
                className="flex justify-center"
              >
                <PhoneFrame>{React.createElement(s.Screen)}</PhoneFrame>
              </motion.div>
            </div>
          ))}
        </div>

        <div className="text-center pb-24 md:pb-32 pt-20">
          <button onClick={handleSignup} className="lp-cta h-16 px-10 text-lg inline-flex items-center justify-center">
            Build my plan
          </button>
        </div>
      </section>

      {/* COMMAND CENTER — full-width multi-panel system view */}
      <section
        ref={sysRef}
        className="py-24 md:py-36 border-y border-[var(--lp-border)]/60 relative overflow-hidden"
        style={{ backgroundColor: "var(--lp-bg-alt)" }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(110,231,242,0.10), transparent 70%)" }}
        />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 md:mb-20">
            <span className="lp-kicker mb-4 block">The command center</span>
            <h2 className="lp-display text-4xl md:text-6xl font-semibold mb-4">
              Your transformation,<br className="hidden md:block" /> running as one live system
            </h2>
            <p className="text-xl text-[var(--lp-muted)] max-w-2xl mx-auto">
              Training, nutrition, analysis, and coaching — one connected operating system that adapts in real time.
            </p>
          </div>

          <FeatureShowcase />
        </div>
      </section>

      {/* THE DIFFERENCE — #0A0F1F */}
      <section id="difference" className="py-24 md:py-32 border-y border-[var(--lp-border)]/60 relative overflow-hidden" style={{ backgroundColor: "var(--lp-bg-alt)" }}>
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <PhoneMock><CoachChatMock /></PhoneMock>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            <span className="lp-kicker mb-4 block">The difference</span>
            <h2 className="lp-display text-4xl md:text-5xl font-semibold mb-8">
              Why most people struggle to transform.
            </h2>

            <p className="text-lg text-[var(--lp-body)] mb-8">
              It isn't because they're lazy. It's because most fitness systems break exactly where{" "}
              <span className="lp-underline">real life begins.</span> They fail when:
            </p>

            <ul className="space-y-4 mb-10 text-lg text-[var(--lp-body)]">
              {["you only have 30 minutes", "you don't know what to eat", "you miss a few days", "your injury flares up", "your progress stalls"].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <Minus className="w-5 h-5 shrink-0" style={{ color: "#F87171" }} /> {t}
                </li>
              ))}
            </ul>

            <div className="lp-card p-6">
              <h3 className="lp-display text-xl font-semibold mb-3" style={{ color: "var(--lp-cyan)" }}>ALLUR is built to adapt.</h3>
              <p className="text-[var(--lp-body)]">
                Most apps just track what happened. <strong className="text-[var(--lp-text)] font-semibold">ALLUR helps shape what happens next</strong> — and adjusts your system when reality changes.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* COMPARISON — #050816 */}
      <section className="py-24 md:py-28 relative overflow-hidden" style={{ backgroundColor: "var(--lp-bg)" }}>
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="lp-card p-8">
              <h3 className="lp-display text-xl font-semibold mb-6 text-[var(--lp-muted)]">Most fitness apps</h3>
              <ul className="space-y-5 text-[var(--lp-muted)]">
                {["Give you static templates", "Make you do the thinking", "Ask you to log everything manually", "Don't adapt when your life changes", "Track data without turning it into action"].map((t) => (
                  <li key={t} className="flex gap-3">
                    <X className="w-5 h-5 shrink-0" style={{ color: "rgba(248,113,113,0.75)" }} /> {t}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="lp-card p-8 relative overflow-hidden"
              style={{ borderColor: "rgba(110,231,242,0.32)", boxShadow: "0 0 40px -16px rgba(110,231,242,0.3)" }}
            >
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Zap className="w-32 h-32" style={{ color: "var(--lp-cyan)" }} />
              </div>
              <h3 className="lp-display text-xl font-semibold mb-6" style={{ color: "var(--lp-cyan)" }}>ALLUR</h3>
              <ul className="space-y-5 text-[var(--lp-body)] relative z-10">
                {["Builds your plan around your body and goal", "Tells you what to do next", "Makes nutrition easier to log via photos", "Shows progress in a motivating way", "Adjusts your system when reality changes"].map((t) => (
                  <li key={t} className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--lp-cyan)" }} /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE PAIR 2 — #0B1120 */}
      <section className="py-24 md:py-32 border-y border-[var(--lp-border)]/60 relative overflow-hidden" style={{ backgroundColor: "var(--lp-bg-feature)" }}>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mb-14"
          >
            <span className="lp-kicker mb-4 block">Train smarter</span>
            <h2 className="lp-display text-4xl md:text-5xl font-semibold">
              Every rep with <span className="lp-underline">purpose.</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            <ImageCard
              image={`${BASE_URL}lp-form.webp`}
              icon={ScanLine}
              eyebrow="Coach in your pocket"
              title="Know exactly"
              highlight="what to do"
              desc="Ask the AI coach anything — substitutions, intensity, technique cues, or a shorter session. It answers in your context and updates your plan instantly."
            />
            <ImageCard
              image={`${BASE_URL}lp-flexible.webp`}
              icon={Activity}
              eyebrow="Built for real life"
              title="Adapts"
              highlight="when you do"
              desc="Injuries, travel, busy weeks — ALLUR reshapes your training and nutrition around reality so you keep moving forward instead of starting over."
              delay={0.1}
            />
          </div>
        </div>
      </section>

      {/* OBJECTIONS — #050816 */}
      <section className="py-24 md:py-32" style={{ backgroundColor: "var(--lp-bg)" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="lp-kicker mb-4 block">Common hesitations</span>
            <h2 className="lp-display text-4xl md:text-5xl font-semibold mb-4">And why that's exactly why ALLUR exists.</h2>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {[
              { q: "I've tried fitness apps before. They don't work.", a: <>Because most apps are passive — they collect data, but they don't coach you through change. <strong className="text-[var(--lp-text)] font-semibold">ALLUR helps shape what happens next</strong>, combining personalized planning, progress feedback, easier tracking, and real-time adaptation.</> },
              { q: "This sounds complicated.", a: <>The technology is sophisticated. Your experience shouldn't feel that way. ALLUR handles the personalization, data, and adjustments behind the scenes so you can focus on the only thing that matters: the next step.</> },
              { q: "I don't have time.", a: <>That's exactly why this works. ALLUR is designed to reduce time spent planning workouts, figuring out macros, logging meals, and restarting. Spend less time organizing fitness, and more time doing it.</> },
              { q: "AI can't really coach me.", a: <>Bad AI chats. Good systems guide action. ALLUR uses your onboarding, progress, goals, injuries, and training context to shape what you should do next — and updates your plan instead of just talking at you.</> },
              { q: "I struggle to stay consistent.", a: <>Most people don't need more guilt — they need less friction. ALLUR makes consistency easier with daily clarity, simplified logging, visible progress, and fast adjustments. <strong className="text-[var(--lp-text)] font-semibold">The goal is making progress easier to sustain.</strong></> },
              { q: "Macro tracking is tedious.", a: <>Usually, yes. That's why ALLUR lets you snap a meal photo, review the analysis, and log it in seconds. Stay aware without making food tracking feel like a second job.</> }
            ].map((faq, i) => (
              <AccordionItem
                key={i}
                value={`obj-${i}`}
                className="lp-card px-6 border-0"
              >
                <AccordionTrigger className="text-lg font-semibold hover:no-underline py-6 text-left text-[var(--lp-text)]">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-[var(--lp-body)] text-base pb-6 leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* NUTRITION HIGHLIGHT — #0A0F1F */}
      <section className="py-24 border-y border-[var(--lp-border)]/60 relative overflow-hidden" style={{ backgroundColor: "var(--lp-bg-alt)" }}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col-reverse lg:flex-row items-center gap-16 relative z-10">
          <div className="flex-1">
            <span className="lp-kicker mb-4 block">Nutrition</span>
            <h2 className="lp-display text-4xl md:text-5xl font-semibold mb-6">Track macros without the spreadsheet.</h2>
            <p className="text-lg text-[var(--lp-body)] mb-8 leading-relaxed">
              No more searching databases for every ingredient. Take a photo of your meal. ALLUR's AI analyzes the food, estimates calories and macros, and lets you{" "}
              <span className="lp-underline">log it in seconds.</span>
            </p>
            <button onClick={handleSignup} className="lp-cta-ghost h-12 px-8 inline-flex items-center justify-center">
              See how it works
            </button>
          </div>
          <div className="flex-1">
            <PhoneMock><MacroScanMock /></PhoneMock>
          </div>
        </div>
      </section>

      {/* PROOF / STAT BAND — #08111F with teal top-accents */}
      <section className="py-24 md:py-28 relative overflow-hidden" style={{ backgroundColor: "var(--lp-bg-proof)" }}>
        <div className="absolute inset-0 lp-halo opacity-50" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-14">
            <h2 className="lp-display text-3xl md:text-5xl font-semibold">
              One system. <span style={{ color: "var(--lp-cyan)" }}>Everything covered.</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {[
              { stat: "1", unit: "Adaptive system", label: "Training, nutrition, and coaching in one place" },
              { stat: "24/7", unit: "AI coach", label: "Answers and plan changes whenever life shifts" },
              { stat: "Photo", unit: "Macro logging", label: "Snap a meal — calories and macros in seconds" },
              { stat: "Real", unit: "Sports science", label: "Evidence-based volume and progression built in" }
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="lp-card lp-card-hover relative p-7 text-center"
                style={{ borderTop: "2px solid rgba(45,212,191,0.5)" }}
              >
                <div className="lp-display text-4xl md:text-5xl font-bold mb-1" style={{ color: "var(--lp-cyan)" }}>{s.stat}</div>
                <div className="lp-display text-sm md:text-base font-semibold text-[var(--lp-text)] mb-3">{s.unit}</div>
                <p className="text-xs md:text-sm text-[var(--lp-muted)] leading-relaxed">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING — #04070F, darkest + cleanest, cyan spotlight on selected tier */}
      <section id="pricing" className="py-24 md:py-32 border-y border-[var(--lp-border)]/60" style={{ backgroundColor: "var(--lp-bg-cta)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="lp-kicker mb-4 block">Pricing</span>
            <h2 className="lp-display text-4xl md:text-5xl font-semibold mb-4">Elite coaching, accessible pricing.</h2>
            <p className="text-xl text-[var(--lp-muted)]">
              You're not paying for more information. You're paying for <span className="lp-underline">less friction.</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Base */}
            <div className="lp-card p-8 flex flex-col">
              <div className="mb-8">
                <h3 className="lp-display text-2xl font-semibold mb-2">Base</h3>
                <div className="flex items-end gap-1 mb-2">
                  <span className="lp-display text-5xl font-bold">$12.99</span>
                  <span className="text-[var(--lp-muted)] mb-1">/mo</span>
                </div>
                <p className="font-medium" style={{ color: "var(--lp-cyan)" }}>14-day free trial included</p>
              </div>

              <ul className="space-y-4 mb-10 flex-1 text-[var(--lp-body)]">
                {["Personalized training plan", "AI Coach guidance", "Photo-based meal logging", "Body stat tracking & analysis"].map((t) => (
                  <li key={t} className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--lp-muted)" }} /> {t}
                  </li>
                ))}
              </ul>

              <button onClick={handleSignup} className="lp-cta-ghost w-full h-14 text-lg inline-flex items-center justify-center">
                Start 14-day free trial
              </button>
            </div>

            {/* Premium — selected tier, cyan spotlight */}
            <div
              className="lp-card p-8 flex flex-col relative overflow-hidden"
              style={{ borderColor: "rgba(110,231,242,0.4)", boxShadow: "0 0 50px -18px rgba(110,231,242,0.4)" }}
            >
              <div
                className="absolute top-0 right-0 text-xs font-semibold px-4 py-1 rounded-bl-xl uppercase tracking-wide"
                style={{ backgroundImage: "linear-gradient(135deg, #6EE7F2, #2DD4BF)", color: "#04111A" }}
              >
                Recommended
              </div>
              <div className="mb-8 relative z-10">
                <h3 className="lp-display text-2xl font-semibold mb-2">Premium</h3>
                <div className="flex items-end gap-1 mb-2">
                  <span className="lp-display text-5xl font-bold">$29.99</span>
                  <span className="mb-1" style={{ color: "rgba(110,231,242,0.8)" }}>/mo</span>
                </div>
                <p className="text-[var(--lp-muted)]">For maximum adaptation</p>
              </div>

              <ul className="space-y-4 mb-10 flex-1 relative z-10 text-[var(--lp-body)]">
                <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--lp-cyan)" }} /> <span><strong className="text-[var(--lp-text)] font-semibold">Unlimited</strong> AI coach requests</span></li>
                <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--lp-cyan)" }} /> <span><strong className="text-[var(--lp-text)] font-semibold">Unlimited</strong> meal photo scans</span></li>
                <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--lp-cyan)" }} /> Advanced physique photo analysis</li>
                <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--lp-cyan)" }} /> Voice notes with AI coach</li>
                <li className="flex gap-3"><CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--lp-cyan)" }} /> Priority plan rebalancing</li>
              </ul>

              <button onClick={handleSignup} className="lp-cta w-full h-14 text-lg inline-flex items-center justify-center">
                Get Premium
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA — cleanest, highest-contrast section, halo ring behind CTA */}
      <section className="py-32 md:py-40 relative overflow-hidden" style={{ backgroundColor: "var(--lp-bg-cta)" }}>
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full bg-grid opacity-20" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, var(--lp-bg-cta), rgba(4,7,15,0.85), var(--lp-bg-cta))" }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] lp-halo opacity-80" />
        </div>

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="lp-display text-5xl md:text-6xl lg:text-7xl font-bold mb-8">
            Stop piecing it together.
            <br />
            <span style={{ color: "var(--lp-cyan)" }}>Start transforming.</span>
          </h2>
          <p className="text-xl md:text-2xl text-[var(--lp-body)] mb-12 max-w-2xl mx-auto">
            Follow a system built to adapt with you — and{" "}
            <span className="lp-underline">build your ideal body faster,</span> with less stress and less guesswork.
          </p>
          <button
            onClick={handleSignup}
            className="lp-cta h-16 px-12 text-xl inline-flex items-center justify-center gap-2 group"
          >
            Start with ALLUR now
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-sm text-[var(--lp-muted)] mt-6 font-medium">
            <span className="text-[var(--lp-text)]">14-day free trial</span> · Cancel anytime
          </p>
        </div>
      </section>

      {/* FOOTER — #03060D */}
      <SiteFooter />
    </div>
  );
}
