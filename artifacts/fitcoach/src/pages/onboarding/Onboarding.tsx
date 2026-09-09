import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import {
  useFitCoach,
  composeGuideline,
  composeEquipment,
  composeDislikes,
  composePreferences,
  physiqueLabel,
  computeMacroTarget,
  Goal,
  TargetPhysique,
  hasCalculableProfile,
  type Workout,
  type ProgramMeta,
  type MacroBreakdown,
} from "@/context/FitCoachContext";
import { buildProgram } from "@/data/trainingKnowledge";
import { EQUIPMENT_OPTIONS } from "@/data/exerciseOptimizer";
import { physiqueOptionsFor } from "@/data/physiques";
import { BODY_TYPE_PATHS, BODY_TYPE_OPTIONS, bodyTypeImagePath, type BodyTypeId } from "@/data/bodyTypes";
import { useAccount } from "@/context/AuthContext";
import { useLogoutAccount } from "@workspace/api-client-react";
import { writeOnboardingStash } from "@/lib/onboardingStash";
import { OnboardingShell } from "./OnboardingShell";
// The onboarding design system. Everything structural lives here so the screens
// can't drift apart again — see kit.tsx for why each piece exists.
import { ChoiceCard as CardBtn, StepCta, StepNav, type ScreenDef } from "./kit";
import { weekScreens } from "./WeekAct";
import { numberScreens } from "./NumbersAct";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Activity, Zap, Shield, ArrowRight, Check, Dumbbell, Salad, ShieldAlert, Wrench, Trophy, ThumbsUp, ThumbsDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { apiFetch, setAuthToken } from "@/lib/apiOrigin";

// Screen count is derived from the `screens` array below — there is no separate
// constant to forget to update. Adding a screen changes the clamp, the progress
// bar and the DEV jumper at once.
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAYS_ABBR = ["M", "T", "W", "T", "F", "S", "S"];

const INJURY_OPTIONS = ["Lower back", "Knee", "Shoulder", "Neck", "Hip", "Wrist / elbow", "Ankle / foot"];
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Pescatarian", "Gluten-free", "Lactose-free", "Nut allergy", "Halal", "Kosher", "Keto"];

const GOAL_OPTIONS: { id: Goal; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { id: "Weight Loss", icon: Activity, desc: "Shred fat and lean out" },
  { id: "Muscle Gain", icon: Dumbbell, desc: "Build size and shape" },
  { id: "Strength", icon: Shield, desc: "Get strong on the main lifts" },
  { id: "Athleticism", icon: Zap, desc: "Speed, power, conditioning" },
];

const PAST_FAILURES: { label: string; fix: string }[] = [
  { label: "Started strong, life got busy", fix: "adapts to your week" },
  { label: "Generic plans I couldn't stick to", fix: "built only for you" },
  { label: "Never knew if I was doing it right", fix: "AI coach checks you" },
  { label: "No time / unpredictable schedule", fix: "15-min busy-day versions" },
  { label: "Results too slow — lost motivation", fix: "visible weekly progress" },
  { label: "Injuries got in the way", fix: "trains around your limits" },
];

const IDENTITY_OPTIONS = [
  "In my teens / early 20s",
  "A few years back",
  "After a program that worked for a while",
  "Recently — I want it back",
  "Honestly, never — this is my first real shot",
];

/** Photographic body-type tile for the self-ID step. Falls back to the
 *  illustrated silhouette if the photo hasn't been added yet, so the step is
 *  never broken while imagery is being produced. */
function BodyTypeCard({
  gender,
  id,
  label,
  active,
  onClick,
  wide,
}: {
  gender: string;
  id: BodyTypeId;
  label: string;
  active: boolean;
  onClick: () => void;
  wide?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border-2 transition-all",
        wide ? "col-span-2 aspect-[16/10]" : "aspect-[3/4]",
        active ? "border-primary shadow-lg shadow-primary/20" : "border-border hover:border-primary/50",
      )}
    >
      {imgOk ? (
        <img
          src={bodyTypeImagePath(gender, id)}
          alt={label}
          onError={() => setImgOk(false)}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]",
            wide ? "object-[50%_20%]" : "object-top",
          )}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-secondary/50 to-card">
          <svg viewBox="0 0 120 150" className="h-3/4 w-auto">
            <path d={BODY_TYPE_PATHS[gender === "Female" ? "f" : "m"][id]} className={active ? "fill-primary" : "fill-muted-foreground/70"} />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
      {active && <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-primary" />}
      <span className="absolute inset-x-3 bottom-3 text-left text-sm font-semibold leading-tight text-white drop-shadow">
        {label}
      </span>
      {active && (
        <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}

/** Grid of tappable card chips (multi-select array field). */
function CardChips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (o: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map((o) => (
        <CardBtn key={o} active={selected.includes(o)} onClick={() => onToggle(o)}>
          <span className="pr-5 leading-snug">{o}</span>
        </CardBtn>
      ))}
    </div>
  );
}

function SectionHead({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-semibold leading-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex bg-card border border-border rounded-xl p-1 gap-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-bold transition-colors",
            value === o ? "bg-primary/15 text-foreground shadow-[0_0_0_1px] shadow-primary/40" : "text-muted-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function UnitToggle({ options, value, onChange }: { options: { label: string; val: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex bg-secondary rounded-full p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(o.val)}
          className={cn("px-2.5 py-0.5 text-xs rounded-full transition-colors", value === o.val ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setOnboardingComplete, setShowInstallPrompt, profile, setProfile, goal, setGoal, setWorkoutPlan, setProgramMeta } = useFitCoach();

  const canCalculate = hasCalculableProfile(profile);
  const [generating, setGenerating] = useState(false);
  const { authUser, refreshAuth } = useAccount();
  const logoutMut = useLogoutAccount();
  const [switchingAccount, setSwitchingAccount] = useState(false);

  // Funnel answers that enrich the plan + power the reveal (kept local; fed to
  // the coach adaptation and shown back on the "here's your plan" screen).
  const [startingPoint, setStartingPoint] = useState("");
  const [pastFailures, setPastFailures] = useState<string[]>([]);
  const [bestShape, setBestShape] = useState("");
  const [reliableDays, setReliableDays] = useState("3");
  const [trainDays, setTrainDays] = useState<number[]>([0, 2, 5]);
  const [sessionLen, setSessionLen] = useState("45 min");
  const [busyDay, setBusyDay] = useState("15 min");
  const [built, setBuilt] = useState<{ plan: Workout[]; meta: ProgramMeta; macros: MacroBreakdown } | null>(null);

  const detectedTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  }, []);
  useEffect(() => {
    if (!profile.timezone && detectedTz) setProfile((p) => (p.timezone ? p : { ...p, timezone: detectedTz }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedTz]);

  const switchAccount = async () => {
    if (switchingAccount) return;
    setSwitchingAccount(true);
    try {
      await logoutMut.mutateAsync();
      // Native's credential is the stored bearer token, not a cookie the
      // server can clear — drop it locally or the device stays signed in.
      setAuthToken(null);
      await refreshAuth();
    } catch {
      toast({ variant: "destructive", title: "Couldn't sign out", description: "Please try again." });
    } finally {
      setSwitchingAccount(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, screens.length));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  /**
   * Onboarding CTAs stay enabled and validate on tap.
   *
   * They used to be `disabled` until the step was complete, but a disabled
   * button here is just the primary colour at 50% opacity — on a dark screen
   * that still reads as a perfectly good button, so a user who tapped it got
   * silence and no explanation. Worse, on a step where nothing is selected yet
   * the whole screen (options + CTA) looked inert.
   *
   * Enabled-plus-explain is the friendlier contract: the button always looks
   * pressable, and pressing it early tells you exactly what is missing.
   */
  const [stepError, setStepError] = useState<string | null>(null);
  const guardedNext = (ok: boolean, message: string) => () => {
    if (!ok) {
      setStepError(message);
      return;
    }
    setStepError(null);
    nextStep();
  };
  // Any change of step clears a stale message.
  useEffect(() => setStepError(null), [step]);

  const physiqueOptions = physiqueOptionsFor(profile.gender);
  const physiqueSelected = physiqueOptions.some((p) => p.id === profile.targetPhysique);

  const toggleField = (field: "equipment" | "sports" | "classes" | "enjoy" | "dislikes") => (opt: string) =>
    setProfile((p) => {
      const arr = (p[field] as string[]) ?? [];
      return { ...p, [field]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
    });
  const toggleInjury = (opt: string) =>
    setProfile((p) => ({ ...p, injuries: p.injuries.includes(opt) ? p.injuries.filter((i) => i !== opt) : [...p.injuries, opt] }));
  const toggleDietary = (opt: string) =>
    setProfile((p) => ({ ...p, dietary: p.dietary.includes(opt) ? p.dietary.filter((d) => d !== opt) : [...p.dietary, opt] }));
  const toggleFailure = (opt: string) => setPastFailures((a) => (a.includes(opt) ? a.filter((x) => x !== opt) : [...a, opt]));
  const toggleDay = (i: number) => setTrainDays((a) => (a.includes(i) ? a.filter((x) => x !== i) : [...a, i].sort((m, n) => m - n)));

  const EQUIPMENT_LABELS = EQUIPMENT_OPTIONS.map((o) => o.label);

  const parseImperial = (h: string) => {
    const m = h.match(/(\d+)?\s*'\s*(\d+)?/);
    return { ft: m?.[1] ?? "", inch: m?.[2] ?? "" };
  };
  const composeImperial = (ft: string, inch: string) => (ft || inch ? `${ft || 0}' ${inch || 0}"` : "");
  const setHeightCm = (cm: string) => setProfile({ ...profile, height: cm, heightUnit: "cm" });
  const setHeightFt = (ft: string) => setProfile({ ...profile, height: composeImperial(ft, parseImperial(profile.height).inch), heightUnit: "ft" });
  const setHeightIn = (inch: string) => setProfile({ ...profile, height: composeImperial(parseImperial(profile.height).ft, inch), heightUnit: "ft" });
  const switchHeightUnit = (unit: "cm" | "ft") => {
    if (unit !== profile.heightUnit) setProfile({ ...profile, height: "", heightUnit: unit });
  };

  // Build the deterministic plan, then reshape it around the user's real week +
  // injuries via the coach, then store it for the reveal screen.
  const generatePlan = async () => {
    if (!goal) return;
    setGenerating(true);
    // Pass the real week in. Step 5 calls this "the part every other plan
    // skipped" — before this, the answer was only ever used for the signed-in
    // LLM pass, so every anonymous visitor saw a stock 5-6 day split no matter
    // what they said. The reveal then claimed "every choice came from something
    // you told us" over a plan that ignored the loudest choice they made.
    const program = buildProgram(profile, goal, {
      count: Number(reliableDays) || undefined,
      dayIndexes: trainDays,
    });
    const macros = computeMacroTarget(profile, goal);
    const injuriesGuideline = composeGuideline(profile.injuries, profile.injuryNotes);
    const dietaryGuideline = composeGuideline(profile.dietary, profile.dietaryNotes);
    const dayNames = trainDays.map((i) => DAYS_FULL[i]).join(", ");

    let finalPlan = program.days;
    // The coach adapt-plan endpoint is auth-gated (it's an LLM call, kept off
    // the anonymous path so it can't be used as a free-coaching backdoor). In
    // the signed-out funnel we show — and later deliver — the deterministic base
    // plan as-is, so the plan the visitor approves is exactly what they get.
    if (authUser && (injuriesGuideline || reliableDays)) {
      try {
        const content =
          `I'm just starting this plan. Reshape it to fit my real week: I can reliably train ${reliableDays} day(s) a week` +
          (dayNames ? ` (${dayNames})` : "") +
          `, about ${sessionLen} per session, and on my busiest day I can still give ${busyDay}. ` +
          `Make it exactly ${reliableDays} training day(s) per week while keeping my ${goal} goal and the overall structure.` +
          (injuriesGuideline ? ` Keep it safe for these injuries/limitations: ${injuriesGuideline} — swap or modify any movement that could aggravate them and add a short note on each change.` : "") +
          (pastFailures.length ? ` In the past I've struggled with: ${pastFailures.join("; ")} — keep it simple and sustainable so it actually sticks.` : "") +
          ` Apply the update now.`;
        const res = await apiFetch(`/api/coach/adapt-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: [{ role: "user", content }],
            goal,
            profile: {
              name: profile.name,
              experience: profile.experience,
              targetPhysique: physiqueLabel(profile.targetPhysique),
              activityLevel: profile.activityLevel,
              injuries: injuriesGuideline,
              dietary: dietaryGuideline,
              equipment: composeEquipment(profile),
              dislikes: composeDislikes(profile),
              preferences: composePreferences(profile),
            },
            plan: program.days,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { planUpdated?: boolean; updatedPlan?: Workout[] | null };
          if (data.planUpdated && Array.isArray(data.updatedPlan) && data.updatedPlan.length) finalPlan = data.updatedPlan;
        }
      } catch {
        /* fall back to the deterministic base plan */
      }
    }

    // Keep the label + day count honest against the plan we actually built.
    const n = finalPlan.length;
    const meta: ProgramMeta = {
      ...program.meta,
      daysPerWeek: n,
      splitName: program.meta.splitName.replace(/^\s*\d+\s*-?\s*[Dd]ay\b/, `${n}-Day`),
    };
    setBuilt({ plan: finalPlan, meta, macros });
    setGenerating(false);
    setStep(8);
  };

  const commitAndContinue = () => {
    if (!built) return;
    // Signed-out visitor: this is the end of the anonymous funnel. Stash the
    // finished plan (plus profile/goal) so it survives account creation, then
    // send them to sign up. The FitCoach provider restores the stash on the new
    // account's first hydration, marks onboarding complete, and the paywall gate
    // takes it from there — so account creation and payment happen HERE, at the
    // end, exactly once the visitor has seen their plan.
    if (!authUser) {
      writeOnboardingStash({ profile, goal, plan: built.plan, meta: built.meta });
      setLocation("/auth?mode=signup");
      return;
    }
    setWorkoutPlan(built.plan);
    setProgramMeta(built.meta);
    setOnboardingComplete(true);
    setShowInstallPrompt(true);
    setLocation("/dashboard");
  };

  // ---- reveal derivations ----
  const reveal = useMemo(() => {
    if (!built) return null;
    const first = built.plan[0];
    const dur = first ? Math.round(first.exercises.length * 9 + 6) : 40;
    const shoulderSafe = profile.injuries.includes("Shoulder");
    const dayTitle = (i: number) => {
      const w = built.plan.find((d) => d.dayName === DAYS_FULL[i]);
      return w ? w.title.split(" ")[0] : null;
    };
    // The week as a readable list, in calendar order. The old 7-across pill
    // grid truncated titles to four characters ("Zone", "Athl", "Long"), which
    // told the user nothing — and hid whether the plan had actually used the
    // days they gave us.
    const sessions = DAYS_FULL.map((name) => built.plan.find((d) => d.dayName === name))
      .filter((w): w is NonNullable<typeof w> => !!w)
      .map((w) => ({
        day: w.dayName,
        short: w.dayName.slice(0, 3),
        title: w.title,
        movements: w.exercises.length,
      }));
    const why: string[] = [];
    // Only claim day-matching when the coach actually reshaped the plan to the
    // user's week (auth-only). On the signed-out funnel the deterministic base
    // plan is shown, so we describe it honestly by goal instead.
    why.push(
      authUser
        ? `${built.meta.splitName} — ${built.meta.daysPerWeek}×/week, matched to the days you gave us.`
        : `${built.meta.splitName} — ${built.meta.daysPerWeek}×/week, built for your ${goal ?? "training"} goal.`,
    );
    if (profile.injuries.length) why.push(`Adjusted around your ${profile.injuries.join(", ").toLowerCase()} so nothing aggravates it.`);
    if (pastFailures.some((f) => /generic/i.test(f))) why.push(`You said generic plans never stuck — this one is built only from your answers.`);
    else if (profile.equipment.length) why.push(`Only movements your setup allows: ${profile.equipment.slice(0, 2).join(", ").toLowerCase()}.`);
    return { first, dur, shoulderSafe, dayTitle, sessions, why: why.slice(0, 3) };
  }, [built, profile.injuries, profile.equipment, pastFailures, authUser, goal]);

  // ---- the flow -------------------------------------------------------
  // The whole onboarding is this list. Adding, cutting or reordering a screen
  // is an edit here rather than a renumbering exercise across the file, which
  // is what the jump from 8 screens to 22 needs. Each `render` closes over the
  // state above, so screens read and write the same answers with no plumbing.
  const screens: ScreenDef[] = [
    {
      id: "self-id",
      label: "Start",
      render: () => (
        <>
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-primary mb-2">Let's build your plan</p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Where are you starting from?</h1>
          <p className="text-muted-foreground mb-6">No judgment — just where we're starting. This is day one.</p>

          {/* Uses the shared CardBtn so gender selection looks identical to
              every other single-select in onboarding. It previously
              reimplemented the same classes inline, which is how the two
              drifted apart. */}
          <div className="flex gap-3 mb-6">
            {(["Male", "Female"] as const).map((g) => (
              <CardBtn
                key={g}
                active={profile.gender === g}
                onClick={() => setProfile({ ...profile, gender: g })}
                className="flex-1 text-center font-semibold"
              >
                {g}
              </CardBtn>
            ))}
          </div>

          {/* The grid is always rendered. Before a gender is chosen it sits
              dimmed and untappable, so the step shows what it's asking for
              instead of opening on ~400px of empty black — this is the
              first screen of the product. Nothing is preselected, so no
              assumption is made about the user; picking a gender simply
              brings the grid to full strength and swaps the imagery. */}
          <div className="relative">
            <div
              aria-hidden={!profile.gender}
              className={cn(
                "grid grid-cols-2 gap-3 content-start transition-opacity duration-300",
                profile.gender ? "opacity-100" : "pointer-events-none opacity-35",
              )}
            >
              {BODY_TYPE_OPTIONS.map((b, idx) => (
                <BodyTypeCard
                  key={b.id}
                  gender={profile.gender || "Male"}
                  id={b.id}
                  label={b.label}
                  active={startingPoint === b.id}
                  onClick={() => setStartingPoint(b.id)}
                  wide={idx === 4}
                />
              ))}
            </div>
            {!profile.gender && (
              <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center px-6">
                <p className="rounded-full border border-border bg-background/90 px-4 py-2 text-center text-sm font-medium text-foreground backdrop-blur-sm">
                  Pick one above to see your starting-point options.
                </p>
              </div>
            )}
          </div>

          <StepCta
            onClick={guardedNext(
              !!profile.gender && !!startingPoint,
              !profile.gender ? "Pick Male or Female first." : "Choose the body type closest to you now.",
            )}
            error={stepError}
            className="mt-8"
          />
        </>
      ),
    },
    {
      id: "goal",
      label: "Goal",
      render: () => (
        <>
          <h1 className="text-3xl font-bold tracking-tight mb-2">What are you chasing?</h1>
          <p className="text-muted-foreground mb-5">We'll build your training and nutrition around this.</p>
          <div className="grid grid-cols-2 gap-2.5 mb-6">
            {GOAL_OPTIONS.map((g) => (
              <CardBtn key={g.id} active={goal === g.id} onClick={() => setGoal(g.id)}>
                <g.icon className="w-5 h-5 mb-1.5 text-primary" />
                <div className="font-semibold text-foreground">{g.id}</div>
                <div className="text-xs text-muted-foreground">{g.desc}</div>
              </CardBtn>
            ))}
          </div>
          <Label className="mb-2 block">And the look you want</Label>
          <div className="space-y-3 flex-1">
            {/* A real <button> with aria-pressed, not a clickable <div>.
                As a div these were invisible to keyboard focus and were
                not announced as controls by VoiceOver — every other
                selectable card in onboarding is a button, so this was also
                the odd one out. The image column is widened to w-28 so the
                physique is actually legible rather than a narrow sliver. */}
            {physiqueOptions.map((p) => {
              const selected = profile.targetPhysique === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setProfile({ ...profile, targetPhysique: p.id as TargetPhysique })}
                  className={cn(
                    "w-full text-left rounded-2xl border-2 transition-all flex items-stretch gap-4 overflow-hidden",
                    selected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  <div className="w-28 shrink-0 bg-black/40 relative">
                    <img src={`${import.meta.env.BASE_URL}physiques/${p.img}`} alt="" className="w-full h-full object-cover object-top" />
                    {selected && (
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 py-3 pr-4 flex flex-col justify-center">
                    <h3 className="font-semibold">{p.label}</h3>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <StepNav
            onBack={prevStep}
            onNext={guardedNext(
              !!goal && physiqueSelected,
              !goal ? "Pick what you're chasing first." : "Choose the look you're aiming for.",
            )}
            error={stepError}
          />
        </>
      ),
    },
    {
      id: "why",
      label: "Why",
      render: () => (
        <>
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-primary mb-2">Be honest</p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">What's gotten in the way before?</h1>
          <p className="text-muted-foreground mb-6">Pick all that ring true. This is the important one.</p>
          <div className="space-y-2.5 flex-1">
            {PAST_FAILURES.map((f) => {
              const active = pastFailures.includes(f.label);
              return (
                <CardBtn key={f.label} active={active} onClick={() => toggleFailure(f.label)} className="block">
                  <span className="pr-5 block">{f.label}</span>
                  <span className="block text-[11px] font-semibold text-primary mt-1">→ {f.fix}</span>
                </CardBtn>
              );
            })}
          </div>
          <div className="mt-4 bg-card border border-dashed border-primary/40 rounded-2xl p-4 text-sm leading-relaxed text-foreground/90">
            None of these were your fault. They're what happens when a plan can't bend to your life. <span className="text-primary font-semibold">That's the part we fixed.</span>
          </div>
          <StepNav onBack={prevStep} onNext={nextStep} />
        </>
      ),
    },
    {
      id: "best-self",
      label: "You",
      render: () => (
        <>
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-primary mb-2">Your best self</p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">When did you last feel like yourself?</h1>
          <p className="text-muted-foreground mb-6">We'll build the path back — and past — that.</p>
          <div className="space-y-2.5 flex-1">
            {IDENTITY_OPTIONS.map((o) => (
              <CardBtn key={o} active={bestShape === o} onClick={() => setBestShape(o)} className="block"><span className="pr-5">{o}</span></CardBtn>
            ))}
          </div>
          <StepNav
            onBack={prevStep}
            onNext={guardedNext(!!bestShape, "Pick the one that fits best — you can change it later.")}
            error={stepError}
          />
        </>
      ),
    },
    ...weekScreens({
      answers: { reliableDays, trainDays, sessionLen, busyDay, equipment: profile.equipment },
      onChange: (patch) => {
        if (patch.reliableDays !== undefined) setReliableDays(patch.reliableDays);
        if (patch.trainDays !== undefined) setTrainDays(patch.trainDays);
        if (patch.sessionLen !== undefined) setSessionLen(patch.sessionLen);
        if (patch.busyDay !== undefined) setBusyDay(patch.busyDay);
        if (patch.equipment !== undefined) setProfile({ ...profile, equipment: patch.equipment });
      },
      equipmentOptions: EQUIPMENT_LABELS,
      onBack: prevStep,
      guardedNext,
      next: nextStep,
      error: stepError,
    }),
    {
      id: "around",
      label: "Around",
      render: () => (
        <>
          <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-primary mb-2">Make it yours</p>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Anything to train around?</h1>
          <p className="text-muted-foreground mb-6">We'll adjust around the limitations you report.</p>
          <div className="flex-1 space-y-6">
            <div>
              <SectionHead icon={ShieldAlert} title="Injuries or limitations" description="We'll avoid movements that aggravate these." />
              <CardChips options={INJURY_OPTIONS} selected={profile.injuries} onToggle={toggleInjury} />
              <Textarea value={profile.injuryNotes} onChange={(e) => setProfile((p) => ({ ...p, injuryNotes: e.target.value }))} placeholder="Anything else? e.g. left knee pain on deep squats…" className="bg-secondary/50 border-0 resize-none h-20 mt-3" />
            </div>
            <div>
              <SectionHead icon={Salad} title="Dietary restrictions" description="We'll keep meal advice within these." />
              <CardChips options={DIETARY_OPTIONS} selected={profile.dietary} onToggle={toggleDietary} />
            </div>
          </div>
          <StepNav onBack={prevStep} onNext={nextStep} className="pt-6 border-t border-border/50" />
        </>
      ),
    },
    ...numberScreens({
      answers: {
        name: profile.name,
        age: profile.age,
        height: profile.height,
        heightUnit: profile.heightUnit as "cm" | "ft",
        weight: profile.weight,
        weightUnit: profile.weightUnit as "kg" | "lb",
        experience: profile.experience,
        activityLevel: profile.activityLevel,
      },
      onChange: (patch) => setProfile({ ...profile, ...patch }),
      onBack: prevStep,
      guardedNext,
      next: nextStep,
      error: stepError,
      unitToggle: (options, value, onChange) => (
        <UnitToggle options={options} value={value} onChange={onChange} />
      ),
      generating,
      onBuild: () => {
        if (!canCalculate) return setStepError("Fill in age, height, weight, experience and activity level.");
        setStepError(null);
        void generatePlan();
      },
    }),
    {
      id: "reveal",
      label: "Plan",
      render: () => (
        <>
          {generating || !built || !reveal ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="relative w-24 h-24 mb-8">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute inset-0 rounded-full border-4 border-primary/30 border-t-primary" />
                <div className="absolute inset-0 flex items-center justify-center"><Zap className="w-8 h-8 text-primary" /></div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Building your plan</h2>
              <p className="text-muted-foreground animate-pulse">Shaping it around your real week…</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-primary mb-2">Your plan is built</p>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Here's what we built for you{profile.name ? `, ${profile.name}` : ""}.</h1>
              <p className="text-muted-foreground mb-5">Not a template. Every choice came from something you told us.</p>

              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mb-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Your first session</p>
                <p className="text-lg font-bold mt-0.5">{reveal.first ? reveal.first.title : "Full body"}</p>
                <p className="text-xs text-primary">{reveal.first ? `${reveal.first.exercises.length} movements · ~${reveal.dur} min` : ""}{reveal.shoulderSafe ? " · shoulder-safe" : ""}</p>
                <ul className="mt-3 space-y-1.5">
                  {reveal.sessions.map((s) => (
                    <li key={s.day} className="flex items-baseline gap-3 text-sm">
                      <span className="w-9 shrink-0 font-bold text-primary">{s.short}</span>
                      <span className="flex-1 font-medium leading-snug">{s.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{s.movements}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 inline-flex text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 rounded-full px-2.5 py-1">◔ Busy-day {busyDay} version ready</div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 mb-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Daily calories</span><span className="font-bold">{built.macros.calories.toLocaleString()} kcal</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Protein</span><span className="font-bold">{built.macros.protein} g</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Adjusts from</span><span className="font-bold">your logged weight</span></div>
              </div>

              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4">
                <h4 className="text-[11px] uppercase tracking-wider text-primary font-bold mb-2.5">Why this plan</h4>
                <ul className="space-y-2">
                  {reveal.why.map((w, i) => (
                    <li key={i} className="text-[13px] text-foreground/85 leading-snug pl-4 relative"><span className="absolute left-0 text-primary font-bold">→</span>{w}</li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-3 mt-8">
                <Button variant="secondary" onClick={() => setStep(7)} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={commitAndContinue} className="flex-1 rounded-full h-12 text-lg font-bold">This looks right <ArrowRight className="ml-2 w-5 h-5" /></Button>
              </div>
            </>
          )}
        </>
      ),
    },
  ];
  const current = screens[step - 1];

  return (
    <OnboardingShell step={step} totalSteps={screens.length}>
      <div className="flex-1 flex flex-col px-6 pt-10 pb-8 md:px-10 md:pt-14">
        {import.meta.env.DEV && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">Preview only · jump to step</p>
            <div className="flex flex-wrap gap-1.5">
              {screens.map((sc, i) => {
                const n = i + 1;
                const label = sc.label;
                return (
                  <button key={n} type="button" onClick={() => setStep(n)} className={cn("text-xs font-medium rounded-full px-3 py-1 border transition-colors", step === n ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50")}>
                    {n}. {label}
                  </button>
                );
              })}
              <button type="button" onClick={() => setLocation("/paywall")} className="text-xs font-medium rounded-full px-3 py-1 border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">→ Paywall</button>
            </div>
          </div>
        )}

        {authUser && (
          <div className="flex items-center justify-between gap-2 mb-4 text-xs text-muted-foreground">
            <span className="truncate">Signed in as <span className="font-medium text-foreground">{authUser.email ?? authUser.username}</span></span>
            <button type="button" onClick={() => void switchAccount()} disabled={switchingAccount} className="shrink-0 font-semibold text-primary hover:underline disabled:opacity-60">
              {switchingAccount ? "Signing out…" : "Not you? Log in"}
            </button>
          </div>
        )}

        <div className="w-full flex gap-1 mb-8">
          {screens.map((sc, idx) => (
            <div key={sc.id} className="h-1 flex-1 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: idx + 1 <= step ? "100%" : "0%" }} />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              {current.render()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OnboardingShell>
  );
}
