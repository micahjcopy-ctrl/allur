import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { completeQuest } from "@/lib/reps";
import { cn } from "@/lib/utils";
import { Home, Dumbbell, Mic, Camera, TrendingUp, Users, ChevronRight, Sparkles } from "lucide-react";

const TOUR_KEY = "allur_tour_v1";

// Has the user seen the welcome tour on this device?
export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true; // if storage is blocked, don't nag
  }
}

const STEPS = [
  { icon: Home, title: "Your command center", body: "Today's workout, macros, and progress — everything in one calm view. Start here each day." },
  { icon: Dumbbell, title: "Your adaptive plan", body: "A training plan built around your body, goal, and equipment. Tap any day to start the workout." },
  { icon: Mic, title: "A coach that acts", body: "Ask the AI coach anything — shorter session, sore knee, new split. It answers and updates your plan on the spot." },
  { icon: Camera, title: "Snap a meal", body: "Photograph your food and get calories + macros in seconds. Or add a food by name — no photo needed." },
  { icon: TrendingUp, title: "See it working", body: "Log weight and progress photos. Run a body-composition scan to track how your physique is actually changing." },
  { icon: Users, title: "Bring your Squad", body: "Add friends, earn Reps for staying on plan, and challenge each other to duels. Consistency is easier together." },
];

export function WelcomeTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);

  // Always start from the first step when (re)opened — e.g. replaying from
  // Settings after having finished the tour before.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);
  const last = step === STEPS.length - 1;
  const S = STEPS[step];
  const Icon = S.icon;

  const finish = () => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* ignore */
    }
    void completeQuest("tour_complete");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(); }}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="p-6 pt-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-5">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary mb-1.5">
            {step === 0 ? "Welcome to ALLUR" : `Step ${step + 1} of ${STEPS.length}`}
          </p>
          <h2 className="text-2xl font-bold mb-2">{S.title}</h2>
          <p className="text-muted-foreground leading-relaxed min-h-[72px]">{S.body}</p>

          {/* dots */}
          <div className="flex items-center justify-center gap-1.5 my-5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-5 bg-primary" : "w-1.5 bg-secondary",
                )}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => (last ? finish() : setStep((s) => s + 1))}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2"
          >
            {last ? (
              <>
                <Sparkles className="w-4 h-4" /> Start — earn your first Reps
              </>
            ) : (
              <>
                Next <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
          {!last && (
            <button type="button" onClick={finish} className="mt-3 text-xs text-muted-foreground hover:text-foreground">
              Skip tour
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
