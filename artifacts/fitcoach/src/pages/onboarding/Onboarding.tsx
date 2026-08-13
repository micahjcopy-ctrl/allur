import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useFitCoach, composeGuideline, composeEquipment, composeDislikes, composePreferences, physiqueLabel, Goal, TargetPhysique, hasCalculableProfile, type Workout } from "@/context/FitCoachContext";
import { buildProgram } from "@/data/trainingKnowledge";
import { EQUIPMENT_OPTIONS, SPORTS_OPTIONS, CLASS_OPTIONS, ENJOY_OPTIONS, AVOID_OPTIONS } from "@/data/exerciseOptimizer";
import { physiqueOptionsFor } from "@/data/physiques";
import { useAccount } from "@/context/AuthContext";
import { useLogoutAccount } from "@workspace/api-client-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Activity, Zap, Shield, ArrowRight, Check, Dumbbell, Salad, ShieldAlert, Wrench, Trophy, Bike, ThumbsUp, ThumbsDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

const TOTAL_STEPS = 6;

const INJURY_OPTIONS = ["Lower back", "Knee", "Shoulder", "Neck", "Hip", "Wrist / elbow", "Ankle / foot"];
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Pescatarian", "Gluten-free", "Lactose-free", "Nut allergy", "Halal", "Kosher", "Keto"];

/**
 * Big, tappable selection cards. The onboarding is a series of "pick what
 * applies" screens, so every multi-select uses this: a responsive grid of
 * generously-sized cards with a clear selected state — far easier to hit than
 * small chips, especially one-handed on a phone.
 */
function CardChips({
  options,
  selected,
  onToggle,
  columns = 2,
}: {
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  columns?: 1 | 2;
}) {
  return (
    <div className={cn("grid gap-2.5", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              "relative text-left rounded-2xl border-2 px-4 py-3.5 text-sm font-medium transition-all",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40",
            )}
          >
            <span className="pr-5 leading-snug">{opt}</span>
            {active && <Check className="absolute top-3 right-3 w-4 h-4 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}

/** Section heading with an icon bubble, used above each card group. */
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

function UnitToggle({ options, value, onChange }: { options: { label: string; val: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex bg-secondary rounded-full p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(o.val)}
          className={cn(
            "px-2.5 py-0.5 text-xs rounded-full transition-colors",
            value === o.val ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground",
          )}
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

  // Timezone: auto-detect and pre-fill silently so reminders land locally later.
  const detectedTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  }, []);
  useEffect(() => {
    if (!profile.timezone && detectedTz) {
      setProfile((p) => (p.timezone ? p : { ...p, timezone: detectedTz }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedTz]);

  // Sign out and let AuthGate route to the welcome / login screen.
  const switchAccount = async () => {
    if (switchingAccount) return;
    setSwitchingAccount(true);
    try {
      await logoutMut.mutateAsync();
      await refreshAuth();
    } catch {
      toast({ variant: "destructive", title: "Couldn't sign out", description: "Please try again." });
    } finally {
      setSwitchingAccount(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  // Physique options depend on gender, which we capture at the top of the
  // physique step (step 2) so the right body-goal images are shown.
  const physiqueOptions = physiqueOptionsFor(profile.gender);
  const physiqueSelected = physiqueOptions.some((p) => p.id === profile.targetPhysique);

  // Generic chip toggler for an array field on the profile.
  const toggleField = (field: "equipment" | "sports" | "classes" | "enjoy" | "dislikes") => (opt: string) =>
    setProfile((p) => {
      const arr = (p[field] as string[]) ?? [];
      return { ...p, [field]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
    });

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

  const toggleInjury = (opt: string) =>
    setProfile({
      ...profile,
      injuries: profile.injuries.includes(opt) ? profile.injuries.filter((i) => i !== opt) : [...profile.injuries, opt],
    });
  const toggleDietary = (opt: string) =>
    setProfile({
      ...profile,
      dietary: profile.dietary.includes(opt) ? profile.dietary.filter((d) => d !== opt) : [...profile.dietary, opt],
    });

  const injuriesGuideline = composeGuideline(profile.injuries, profile.injuryNotes);
  const dietaryGuideline = composeGuideline(profile.dietary, profile.dietaryNotes);

  // Build the deterministic base program, then — if the user flagged any
  // injuries — let the coach adapt it to train safely around them. New users
  // land on the mandatory paywall (RouteGuard) immediately after this.
  const generatePlan = async () => {
    setGenerating(true);
    const program = buildProgram(profile, goal);
    setProgramMeta(program.meta);

    let finalPlan = program.days;
    let injuriesApplied = false;
    if (injuriesGuideline) {
      try {
        const res = await fetch(`${apiBase()}/api/coach/adapt-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content:
                  `I'm just starting this plan. Please adapt it so it's safe for my injuries/limitations: ${injuriesGuideline}. ` +
                  `Keep my ${goal ?? "training"} goal and the overall structure, but swap or modify any movement that could aggravate these and add a short note on each change. Apply the update now.`,
              },
            ],
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
          if (data.planUpdated && Array.isArray(data.updatedPlan) && data.updatedPlan.length) {
            finalPlan = data.updatedPlan;
            injuriesApplied = true;
          }
        }
      } catch {
        // Network/coach failure → fall back to the deterministic base plan.
      }
    }

    setWorkoutPlan(finalPlan);
    setOnboardingComplete(true);
    setShowInstallPrompt(true);
    setLocation("/dashboard");

    if (injuriesGuideline && !injuriesApplied) {
      toast({
        title: "Using your base plan for now",
        description: "We couldn't auto-adapt your plan for your injuries just now. Ask the AI Coach to adjust it — it has your guidelines on file.",
      });
    }
  };

  return (
    <MobileLayout showNav={false}>
      <div className="flex-1 flex flex-col pt-12 pb-6 px-6">
        {/* Preview-only step jumper (DEV builds only). */}
        {import.meta.env.DEV && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">Preview only · jump to step</p>
            <div className="flex flex-wrap gap-1.5">
              {["Goal", "Physique", "Setup", "Injuries", "Sports", "Profile"].map((label, i) => {
                const n = i + 1;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStep(n)}
                    className={cn(
                      "text-xs font-medium rounded-full px-3 py-1 border transition-colors",
                      step === n ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/50",
                    )}
                  >
                    {n}. {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setLocation("/paywall")}
                className="text-xs font-medium rounded-full px-3 py-1 border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                → Paywall
              </button>
            </div>
          </div>
        )}

        {/* Account escape hatch. */}
        {authUser && (
          <div className="flex items-center justify-between gap-2 mb-4 text-xs text-muted-foreground">
            <span className="truncate">
              Signed in as <span className="font-medium text-foreground">{authUser.email ?? authUser.username}</span>
            </span>
            <button
              type="button"
              onClick={() => void switchAccount()}
              disabled={switchingAccount}
              className="shrink-0 font-semibold text-primary hover:underline disabled:opacity-60"
            >
              {switchingAccount ? "Signing out…" : "Not you? Log in"}
            </button>
          </div>
        )}

        {/* Progress bar. */}
        <div className="w-full flex gap-1 mb-8">
          {Array.from({ length: TOTAL_STEPS }, (_, idx) => idx + 1).map((i) => (
            <div key={i} className="h-1 flex-1 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: i <= step ? "100%" : "0%" }} />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1 — PRIMARY GOAL */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight mb-2">What is your primary goal?</h1>
              <p className="text-muted-foreground mb-8">We'll tailor your training and nutrition to this objective.</p>
              <div className="space-y-3 flex-1">
                {[
                  { id: "Weight Loss", icon: Activity, desc: "Shred fat and lean out" },
                  { id: "Muscle Gain", icon: Dumbbell, desc: "Build size and hypertrophy" },
                  { id: "Strength", icon: Shield, desc: "Increase 1RM on main lifts" },
                  { id: "Athleticism", icon: Zap, desc: "Speed, power, and conditioning" },
                ].map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setGoal(g.id as Goal)}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4",
                      goal === g.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50",
                    )}
                  >
                    <div className={cn("p-3 rounded-full", goal === g.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                      <g.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{g.id}</h3>
                      <p className="text-sm text-muted-foreground">{g.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={nextStep} className="w-full mt-8 rounded-full h-12 text-lg font-medium" disabled={!goal}>
                Next <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          )}

          {/* STEP 2 — PHYSIQUE (gender captured here) */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Which physique are you chasing?</h1>
              <p className="text-muted-foreground mb-6">We'll shape your training emphasis around the look you want.</p>

              <div className="mb-6">
                <Label className="mb-2 block">You are</Label>
                <div className="flex gap-3">
                  {(["Male", "Female"] as const).map((gnd) => (
                    <button
                      key={gnd}
                      type="button"
                      onClick={() => setProfile({ ...profile, gender: gnd })}
                      className={cn(
                        "flex-1 rounded-2xl border-2 py-3 text-sm font-semibold transition-all",
                        profile.gender === gnd ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {gnd}
                    </button>
                  ))}
                </div>
              </div>

              {profile.gender ? (
                <div className="space-y-3 flex-1">
                  {physiqueOptions.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setProfile({ ...profile, targetPhysique: p.id as TargetPhysique })}
                      className={cn(
                        "rounded-2xl border-2 transition-all cursor-pointer flex items-stretch gap-4 overflow-hidden",
                        profile.targetPhysique === p.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50",
                      )}
                    >
                      <div className="w-24 shrink-0 bg-black/40 relative">
                        <img src={`${import.meta.env.BASE_URL}physiques/${p.img}`} alt={p.label} className="w-full h-full object-cover object-top" />
                        {profile.targetPhysique === p.id && (
                          <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 py-4 pr-4 flex flex-col justify-center">
                        <h3 className="font-semibold text-lg">{p.label}</h3>
                        <p className="text-sm text-muted-foreground">{p.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center text-sm text-muted-foreground">Pick one above to see your body-goal options.</div>
              )}

              <div className="flex gap-3 mt-8">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium" disabled={!physiqueSelected}>
                  Next <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 — TRAINING SETUP */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Your training setup</h1>
              <p className="text-muted-foreground mb-6">Tap what fits. We only program what you can actually do — lean into what you enjoy, skip what you hate.</p>
              <div className="flex-1 space-y-6">
                <div>
                  <SectionHead icon={Wrench} title="What can you train with?" description="No barbell drills if you've only got dumbbells." />
                  <CardChips options={EQUIPMENT_LABELS} selected={profile.equipment} onToggle={toggleField("equipment")} />
                </div>
                <div>
                  <SectionHead icon={ThumbsUp} title="What do you enjoy?" description="We'll bias your plan toward these so you stick with it." />
                  <CardChips options={ENJOY_OPTIONS} selected={profile.enjoy} onToggle={toggleField("enjoy")} />
                </div>
                <div>
                  <SectionHead icon={ThumbsDown} title="Anything you'd rather avoid?" description="Especially cardio you dislike." />
                  <CardChips options={AVOID_OPTIONS} selected={profile.dislikes} onToggle={toggleField("dislikes")} />
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-6 border-t border-border/50">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium">Next <ChevronRight className="ml-2 w-5 h-5" /></Button>
              </div>
            </motion.div>
          )}

          {/* STEP 4 — INJURIES & DIET */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Anything to train around?</h1>
              <p className="text-muted-foreground mb-6">We'll adjust around the limitations you report and keep nutrition within your restrictions.</p>
              <div className="flex-1 space-y-6">
                <div>
                  <SectionHead icon={ShieldAlert} title="Any injuries the coach should know about?" description="We'll avoid movements that aggravate these." />
                  <CardChips options={INJURY_OPTIONS} selected={profile.injuries} onToggle={toggleInjury} />
                  <Textarea
                    value={profile.injuryNotes}
                    onChange={(e) => setProfile((p) => ({ ...p, injuryNotes: e.target.value }))}
                    placeholder="Anything else? e.g. left knee pain on deep squats, recovering shoulder…"
                    className="bg-secondary/50 border-0 resize-none h-20 mt-3"
                  />
                </div>
                <div>
                  <SectionHead icon={Salad} title="Any dietary restrictions?" description="We'll keep meal advice within these." />
                  <CardChips options={DIETARY_OPTIONS} selected={profile.dietary} onToggle={toggleDietary} />
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-6 border-t border-border/50">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium">Next <ChevronRight className="ml-2 w-5 h-5" /></Button>
              </div>
            </motion.div>
          )}

          {/* STEP 5 — SPORTS & CLASSES */}
          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Sports & classes</h1>
              <p className="text-muted-foreground mb-6">We'll count these toward your week and offer them as fun cardio alternatives. Skip if none apply.</p>
              <div className="flex-1 space-y-6">
                <div>
                  <SectionHead icon={Trophy} title="Any sports you play?" />
                  <CardChips options={SPORTS_OPTIONS} selected={profile.sports} onToggle={toggleField("sports")} />
                </div>
                <div>
                  <SectionHead icon={Bike} title="Any classes you like?" />
                  <CardChips options={CLASS_OPTIONS} selected={profile.classes} onToggle={toggleField("classes")} />
                </div>
              </div>
              <div className="flex gap-3 mt-6 pt-6 border-t border-border/50">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium">Next <ChevronRight className="ml-2 w-5 h-5" /></Button>
              </div>
            </motion.div>
          )}

          {/* STEP 6 — PROFILE → build plan → paywall */}
          {step === 6 && (
            <motion.div key="step6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              {generating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="relative w-24 h-24 mb-8">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute inset-0 rounded-full border-4 border-primary/30 border-t-primary" />
                    <div className="absolute inset-0 flex items-center justify-center"><Zap className="w-8 h-8 text-primary" /></div>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Building your plan</h2>
                  <p className="text-muted-foreground animate-pulse">
                    {injuriesGuideline ? "Tailoring your plan around the guidelines you shared…" : `Building your custom ${goal} plan…`}
                  </p>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl font-bold tracking-tight mb-2">Last step — your details</h1>
                  <p className="text-muted-foreground mb-8">These calibrate your starting calories and loads.</p>
                  <div className="space-y-4 flex-1">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="John" className="bg-secondary/50 border-0" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Age</Label>
                        <Input type="number" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} placeholder="28" className="bg-secondary/50 border-0" />
                      </div>
                      <div className="space-y-2">
                        <Label>Experience</Label>
                        <Select value={profile.experience} onValueChange={(val: any) => setProfile({ ...profile, experience: val })}>
                          <SelectTrigger className="bg-secondary/50 border-0"><SelectValue placeholder="Experience" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Beginner">Beginner (0-1 yrs)</SelectItem>
                            <SelectItem value="Intermediate">Intermediate (1-3 yrs)</SelectItem>
                            <SelectItem value="Advanced">Advanced (3+ yrs)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between min-h-6">
                          <Label>Height</Label>
                          <UnitToggle options={[{ label: "cm", val: "cm" }, { label: "ft/in", val: "ft" }]} value={profile.heightUnit} onChange={(v) => switchHeightUnit(v as "cm" | "ft")} />
                        </div>
                        {profile.heightUnit === "cm" ? (
                          <Input type="number" inputMode="numeric" value={profile.height} onChange={(e) => setHeightCm(e.target.value)} placeholder="180" className="bg-secondary/50 border-0" />
                        ) : (
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input type="number" inputMode="numeric" value={parseImperial(profile.height).ft} onChange={(e) => setHeightFt(e.target.value)} placeholder="5" className="bg-secondary/50 border-0 pr-7" />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ft</span>
                            </div>
                            <div className="relative flex-1">
                              <Input type="number" inputMode="numeric" value={parseImperial(profile.height).inch} onChange={(e) => setHeightIn(e.target.value)} placeholder="11" className="bg-secondary/50 border-0 pr-7" />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">in</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between min-h-6">
                          <Label>Weight</Label>
                          <UnitToggle options={[{ label: "kg", val: "kg" }, { label: "lb", val: "lb" }]} value={profile.weightUnit} onChange={(v) => setProfile({ ...profile, weightUnit: v as "kg" | "lb" })} />
                        </div>
                        <div className="relative">
                          <Input type="number" inputMode="numeric" value={profile.weight} onChange={(e) => setProfile({ ...profile, weight: e.target.value })} placeholder={profile.weightUnit === "lb" ? "180" : "80"} className="bg-secondary/50 border-0 pr-9" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{profile.weightUnit}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Activity level</Label>
                      <Select value={profile.activityLevel} onValueChange={(val: any) => setProfile({ ...profile, activityLevel: val })}>
                        <SelectTrigger className="bg-secondary/50 border-0"><SelectValue placeholder="How active are you?" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sedentary">Sedentary (desk job, little exercise)</SelectItem>
                          <SelectItem value="Light">Light (1-2 workouts / week)</SelectItem>
                          <SelectItem value="Moderate">Moderate (3-4 workouts / week)</SelectItem>
                          <SelectItem value="Very Active">Very Active (5-6 workouts / week)</SelectItem>
                          <SelectItem value="Athlete">Athlete (daily training / physical job)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Used to calculate your daily calorie target.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-8">
                    <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                    <Button onClick={() => void generatePlan()} className="flex-1 rounded-full h-12 text-lg font-bold" disabled={!profile.name || !canCalculate}>
                      Build my plan <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MobileLayout>
  );
}
