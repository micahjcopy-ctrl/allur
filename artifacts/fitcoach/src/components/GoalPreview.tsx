import React, { useMemo } from "react";
import { useFitCoach, physiqueLabel } from "@/context/FitCoachContext";
import { physiqueImagePath } from "@/data/physiques";
import { cn } from "@/lib/utils";
import { ArrowRight, Camera, Sparkles } from "lucide-react";

// "Where you're headed" — pairs the athlete's most recent progress photo (their
// "now") with the body-goal image they chose at onboarding (their "goal"), so the
// physique selection ties directly into the progress tracking they already use.
// Renders nothing when no target physique is set (image can't be resolved).
export function GoalPreview({ className }: { className?: string }) {
  const { profile, progressPhotos } = useFitCoach();

  const goalImg = physiqueImagePath(profile.targetPhysique, profile.gender);
  const goalLabel = physiqueLabel(profile.targetPhysique);

  // Latest "now" photo: highest week, then most recent date within that week.
  const latestPhoto = useMemo(() => {
    if (progressPhotos.length === 0) return null;
    return [...progressPhotos].sort((a, b) => {
      if (b.week !== a.week) return b.week - a.week;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    })[0];
  }, [progressPhotos]);

  if (!goalImg) return null;

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-2xl p-5 space-y-4 overflow-hidden",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium uppercase tracking-wider">Where you're headed</span>
      </div>

      <div className="flex items-stretch gap-3">
        {/* NOW */}
        <div className="flex-1 space-y-2">
          <div className="aspect-[3/4] rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center">
            {latestPhoto ? (
              <img src={latestPhoto.url} alt="Your latest progress" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground px-3 text-center">
                <Camera className="w-7 h-7" />
                <span className="text-[11px] leading-tight">Add a progress photo to see your starting point</span>
              </div>
            )}
          </div>
          <p className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Now</p>
        </div>

        {/* ARROW */}
        <div className="flex items-center justify-center shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-primary" />
          </div>
        </div>

        {/* GOAL */}
        <div className="flex-1 space-y-2">
          <div className="aspect-[3/4] rounded-xl overflow-hidden border border-primary/40 bg-secondary relative">
            <img src={goalImg} alt={goalLabel} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <span className="text-[11px] font-bold text-white leading-tight">{goalLabel}</span>
            </div>
          </div>
          <p className="text-center text-[11px] font-medium uppercase tracking-wider text-primary">Goal</p>
        </div>
      </div>
    </div>
  );
}
