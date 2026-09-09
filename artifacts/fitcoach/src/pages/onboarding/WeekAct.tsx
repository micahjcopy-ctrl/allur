// ---------------------------------------------------------------------------
// The "your real week" act — five screens, one question each.
//
// This replaced a single step that asked five things at once: how many days,
// which days, session length, busiest-day floor, and equipment. It was the
// clearest reason onboarding read as a form rather than a conversation, and
// it's also the step whose answers the plan builder actually depends on.
//
// Exported as screen definitions rather than a self-contained sub-flow, so the
// five land in the main flow list alongside every other screen. That keeps one
// source of truth for ordering and lets the progress bar count real screens —
// as a nested sub-flow it silently under-reported five screens as one.
// ---------------------------------------------------------------------------

import { ChoiceCard as Choice, StepShell, type ScreenDef } from "./kit";

const DAYS_ABBR = ["M", "T", "W", "T", "F", "S", "S"];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface WeekAnswers {
  reliableDays: string;
  trainDays: number[];
  sessionLen: string;
  busyDay: string;
  equipment: string[];
}

export interface WeekScreenArgs {
  answers: WeekAnswers;
  onChange: (patch: Partial<WeekAnswers>) => void;
  equipmentOptions: string[];
  onBack: () => void;
  /** Advance, but only if `ok`; otherwise show `message`. */
  guardedNext: (ok: boolean, message: string) => () => void;
  next: () => void;
  error: string | null;
}

export function weekScreens({
  answers,
  onChange,
  equipmentOptions,
  onBack,
  guardedNext,
  next,
  error,
}: WeekScreenArgs): ScreenDef[] {
  const toggleDay = (d: number) =>
    onChange({
      trainDays: answers.trainDays.includes(d)
        ? answers.trainDays.filter((x) => x !== d)
        : [...answers.trainDays, d].sort((a, b) => a - b),
    });

  const toggleEquipment = (e: string) =>
    onChange({
      equipment: answers.equipment.includes(e)
        ? answers.equipment.filter((x) => x !== e)
        : [...answers.equipment, e],
    });

  const wanted = Number(answers.reliableDays) || 0;

  return [
    {
      id: "week-days",
      label: "Days",
      render: () => (
        <StepShell
          eyebrow="Your real week"
          question="How many days can you actually train?"
          sub="The part every other plan skipped — and why they fell apart."
          onBack={onBack}
          onNext={next}
          error={error}
        >
          <div className="grid grid-cols-3 gap-2.5">
            {["2", "3", "4", "5", "6"].map((d) => (
              <Choice
                key={d}
                active={answers.reliableDays === d}
                onClick={() => onChange({ reliableDays: d })}
                hideCheck
                className="justify-center text-center text-lg font-bold"
              >
                {d}
              </Choice>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Be honest rather than optimistic. The plan is built to exactly this number, so
            over-promising here is what makes a normal week feel like failure.
          </p>
        </StepShell>
      ),
    },
    {
      id: "week-which",
      label: "Which",
      render: () => (
        <StepShell
          eyebrow="Your real week"
          question="Which days usually work?"
          sub={wanted ? `Pick about ${wanted}. We'll schedule your sessions on them.` : undefined}
          onBack={onBack}
          onNext={guardedNext(answers.trainDays.length > 0, "Pick at least one day you can train.")}
          error={error}
        >
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS_ABBR.map((d, idx) => (
              <Choice
                key={idx}
                active={answers.trainDays.includes(idx)}
                onClick={() => toggleDay(idx)}
                hideCheck
                className="aspect-square min-h-0 px-0 text-center text-sm font-bold"
              >
                {d}
              </Choice>
            ))}
          </div>
          {answers.trainDays.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {answers.trainDays.map((d) => DAYS_FULL[d]).join(" · ")}
            </p>
          )}
        </StepShell>
      ),
    },
    {
      id: "week-length",
      label: "Length",
      render: () => (
        <StepShell
          eyebrow="Your real week"
          question="How long is a normal session?"
          onBack={onBack}
          onNext={next}
          error={error}
        >
          <div className="grid grid-cols-2 gap-2.5">
            {["30 min", "45 min", "60 min", "75+"].map((s) => (
              <Choice
                key={s}
                active={answers.sessionLen === s}
                onClick={() => onChange({ sessionLen: s })}
                hideCheck
                className="text-center"
              >
                {s}
              </Choice>
            ))}
          </div>
        </StepShell>
      ),
    },
    {
      id: "week-floor",
      label: "Floor",
      render: () => (
        <StepShell
          eyebrow="Your real week"
          question="On your busiest day, what could you still give?"
          sub="This is the version that runs when the week goes sideways."
          onBack={onBack}
          onNext={next}
          error={error}
        >
          <div className="flex flex-col gap-2.5">
            {["15 min", "20 min", "Skip it"].map((s) => (
              <Choice key={s} active={answers.busyDay === s} onClick={() => onChange({ busyDay: s })}>
                {s}
              </Choice>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Having a floor is what stops a bad week ending the plan. "Skip it" is a real answer —
            the plan just reshuffles instead.
          </p>
        </StepShell>
      ),
    },
    {
      id: "week-where",
      label: "Where",
      render: () => (
        <StepShell
          eyebrow="Your real week"
          question="Where do you train?"
          sub="We'll only prescribe movements your setup allows."
          onBack={onBack}
          onNext={guardedNext(answers.equipment.length > 0, "Pick at least one — bodyweight counts.")}
          error={error}
        >
          <div className="grid grid-cols-2 gap-2.5">
            {equipmentOptions.map((e) => (
              <Choice key={e} active={answers.equipment.includes(e)} onClick={() => toggleEquipment(e)}>
                <span className="leading-snug">{e}</span>
              </Choice>
            ))}
          </div>
        </StepShell>
      ),
    },
  ];
}
