import { PHYSIQUE_LABELS, type TargetPhysique, type UserProfile } from "@/context/FitCoachContext";

// Single source of truth for the onboarding target-physique options. The
// onboarding step (step 3) and the "Where you're headed" goal preview both read
// from here so descriptions and images never drift apart. Labels are derived
// from PHYSIQUE_LABELS (the same map the AI payload uses) so the display label
// and the coach label can never diverge.
export interface PhysiqueOption {
  id: Exclude<TargetPhysique, "">;
  label: string;
  img: string; // filename under public/physiques
  desc: string;
}

const opt = (
  id: Exclude<TargetPhysique, "">,
  img: string,
  desc: string,
): PhysiqueOption => ({ id, label: PHYSIQUE_LABELS[id], img, desc });

export const MEN_PHYSIQUES: PhysiqueOption[] = [
  opt("LeanVTaper", "men-lean-v-taper.png", "Lean, defined, broad shoulders, smaller waist."),
  opt("Athletic", "men-athletic.png", "Strong, capable, balanced, fit-looking. Great if you don't want extreme bodybuilding."),
  opt("Aesthetic", "men-aesthetic.png", "Muscle definition, symmetry, chest/shoulders/arms, visible abs."),
  opt("Mass", "men-mass-builder.png", "Bigger arms, chest, back, legs — more size-focused."),
];

export const WOMEN_PHYSIQUES: PhysiqueOption[] = [
  opt("LeanToned", "women-lean-toned.png", "Definition, a smaller waist, lower body fat, and visible muscle without looking bulky."),
  opt("StrongCurves", "women-strong-curves.png", "Glutes, legs, shape, and strength while still looking feminine and athletic."),
  opt("Athletic", "women-athletic.png", "Performance, strength, conditioning, and a fit 'sports body' look."),
  opt("Sculpted", "women-sculpted.png", "The most aesthetic transformation: defined shoulders, legs, glutes, abs, and symmetry."),
];

// Women see body-goal options tailored to them; everyone else (Male / unset)
// sees the men's set.
export const physiqueOptionsFor = (gender: UserProfile["gender"]): PhysiqueOption[] =>
  gender === "Female" ? WOMEN_PHYSIQUES : MEN_PHYSIQUES;

// Resolve the public image path for a chosen physique, honoring gender (the
// "Athletic" id maps to a different image for men vs women). Returns null when
// nothing is selected or the id isn't valid for the gender's option set.
export const physiqueImagePath = (
  id: TargetPhysique,
  gender: UserProfile["gender"],
): string | null => {
  if (!id) return null;
  const opt = physiqueOptionsFor(gender).find((o) => o.id === id);
  return opt ? `${import.meta.env.BASE_URL}physiques/${opt.img}` : null;
};
