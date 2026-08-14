// Anonymous-onboarding hand-off.
//
// The quiz funnel now runs signed-OUT: a visitor answers the funnel, we build
// their plan in memory, and only THEN do they create an account + pay. Because
// the signed-out app keeps FitCoach state in memory (nothing is persisted until
// there's a user id), that in-memory plan would be wiped the moment the new
// account hydrates. To bridge the gap we stash the finished onboarding result
// in sessionStorage right before sending the visitor to sign up, and the
// FitCoach provider restores it on the brand-new account's first hydration.
//
// sessionStorage (not localStorage) is deliberate: the hand-off is meant to
// survive the signup navigation within the same tab and nothing longer.

import type { UserProfile, Goal, Workout, ProgramMeta } from "@/context/FitCoachContext";

const STASH_KEY = "allur.onboardingStash.v1";

export interface OnboardingStash {
  v: 1;
  profile: UserProfile;
  goal: Goal;
  plan: Workout[];
  meta: ProgramMeta | null;
}

/** Persist a finished anonymous onboarding result for restore after signup. */
export function writeOnboardingStash(stash: Omit<OnboardingStash, "v">): void {
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify({ v: 1, ...stash }));
  } catch {
    /* private mode / quota — the flow still works, plan is just rebuilt fresh */
  }
}

/** Read a pending anonymous onboarding result, if any. */
export function readOnboardingStash(): OnboardingStash | null {
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingStash;
    if (parsed && parsed.v === 1 && Array.isArray(parsed.plan)) return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Drop the stash once it's been consumed (or is no longer relevant). */
export function clearOnboardingStash(): void {
  try {
    sessionStorage.removeItem(STASH_KEY);
  } catch {
    /* nothing to clear */
  }
}
