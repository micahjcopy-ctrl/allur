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

const TOTAL_STEPS = 8;
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

/** Large tappable card for a single- or multi-select option. */
function CardBtn({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative text-left rounded-2xl border-2 px-4 py-3.5 text-sm font-medium transition-all",
        active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40",
        className,
      )}
    >
      {children}
      {active && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
    </button>
  );
}

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

  const nextStep = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

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
    const program = buildProgram(profile, goal);
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
    return { first, dur, shoulderSafe, dayTitle, why: why.slice(0, 3) };
  }, [built, profile.injuries, profile.equipment, pastFailures, authUser, goal]);

  return (
    <OnboardingShell step={step} totalSteps={TOTAL_STEPS}>
      <div className="flex-1 flex flex-col px-6 pt-10 pb-8 md:px-10 md:pt-14">
        {import.meta.env.DEV && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">Preview only · jump to step</p>
            <div className="flex flex-wrap gap-1.5">
              {["Start", "Goal", "Why", "You", "Week", "Around", "Numbers", "Plan"].map((label, i) => {
                const n = i + 1;
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
          {Array.from({ length: TOTAL_STEPS }, (_, idx) => idx + 1).map((i) => (
            <div key={i} className="h-1 flex-1 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: i <= step ? "100%" : "0%" }} />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* 1 — SELF-ID */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-primary mb-2">Let's build your plan</p>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Where are you starting from?</h1>
              <p className="text-muted-foreground mb-6">No judgment — just where we're starting. This is day one.</p>

              <div className="flex gap-3 mb-6">
                {(["Male", "Female"] as const).map((g) => (
                  <button key={g} type="button" onClick={() => setProfile({ ...profile, gender: g })} className={cn("flex-1 rounded-2xl border-2 py-3 text-sm font-semibold transition-all", profile.gender === g ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40")}>{g}</button>
                ))}
              </div>

              {profile.gender ? (
                <div className="grid grid-cols-2 gap-3 content-start">
                  {BODY_TYPE_OPTIONS.map((b, idx) => (
                    <BodyTypeCard
                      key={b.id}
                      gender={profile.gender}
                      id={b.id}
                      label={b.label}
                      active={startingPoint === b.id}
                      onClick={() => setStartingPoint(b.id)}
                      wide={idx === 4}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground">Pick one above to see your starting-point options.</div>
              )}

              <Button onClick={nextStep} className="w-full mt-8 rounded-full h-12 text-lg font-medium" disabled={!profile.gender || !startingPoint}>Next <ChevronRight className="ml-2 w-5 h-5" /></Button>
            </motion.div>
          )}

          {/* 2 — DESIRE (goal + physique) */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
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
                {physiqueOptions.map((p) => (
                  <div key={p.id} onClick={() => setProfile({ ...profile, targetPhysique: p.id as TargetPhysique })} className={cn("rounded-2xl border-2 transition-all cursor-pointer flex items-stretch gap-4 overflow-hidden", profile.targetPhysique === p.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50")}>
                    <div className="w-20 shrink-0 bg-black/40 relative">
                      <img src={`${import.meta.env.BASE_URL}physiques/${p.img}`} alt={p.label} className="w-full h-full object-cover object-top" />
                      {profile.targetPhysique === p.id && <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1"><Check className="w-3 h-3" /></div>}
                    </div>
                    <div className="flex-1 py-3 pr-4 flex flex-col justify-center">
                      <h3 className="font-semibold">{p.label}</h3>
                      <p className="text-xs text-muted-foreground">{p.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-8">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium" disabled={!goal || !physiqueSelected}>Next <ChevronRight className="ml-2 w-5 h-5" /></Button>
              </div>
            </motion.div>
          )}

          {/* 3 — PAST FAILURE */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
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
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium">Next <ChevronRight className="ml-2 w-5 h-5" /></Button>
              </div>
            </motion.div>
          )}

          {/* 4 — IDENTITY */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-primary mb-2">Your best self</p>
              <h1 className="text-3xl font-bold tracking-tight mb-2">When did you last feel like yourself?</h1>
              <p className="text-muted-foreground mb-6">We'll build the path back — and past — that.</p>
              <div className="space-y-2.5 flex-1">
                {IDENTITY_OPTIONS.map((o) => (
                  <CardBtn key={o} active={bestShape === o} onClick={() => setBestShape(o)} className="block"><span className="pr-5">{o}</span></CardBtn>
                ))}
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium" disabled={!bestShape}>Next <ChevronRight className="ml-2 w-5 h-5" /></Button>
              </div>
            </motion.div>
          )}

          {/* 5 — REAL WEEK */}
          {step === 5 && (
            <motion.div key="s5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-primary mb-2">Your real week</p>
              <h1 className="text-3xl font-bold tracking-tight mb-2">When can you actually train?</h1>
              <p className="text-muted-foreground mb-6">The part every other plan skipped — and why they fell apart.</p>
              <div className="flex-1 space-y-5">
                <div>
                  <Label className="mb-2 block">Days you can reliably train</Label>
                  <Segmented options={["2", "3", "4", "5", "6"]} value={reliableDays} onChange={setReliableDays} />
                </div>
                <div>
                  <Label className="mb-2 block">Which days usually work?</Label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS_ABBR.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleDay(i)} className={cn("aspect-square rounded-lg border text-xs font-bold transition-colors", trainDays.includes(i) ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border text-muted-foreground")}>{d}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Normal session length</Label>
                  <Segmented options={["30 min", "45 min", "60 min", "75+"]} value={sessionLen} onChange={setSessionLen} />
                </div>
                <div>
                  <Label className="mb-2 block">Busiest day, you could still give</Label>
                  <Segmented options={["15 min", "20 min", "Skip it"]} value={busyDay} onChange={setBusyDay} />
                </div>
                <div>
                  <SectionHead icon={Wrench} title="Where do you train?" />
                  <CardChips options={EQUIPMENT_LABELS} selected={profile.equipment} onToggle={toggleField("equipment")} />
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-6 border-t border-border/50">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium">Next <ChevronRight className="ml-2 w-5 h-5" /></Button>
              </div>
            </motion.div>
          )}

          {/* 6 — TRAIN AROUND */}
          {step === 6 && (
            <motion.div key="s6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
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
              <div className="flex gap-3 mt-6 pt-6 border-t border-border/50">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium">Next <ChevronRight className="ml-2 w-5 h-5" /></Button>
              </div>
            </motion.div>
          )}

          {/* 7 — CALIBRATE */}
          {step === 7 && (
            <motion.div key="s7" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-primary mb-2">Precision</p>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Last thing — your numbers.</h1>
              <p className="text-muted-foreground mb-6">So your plan is calibrated to you, not a template.</p>
              <div className="space-y-4 flex-1">
                <div className="space-y-2"><Label>Name</Label><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="John" className="bg-secondary/50 border-0" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Age</Label><Input type="number" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} placeholder="28" className="bg-secondary/50 border-0" /></div>
                  <div className="space-y-2"><Label>Experience</Label>
                    <Select value={profile.experience} onValueChange={(val: any) => setProfile({ ...profile, experience: val })}>
                      <SelectTrigger className="bg-secondary/50 border-0"><SelectValue placeholder="Experience" /></SelectTrigger>
                      <SelectContent><SelectItem value="Beginner">Beginner (0-1 yrs)</SelectItem><SelectItem value="Intermediate">Intermediate (1-3 yrs)</SelectItem><SelectItem value="Advanced">Advanced (3+ yrs)</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between min-h-6"><Label>Height</Label><UnitToggle options={[{ label: "cm", val: "cm" }, { label: "ft/in", val: "ft" }]} value={profile.heightUnit} onChange={(v) => switchHeightUnit(v as "cm" | "ft")} /></div>
                    {profile.heightUnit === "cm" ? (
                      <Input type="number" inputMode="numeric" value={profile.height} onChange={(e) => setHeightCm(e.target.value)} placeholder="180" className="bg-secondary/50 border-0" />
                    ) : (
                      <div className="flex gap-2">
                        <div className="relative flex-1"><Input type="number" inputMode="numeric" value={parseImperial(profile.height).ft} onChange={(e) => setHeightFt(e.target.value)} placeholder="5" className="bg-secondary/50 border-0 pr-7" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ft</span></div>
                        <div className="relative flex-1"><Input type="number" inputMode="numeric" value={parseImperial(profile.height).inch} onChange={(e) => setHeightIn(e.target.value)} placeholder="11" className="bg-secondary/50 border-0 pr-7" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">in</span></div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between min-h-6"><Label>Weight</Label><UnitToggle options={[{ label: "kg", val: "kg" }, { label: "lb", val: "lb" }]} value={profile.weightUnit} onChange={(v) => setProfile({ ...profile, weightUnit: v as "kg" | "lb" })} /></div>
                    <div className="relative"><Input type="number" inputMode="numeric" value={profile.weight} onChange={(e) => setProfile({ ...profile, weight: e.target.value })} placeholder={profile.weightUnit === "lb" ? "180" : "80"} className="bg-secondary/50 border-0 pr-9" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{profile.weightUnit}</span></div>
                  </div>
                </div>
                <div className="space-y-2"><Label>Activity level</Label>
                  <Select value={profile.activityLevel} onValueChange={(val: any) => setProfile({ ...profile, activityLevel: val })}>
                    <SelectTrigger className="bg-secondary/50 border-0"><SelectValue placeholder="How active are you?" /></SelectTrigger>
                    <SelectContent><SelectItem value="Sedentary">Sedentary (desk job)</SelectItem><SelectItem value="Light">Light (1-2 / week)</SelectItem><SelectItem value="Moderate">Moderate (3-4 / week)</SelectItem><SelectItem value="Very Active">Very Active (5-6 / week)</SelectItem><SelectItem value="Athlete">Athlete (daily)</SelectItem></SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Used to calculate your daily calorie target.</p>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={() => void generatePlan()} disabled={!profile.name || !canCalculate || generating} className="flex-1 rounded-full h-12 text-lg font-bold">
                  {generating ? "Building…" : <>Build my plan <ArrowRight className="ml-2 w-5 h-5" /></>}
                </Button>
              </div>
            </motion.div>
          )}

          {/* 8 — REVEAL */}
          {step === 8 && (
            <motion.div key="s8" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
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
                    <div className="grid grid-cols-7 gap-1.5 mt-3">
                      {DAYS_ABBR.map((d, i) => {
                        const t = reveal.dayTitle(i);
                        return (
                          <div key={i} className={cn("rounded-lg py-1.5 text-center text-[9px] font-bold border", t ? "bg-primary text-primary-foreground border-transparent" : "bg-card text-muted-foreground border-border")}>
                            {d}<span className="block text-[10px] mt-0.5">{t ? t.slice(0, 4) : "·"}</span>
                          </div>
                        );
                      })}
                    </div>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </OnboardingShell>
  );
}
