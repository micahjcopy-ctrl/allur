// Body-type silhouettes for the onboarding self-identification screen.
// Tasteful, non-judgmental front-view outlines (illustrated, never photos) so
// the "where are you starting from?" step reads as a starting line, not a flaw.
// Paths render in a 120x150 viewBox. Gender-branched.

export type BodyTypeId = "lean" | "soft" | "over" | "plateau" | "fit";

export const BODY_TYPE_PATHS: Record<"m" | "f", Record<BodyTypeId, string>> = {
  m: {
  lean: "M 60 3 a 11 11 0 1 0 0.1 0 Z M 53 27 L 36 41 Q 41 74 39 104 L 39 142 L 55 142 L 55 120 L 65 120 L 65 142 L 81 142 L 81 104 Q 79 74 84 41 L 67 27 Z",
  soft: "M 60 3 a 11 11 0 1 0 0.1 0 Z M 53 27 L 34 41 Q 30 74 34 104 L 34 142 L 55 142 L 55 120 L 65 120 L 65 142 L 86 142 L 86 104 Q 90 74 86 41 L 67 27 Z",
  over: "M 60 3 a 11 11 0 1 0 0.1 0 Z M 53 27 L 29 41 Q 22 74 27 104 L 27 142 L 55 142 L 55 120 L 65 120 L 65 142 L 93 142 L 93 104 Q 98 74 91 41 L 67 27 Z",
  plateau: "M 60 3 a 11 11 0 1 0 0.1 0 Z M 53 27 L 25 41 Q 32 74 34 104 L 34 142 L 55 142 L 55 120 L 65 120 L 65 142 L 86 142 L 86 104 Q 88 74 95 41 L 67 27 Z",
  fit: "M 60 3 a 11 11 0 1 0 0.1 0 Z M 53 27 L 19 41 Q 37 74 35 104 L 35 142 L 55 142 L 55 120 L 65 120 L 65 142 L 85 142 L 85 104 Q 83 74 101 41 L 67 27 Z",
},
  f: {
  lean: "M 60 3 a 11 11 0 1 0 0.1 0 Z M 53 27 L 37 41 Q 41 74 35 104 L 35 142 L 55 142 L 55 120 L 65 120 L 65 142 L 85 142 L 85 104 Q 79 74 83 41 L 67 27 Z",
  soft: "M 60 3 a 11 11 0 1 0 0.1 0 Z M 53 27 L 35 41 Q 31 74 31 104 L 31 142 L 55 142 L 55 120 L 65 120 L 65 142 L 89 142 L 89 104 Q 89 74 85 41 L 67 27 Z",
  over: "M 60 3 a 11 11 0 1 0 0.1 0 Z M 53 27 L 31 41 Q 24 74 25 104 L 25 142 L 55 142 L 55 120 L 65 120 L 65 142 L 95 142 L 95 104 Q 96 74 89 41 L 67 27 Z",
  plateau: "M 60 3 a 11 11 0 1 0 0.1 0 Z M 53 27 L 29 41 Q 35 74 31 104 L 31 142 L 55 142 L 55 120 L 65 120 L 65 142 L 89 142 L 89 104 Q 85 74 91 41 L 67 27 Z",
  fit: "M 60 3 a 11 11 0 1 0 0.1 0 Z M 53 27 L 27 41 Q 38 74 30 104 L 30 142 L 55 142 L 55 120 L 65 120 L 65 142 L 90 142 L 90 104 Q 82 74 93 41 L 67 27 Z",
},
};

export const BODY_TYPE_OPTIONS: { id: BodyTypeId; label: string }[] = [
  { id: "lean", label: "Lean \u2014 hard to build" },
  { id: "soft", label: "Soft in the middle" },
  { id: "over", label: "Carrying extra weight" },
  { id: "plateau", label: "Fit but plateaued" },
  { id: "fit", label: "In shape \u2014 want the edge" },
];

// Photographic body-type cards for the self-ID step, shot in the same dark
// cinematic style as the goal-physique photos. Files live under
// public/bodytypes/{men|women}-start-{id}.png. If a photo is missing the card
// falls back to the illustrated silhouette above, so the step never looks broken.
export const bodyTypeImagePath = (gender: string, id: BodyTypeId): string =>
  `${import.meta.env.BASE_URL}bodytypes/${gender === "Female" ? "women" : "men"}-start-${id}.png`;
