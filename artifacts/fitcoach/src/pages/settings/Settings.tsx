import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useFitCoach,
  computeMacroTarget,
  type Goal,
  type UserProfile,
} from "@/context/FitCoachContext";
import { physiqueOptionsFor } from "@/data/physiques";
import { useToast } from "@/hooks/use-toast";
import { WelcomeTour } from "@/components/WelcomeTour";
import { ChevronLeft, Loader2, PlayCircle, ChevronRight } from "lucide-react";

const GOALS: Exclude<Goal, null>[] = ["Weight Loss", "Muscle Gain", "Strength", "Athleticism"];

function UnitToggle({
  options,
  value,
  onChange,
}: {
  options: { label: string; val: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex bg-secondary rounded-full p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(o.val)}
          className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${
            value === o.val ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const { profile, setProfile, goal, setGoal } = useFitCoach();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Local draft so edits aren't applied (and macros don't churn) until Save.
  const [draft, setDraft] = useState<UserProfile>({ ...profile });
  const [draftGoal, setDraftGoal] = useState<Goal>(goal);
  const [saving, setSaving] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const physiqueOptions = useMemo(() => physiqueOptionsFor(draft.gender), [draft.gender]);
  const previewMacros = useMemo(
    () => computeMacroTarget(draft, draftGoal),
    [draft, draftGoal],
  );

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    setSaving(true);
    setProfile(draft);
    if (draftGoal !== goal) setGoal(draftGoal);
    toast({
      title: "Profile updated",
      description: "Your details and nutrition targets were saved.",
    });
    setSaving(false);
    navigate("/account");
  };

  return (
    <MobileLayout>
      <div className="p-6 space-y-8">
        <header className="flex items-center gap-3 pt-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate("/account")}
            className="rounded-full -ml-2"
            aria-label="Back to account"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        </header>

        <section className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                inputMode="numeric"
                value={draft.age}
                onChange={(e) => set("age", e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Years"
              />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                value={draft.gender}
                onValueChange={(val) => set("gender", val as UserProfile["gender"])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="height">Height</Label>
              <div className="w-28">
                <UnitToggle
                  options={[
                    { label: "cm", val: "cm" },
                    { label: "ft/in", val: "ft" },
                  ]}
                  value={draft.heightUnit}
                  onChange={(v) => set("heightUnit", v as UserProfile["heightUnit"])}
                />
              </div>
            </div>
            <Input
              id="height"
              value={draft.height}
              onChange={(e) => set("height", e.target.value)}
              placeholder={draft.heightUnit === "cm" ? "e.g. 178" : `e.g. 5'10"`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="weight">Weight</Label>
              <div className="w-28">
                <UnitToggle
                  options={[
                    { label: "kg", val: "kg" },
                    { label: "lb", val: "lb" },
                  ]}
                  value={draft.weightUnit}
                  onChange={(v) => set("weightUnit", v as UserProfile["weightUnit"])}
                />
              </div>
            </div>
            <Input
              id="weight"
              inputMode="decimal"
              value={draft.weight}
              onChange={(e) => set("weight", e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={draft.weightUnit === "kg" ? "e.g. 80" : "e.g. 176"}
            />
          </div>

          <div className="space-y-2">
            <Label>Experience</Label>
            <Select
              value={draft.experience}
              onValueChange={(val) => set("experience", val as UserProfile["experience"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Beginner">Beginner (0-1 yrs)</SelectItem>
                <SelectItem value="Intermediate">Intermediate (1-3 yrs)</SelectItem>
                <SelectItem value="Advanced">Advanced (3+ yrs)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Activity Level</Label>
            <Select
              value={draft.activityLevel}
              onValueChange={(val) =>
                set("activityLevel", val as UserProfile["activityLevel"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select activity level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sedentary">Sedentary (desk job, little exercise)</SelectItem>
                <SelectItem value="Light">Light (1-2 workouts / week)</SelectItem>
                <SelectItem value="Moderate">Moderate (3-4 workouts / week)</SelectItem>
                <SelectItem value="Very Active">Very Active (5-6 workouts / week)</SelectItem>
                <SelectItem value="Athlete">Athlete (2x daily / physical job)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Primary Goal</Label>
            <Select
              value={draftGoal ?? ""}
              onValueChange={(val) => setDraftGoal(val as Goal)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your goal" />
              </SelectTrigger>
              <SelectContent>
                {GOALS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Target Physique</Label>
            <Select
              value={draft.targetPhysique}
              onValueChange={(val) =>
                set("targetPhysique", val as UserProfile["targetPhysique"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select target physique" />
              </SelectTrigger>
              <SelectContent>
                {physiqueOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-secondary/40 p-4">
          <h3 className="font-semibold text-sm mb-3 text-muted-foreground">
            Updated Daily Targets
          </h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Cals", value: previewMacros.calories },
              { label: "Protein", value: `${previewMacros.protein}g` },
              { label: "Carbs", value: `${previewMacros.carbs}g` },
              { label: "Fat", value: `${previewMacros.fat}g` },
            ].map((m) => (
              <div key={m.label}>
                <div className="text-lg font-bold">{m.value}</div>
                <div className="text-[11px] text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl h-12 font-bold">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Save Changes
        </Button>

        {/* Help */}
        <section className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">Help</h3>
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="w-full flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3.5 text-left hover:bg-secondary/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <PlayCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Replay the app tour</p>
              <p className="text-xs text-muted-foreground">A quick walkthrough of everything ALLUR can do.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>
        </section>

        <WelcomeTour open={tourOpen} onClose={() => setTourOpen(false)} />
      </div>
    </MobileLayout>
  );
}
