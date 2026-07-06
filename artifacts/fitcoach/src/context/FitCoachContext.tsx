import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from "react";
import { buildProgram, type ProgramMeta } from "@/data/trainingKnowledge";
import { useAccount } from "@/context/AuthContext";
import {
  useGetMyFitnessState,
  useSaveMyFitnessState,
  getGetMyFitnessStateQueryKey,
  useGetMyCredits,
  getGetMyCreditsQueryKey,
  useGetMySubscription,
  getGetMySubscriptionQueryKey,
  useGetAdminStatus,
  getGetAdminStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

export type { ProgramMeta } from "@/data/trainingKnowledge";

export type Goal = "Weight Loss" | "Muscle Gain" | "Strength" | "Athleticism" | null;

export type ActivityLevel = "Sedentary" | "Light" | "Moderate" | "Very Active" | "Athlete" | "";

export type TargetPhysique =
  | "LeanVTaper"
  | "Athletic"
  | "Aesthetic"
  | "Mass"
  | "LeanToned"
  | "StrongCurves"
  | "Sculpted"
  | "";

// Human-readable labels for each target physique. The stored value is a stable
// id; this is what we show in the UI and send to the coach so prompts read
// naturally (e.g. "Lean V-Taper", not "LeanVTaper").
export const PHYSIQUE_LABELS: Record<Exclude<TargetPhysique, "">, string> = {
  LeanVTaper: "Lean V-Taper",
  Athletic: "Athletic Build",
  Aesthetic: "Aesthetic Physique",
  Mass: "Mass Builder",
  LeanToned: "Lean & Toned",
  StrongCurves: "Strong Curves",
  Sculpted: "Sculpted Physique",
};

export const physiqueLabel = (p: TargetPhysique): string =>
  p ? PHYSIQUE_LABELS[p] : "";

// Older saves used a smaller, gender-neutral physique set. Map any retired ids
// onto the closest current one so a hydrated profile still resolves to a valid
// selection and emphasis day.
const LEGACY_PHYSIQUE_MAP: Record<string, Exclude<TargetPhysique, "">> = {
  Bodybuilder: "Aesthetic",
};

export const normalizePhysique = (value: unknown): TargetPhysique => {
  if (typeof value !== "string") return "";
  if (value in PHYSIQUE_LABELS) return value as TargetPhysique;
  return LEGACY_PHYSIQUE_MAP[value] ?? "";
};

export interface UserProfile {
  name: string;
  age: string;
  height: string;
  heightUnit: "cm" | "ft";
  weight: string;
  weightUnit: "kg" | "lb";
  gender: "Male" | "Female" | "";
  experience: "Beginner" | "Intermediate" | "Advanced" | "";
  activityLevel: ActivityLevel;
  targetPhysique: TargetPhysique;
  injuries: string[];
  injuryNotes: string;
  dietary: string[];
  dietaryNotes: string;
  // Training setup gathered during onboarding — feeds plan generation so the
  // program never uses unavailable equipment or disliked cardio, and so the
  // per-exercise detail can suggest alternatives the user actually enjoys.
  equipment: string[];
  equipmentNotes: string;
  sports: string[];
  sportsNotes: string;
  classes: string[];
  classesNotes: string;
  enjoy: string[];
  enjoyNotes: string;
  dislikes: string[];
  dislikeNotes: string;
  // IANA timezone (e.g. "America/New_York") — captured during onboarding so
  // reminders can eventually be timed to the user's local day.
  timezone: string;
}

/**
 * Combine the selected option chips and the free-form / transcribed notes for a
 * guideline section into one readable string for the coach (e.g. injuries or
 * dietary restrictions). Returns "" when nothing was provided.
 */
export const composeGuideline = (chips: string[], notes: string): string => {
  const parts = [...chips.map((c) => c.trim()).filter(Boolean)];
  const trimmed = notes.trim();
  if (trimmed) parts.push(trimmed);
  return parts.join("; ");
};

/**
 * The user's equipment / training access as one readable string for the coach.
 */
export const composeEquipment = (profile: UserProfile): string =>
  composeGuideline(profile.equipment ?? [], profile.equipmentNotes ?? "");

/**
 * The workouts the user dislikes (and any free-form note) as one string. The
 * coach treats these as hard "do not program" constraints — especially cardio.
 */
export const composeDislikes = (profile: UserProfile): string =>
  composeGuideline(profile.dislikes ?? [], profile.dislikeNotes ?? "");

/**
 * What the user enjoys — preferred training styles, the pickup sports they
 * play, and the workout classes they like — folded into one string the coach
 * can bias toward for adherence.
 */
export const composePreferences = (profile: UserProfile): string => {
  const parts = [
    ...(profile.enjoy ?? []),
    ...(profile.sports ?? []).map((s) => `plays ${s}`),
    ...(profile.classes ?? []).map((c) => `enjoys ${c} classes`),
  ];
  const notes = [profile.enjoyNotes, profile.sportsNotes, profile.classesNotes]
    .map((n) => (n ?? "").trim())
    .filter(Boolean)
    .join("; ");
  if (notes) parts.push(notes);
  return parts.join("; ");
};

export interface Credits {
  coaching: number;
  photo: number;
  bodyScan: number;
}

export type UserPlan = "free" | "base" | "premium";

export interface SubscriptionInfo {
  plan: UserPlan;
  status: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasEverSubscribed: boolean;
}

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  note?: string;
}

export interface Workout {
  dayName: string;
  title: string;
  exercises: WorkoutExercise[];
}

// A single exercise as logged during a live workout session. Carries the
// prescription (targetSets/targetReps) plus what the user actually did.
export interface SessionExercise {
  name: string;
  targetSets: number;
  targetReps: string;
  completed: boolean;
  weight: number | null; // working weight the user logged
  unit: "kg" | "lb";
  reps: number | null; // reps achieved at that weight (optional)
}

// One workout the user started from the Plan. `finishedAt` is null while in
// progress and set when the user taps Finish. Persisted in the JSONB blob.
export interface WorkoutSession {
  id: string;
  dayName: string;
  title: string;
  startedAt: string; // ISO
  finishedAt: string | null; // ISO once finished
  exercises: SessionExercise[];
}

export interface PR {
  id: string;
  exercise: string;
  weight: string;
  reps: string;
  date: string;
}

export interface WeightLog {
  id: string;
  weight: number;
  date: string;
}

export interface ProgressPhoto {
  id: string;
  week: number;
  url: string;
  view?: string; // optional angle label (e.g. Front/Side/Back) for baseline photos
  bodyFat: number | null;
  date: string;
}

export type PhotoAngle = "Front" | "Side" | "Back";
export const PHOTO_ANGLES: PhotoAngle[] = ["Front", "Side", "Back"];

// AI-enhanced "goal" version of the user's own progress photo, shown in the
// goal preview instead of a generic physique reference so the comparison is
// personal. `sourcePhotoId` ties it to the progress photo it was built from.
export interface EnhancedGoalPhoto {
  url: string;
  sourcePhotoId: string;
  date: string;
}

// What the user wants to be reminded about. Stored with their account; the
// bell sheet and onboarding both edit the same object.
export interface NotificationPrefs {
  workouts: boolean; // workout-day nudges
  meals: boolean; // meal / macro logging reminders
  progress: boolean; // weekly progress-photo + scan reminders
  squad: boolean; // squad activity + weekly recap
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  workouts: true,
  meals: true,
  progress: true,
  squad: true,
};

// Local calendar day key (YYYY-MM-DD) used for rest-day completion tracking.
export const dayKeyOf = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  planSummary?: string; // set on assistant turns that applied a plan change
  date: string;
}

export interface MacroBreakdown {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealEntry {
  id: string;
  name: string;
  photoUrl: string;
  items: string[];
  macros: MacroBreakdown;
  date: string;
}

export type MuscleStatus = "strong" | "developing" | "weak";

export interface BodyPartRating {
  part: string;
  rating: number; // 0-100 development score
  status: MuscleStatus;
  note: string;
}

export type AnalysisConfidence = "low" | "medium" | "high";

export interface PhysiqueAnalysis {
  id: string;
  week?: number; // the progress week this analysis belongs to
  photoUrl: string; // the primary (latest) analyzed photo, kept for back-compat
  photoUrls: string[]; // every photo/angle that fed this analysis
  date: string;
  overallScore: number; // 0-100 average development
  muscleMassKg: number | null; // estimated lean mass
  bodyFatEstimate: number; // % — midpoint of the range, kept for back-compat
  bodyFatLow: number; // % — low end of the estimated range
  bodyFatHigh: number; // % — high end of the estimated range
  confidence: AnalysisConfidence;
  markers: string[]; // visual markers that informed the estimate
  limitations: string; // what limits the accuracy of an image-based estimate
  suggestedDirection: string; // recommended training/nutrition direction
  parts: BodyPartRating[];
  strengths: BodyPartRating[];
  focusAreas: BodyPartRating[];
  summary: string;
}

const MACRO_TARGETS: Record<NonNullable<Goal>, MacroBreakdown> = {
  "Weight Loss": { calories: 2000, protein: 180, carbs: 150, fat: 60 },
  "Muscle Gain": { calories: 2800, protein: 200, carbs: 300, fat: 80 },
  Strength: { calories: 2900, protein: 190, carbs: 320, fat: 85 },
  Athleticism: { calories: 2600, protein: 170, carbs: 280, fat: 75 },
};

// Fallback when we don't yet have enough profile data to calculate accurately.
export const getMacroTarget = (goal: Goal): MacroBreakdown =>
  goal ? MACRO_TARGETS[goal] : { calories: 2400, protein: 160, carbs: 250, fat: 70 };

const ACTIVITY_FACTORS: Record<Exclude<ActivityLevel, "">, number> = {
  Sedentary: 1.2,
  Light: 1.375,
  Moderate: 1.55,
  "Very Active": 1.725,
  Athlete: 1.9,
};

// Calorie adjustment applied to maintenance (TDEE) based on the user's goal.
const GOAL_CALORIE_FACTOR: Record<NonNullable<Goal>, number> = {
  "Weight Loss": 0.8, // ~20% deficit
  "Muscle Gain": 1.12, // ~12% surplus
  Strength: 1.08, // slight surplus to fuel heavy lifting
  Athleticism: 1.0, // performance maintenance
};

// Protein target in grams per kg of bodyweight, by goal.
const PROTEIN_PER_KG: Record<NonNullable<Goal>, number> = {
  "Weight Loss": 2.2, // higher to preserve lean mass in a deficit
  "Muscle Gain": 2.0,
  Strength: 2.0,
  Athleticism: 1.8,
};

const parseWeightKg = (profile: UserProfile): number | null => {
  const raw = parseFloat(profile.weight);
  if (isNaN(raw) || raw <= 0) return null;
  return profile.weightUnit === "lb" ? raw * 0.453592 : raw;
};

const parseHeightCm = (profile: UserProfile): number | null => {
  if (profile.heightUnit === "cm") {
    const cm = parseFloat(profile.height);
    return isNaN(cm) || cm <= 0 ? null : cm;
  }
  // Imperial stored like `5' 11"`
  const m = profile.height.match(/(\d+)?\s*'\s*(\d+)?/);
  const ft = parseInt(m?.[1] ?? "", 10);
  const inch = parseInt(m?.[2] ?? "0", 10) || 0;
  if (isNaN(ft) || ft <= 0) return null;
  return ft * 30.48 + inch * 2.54;
};

// True when the profile holds enough valid numeric data to compute an accurate
// target (vs. falling back to static per-goal defaults).
export const hasCalculableProfile = (profile: UserProfile): boolean => {
  const age = parseInt(profile.age, 10);
  return (
    parseWeightKg(profile) !== null &&
    parseHeightCm(profile) !== null &&
    !isNaN(age) &&
    age > 0 &&
    !!profile.gender &&
    !!profile.activityLevel
  );
};

// Accurate daily nutrition target using the Mifflin-St Jeor equation:
//   BMR -> TDEE (activity) -> goal-adjusted calories -> macro split.
export const computeMacroTarget = (profile: UserProfile, goal: Goal): MacroBreakdown => {
  const kg = parseWeightKg(profile);
  const cm = parseHeightCm(profile);
  const age = parseInt(profile.age, 10);

  if (!goal || kg === null || cm === null || isNaN(age) || age <= 0 || !profile.gender || !profile.activityLevel) {
    return getMacroTarget(goal);
  }

  const sexConstant = profile.gender === "Male" ? 5 : -161;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + sexConstant;
  const tdee = bmr * ACTIVITY_FACTORS[profile.activityLevel];
  const calories = tdee * GOAL_CALORIE_FACTOR[goal];

  const protein = Math.round(PROTEIN_PER_KG[goal] * kg);
  const fat = Math.round((calories * 0.25) / 9);
  const remainingCals = Math.max(calories - protein * 4 - fat * 9, 0);
  const carbs = Math.round(remainingCals / 4);

  return {
    calories: Math.round(calories / 10) * 10,
    protein,
    carbs,
    fat,
  };
};

// --- Simulated AI physique analysis -----------------------------------------
// We can't actually run vision models in this MVP, so we derive a believable,
// repeatable breakdown seeded from the photo so re-scanning the same image is
// consistent. Advice is tailored to the user's target physique.

const BODY_PARTS = ["Shoulders", "Chest", "Back", "Arms", "Core", "Legs"] as const;

const STRONG_NOTES: Record<string, string> = {
  Shoulders: "Capped, well-rounded delts give you a wide, 3D look.",
  Chest: "Full chest with good upper-pec thickness.",
  Back: "Wide, thick back creates a powerful V-taper.",
  Arms: "Balanced arms with solid bicep and tricep size.",
  Core: "Tight, defined midsection with visible abs.",
  Legs: "Well-developed quads and hamstrings — no skipping leg day.",
};

const WEAK_NOTES: Record<string, string> = {
  Shoulders: "Shoulders lack width — add lateral raises and overhead pressing to build that capped look.",
  Chest: "Chest is lagging — prioritize incline pressing and flyes for fuller pecs.",
  Back: "Back width and thickness need work — add pull-ups, rows, and lat pulldowns.",
  Arms: "Arms could be bigger — add direct curl and tricep extension volume.",
  Core: "Core definition is limited — tighten nutrition and add weighted ab work.",
  Legs: "Legs are underdeveloped vs. your upper body — prioritize squats and hamstring work.",
};

const hashString = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const statusFor = (rating: number): MuscleStatus =>
  rating >= 78 ? "strong" : rating >= 63 ? "developing" : "weak";

export const buildPhysiqueAnalysis = (
  profile: UserProfile,
  photoUrl: string,
  bodyFat?: number | null,
): PhysiqueAnalysis => {
  const rand = mulberry32(hashString(photoUrl || profile.name || "fitcoach"));

  const parts: BodyPartRating[] = BODY_PARTS.map((part) => {
    const rating = Math.round(48 + rand() * 44); // 48-92
    const status = statusFor(rating);
    return {
      part,
      rating,
      status,
      note: status === "weak" ? WEAK_NOTES[part] : STRONG_NOTES[part],
    };
  });

  const overallScore = Math.round(parts.reduce((sum, p) => sum + p.rating, 0) / parts.length);

  const strengths = [...parts]
    .filter((p) => p.status !== "weak")
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 2);

  const focusAreas = [...parts].sort((a, b) => a.rating - b.rating).slice(0, 3);

  const bodyFatEstimate =
    bodyFat != null && bodyFat > 0 ? bodyFat : Math.round((12 + rand() * 10) * 10) / 10; // 12-22%

  const kg = parseWeightKg(profile);
  const muscleMassKg = kg != null ? Math.round(kg * (1 - bodyFatEstimate / 100) * 0.55 * 10) / 10 : null;

  const weakNames = focusAreas
    .filter((p) => p.status === "weak")
    .map((p) => p.part.toLowerCase());
  const weakList = weakNames.length ? weakNames.join(" and ") : focusAreas.map((p) => p.part.toLowerCase()).join(" and ");

  const physique = profile.targetPhysique;
  const summary =
    physique === "Aesthetic" || physique === "Sculpted"
      ? `For your ${physiqueLabel(physique).toLowerCase()}, bringing up your ${weakList} will sharpen your symmetry and detail.`
      : physique === "Athletic"
      ? `For an athletic build, balanced, functional development matters — tighten up your ${weakList} while keeping conditioning high.`
      : physique === "Mass"
      ? `For maximum mass, keep pushing heavy compounds and pour extra volume into your ${weakList}.`
      : physique === "LeanVTaper" || physique === "LeanToned"
      ? `For a ${physiqueLabel(physique).toLowerCase()} look, focus on your ${weakList} while keeping conditioning high and body fat low.`
      : physique === "StrongCurves"
      ? `For strong curves, keep driving glute and leg work while bringing up your ${weakList}.`
      : `Focus your next training block on your ${weakList} to even out your development.`;

  return {
    id: Math.random().toString(36).substring(7),
    photoUrl,
    photoUrls: [photoUrl],
    date: new Date().toISOString(),
    overallScore,
    muscleMassKg,
    bodyFatEstimate,
    bodyFatLow: Math.round((bodyFatEstimate - 2) * 10) / 10,
    bodyFatHigh: Math.round((bodyFatEstimate + 2) * 10) / 10,
    confidence: "medium",
    markers: [
      "Visible abdominal outline with soft separation",
      "Moderate definition through the shoulders and arms",
      "Some softness around the waist and lower back",
    ],
    limitations:
      "This is a visual estimate from a single photo — lighting, pose, and pump can shift it by a few points. For precision, pair it with measurements over time.",
    suggestedDirection: summary,
    parts,
    strengths,
    focusAreas,
    summary,
  };
};

// Reply shape returned by POST /api/coach/analyze-physique (mirrors the
// generated PhysiqueAnalysisReply, kept inline to avoid a server type import).
export interface PhysiqueAnalysisReply {
  bodyFatLow: number;
  bodyFatHigh: number;
  bodyFatMidpoint: number;
  confidence: AnalysisConfidence;
  markers: string[];
  limitations: string;
  suggestedDirection: string;
  summary: string;
  parts: { part: string; rating: number; note: string }[];
}

// Build the app-facing PhysiqueAnalysis from a real vision API reply. The
// server returns the body-fat range, confidence, markers and per-muscle
// ratings; the derived fields (status, overall score, strengths/focus, lean
// mass) are computed here so the UI stays consistent with the seeded demo.
export const buildPhysiqueAnalysisFromReply = (
  profile: UserProfile,
  photoUrls: string[],
  reply: PhysiqueAnalysisReply,
): PhysiqueAnalysis => {
  const parts: BodyPartRating[] = reply.parts.map((p) => {
    const rating = Math.max(0, Math.min(100, Math.round(p.rating)));
    const status = statusFor(rating);
    return { part: p.part, rating, status, note: p.note };
  });

  const overallScore = parts.length
    ? Math.round(parts.reduce((sum, p) => sum + p.rating, 0) / parts.length)
    : 0;

  const strengths = [...parts]
    .filter((p) => p.status !== "weak")
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 2);

  const focusAreas = [...parts].sort((a, b) => a.rating - b.rating).slice(0, 3);

  const bodyFatEstimate = reply.bodyFatMidpoint;
  const kg = parseWeightKg(profile);
  const muscleMassKg =
    kg != null ? Math.round(kg * (1 - bodyFatEstimate / 100) * 0.55 * 10) / 10 : null;

  return {
    id: Math.random().toString(36).substring(7),
    photoUrl: photoUrls[photoUrls.length - 1] ?? "",
    photoUrls,
    date: new Date().toISOString(),
    overallScore,
    muscleMassKg,
    bodyFatEstimate,
    bodyFatLow: reply.bodyFatLow,
    bodyFatHigh: reply.bodyFatHigh,
    confidence: reply.confidence,
    markers: reply.markers,
    limitations: reply.limitations,
    suggestedDirection: reply.suggestedDirection,
    parts,
    strengths,
    focusAreas,
    summary: reply.summary,
  };
};

// The condensed slice of a PhysiqueAnalysis the coach/personalization endpoints
// need (body-fat estimate + per-muscle ratings). Returns undefined when there's
// no analysis yet so callers can spread it conditionally into request bodies.
export interface PhysiqueContextPayload {
  bodyFatLow: number;
  bodyFatHigh: number;
  bodyFatMidpoint: number;
  overallScore: number;
  parts: { part: string; rating: number; status: MuscleStatus; note: string }[];
}

export const buildPhysiqueContext = (
  analysis: PhysiqueAnalysis | null,
): PhysiqueContextPayload | undefined => {
  if (!analysis) return undefined;
  return {
    bodyFatLow: analysis.bodyFatLow,
    bodyFatHigh: analysis.bodyFatHigh,
    bodyFatMidpoint: analysis.bodyFatEstimate,
    overallScore: analysis.overallScore,
    parts: analysis.parts.map((p) => ({
      part: p.part,
      rating: p.rating,
      status: p.status,
      note: p.note,
    })),
  };
};

interface FitCoachState {
  onboardingComplete: boolean;
  // ISO timestamp anchoring "Week 1" of the user's program. Used to auto-advance
  // the transformation timeline in real time (a new week card appears each week).
  programStartDate: string | null;
  profile: UserProfile;
  goal: Goal;
  // Server-authoritative usage credits (read from GET /api/me/credits). The
  // client never decrements these — spends are enforced server-side inside the
  // gated coach/vision endpoints; the client just refreshes after a spend.
  credits: Credits;
  plan: UserPlan;
  isPremium: boolean; // premium subscriber OR owner → unlimited usage
  isSubscribed: boolean; // base OR premium → full feature access (free = locked)
  subscription: SubscriptionInfo | null;
  subscriptionLoading: boolean;
  refreshSubscription: () => void;
  creditsLoading: boolean;
  workoutPlan: Workout[];
  programMeta: ProgramMeta | null;
  prs: PR[];
  weightLogs: WeightLog[];
  progressPhotos: ProgressPhoto[];
  chatMessages: ChatMessage[];
  meals: MealEntry[];
  workoutSessions: WorkoutSession[];
  // Local day keys (YYYY-MM-DD) of rest days the user has checked off as done.
  restDaysCompleted: string[];
  // AI-enhanced goal version of the user's own photo (null until generated).
  enhancedGoalPhoto: EnhancedGoalPhoto | null;
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: (prefs: NotificationPrefs) => void;
  // Count of consecutive calendar days (ending today/yesterday) with a finished
  // workout OR a completed rest day. Derived from workoutSessions + restDaysCompleted.
  workoutStreak: number;
  macroTarget: MacroBreakdown;
  physiqueAnalysis: PhysiqueAnalysis | null; // active (latest-week) analysis, for dashboard/coach/plan
  physiqueAnalyses: PhysiqueAnalysis[]; // one analysis per analyzed week
  adminMode: boolean;
  // True once the logged-in user's saved state has finished loading (or there
  // is nothing to load). Used to avoid flashing onboarding before hydration.
  hydrated: boolean;
  // The saved-state read failed before this user ever hydrated. The app shows
  // a retry screen instead of routing (defaults would fake a new account).
  hydrationFailed: boolean;
  hydrationRetrying: boolean;
  retryHydration: () => void;

  setOnboardingComplete: (val: boolean) => void;
  // Session-only flag (never persisted): set true the moment a user finishes
  // onboarding so the app can show the one-time "install ALLUR" prompt.
  showInstallPrompt: boolean;
  setShowInstallPrompt: (val: boolean) => void;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  setGoal: (goal: Goal) => void;
  // Pre-flight UX check only (premium → always true). Real enforcement is the
  // server's 402 response; callers must still handle that.
  hasCredit: (type: keyof Credits) => boolean;
  // Re-fetch the server balance after a spend (or a successful upgrade).
  refreshCredits: () => void;
  setWorkoutPlan: (plan: Workout[]) => void;
  setProgramMeta: (meta: ProgramMeta | null) => void;
  addPR: (pr: Omit<PR, "id">) => void;
  addWeightLog: (weight: number) => void;
  removeWeightLog: (id: string) => void;
  setWeightUnit: (unit: "kg" | "lb") => void;
  setBaselinePhotos: (items: { url: string; view?: string }[]) => void;
  addAnglePhoto: (week: number, view: PhotoAngle, url: string) => void;
  removeProgressPhoto: (id: string) => void;
  updateProgressBodyFat: (id: string, bodyFat: number | null) => void;
  setWeekBodyFat: (week: number, bodyFat: number | null) => void;
  addChatMessage: (msg: { role: ChatRole; content: string; planSummary?: string }) => void;
  addMeal: (meal: Omit<MealEntry, "id" | "date">) => void;
  removeMeal: (id: string) => void;
  // --- Workout sessions ---
  // Begin a session from a plan day. Returns the new session id. Pre-fills each
  // exercise's weight with the progressive-overload recommendation from history.
  startWorkoutSession: (workout: Workout) => string;
  toggleExerciseComplete: (sessionId: string, exerciseName: string) => void;
  logExerciseWeight: (
    sessionId: string,
    exerciseName: string,
    weight: number | null,
    unit: "kg" | "lb",
    reps?: number | null,
  ) => void;
  finishWorkoutSession: (sessionId: string) => void;
  // Check off (or un-check) an assigned rest day as completed for a local day.
  toggleRestDayComplete: (dateKey: string) => void;
  setEnhancedGoalPhoto: (photo: EnhancedGoalPhoto | null) => void;
  // Latest in-progress (unfinished) session, if any.
  activeSession: WorkoutSession | null;
  // Progressive-overload suggestion for an exercise based on session history.
  recommendNextWeight: (exerciseName: string) => { weight: number; unit: "kg" | "lb" } | null;
  setPhysiqueAnalysisForWeek: (week: number, analysis: PhysiqueAnalysis | null) => void;
  enterAdminMode: () => void;
  exitAdminMode: () => void;
}

const EMPTY_PROFILE: UserProfile = {
  name: "",
  age: "",
  height: "",
  heightUnit: "ft",
  weight: "",
  weightUnit: "lb",
  gender: "",
  experience: "",
  activityLevel: "",
  targetPhysique: "",
  injuries: [],
  injuryNotes: "",
  dietary: [],
  dietaryNotes: "",
  equipment: [],
  equipmentNotes: "",
  sports: [],
  sportsNotes: "",
  classes: [],
  classesNotes: "",
  enjoy: [],
  enjoyNotes: "",
  dislikes: [],
  dislikeNotes: "",
  timezone: "",
};

// Shown while the server balance is still loading (or for a logged-out user).
const EMPTY_CREDITS: Credits = { coaching: 0, photo: 0, bodyScan: 0 };

// The durable slice of app state that is persisted per-user to the backend.
// Chat history is intentionally excluded (ephemeral, session-scoped). Credits
// are NO LONGER persisted here — they are server-authoritative (userCreditsTable,
// read via GET /api/me/credits). Any `credits` field on a legacy saved blob is
// ignored on hydrate.
interface PersistedFitCoachState {
  onboardingComplete: boolean;
  programStartDate?: string | null;
  profile: UserProfile;
  goal: Goal;
  workoutPlan: Workout[];
  programMeta: ProgramMeta | null;
  prs: PR[];
  weightLogs: WeightLog[];
  progressPhotos: ProgressPhoto[];
  meals: MealEntry[];
  physiqueAnalyses: PhysiqueAnalysis[];
  workoutSessions: WorkoutSession[];
  restDaysCompleted?: string[];
  enhancedGoalPhoto?: EnhancedGoalPhoto | null;
  notificationPrefs?: NotificationPrefs;
  // One-time marker: legacy auto-seeded bodyweight entries have been stripped
  // from weightLogs for this account.
  autoSeedCleaned?: boolean;
}

// Best-effort: figure out which week a legacy (week-less) analysis belongs to by
// matching its photos against the saved timeline; falls back to the latest week.
const deriveAnalysisWeek = (
  analysis: PhysiqueAnalysis,
  photos: ProgressPhoto[],
): number => {
  const urls = new Set(analysis.photoUrls ?? [analysis.photoUrl]);
  const match = photos.find((p) => urls.has(p.url));
  if (match) return match.week;
  return photos.reduce((max, p) => Math.max(max, p.week), 0) || 1;
};

const FitCoachContext = createContext<FitCoachState | null>(null);

export function FitCoachProvider({ children }: { children: React.ReactNode }) {
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [programStartDate, setProgramStartDate] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>({ ...EMPTY_PROFILE });
  const [goal, setGoal] = useState<Goal>(null);
  const [workoutPlan, setWorkoutPlan] = useState<Workout[]>([]);
  const [programMeta, setProgramMeta] = useState<ProgramMeta | null>(null);
  const [prs, setPrs] = useState<PR[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [autoSeedCleaned, setAutoSeedCleaned] = useState(false);
  const [progressPhotos, setProgressPhotos] = useState<ProgressPhoto[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [workoutSessions, setWorkoutSessions] = useState<WorkoutSession[]>([]);
  const [restDaysCompleted, setRestDaysCompleted] = useState<string[]>([]);
  const [enhancedGoalPhoto, setEnhancedGoalPhoto] = useState<EnhancedGoalPhoto | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({ ...DEFAULT_NOTIFICATION_PREFS });
  const [physiqueAnalyses, setPhysiqueAnalyses] = useState<PhysiqueAnalysis[]>([]);
  // The active analysis (highest week) backs the dashboard/coach/plan, which only
  // ever need the most recent scan.
  const physiqueAnalysis = useMemo<PhysiqueAnalysis | null>(
    () =>
      physiqueAnalyses.length
        ? [...physiqueAnalyses].sort((a, b) => (b.week ?? 0) - (a.week ?? 0))[0]
        : null,
    [physiqueAnalyses],
  );
  const [adminMode, setAdminMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const macroTarget = computeMacroTarget(profile, goal);

  // --- Per-user persistence -------------------------------------------------
  const { authUser } = useAccount();
  const userId = authUser?.id ?? null;

  // Whether the current user is the repl owner (you). Gated server-side by
  // /api/admin/status comparing the authenticated id to REPL_OWNER_ID, so a
  // normal user can never flip this on. Owners get unlimited testing credits.
  const adminStatusQuery = useGetAdminStatus({
    query: {
      enabled: !!userId,
      queryKey: [...getGetAdminStatusQueryKey(), userId ?? "anon"],
      retry: false,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  });
  const isOwner = adminStatusQuery.data?.isOwner === true;

  // Tracks which user's saved state has already been loaded into context, so we
  // hydrate exactly once per login and never persist before the initial load.
  const hydratedUserIdRef = useRef<string | null>(null);
  // Once the owner-only admin demo preview is entered this session, the context
  // becomes a throwaway preview — it must never be persisted to a real account.
  const adminTaintedRef = useRef(false);

  const fitnessStateQuery = useGetMyFitnessState({
    query: {
      enabled: !!userId,
      // Scope the cache per user so switching accounts refetches instead of
      // reusing the previous user's blob.
      queryKey: [...getGetMyFitnessStateQueryKey(), userId ?? "anon"],
      // A single failed read used to disable persistence for the whole session
      // (defaults rendered, writer never enabled) with no warning. Retry a few
      // times and refetch on reconnect so one network blip can't strand a user
      // in a non-saving session.
      retry: 3,
      refetchOnReconnect: true,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  });
  const saveErrorToastAtRef = useRef(0);
  const { mutate: saveFitnessState } = useSaveMyFitnessState({
    mutation: {
      retry: 2,
      onError: () => {
        // Persistence failures used to be completely silent — the UI kept
        // showing "saved" data that evaporated on reload. Tell the user, but
        // rate-limit the toast so a flaky connection doesn't spam them.
        const now = Date.now();
        if (now - saveErrorToastAtRef.current < 30_000) return;
        saveErrorToastAtRef.current = now;
        toast({
          variant: "destructive",
          title: "Changes aren't saving",
          description:
            "Your latest changes couldn't sync to your account. Check your connection — we'll keep retrying.",
        });
      },
    },
  });

  // Server-authoritative usage credits. The balance + plan come from the server
  // (userCreditsTable); the client only reads them and refreshes after a spend.
  const queryClient = useQueryClient();
  const creditsQueryKey = useMemo(
    () => [...getGetMyCreditsQueryKey(), userId ?? "anon"],
    [userId],
  );
  const creditsQuery = useGetMyCredits({
    query: {
      enabled: !!userId,
      queryKey: creditsQueryKey,
      retry: false,
      refetchOnWindowFocus: false,
    },
  });
  const rawPlan = creditsQuery.data?.plan;
  const serverCredits: Credits = creditsQuery.data?.credits
    ? {
        coaching: creditsQuery.data.credits.coaching,
        photo: creditsQuery.data.credits.photo,
        bodyScan: creditsQuery.data.credits.bodyScan,
      }
    : EMPTY_CREDITS;
  const refreshCredits = () => {
    queryClient.invalidateQueries({ queryKey: creditsQueryKey });
  };

  // Subscription summary (trial/cancel state + whether the user has ever
  // subscribed). Drives the post-onboarding payment gate and Account page.
  const subscriptionQueryKey = useMemo(
    () => [...getGetMySubscriptionQueryKey(), userId ?? "anon"],
    [userId],
  );
  const subscriptionQuery = useGetMySubscription({
    query: {
      enabled: !!userId,
      queryKey: subscriptionQueryKey,
      // The subscription summary gates the post-onboarding paywall, so retry
      // transient failures rather than fail-open immediately. If it ultimately
      // can't load, App.tsx fails open into the app (server creditGuard still
      // blocks any unpaid usage).
      retry: 2,
      refetchOnWindowFocus: false,
    },
  });
  const subscription: SubscriptionInfo | null = subscriptionQuery.data
    ? {
        plan:
          subscriptionQuery.data.plan === "premium"
            ? "premium"
            : subscriptionQuery.data.plan === "base"
            ? "base"
            : "free",
        status: subscriptionQuery.data.status ?? null,
        trialEnd: subscriptionQuery.data.trialEnd ?? null,
        currentPeriodEnd: subscriptionQuery.data.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: !!subscriptionQuery.data.cancelAtPeriodEnd,
        hasEverSubscribed: !!subscriptionQuery.data.hasEverSubscribed,
      }
    : null;
  const refreshSubscription = () => {
    queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });
    queryClient.invalidateQueries({ queryKey: creditsQueryKey });
  };

  // Access tier. The subscription summary is read straight from Stripe-sync data
  // (active/trialing/past_due → base|premium) and is the authoritative source of
  // truth; we only fall back to the credits endpoint's plan (then "free") when
  // the subscription summary hasn't loaded. Preferring the subscription avoids
  // falsely locking a paying user out as Free if the credits fetch fails or
  // lags right after a fresh checkout. (Server-side creditGuard is the real
  // enforcement regardless of what the client derives here.)
  const plan: UserPlan =
    subscription?.plan ??
    (rawPlan === "premium" ? "premium" : rawPlan === "base" ? "base" : "free");
  // Premium (and the owner, whom the server reports as premium) gets unlimited
  // usage — no credit decrement.
  const isPremium = plan === "premium";
  // Base or Premium → full feature access. Free users keep their data but the
  // credit-gated features (Coach, plan updates, macro/meal tracking, physique
  // analysis) are locked behind a resubscribe prompt.
  const isSubscribed = plan === "base" || plan === "premium";

  const hydrateFrom = (state: PersistedFitCoachState) => {
    setOnboardingComplete(state.onboardingComplete);
    setProgramStartDate(state.programStartDate ?? null);
    // Merge over EMPTY_PROFILE so older saves (made before the training-setup
    // fields existed) still have the new array/string fields defined — the
    // optimizer and onboarding chips call .includes/.map on them. Also map any
    // retired targetPhysique id onto a current one.
    const mergedProfile = { ...EMPTY_PROFILE, ...state.profile };
    mergedProfile.targetPhysique = normalizePhysique(mergedProfile.targetPhysique);
    setProfile(mergedProfile);
    setGoal(state.goal);
    // Credits are no longer persisted in the blob (server-authoritative). Any
    // legacy `state.credits` on an old save is intentionally ignored.
    setWorkoutPlan(state.workoutPlan);
    setProgramMeta(state.programMeta);
    setPrs(state.prs);
    // One-time legacy cleanup: an earlier bug auto-seeded a bodyweight entry
    // equal to the onboarding weight (profile.weight) into weightLogs. That weight
    // is now rendered as a synthetic chart "Start" point, so the stored copy is a
    // stray duplicate the user never logged. Strip any entry equal to it ONCE
    // (gated by `autoSeedCleaned`), so a real future log that happens to match the
    // onboarding weight is preserved. The filter is idempotent on already-clean data.
    if (state.autoSeedCleaned) {
      setWeightLogs(state.weightLogs);
    } else {
      const onboardingWeight = parseFloat(mergedProfile.weight);
      setWeightLogs(
        Number.isFinite(onboardingWeight)
          ? state.weightLogs.filter((l) => Math.abs(l.weight - onboardingWeight) > 0.05)
          : state.weightLogs,
      );
    }
    setAutoSeedCleaned(true);
    setProgressPhotos(state.progressPhotos);
    setMeals(state.meals);
    setWorkoutSessions(Array.isArray(state.workoutSessions) ? state.workoutSessions : []);
    setRestDaysCompleted(Array.isArray(state.restDaysCompleted) ? state.restDaysCompleted : []);
    setEnhancedGoalPhoto(state.enhancedGoalPhoto && state.enhancedGoalPhoto.url ? state.enhancedGoalPhoto : null);
    setNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...(state.notificationPrefs ?? {}) });
    // Back-compat: older saves stored a single `physiqueAnalysis`; newer saves
    // store `physiqueAnalyses` (one per week). Migrate the legacy shape by
    // attaching it to the week of the photos it analyzed.
    const legacy = state as PersistedFitCoachState & {
      physiqueAnalysis?: PhysiqueAnalysis | null;
    };
    if (Array.isArray(state.physiqueAnalyses)) {
      setPhysiqueAnalyses(state.physiqueAnalyses);
    } else if (legacy.physiqueAnalysis) {
      const old = legacy.physiqueAnalysis;
      setPhysiqueAnalyses([{ ...old, week: deriveAnalysisWeek(old, state.progressPhotos) }]);
    } else {
      setPhysiqueAnalyses([]);
    }
  };

  const resetToDefaults = () => {
    setOnboardingComplete(false);
    setShowInstallPrompt(false);
    setProgramStartDate(null);
    setProfile(EMPTY_PROFILE);
    setGoal(null);
    setWorkoutPlan([]);
    setProgramMeta(null);
    setPrs([]);
    setWeightLogs([]);
    setAutoSeedCleaned(true);
    setProgressPhotos([]);
    setChatMessages([]);
    setMeals([]);
    setWorkoutSessions([]);
    setRestDaysCompleted([]);
    setEnhancedGoalPhoto(null);
    setNotificationPrefs({ ...DEFAULT_NOTIFICATION_PREFS });
    setPhysiqueAnalyses([]);
  };

  // Hydrate from the server once per logged-in user; reset on logout.
  const { isSuccess, isFetched, data: remoteState } = fitnessStateQuery;

  // True when the signed-in user's saved state could not be loaded (network
  // blip / cold server) and we have NOT hydrated yet. The app must show a
  // retry screen in this case — rendering blank defaults made a returning
  // user look brand-new and dumped them back into onboarding.
  const hydrationFailed =
    !!userId &&
    !adminMode &&
    !adminTaintedRef.current &&
    fitnessStateQuery.isError &&
    hydratedUserIdRef.current !== userId;
  const hydrationRetrying = hydrationFailed && fitnessStateQuery.isFetching;
  const retryHydration = () => {
    void fitnessStateQuery.refetch();
  };
  useEffect(() => {
    if (!userId) {
      if (hydratedUserIdRef.current !== null) {
        resetToDefaults();
        hydratedUserIdRef.current = null;
      }
      // Logout ends any admin preview and clears the per-tab taint so the next
      // login hydrates and persists normally.
      adminTaintedRef.current = false;
      setAdminMode(false);
      setHydrated(false);
      return;
    }
    if (adminMode || adminTaintedRef.current) {
      setHydrated(true);
      return;
    }
    if (hydratedUserIdRef.current === userId) return;
    // A different user is now active (initial login or in-session account
    // switch): block routing until THIS user's state settles, so the previous
    // user's in-memory data is never rendered under the new account.
    setHydrated(false);
    if (!isFetched) return; // wait for the read to settle (success or error)

    if (isSuccess) {
      const saved = (remoteState?.state ?? null) as unknown as PersistedFitCoachState | null;
      if (saved) {
        hydrateFrom(saved);
      } else {
        resetToDefaults();
      }
      // Mark loaded so the debounced writer is now allowed to persist changes.
      hydratedUserIdRef.current = userId;
    } else {
      // Read failed: render with defaults but leave persistence disabled so we
      // never clobber possibly-existing server data with empty state.
      resetToDefaults();
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isFetched, isSuccess, remoteState, adminMode]);

  // Debounced persistence of all durable state for the logged-in user.
  const persistable = useMemo<PersistedFitCoachState>(
    () => ({
      onboardingComplete,
      programStartDate,
      profile,
      goal,
      workoutPlan,
      programMeta,
      prs,
      weightLogs,
      progressPhotos,
      meals,
      physiqueAnalyses,
      workoutSessions,
      restDaysCompleted,
      enhancedGoalPhoto,
      notificationPrefs,
      autoSeedCleaned,
    }),
    [
      onboardingComplete,
      programStartDate,
      profile,
      goal,
      workoutPlan,
      programMeta,
      prs,
      weightLogs,
      progressPhotos,
      meals,
      physiqueAnalyses,
      workoutSessions,
      restDaysCompleted,
      enhancedGoalPhoto,
      notificationPrefs,
      autoSeedCleaned,
    ],
  );

  // Safety net for account syncing: the platform rejects request bodies over
  // ~4.5MB, and one oversized inline photo used to brick EVERY subsequent save
  // for the account. Photos above the cap are dropped from the persisted copy
  // only (the in-session UI keeps showing them).
  const MAX_PERSISTED_PHOTO_CHARS = 300_000; // ~220KB decoded
  const slimPhoto = (url: string): string =>
    url && url.startsWith("data:") && url.length > MAX_PERSISTED_PHOTO_CHARS ? "" : url;
  const slimForPersist = (s: PersistedFitCoachState): PersistedFitCoachState => ({
    ...s,
    meals: s.meals.map((m) => ({ ...m, photoUrl: slimPhoto(m.photoUrl) })),
    progressPhotos: s.progressPhotos.map((p) => ({ ...p, url: slimPhoto(p.url) })),
    enhancedGoalPhoto:
      s.enhancedGoalPhoto && slimPhoto(s.enhancedGoalPhoto.url)
        ? s.enhancedGoalPhoto
        : null,
    physiqueAnalyses: s.physiqueAnalyses.map((a) => ({
      ...a,
      photoUrl: slimPhoto(a.photoUrl),
      photoUrls: (a.photoUrls ?? []).map(slimPhoto),
    })),
  });

  // Backfill the user's timezone from the device for accounts created before
  // the onboarding picker existed (never overwrites an explicit choice).
  useEffect(() => {
    if (!hydrated || !onboardingComplete) return;
    if (profile.timezone) return;
    let detected = "";
    try {
      detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      /* unsupported — leave empty */
    }
    if (detected) setProfile((p) => (p.timezone ? p : { ...p, timezone: detected }));
  }, [hydrated, onboardingComplete, profile.timezone]);

  // Backfill the program-start anchor once the user has onboarded. New users get
  // "now"; existing users (saved before this field existed) are healed from their
  // earliest logged data so their timeline doesn't reset to Week 1. Runs only
  // after hydration so it never fires against a half-loaded/throwaway state.
  useEffect(() => {
    if (!hydrated) return;
    if (!onboardingComplete) return;
    if (programStartDate) return;
    const earliest = [
      ...progressPhotos.map((p) => p.date),
      ...weightLogs.map((w) => w.date),
    ]
      .filter((d): d is string => !!d)
      .sort()[0];
    setProgramStartDate(earliest ?? new Date().toISOString());
  }, [hydrated, onboardingComplete, programStartDate, progressPhotos, weightLogs]);

  useEffect(() => {
    if (!userId) return;
    if (adminMode || adminTaintedRef.current) return;
    if (hydratedUserIdRef.current !== userId) return;
    const handle = setTimeout(() => {
      saveFitnessState({
        data: { state: slimForPersist(persistable) as unknown as Record<string, unknown> },
      });
    }, 800);
    return () => clearTimeout(handle);
  }, [persistable, userId, adminMode, saveFitnessState]);

  // Premium (and the owner, who the server reports as premium) always have a
  // credit. For free users this is a UX pre-check against the cached server
  // balance — the authoritative gate is the endpoint's 402 response.
  const hasCredit = (type: keyof Credits) => {
    if (isPremium) return true;
    // Free users can't use credit-gated features at all (locked behind a
    // subscribe prompt); Base users check their remaining balance.
    if (plan === "free") return false;
    return (serverCredits[type] ?? 0) > 0;
  };

  const addPR = (pr: Omit<PR, "id">) => {
    setPrs(prev => [{ ...pr, id: Math.random().toString(36).substring(7) }, ...prev]);
  };

  const addWeightLog = (weight: number) => {
    setWeightLogs(prev => [
      ...prev,
      { id: Math.random().toString(36).substring(7), weight, date: new Date().toISOString() }
    ]);
  };

  const removeWeightLog = (id: string) => {
    setWeightLogs(prev => prev.filter(l => l.id !== id));
  };

  // Switch the preferred weight unit AND convert every already-stored bodyweight
  // (the profile weight + all logged entries) so the user's history stays correct
  // instead of being silently reinterpreted in the new unit.
  const setWeightUnit = (unit: "kg" | "lb") => {
    if (profile.weightUnit === unit) return;
    const factor = unit === "lb" ? 2.2046226218 : 1 / 2.2046226218;
    // Leave non-finite (corrupt/legacy) values untouched rather than turning them
    // into NaN/Infinity.
    const converted = (n: number) =>
      Number.isFinite(n) ? Math.round(n * factor * 10) / 10 : n;
    // Two separate, pure updater calls (no nested setters) so React StrictMode's
    // double-invocation can't double-convert the values.
    setWeightLogs(logs => logs.map(l => ({ ...l, weight: converted(l.weight) })));
    setProfile(prev => {
      const w = parseFloat(prev.weight);
      const nextWeight = prev.weight && !isNaN(w) ? String(converted(w)) : prev.weight;
      return { ...prev, weightUnit: unit, weight: nextWeight };
    });
  };

  // Replace the week-1 baseline with every uploaded angle (Front/Side/Back).
  // Each is stored as its own week-1 ProgressPhoto so the timeline shows all of
  // them and the physique analysis can use them as multiple angles.
  const setBaselinePhotos = (items: { url: string; view?: string }[]) => {
    if (items.length === 0) return;
    setProgressPhotos(prev => {
      const rest = prev.filter(p => p.week !== 1);
      const baseline: ProgressPhoto[] = items.map(it => ({
        id: Math.random().toString(36).substring(7),
        week: 1,
        url: it.url,
        view: it.view,
        bodyFat: null,
        date: new Date().toISOString(),
      }));
      return [...baseline, ...rest];
    });
  };

  // Add (or replace) the photo for a specific week + angle. A week can hold up
  // to one Front, one Side, and one Back photo; re-uploading an angle overwrites
  // it and inherits the week's existing body-fat value.
  const addAnglePhoto = (week: number, view: PhotoAngle, url: string) => {
    setProgressPhotos(prev => {
      const existingWeekBf = prev.find(p => p.week === week && p.bodyFat != null)?.bodyFat ?? null;
      const rest = prev.filter(p => !(p.week === week && p.view === view));
      return [
        ...rest,
        {
          id: Math.random().toString(36).substring(7),
          week,
          url,
          view,
          bodyFat: existingWeekBf,
          date: new Date().toISOString(),
        },
      ];
    });
  };

  const removeProgressPhoto = (id: string) => {
    setProgressPhotos(prev => prev.filter(p => p.id !== id));
  };

  const updateProgressBodyFat = (id: string, bodyFat: number | null) => {
    setProgressPhotos(prev => prev.map(p => (p.id === id ? { ...p, bodyFat } : p)));
  };

  // Apply one body-fat value to every photo/angle in a week (body fat is a
  // week-level measurement, not per-angle).
  const setWeekBodyFat = (week: number, bodyFat: number | null) => {
    setProgressPhotos(prev => prev.map(p => (p.week === week ? { ...p, bodyFat } : p)));
  };

  const setPhysiqueAnalysisForWeek = (week: number, analysis: PhysiqueAnalysis | null) => {
    setPhysiqueAnalyses(prev => {
      const rest = prev.filter(a => a.week !== week);
      return analysis ? [...rest, { ...analysis, week }] : rest;
    });
  };

  const addChatMessage = (msg: { role: ChatRole; content: string; planSummary?: string }) => {
    setChatMessages(prev => [
      ...prev,
      { ...msg, id: Math.random().toString(36).substring(7), date: new Date().toISOString() },
    ]);
  };

  const addMeal = (meal: Omit<MealEntry, "id" | "date">) => {
    setMeals(prev => [
      { ...meal, id: Math.random().toString(36).substring(7), date: new Date().toISOString() },
      ...prev,
    ]);
  };

  const removeMeal = (id: string) => {
    setMeals(prev => prev.filter(m => m.id !== id));
  };

  // --- Workout sessions ----------------------------------------------------
  // Progressive overload: look back through finished sessions (newest first) for
  // the last time this exercise was logged with a weight. If the user completed
  // it, bump the load by one increment (2.5kg / 5lb); if they logged it but
  // didn't complete, suggest the same weight again. No history → no suggestion.
  const recommendNextWeight = (
    exerciseName: string,
  ): { weight: number; unit: "kg" | "lb" } | null => {
    const finished = [...workoutSessions]
      .filter((s) => s.finishedAt)
      .sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
    for (const session of finished) {
      const ex = session.exercises.find(
        (e) => e.name === exerciseName && typeof e.weight === "number" && e.weight > 0,
      );
      if (ex && typeof ex.weight === "number") {
        const increment = ex.unit === "kg" ? 2.5 : 5;
        const next = ex.completed ? ex.weight + increment : ex.weight;
        return { weight: Math.round(next * 10) / 10, unit: ex.unit };
      }
    }
    return null;
  };

  const startWorkoutSession = (workout: Workout): string => {
    const id = Math.random().toString(36).substring(7);
    const defaultUnit = profile.weightUnit ?? "kg";
    const exercises: SessionExercise[] = workout.exercises.map((e) => {
      const rec = recommendNextWeight(e.name);
      return {
        name: e.name,
        targetSets: e.sets,
        targetReps: e.reps,
        completed: false,
        weight: rec?.weight ?? null,
        unit: rec?.unit ?? defaultUnit,
        reps: null,
      };
    });
    const session: WorkoutSession = {
      id,
      dayName: workout.dayName,
      title: workout.title,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exercises,
    };
    setWorkoutSessions((prev) => [session, ...prev]);
    return id;
  };

  const toggleExerciseComplete = (sessionId: string, exerciseName: string) => {
    setWorkoutSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              exercises: s.exercises.map((e) =>
                e.name === exerciseName ? { ...e, completed: !e.completed } : e,
              ),
            }
          : s,
      ),
    );
  };

  const logExerciseWeight = (
    sessionId: string,
    exerciseName: string,
    weight: number | null,
    unit: "kg" | "lb",
    reps: number | null = null,
  ) => {
    setWorkoutSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              exercises: s.exercises.map((e) =>
                e.name === exerciseName
                  ? { ...e, weight, unit, reps: reps ?? e.reps }
                  : e,
              ),
            }
          : s,
      ),
    );
  };

  const finishWorkoutSession = (sessionId: string) => {
    setWorkoutSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId && !s.finishedAt
          ? { ...s, finishedAt: new Date().toISOString() }
          : s,
      ),
    );
  };

  const activeSession = useMemo<WorkoutSession | null>(
    () => workoutSessions.find((s) => !s.finishedAt) ?? null,
    [workoutSessions],
  );

  // Check off (or un-check) a rest day as completed for a given local day key.
  const toggleRestDayComplete = (dateKey: string) => {
    setRestDaysCompleted((prev) =>
      prev.includes(dateKey) ? prev.filter((d) => d !== dateKey) : [...prev, dateKey],
    );
  };

  // Consecutive-day streak ending today or yesterday, counted from the distinct
  // calendar days that have a finished workout or a completed rest day (rest
  // days the plan assigns count toward consistency once checked off).
  const workoutStreak = useMemo<number>(() => {
    const days = new Set([
      ...workoutSessions
        .filter((s) => s.finishedAt)
        .map((s) => dayKeyOf(new Date(s.finishedAt as string))),
      ...restDaysCompleted,
    ]);
    if (days.size === 0) return 0;
    const dayKey = (d: Date) => dayKeyOf(d);
    const cursor = new Date();
    // Allow the streak to "hold" if today isn't logged yet but yesterday was.
    if (!days.has(dayKey(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
      if (!days.has(dayKey(cursor))) return 0;
    }
    let streak = 0;
    while (days.has(dayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [workoutSessions, restDaysCompleted]);

  const enterAdminMode = () => {
    // The admin demo seeds throwaway preview data — disable persistence for the
    // rest of this session so it never overwrites a real account's saved state.
    adminTaintedRef.current = true;
    const rid = () => Math.random().toString(36).substring(7);
    const daysAgo = (n: number) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return d.toISOString();
    };

    const demoProfile: UserProfile = {
      name: "Demo Athlete",
      age: "29",
      height: "182 cm",
      heightUnit: "cm",
      weight: "84",
      weightUnit: "kg",
      gender: "Male",
      experience: "Intermediate",
      activityLevel: "Moderate",
      targetPhysique: "Aesthetic",
      injuries: ["Lower back"],
      injuryNotes: "Mild lower-back tightness on heavy deadlifts.",
      dietary: ["Lactose-free"],
      dietaryNotes: "",
      equipment: ["Full gym", "Cardio machines (bike / treadmill / rower)", "Pool access"],
      equipmentNotes: "",
      sports: ["Basketball", "Tennis"],
      sportsNotes: "Pickup ball on weekends.",
      classes: ["Spin / cycling", "Hot yoga"],
      classesNotes: "",
      enjoy: ["Heavy compound lifts", "Group classes"],
      enjoyNotes: "",
      dislikes: ["Long cardio"],
      dislikeNotes: "Hates slogging on the treadmill.",
      timezone: "America/New_York",
    };
    setProfile(demoProfile);
    setGoal("Muscle Gain");
    const demoProgram = buildProgram(demoProfile, "Muscle Gain");
    setWorkoutPlan(demoProgram.days);
    setProgramMeta(demoProgram.meta);
    setPrs([
      { id: rid(), exercise: "Bench Press", weight: "100kg", reps: "5", date: daysAgo(2) },
      { id: rid(), exercise: "Back Squat", weight: "140kg", reps: "3", date: daysAgo(9) },
      { id: rid(), exercise: "Deadlift", weight: "170kg", reps: "2", date: daysAgo(16) },
    ]);
    setWeightLogs([
      { id: rid(), weight: 86, date: daysAgo(28) },
      { id: rid(), weight: 85.2, date: daysAgo(21) },
      { id: rid(), weight: 84.6, date: daysAgo(14) },
      { id: rid(), weight: 84.1, date: daysAgo(7) },
      { id: rid(), weight: 84, date: daysAgo(0) },
    ]);
    setProgressPhotos([
      { id: rid(), week: 1, view: "Front", url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=800&auto=format&fit=crop", bodyFat: 22, date: daysAgo(28) },
      { id: rid(), week: 2, view: "Front", url: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?q=80&w=800&auto=format&fit=crop", bodyFat: 20.5, date: daysAgo(21) },
      { id: rid(), week: 3, view: "Front", url: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=800&auto=format&fit=crop", bodyFat: 19, date: daysAgo(14) },
      { id: rid(), week: 4, view: "Front", url: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=800&auto=format&fit=crop", bodyFat: 17.5, date: daysAgo(7) },
    ]);
    setChatMessages([
      {
        id: rid(),
        role: "user",
        content: "I want to focus more on arms this week.",
        date: daysAgo(3),
      },
      {
        id: rid(),
        role: "assistant",
        content:
          "For your muscle gain goal, I'd add extra bicep and tricep volume on your push and pull days. Prioritize slow eccentrics and progressive overload — aim to add reps before weight. Want me to update your plan?",
        date: daysAgo(3),
      },
    ]);
    setMeals([
      {
        id: rid(),
        name: "Grilled Chicken & Rice Bowl",
        photoUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop",
        items: ["Grilled chicken breast", "White rice", "Steamed broccoli", "Olive oil"],
        macros: { calories: 620, protein: 52, carbs: 68, fat: 14 },
        date: daysAgo(0),
      },
      {
        id: rid(),
        name: "Greek Yogurt & Berries",
        photoUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=800&auto=format&fit=crop",
        items: ["Greek yogurt", "Blueberries", "Granola", "Honey"],
        macros: { calories: 340, protein: 24, carbs: 42, fat: 8 },
        date: daysAgo(0),
      },
      {
        id: rid(),
        name: "Salmon & Avocado Salad",
        photoUrl: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?q=80&w=800&auto=format&fit=crop",
        items: ["Grilled salmon", "Avocado", "Mixed greens", "Cherry tomatoes"],
        macros: { calories: 480, protein: 38, carbs: 18, fat: 30 },
        date: daysAgo(0),
      },
    ]);
    // Credits are server-authoritative now; the admin demo is owner-only and the
    // server reports the owner as premium (unlimited), so there's nothing to seed.
    setPhysiqueAnalysisForWeek(
      4,
      buildPhysiqueAnalysis(
        demoProfile,
        "https://images.unsplash.com/photo-1599058917212-d750089bc07e?q=80&w=800&auto=format&fit=crop",
        17.5,
      ),
    );
    setOnboardingComplete(true);
    setAdminMode(true);
  };

  const exitAdminMode = () => {
    setAdminMode(false);
    // Drop the throwaway demo data and clear the per-tab taint, then force a
    // fresh hydrate so the owner's real saved state is reloaded from the server
    // and normal persistence resumes (never persisting the demo seed).
    resetToDefaults();
    adminTaintedRef.current = false;
    hydratedUserIdRef.current = null;
    setHydrated(false);
  };

  return (
    <FitCoachContext.Provider
      value={{
        onboardingComplete,
        setOnboardingComplete,
        showInstallPrompt,
        setShowInstallPrompt,
        programStartDate,
        profile,
        setProfile,
        goal,
        setGoal,
        credits: serverCredits,
        plan,
        isPremium,
        isSubscribed,
        subscription,
        subscriptionLoading: !!userId && subscriptionQuery.isPending,
        refreshSubscription,
        creditsLoading: !!userId && creditsQuery.isPending,
        hasCredit,
        refreshCredits,
        workoutPlan,
        setWorkoutPlan,
        programMeta,
        setProgramMeta,
        prs,
        addPR,
        weightLogs,
        addWeightLog,
        removeWeightLog,
        setWeightUnit,
        progressPhotos,
        setBaselinePhotos,
        addAnglePhoto,
        removeProgressPhoto,
        updateProgressBodyFat,
        setWeekBodyFat,
        chatMessages,
        addChatMessage,
        meals,
        macroTarget,
        addMeal,
        removeMeal,
        workoutSessions,
        restDaysCompleted,
        toggleRestDayComplete,
        enhancedGoalPhoto,
        setEnhancedGoalPhoto,
        notificationPrefs,
        setNotificationPrefs,
        workoutStreak,
        startWorkoutSession,
        toggleExerciseComplete,
        logExerciseWeight,
        finishWorkoutSession,
        activeSession,
        recommendNextWeight,
        physiqueAnalysis,
        physiqueAnalyses,
        setPhysiqueAnalysisForWeek,
        adminMode,
        hydrated,
        hydrationFailed,
        hydrationRetrying,
        retryHydration,
        enterAdminMode,
        exitAdminMode,
      }}
    >
      {children}
    </FitCoachContext.Provider>
  );
}

export const useFitCoach = () => {
  const ctx = useContext(FitCoachContext);
  if (!ctx) throw new Error("useFitCoach must be used within FitCoachProvider");
  return ctx;
};
