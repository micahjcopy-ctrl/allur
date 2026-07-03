import React, { useMemo, useState } from "react";
import { useFitCoach, physiqueLabel } from "@/context/FitCoachContext";
import { physiqueImagePath } from "@/data/physiques";
import { cn } from "@/lib/utils";
import { compressForStorage, downscaleImage } from "@/lib/image";
import { useToast } from "@/hooks/use-toast";
import { OUT_OF_CREDITS_STATUS, outOfCreditsToast, needsSubscriptionToast } from "@/lib/credits";
import { ArrowRight, Camera, Sparkles, Loader2, RefreshCw } from "lucide-react";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

// "Where you're headed" — pairs the athlete's most recent progress photo (their
// "now") with an AI-enhanced goal version of THAT SAME PHOTO (their "goal"), so
// the comparison is personal instead of a generic physique reference. Until a
// goal photo has been generated, the generic body-goal image from onboarding is
// shown as a placeholder with a one-tap "make it me" generator.
export function GoalPreview({ className }: { className?: string }) {
  const {
    profile,
    goal,
    progressPhotos,
    enhancedGoalPhoto,
    setEnhancedGoalPhoto,
    hasCredit,
    refreshCredits,
    isSubscribed,
  } = useFitCoach();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

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

  // A generated goal photo is current only while it's based on the user's
  // latest photo; when a newer photo lands we offer a refresh instead.
  const enhancedIsCurrent =
    !!enhancedGoalPhoto && !!latestPhoto && enhancedGoalPhoto.sourcePhotoId === latestPhoto.id;

  const generateGoalPhoto = async () => {
    if (generating || !latestPhoto?.url) return;
    if (!isSubscribed) {
      toast(needsSubscriptionToast());
      return;
    }
    if (!hasCredit("photo")) {
      toast(outOfCreditsToast("photo enhancements"));
      return;
    }
    setGenerating(true);
    try {
      const photo = await downscaleImage(latestPhoto.url, 1024, 0.85).catch(() => latestPhoto.url);
      const res = await fetch(`${apiBase()}/api/coach/enhance-goal-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          photo,
          profile: {
            gender: profile.gender,
            targetPhysique: physiqueLabel(profile.targetPhysique),
            goal,
          },
        }),
      });
      if (res.status === OUT_OF_CREDITS_STATUS) {
        refreshCredits();
        toast(outOfCreditsToast("photo enhancements"));
        return;
      }
      if (!res.ok) {
        let message = "Couldn't generate your goal photo. Please try again.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          /* keep default message */
        }
        throw new Error(message);
      }
      const data = (await res.json()) as { image: string };
      // Compress so the stored copy always fits the account-sync budget.
      const stored = await compressForStorage(data.image).catch(() => data.image);
      setEnhancedGoalPhoto({
        url: stored,
        sourcePhotoId: latestPhoto.id,
        date: new Date().toISOString(),
      });
      refreshCredits();
      toast({
        title: "Goal photo ready",
        description: "That's you, a few months of consistency from now.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (!goalImg && !enhancedGoalPhoto) return null;

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

        {/* GOAL — the user's own AI-enhanced photo once generated */}
        <div className="flex-1 space-y-2">
          <div className="aspect-[3/4] rounded-xl overflow-hidden border border-primary/40 bg-secondary relative">
            {generating ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground px-3 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-[11px] leading-tight">Building your future physique…</span>
              </div>
            ) : enhancedGoalPhoto ? (
              <img src={enhancedGoalPhoto.url} alt="AI-enhanced goal version of you" className="w-full h-full object-cover" />
            ) : goalImg ? (
              <img src={goalImg} alt={goalLabel} className="w-full h-full object-cover opacity-60" />
            ) : null}
            {!generating && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <span className="text-[11px] font-bold text-white leading-tight">
                  {enhancedGoalPhoto ? "You — AI projection" : goalLabel}
                </span>
              </div>
            )}
          </div>
          <p className="text-center text-[11px] font-medium uppercase tracking-wider text-primary">Goal</p>
        </div>
      </div>

      {/* Generate / refresh the personalized goal photo */}
      {latestPhoto && !generating && (!enhancedGoalPhoto || !enhancedIsCurrent) && (
        <button
          type="button"
          onClick={generateGoalPhoto}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider py-2.5 hover:bg-primary/15 transition-colors"
        >
          {enhancedGoalPhoto ? (
            <>
              <RefreshCw className="w-3.5 h-3.5" /> Update goal photo from your latest pic
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" /> See YOUR body at its goal — AI enhance my photo
            </>
          )}
        </button>
      )}
    </div>
  );
}
