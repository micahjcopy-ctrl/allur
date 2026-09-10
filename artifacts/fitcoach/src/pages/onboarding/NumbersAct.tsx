// ---------------------------------------------------------------------------
// The "your numbers" act — six screens, one question each.
//
// This replaced the single worst screen in onboarding: seven inputs at once
// (name, age, experience, height, weight, activity level) with three separate
// keyboard summons and two unit toggles. It was the last screen before the
// payoff, which is exactly where a form is most likely to lose someone.
//
// Age, height and weight are now Dials rather than number fields. Typing a
// number into a box feels like paperwork; dragging feels like using an app —
// and every Dial still lets you tap the number and type, so nobody who prefers
// the keyboard is trapped.
//
// The weight screen carries its reassurance inline, underneath the input,
// because that is where the hesitation actually happens. A privacy promise on
// a policy page is not reassurance.
// ---------------------------------------------------------------------------

import type { ActivityLevel } from "@/context/FitCoachContext";
import { ChoiceCard, Dial, StepShell, type ScreenDef } from "./kit";
import { Input } from "@/components/ui/input";

export interface NumbersAnswers {
  name: string;
  age: string;
  /** Either a cm number ("180") or imperial ("5' 11\"") — matches heightUnit. */
  height: string;
  heightUnit: "cm" | "ft";
  weight: string;
  weightUnit: "kg" | "lb";
  experience: Experience;
  activityLevel: ActivityLevel;
}

export type Experience = "Beginner" | "Intermediate" | "Advanced" | "";

const EXPERIENCE_OPTIONS: { val: Exclude<Experience, "">; desc: string }[] = [
  { val: "Beginner", desc: "0–1 years — new, or starting again" },
  { val: "Intermediate", desc: "1–3 years — I know the lifts" },
  { val: "Advanced", desc: "3+ years — I train seriously" },
];

const ACTIVITY_OPTIONS: { val: Exclude<ActivityLevel, "">; desc: string }[] = [
  { val: "Sedentary", desc: "Desk job, little movement" },
  { val: "Light", desc: "1–2 sessions a week" },
  { val: "Moderate", desc: "3–4 sessions a week" },
  { val: "Very Active", desc: "5–6 sessions a week" },
  { val: "Athlete", desc: "Daily training" },
];

// ---- height ---------------------------------------------------------------
// Stored as a string so nothing downstream has to change. These convert it to
// and from the single number a Dial drags.

const IMPERIAL = /(\d+)?\s*'\s*(\d+)?/;

/** Total inches from `5' 11"`. */
export function heightToInches(h: string): number {
  const m = h.match(IMPERIAL);
  return (Number(m?.[1] ?? 0) || 0) * 12 + (Number(m?.[2] ?? 0) || 0);
}

/** `5' 11"` from total inches. */
export function inchesToHeight(total: number): string {
  return `${Math.floor(total / 12)}' ${Math.round(total % 12)}"`;
}

/**
 * Switching cm ↔ ft converts the value instead of clearing it.
 *
 * The old toggle wiped the field on every switch, so tapping the wrong unit
 * first cost you the number you had already entered. Nothing about a unit
 * change means the user has stopped being that tall.
 */
export function convertHeight(h: string, from: "cm" | "ft", to: "cm" | "ft"): string {
  if (from === to || !h) return h;
  return to === "cm"
    ? String(Math.round(heightToInches(h) * 2.54))
    : inchesToHeight(Math.round((Number(h) || 0) / 2.54));
}

/** Switching kg ↔ lb converts too, for the same reason. */
export function convertWeight(w: string, from: "kg" | "lb", to: "kg" | "lb"): string {
  if (from === to || !w) return w;
  const n = Number(w) || 0;
  return String(Math.round(to === "kg" ? n / 2.20462 : n * 2.20462));
}

// ---------------------------------------------------------------------------

export interface NumbersScreenArgs {
  answers: NumbersAnswers;
  onChange: (patch: Partial<NumbersAnswers>) => void;
  onBack: () => void;
  /** Advance, but only if `ok`; otherwise show `message`. */
  guardedNext: (ok: boolean, message: string) => () => void;
  next: () => void;
  error: string | null;
  /** Unit toggle, rendered top-right of the Dial. */
  unitToggle: (options: { label: string; val: string }[], value: string, onChange: (v: string) => void) => React.ReactNode;
  /** Final CTA on the last screen — kicks off plan generation. */
  onBuild: () => void;
  generating: boolean;
}

export function numberScreens({
  answers,
  onChange,
  onBack,
  guardedNext,
  next,
  error,
  unitToggle,
  onBuild,
  generating,
}: NumbersScreenArgs): ScreenDef[] {
  const metric = answers.heightUnit === "cm";
  const heightValue = metric ? Number(answers.height) || 175 : heightToInches(answers.height) || 69;
  const weightMetric = answers.weightUnit === "kg";
  const weightValue = Number(answers.weight) || (weightMetric ? 80 : 176);

  return [
    {
      id: "num-name",
      label: "Name",
      render: () => (
        <StepShell
          eyebrow="Your numbers"
          question="What should the coach call you?"
          sub="First name is plenty."
          onBack={onBack}
          onNext={guardedNext(answers.name.trim().length > 0, "Add your name so the coach can talk to you.")}
          error={error}
        >
          <Input
            value={answers.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="John"
            autoComplete="given-name"
            className="h-14 border-0 bg-secondary/50 text-center text-2xl font-semibold"
          />
        </StepShell>
      ),
    },
    {
      id: "num-age",
      label: "Age",
      render: () => (
        <StepShell eyebrow="Your numbers" question="How old are you?" onBack={onBack} onNext={next} error={error}>
          <Dial
            label="Age"
            value={Number(answers.age) || 30}
            onChange={(v) => onChange({ age: String(v) })}
            min={16}
            max={90}
            unit="yrs"
          />
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Used for your calorie target and to set sensible starting loads — not to put you in a bracket.
          </p>
        </StepShell>
      ),
    },
    {
      id: "num-height",
      label: "Height",
      render: () => (
        <StepShell eyebrow="Your numbers" question="How tall are you?" onBack={onBack} onNext={next} error={error}>
          <Dial
            label="Height"
            value={heightValue}
            onChange={(v) => onChange({ height: metric ? String(v) : inchesToHeight(v) })}
            min={metric ? 120 : 48}
            max={metric ? 220 : 84}
            unit={metric ? "cm" : undefined}
            format={metric ? undefined : inchesToHeight}
            aside={unitToggle(
              [
                { label: "cm", val: "cm" },
                { label: "ft/in", val: "ft" },
              ],
              answers.heightUnit,
              (v) =>
                onChange({
                  height: convertHeight(answers.height, answers.heightUnit, v as "cm" | "ft"),
                  heightUnit: v as "cm" | "ft",
                }),
            )}
          />
        </StepShell>
      ),
    },
    {
      id: "num-weight",
      label: "Weight",
      render: () => (
        <StepShell
          eyebrow="Your numbers"
          question="And what do you weigh right now?"
          onBack={onBack}
          onNext={next}
          error={error}
        >
          <Dial
            label="Weight"
            value={weightValue}
            onChange={(v) => onChange({ weight: String(v) })}
            min={weightMetric ? 35 : 80}
            max={weightMetric ? 200 : 440}
            unit={answers.weightUnit}
            aside={unitToggle(
              [
                { label: "kg", val: "kg" },
                { label: "lb", val: "lb" },
              ],
              answers.weightUnit,
              (v) =>
                onChange({
                  weight: convertWeight(answers.weight, answers.weightUnit, v as "kg" | "lb"),
                  weightUnit: v as "kg" | "lb",
                }),
            )}
          />
          {/* Reassurance sits exactly where the hesitation is. This is the
              question people stall on, and answering "why do you need this"
              on the screen itself is what gets it answered honestly. */}
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Why we ask</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              It sets your calorie and protein targets, and it's the baseline your progress is measured
              against. It's stored on your account, it is never shown to anyone else, and you can change
              it any time. There is no number here that's wrong.
            </p>
          </div>
        </StepShell>
      ),
    },
    {
      id: "num-experience",
      label: "Level",
      render: () => (
        <StepShell
          eyebrow="Your numbers"
          question="How much lifting have you done?"
          sub="This sets where your plan starts, not how hard it gets."
          onBack={onBack}
          onNext={guardedNext(!!answers.experience, "Pick the one that's closest.")}
          error={error}
        >
          <div className="flex flex-col gap-2.5">
            {EXPERIENCE_OPTIONS.map((o) => (
              <ChoiceCard
                key={o.val}
                active={answers.experience === o.val}
                onClick={() => onChange({ experience: o.val })}
              >
                <span className="block pr-5 font-semibold">{o.val}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{o.desc}</span>
              </ChoiceCard>
            ))}
          </div>
        </StepShell>
      ),
    },
    {
      id: "num-activity",
      label: "Activity",
      render: () => (
        <StepShell
          eyebrow="Your numbers"
          question="Outside training, how active is your life?"
          sub="Used to calculate your daily calorie target."
          onBack={onBack}
          // Last screen of the act: this builds the plan rather than advancing.
          // `busy` is a real in-flight state, so it still disables — unlike the
          // old validation gates, which disabled the button and explained nothing.
          onNext={() => {
            if (!answers.activityLevel) return guardedNext(false, "Pick your usual week.")();
            onBuild();
          }}
          error={error}
          cta={generating ? "Building…" : "Build my plan"}
          busy={generating}
        >
          <div className="flex flex-col gap-2.5">
            {ACTIVITY_OPTIONS.map((o) => (
              <ChoiceCard
                key={o.val}
                active={answers.activityLevel === o.val}
                onClick={() => {
                  onChange({ activityLevel: o.val });
                }}
              >
                <span className="block pr-5 font-semibold">{o.val}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{o.desc}</span>
              </ChoiceCard>
            ))}
          </div>
        </StepShell>
      ),
    },
  ];
}
