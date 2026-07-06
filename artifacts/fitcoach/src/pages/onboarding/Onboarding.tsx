import React, { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useFitCoach, composeGuideline, composeEquipment, composeDislikes, composePreferences, physiqueLabel, Goal, TargetPhysique, hasCalculableProfile, type Workout, type UserProfile } from "@/context/FitCoachContext";
import { buildProgram } from "@/data/trainingKnowledge";
import { EQUIPMENT_OPTIONS, SPORTS_OPTIONS, CLASS_OPTIONS, ENJOY_OPTIONS, AVOID_OPTIONS } from "@/data/exerciseOptimizer";
import { physiqueOptionsFor } from "@/data/physiques";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import { useAccount } from "@/context/AuthContext";
import { useLogoutAccount } from "@workspace/api-client-react";
import { usePush } from "@/hooks/usePush";
import { ReminderPrefToggles } from "@/components/NotificationsBell";
import { BellRing, Check as CheckIcon } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Mic, Square, Loader2, ShieldAlert, Salad, ChevronRight, Activity, Zap, Shield, ArrowRight, Check, Dumbbell, X, UploadCloud, Flame, Wrench, Trophy, Bike, ThumbsUp, ThumbsDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { compressForStorage } from "@/lib/image";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

const INJURY_OPTIONS = ["Lower back", "Knee", "Shoulder", "Neck", "Hip", "Wrist / elbow", "Ankle / foot"];
const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Pescatarian", "Gluten-free", "Lactose-free", "Nut allergy", "Halal", "Kosher", "Keto"];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// One reusable guideline block: checkable option chips + a free-form textarea +
// a real voice note (recorded, transcribed via /coach/transcribe, appended to
// the notes). Used for both the injuries and dietary-restrictions sections.
function GuidelineSection({
  icon: Icon,
  title,
  description,
  options,
  selected,
  onToggle,
  notes,
  onNotesChange,
  onAppendNote,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  options: string[];
  selected: string[];
  onToggle: (option: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onAppendNote: (text: string) => void;
  placeholder: string;
}) {
  const recorder = useVoiceRecorder();
  const { toast } = useToast();
  const [transcribing, setTranscribing] = useState(false);
  const isRecording = recorder.state === "recording";

  const toggleRecording = async () => {
    if (transcribing) return;
    if (!isRecording) {
      try {
        await recorder.startRecording();
      } catch {
        toast({ variant: "destructive", title: "Microphone unavailable", description: "Check your browser's mic permissions and try again." });
      }
      return;
    }
    const blob = await recorder.stopRecording();
    if (!blob.size) return;
    setTranscribing(true);
    try {
      const audio = await blobToBase64(blob);
      const res = await fetch(`${apiBase()}/api/coach/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ audio, audioFormat: "webm" }),
      });
      if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
      const data = (await res.json()) as { text: string };
      const text = data.text?.trim();
      if (text) onAppendNote(text);
    } catch {
      toast({ variant: "destructive", title: "Couldn't transcribe", description: "We couldn't turn that into text. Please try again or type it instead." });
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3.5">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-primary/10 text-primary shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors",
                active
                  ? "bg-primary text-primary-foreground border-primary font-medium"
                  : "bg-secondary/50 border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {active && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
              {opt}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={placeholder}
          className="bg-secondary/50 border-0 resize-none h-24 pr-12"
        />
        <button
          type="button"
          onClick={toggleRecording}
          disabled={transcribing}
          aria-label={isRecording ? "Stop recording" : "Record a voice note"}
          className={cn(
            "absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-60",
            isRecording ? "bg-red-500 text-white animate-pulse" : "bg-primary/15 text-primary hover:bg-primary/25"
          )}
        >
          {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {transcribing
          ? "Transcribing your voice note…"
          : isRecording
          ? "Recording… tap to stop and transcribe."
          : "Pick options, type, or tap the mic to add a voice note."}
      </p>
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
            value === o.val ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"
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
  const { setOnboardingComplete, setShowInstallPrompt, profile, setProfile, goal, setGoal, setWorkoutPlan, setProgramMeta, setBaselinePhotos, macroTarget } = useFitCoach();

  const canCalculate = hasCalculableProfile(profile);
  const [generating, setGenerating] = useState(false);
  const { authUser, refreshAuth } = useAccount();
  const logoutMut = useLogoutAccount();
  const [switchingAccount, setSwitchingAccount] = useState(false);

  // Timezone: auto-detect from the device and pre-fill silently; the reminders
  // card lets them correct it. Powers locally-timed reminders server-side.
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
  const timezoneOptions = useMemo(() => {
    let zones: string[] = [];
    try {
      zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    } catch {
      /* older browsers */
    }
    if (zones.length === 0) {
      zones = [
        "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix",
        "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
        "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Australia/Sydney",
        "Asia/Tokyo", "Asia/Dubai", "Asia/Kolkata",
      ];
    }
    // Make sure the detected/current value is always present in the list.
    const current = profile.timezone || detectedTz;
    if (current && !zones.includes(current)) zones = [current, ...zones];
    return zones;
  }, [profile.timezone, detectedTz]);

  // Push opt-in on the final step. Declining is fine — the bell on the home
  // screen offers the same switch anytime.
  const push = usePush();
  const enableNotifications = async () => {
    try {
      const result = await push.enable();
      if (result === "on") {
        toast({ title: "Notifications on", description: "Only the reminders you've picked — nothing spammy." });
      } else if (result === "blocked") {
        toast({ title: "No problem", description: "You can turn them on later from the bell on your home screen." });
      }
    } catch {
      toast({ title: "Couldn't enable them right now", description: "You can turn notifications on anytime from the bell on your home screen." });
    }
  };

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
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [dragView, setDragView] = useState<string | null>(null);
  const photoInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const handlePhotoFile = (file: File | undefined, view: string) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      // Compress before storing: full-res phone photos exceeded the account
      // sync size budget and were silently dropped on the next app launch.
      const raw = reader.result as string;
      const stored = await compressForStorage(raw).catch(() => raw);
      setPhotos((p) => ({ ...p, [view]: stored }));
    };
    reader.readAsDataURL(file);
  };
  const handlePhotoDrop = (e: React.DragEvent, view: string) => {
    e.preventDefault();
    setDragView(null);
    handlePhotoFile(e.dataTransfer.files?.[0], view);
  };
  const removePhoto = (e: React.MouseEvent, view: string) => {
    e.preventDefault();
    e.stopPropagation();
    setPhotos((p) => {
      const next = { ...p };
      delete next[view];
      return next;
    });
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 7));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  // Target-physique options shown on step 3, chosen by the gender captured on
  // step 1. Each `id` is a stable TargetPhysique value; `img` lives in
  // public/physiques. Women see body-goal options tailored to them. Options live
  // in @/data/physiques so the goal preview reuses the same source of truth.
  const physiqueOptions = physiqueOptionsFor(profile.gender);
  // Guard against a stale cross-gender selection (e.g. picked a men's option,
  // then went back and switched gender): only count it as selected if the id is
  // actually one of the currently shown options.
  const physiqueSelected = physiqueOptions.some((p) => p.id === profile.targetPhysique);

  // Generic chip toggler for an array field on the profile. Uses a functional
  // update so rapid taps never overwrite each other (stale-closure safe).
  const toggleField = (field: "equipment" | "sports" | "classes" | "enjoy" | "dislikes") => (opt: string) =>
    setProfile((p) => {
      const arr = (p[field] as string[]) ?? [];
      return { ...p, [field]: arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt] };
    });
  const appendNote = (field: "equipmentNotes" | "sportsNotes" | "classesNotes" | "enjoyNotes" | "dislikeNotes") => (text: string) =>
    setProfile((p) => {
      const cur = (p[field] as string) ?? "";
      return { ...p, [field]: cur.trim() ? `${cur.trim()} ${text}` : text };
    });
  const setNote = (field: "equipmentNotes" | "sportsNotes" | "classesNotes" | "enjoyNotes" | "dislikeNotes") => (v: string) =>
    setProfile((p) => ({ ...p, [field]: v }));

  const EQUIPMENT_LABELS = EQUIPMENT_OPTIONS.map((o) => o.label);

  const parseImperial = (h: string) => {
    const m = h.match(/(\d+)?\s*'\s*(\d+)?/);
    return { ft: m?.[1] ?? "", inch: m?.[2] ?? "" };
  };
  const composeImperial = (ft: string, inch: string) =>
    ft || inch ? `${ft || 0}' ${inch || 0}"` : "";

  const setHeightCm = (cm: string) => setProfile({ ...profile, height: cm, heightUnit: "cm" });
  const setHeightFt = (ft: string) =>
    setProfile({ ...profile, height: composeImperial(ft, parseImperial(profile.height).inch), heightUnit: "ft" });
  const setHeightIn = (inch: string) =>
    setProfile({ ...profile, height: composeImperial(parseImperial(profile.height).ft, inch), heightUnit: "ft" });
  const switchHeightUnit = (unit: "cm" | "ft") => {
    if (unit !== profile.heightUnit) setProfile({ ...profile, height: "", heightUnit: unit });
  };

  const toggleInjury = (opt: string) =>
    setProfile({
      ...profile,
      injuries: profile.injuries.includes(opt)
        ? profile.injuries.filter((i) => i !== opt)
        : [...profile.injuries, opt],
    });
  const toggleDietary = (opt: string) =>
    setProfile({
      ...profile,
      dietary: profile.dietary.includes(opt)
        ? profile.dietary.filter((d) => d !== opt)
        : [...profile.dietary, opt],
    });

  const injuriesGuideline = composeGuideline(profile.injuries, profile.injuryNotes);
  const dietaryGuideline = composeGuideline(profile.dietary, profile.dietaryNotes);

  // Build the deterministic base program, then — if the user flagged any
  // injuries — let the coach adapt it to train safely around them before we
  // drop them on the dashboard. The loading screen genuinely waits for this.
  const generatePlan = async () => {
    setGenerating(true);
    const program = buildProgram(profile, goal);
    setProgramMeta(program.meta);
    const baselinePhotos = ["Front", "Side", "Back"]
      .filter((view) => photos[view])
      .map((view) => ({ url: photos[view], view }));
    if (baselinePhotos.length) setBaselinePhotos(baselinePhotos);

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
          const data = (await res.json()) as {
            planUpdated?: boolean;
            updatedPlan?: Workout[] | null;
          };
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
    // Profile is created — nudge them to install ALLUR to their home screen.
    setShowInstallPrompt(true);
    setLocation("/dashboard");

    if (injuriesGuideline && !injuriesApplied) {
      toast({
        title: "Using your base plan for now",
        description:
          "We couldn't auto-adapt your plan for your injuries just now. Ask the AI Coach to adjust it — it has your guidelines on file.",
      });
    }
  };

  return (
    <MobileLayout showNav={false}>
      <div className="flex-1 flex flex-col pt-12 pb-6 px-6">
        {/* Preview-only step jumper: lets you click straight to any onboarding
            step while testing. import.meta.env.DEV is false in the published
            build, so real users never see this. */}
        {import.meta.env.DEV && (
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Preview only · jump to step
            </p>
            <div className="flex flex-wrap gap-1.5">
              {["Profile", "Goal", "Physique", "Photos", "Guidelines", "Training", "All set"].map((label, i) => {
                const n = i + 1;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setStep(n)}
                    className={cn(
                      "text-xs font-medium rounded-full px-3 py-1 border transition-colors",
                      step === n
                        ? "bg-primary text-black border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/50",
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
                → Payment
              </button>
            </div>
          </div>
        )}

        {/* Account escape hatch: onboarding is where you land when the signed-in
            account has never onboarded — which is confusing if you're actually
            in the WRONG account (old test login, family member's phone). Always
            show who you are and a one-tap way out to the login screen. */}
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

        <div className="w-full flex gap-1 mb-8">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-1 flex-1 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: i <= step ? "100%" : "0%" }}
              />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-3xl font-bold tracking-tight mb-2">Let's build your profile</h1>
              <p className="text-muted-foreground mb-8">Tell us about yourself to calibrate your AI coach.</p>

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
                    <Label>Gender</Label>
                    <Select value={profile.gender} onValueChange={(val) => setProfile({ ...profile, gender: val as "Male" | "Female" })}>
                      <SelectTrigger className="bg-secondary/50 border-0">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between min-h-6">
                      <Label>Height</Label>
                      <UnitToggle
                        options={[{ label: "cm", val: "cm" }, { label: "ft/in", val: "ft" }]}
                        value={profile.heightUnit}
                        onChange={(v) => switchHeightUnit(v as "cm" | "ft")}
                      />
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
                      <UnitToggle
                        options={[{ label: "kg", val: "kg" }, { label: "lb", val: "lb" }]}
                        value={profile.weightUnit}
                        onChange={(v) => setProfile({ ...profile, weightUnit: v as "kg" | "lb" })}
                      />
                    </div>
                    <div className="relative">
                      <Input type="number" inputMode="numeric" value={profile.weight} onChange={(e) => setProfile({ ...profile, weight: e.target.value })} placeholder={profile.weightUnit === "lb" ? "180" : "80"} className="bg-secondary/50 border-0 pr-9" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{profile.weightUnit}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Experience</Label>
                  <Select value={profile.experience} onValueChange={(val: any) => setProfile({ ...profile, experience: val })}>
                    <SelectTrigger className="bg-secondary/50 border-0">
                      <SelectValue placeholder="Training experience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Beginner">Beginner (0-1 yrs)</SelectItem>
                      <SelectItem value="Intermediate">Intermediate (1-3 yrs)</SelectItem>
                      <SelectItem value="Advanced">Advanced (3+ yrs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Activity level</Label>
                  <Select value={profile.activityLevel} onValueChange={(val: any) => setProfile({ ...profile, activityLevel: val })}>
                    <SelectTrigger className="bg-secondary/50 border-0">
                      <SelectValue placeholder="How active are you?" />
                    </SelectTrigger>
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

              <Button onClick={nextStep} className="w-full mt-8 rounded-full h-12 text-lg font-medium" disabled={!profile.name || !canCalculate}>
                Next <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-3xl font-bold tracking-tight mb-2">What is your primary goal?</h1>
              <p className="text-muted-foreground mb-8">We'll tailor your training and nutrition to this objective.</p>

              <div className="space-y-3 flex-1">
                {[
                  { id: "Weight Loss", icon: Activity, desc: "Shred fat and lean out" },
                  { id: "Muscle Gain", icon: Dumbbell, desc: "Build size and hypertrophy" },
                  { id: "Strength", icon: Shield, desc: "Increase 1RM on main lifts" },
                  { id: "Athleticism", icon: Zap, desc: "Speed, power, and conditioning" }
                ].map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setGoal(g.id as Goal)}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-4",
                      goal === g.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <div className={cn("p-3 rounded-full", goal === g.id ? "bg-primary text-black" : "bg-secondary text-muted-foreground")}>
                      <g.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{g.id}</h3>
                      <p className="text-sm text-muted-foreground">{g.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-8">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium" disabled={!goal}>
                  Next <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-3xl font-bold tracking-tight mb-2">Which physique are you chasing?</h1>
              <p className="text-muted-foreground mb-8">We'll shape your training emphasis around the look you want.</p>

              <div className="space-y-3 flex-1">
                {physiqueOptions.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setProfile({ ...profile, targetPhysique: p.id as TargetPhysique })}
                    className={cn(
                      "rounded-2xl border-2 transition-all cursor-pointer flex items-stretch gap-4 overflow-hidden",
                      profile.targetPhysique === p.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
                    )}
                  >
                    <div className="w-24 shrink-0 bg-black/40 relative">
                      <img src={`${import.meta.env.BASE_URL}physiques/${p.img}`} alt={p.label} className="w-full h-full object-cover object-top" />
                      {profile.targetPhysique === p.id && (
                        <div className="absolute top-2 left-2 bg-primary text-black rounded-full p-1">
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

              <div className="flex gap-3 mt-8">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium" disabled={!physiqueSelected}>
                  Next <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-3xl font-bold tracking-tight mb-2">Baseline Photos</h1>
              <p className="text-muted-foreground mb-8">
                <span className="hidden sm:inline">Drag &amp; drop or tap a slot to upload. </span>
                <span className="sm:hidden">Tap a slot to use your camera or photo library. </span>
                Track your transformation over time.
              </p>

              <div className="grid grid-cols-3 gap-3">
                {["Front", "Side", "Back"].map((view) => (
                  <div
                    key={view}
                    role="button"
                    tabIndex={0}
                    onClick={() => photoInputs.current[view]?.click()}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); photoInputs.current[view]?.click(); } }}
                    onDragOver={(e) => { e.preventDefault(); setDragView(view); }}
                    onDragLeave={() => setDragView((v) => (v === view ? null : v))}
                    onDrop={(e) => handlePhotoDrop(e, view)}
                    className={cn(
                      "aspect-[3/4] rounded-2xl border border-dashed flex flex-col items-center justify-center text-center transition-colors cursor-pointer relative overflow-hidden outline-none",
                      dragView === view
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"
                    )}
                  >
                    <input
                      ref={(el) => { photoInputs.current[view] = el; }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { handlePhotoFile(e.target.files?.[0], view); e.target.value = ""; }}
                    />
                    {photos[view] ? (
                      <>
                        <img src={photos[view]} alt={`${view} baseline`} className="absolute inset-0 w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => removePhoto(e, view)}
                          onKeyDown={(e) => e.stopPropagation()}
                          aria-label={`Remove ${view} photo`}
                          className="absolute top-1.5 right-1.5 z-10 bg-black/60 rounded-full p-1 text-white hover:bg-black/80 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] font-medium py-1">{view}</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-6 h-6 mb-2" />
                        <span className="text-xs font-medium">{view}</span>
                        <span className="text-[10px] mt-1 opacity-70 px-1 hidden sm:block">Drag or click</span>
                        <span className="text-[10px] mt-1 opacity-70 px-1 sm:hidden">Camera / Library</span>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20 mt-6 mb-6 flex items-start gap-3">
                <Activity className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  {Object.keys(photos).length > 0
                    ? `${Object.keys(photos).length} of 3 photos added. Estimated body composition analysis will appear here.`
                    : "Estimated body composition analysis will appear here after uploading photos."}
                </p>
              </div>

              <div className="flex gap-3 mt-auto">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium">
                  {Object.keys(photos).length > 0 ? "Continue" : "Skip for now"} <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-3xl font-bold tracking-tight mb-2">Guidelines for your coach</h1>
              <p className="text-muted-foreground mb-6">Anything we should train around? Pick options, type, or record a voice note — your coach will follow these.</p>

              <div className="flex-1 space-y-4">
                <GuidelineSection
                  icon={ShieldAlert}
                  title="Any injuries the Coach should know about?"
                  description="We'll program around these and avoid movements that aggravate them."
                  options={INJURY_OPTIONS}
                  selected={profile.injuries}
                  onToggle={toggleInjury}
                  notes={profile.injuryNotes}
                  onNotesChange={(v) => setProfile((p) => ({ ...p, injuryNotes: v }))}
                  onAppendNote={(text) =>
                    setProfile((p) => ({
                      ...p,
                      injuryNotes: p.injuryNotes.trim() ? `${p.injuryNotes.trim()} ${text}` : text,
                    }))
                  }
                  placeholder="e.g. left knee pain on deep squats, recovering from a shoulder strain…"
                />
                <GuidelineSection
                  icon={Salad}
                  title="Any dietary restrictions?"
                  description="We'll keep nutrition and meal advice within these."
                  options={DIETARY_OPTIONS}
                  selected={profile.dietary}
                  onToggle={toggleDietary}
                  notes={profile.dietaryNotes}
                  onNotesChange={(v) => setProfile((p) => ({ ...p, dietaryNotes: v }))}
                  onAppendNote={(text) =>
                    setProfile((p) => ({
                      ...p,
                      dietaryNotes: p.dietaryNotes.trim() ? `${p.dietaryNotes.trim()} ${text}` : text,
                    }))
                  }
                  placeholder="e.g. vegetarian, lactose intolerant, no shellfish…"
                />
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-border/50">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium">
                  Next <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-3xl font-bold tracking-tight mb-2">Your training setup</h1>
              <p className="text-muted-foreground mb-6">This shapes your plan — we'll only program things you can actually do, skip what you hate, and lean into what you enjoy.</p>

              <div className="flex-1 space-y-4">
                <GuidelineSection
                  icon={Wrench}
                  title="What equipment can you train with?"
                  description="We'll only program exercises you can actually do — no barbell drills if you've only got dumbbells."
                  options={EQUIPMENT_LABELS}
                  selected={profile.equipment}
                  onToggle={toggleField("equipment")}
                  notes={profile.equipmentNotes}
                  onNotesChange={setNote("equipmentNotes")}
                  onAppendNote={appendNote("equipmentNotes")}
                  placeholder="e.g. home garage with a rack, adjustable dumbbells and a bike…"
                />
                <GuidelineSection
                  icon={Trophy}
                  title="Any sports you play?"
                  description="We'll count these toward your week and suggest them as fun cardio alternatives."
                  options={SPORTS_OPTIONS}
                  selected={profile.sports}
                  onToggle={toggleField("sports")}
                  notes={profile.sportsNotes}
                  onNotesChange={setNote("sportsNotes")}
                  onAppendNote={appendNote("sportsNotes")}
                  placeholder="e.g. pickup basketball Sundays, tennis twice a week…"
                />
                <GuidelineSection
                  icon={Bike}
                  title="Any classes you like?"
                  description="Boxing, spin, hot yoga, CrossFit — we'll offer these as alternatives so cardio stays fun."
                  options={CLASS_OPTIONS}
                  selected={profile.classes}
                  onToggle={toggleField("classes")}
                  notes={profile.classesNotes}
                  onNotesChange={setNote("classesNotes")}
                  onAppendNote={appendNote("classesNotes")}
                  placeholder="e.g. spin Mondays, hot yoga on the weekend…"
                />
                <GuidelineSection
                  icon={ThumbsUp}
                  title="What do you enjoy?"
                  description="We'll bias your plan toward these so you actually stick with it."
                  options={ENJOY_OPTIONS}
                  selected={profile.enjoy}
                  onToggle={toggleField("enjoy")}
                  notes={profile.enjoyNotes}
                  onNotesChange={setNote("enjoyNotes")}
                  onAppendNote={appendNote("enjoyNotes")}
                  placeholder="e.g. love heavy compound lifts and kettlebell work…"
                />
                <GuidelineSection
                  icon={ThumbsDown}
                  title="Anything you'd rather avoid?"
                  description="We'll keep these out of your plan — especially cardio you dislike."
                  options={AVOID_OPTIONS}
                  selected={profile.dislikes}
                  onToggle={toggleField("dislikes")}
                  notes={profile.dislikeNotes}
                  onNotesChange={setNote("dislikeNotes")}
                  onAppendNote={appendNote("dislikeNotes")}
                  placeholder="e.g. hate long treadmill runs and burpees…"
                />
              </div>

              <div className="flex gap-3 mt-6 pt-6 border-t border-border/50">
                <Button variant="secondary" onClick={prevStep} className="rounded-full h-12 px-6">Back</Button>
                <Button onClick={nextStep} className="flex-1 rounded-full h-12 text-lg font-medium">
                  Next <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 7 && (
            <motion.div
              key="step7"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              {generating ? (
                <div className="flex flex-col items-center">
                  <div className="relative w-24 h-24 mb-8">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-4 border-primary/30 border-t-primary"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Generating Protocol</h2>
                  <p className="text-muted-foreground animate-pulse">
                    {injuriesGuideline
                      ? "Tailoring your plan around the guidelines you shared..."
                      : `Building your custom ${goal} plan${profile.targetPhysique ? ` for a ${physiqueLabel(profile.targetPhysique).toLowerCase()} look` : ""}...`}
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
                    <Check className="w-10 h-10 text-primary" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight mb-2">You're all set</h1>
                  <p className="text-muted-foreground mb-8">Here's the daily nutrition target we calculated for your {goal} goal.</p>

                  <div className="w-full bg-card border border-border rounded-3xl p-6 mb-8 text-left">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <Flame className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium uppercase tracking-wider">Daily calorie target</span>
                    </div>
                    <p className="text-4xl font-bold mb-1">
                      {macroTarget.calories.toLocaleString()} <span className="text-lg font-medium text-muted-foreground">kcal</span>
                    </p>
                    <p className="text-xs text-muted-foreground mb-5">
                      {goal === "Weight Loss"
                        ? "A calorie deficit to lose fat while protecting muscle."
                        : goal === "Muscle Gain"
                        ? "A calorie surplus to fuel new muscle growth."
                        : goal === "Strength"
                        ? "A slight surplus to power your heavy lifts."
                        : "Maintenance calories to fuel performance."}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-secondary/50 rounded-2xl p-3 text-center">
                        <p className="text-lg font-bold text-info">{macroTarget.protein}g</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Protein</p>
                      </div>
                      <div className="bg-secondary/50 rounded-2xl p-3 text-center">
                        <p className="text-lg font-bold text-primary">{macroTarget.carbs}g</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Carbs</p>
                      </div>
                      <div className="bg-secondary/50 rounded-2xl p-3 text-center">
                        <p className="text-lg font-bold text-warning">{macroTarget.fat}g</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Fat</p>
                      </div>
                    </div>
                  </div>

                  {/* Notifications opt-in — optional; the home-screen bell offers
                      the same controls later, so declining costs nothing. */}
                  <div className="w-full bg-card border border-border rounded-3xl p-5 mb-8 text-left space-y-4">
                    <div>
                      <p className="font-bold flex items-center gap-2">
                        <BellRing className="w-4 h-4 text-primary" /> Want reminders?
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        People who get nudges stick to their plan far more often. Pick what's useful — change it anytime from the bell on your home screen.
                      </p>
                    </div>
                    <ReminderPrefToggles compact />

                    {/* Timezone — detected automatically; shown so they can
                        correct it. Reminders use this to land at the right
                        local time. */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your time zone</p>
                      <Select
                        value={profile.timezone || detectedTz}
                        onValueChange={(val) => setProfile((p) => ({ ...p, timezone: val }))}
                      >
                        <SelectTrigger className="bg-secondary/50 border-0">
                          <SelectValue placeholder="Select your time zone" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {timezoneOptions.map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        So reminders land at the right time of <em>your</em> day.
                      </p>
                    </div>

                    {push.state === "on" ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CheckIcon className="w-3.5 h-3.5 text-success" /> Notifications are on.
                      </p>
                    ) : push.state === "unsupported" ? (
                      <p className="text-xs text-muted-foreground">
                        Your picks are saved — notifications switch on once you install ALLUR to your home screen (bell icon, top of the app).
                      </p>
                    ) : push.state === "off" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void enableNotifications()}
                        disabled={push.busy}
                        className="w-full rounded-xl h-11 font-semibold"
                      >
                        <BellRing className="w-4 h-4 mr-2" /> Turn on notifications
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Your picks are saved — you can switch notifications on anytime from the bell on your home screen.
                      </p>
                    )}
                  </div>

                  <Button onClick={generatePlan} className="w-full rounded-full h-14 text-lg font-bold shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                    Generate My Plan <ArrowRight className="ml-2 w-6 h-6" />
                  </Button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MobileLayout>
  );
}
