import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// HealthEstimateNote — the disclosure that has to sit next to any body
// composition number we show.
//
// Why this exists (do not remove it to tidy up a layout):
//
//   App Review Guideline 1.4.1 says apps "must clearly disclose data and
//   methodology to support accuracy claims relating to health measurements",
//   and that apps claiming to measure physiological values "using only the
//   sensors on the device are not permitted". A body-fat percentage derived
//   from a phone photo sits right beside that line.
//
//   The defensible position — and the honest one — is that the Allur Score and
//   the body-fat range are a VISUAL PROGRESS ESTIMATE, not a measurement. This
//   component states that in the user's face, at the point the number is shown,
//   rather than burying it in a legal page nobody opens.
//
// Two variants:
//   "inline" — one line, for compact stat tiles.
//   "full"   — expandable methodology + medical note, for the detail surfaces
//              where the number is the main event.
//
// Keep the wording conservative. "Estimate", "approximate", "not a measurement"
// are safe. Anything that sounds like a clinical reading is not.
// ---------------------------------------------------------------------------

const MEDICAL_NOTE =
  "ALLUR is a fitness and wellness app, not a medical device. These figures are not a diagnosis and are not a substitute for professional medical advice. Talk to a doctor or a qualified health professional before making decisions about your health.";

export function HealthEstimateNote({
  variant = "inline",
  className,
}: {
  variant?: "inline" | "full";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (variant === "inline") {
    return (
      <p className={cn("text-[10px] leading-snug text-muted-foreground", className)}>
        Visual estimate, not a medical measurement.
      </p>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border/60 bg-secondary/30", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 p-3 text-left transition active:scale-[0.99]"
      >
        <Info className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-xs font-medium">How this is estimated</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            These figures come from an AI model reading the progress photos you upload. It compares
            what it can see — visible muscle definition, proportions and how they change between
            photos — against reference physiques. <strong className="font-semibold text-foreground">
            It is an estimate from an image, not a measurement of your body.</strong>
          </p>
          <p>
            It is not a DEXA scan, a bioelectrical impedance reading or a caliper measurement, and it
            should not be compared against one as though the numbers mean the same thing. Accuracy
            varies with lighting, camera angle, distance, pose and clothing, which is why we show a
            range and a confidence level rather than a single exact figure.
          </p>
          <p>
            <strong className="font-semibold text-foreground">Use the trend, not the number.</strong>{" "}
            Photograph yourself in similar lighting, at a similar time of day and in similar
            clothing each time. The direction of travel across weeks is meaningful. Any single
            reading is not.
          </p>
          <p>{MEDICAL_NOTE}</p>
        </div>
      )}
    </div>
  );
}

/** Always-visible one-liner for surfaces where a collapsed panel would be missed. */
export function HealthEstimateInline({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] leading-snug text-muted-foreground", className)}>
      Estimated from your photos — a visual estimate, not a medical measurement. Not a substitute for
      professional medical advice.
    </p>
  );
}
