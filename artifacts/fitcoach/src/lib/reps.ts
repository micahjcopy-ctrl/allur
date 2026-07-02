// Fire-and-forget Reps awarding. Called from the actions that represent plan
// adherence (workout finished, meal logged, weekly check-in). The server owns
// the catalog and the per-day caps — this just reports that the action happened.
// Failures are silent by design: gamification must never block the real action.

export type RepEventType = "workout" | "meal" | "protein" | "checkin" | "coach_reply";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

export const localDay = (): string => {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

export async function awardReps(type: RepEventType): Promise<{ awarded: number; bonus?: number } | null> {
  try {
    const res = await fetch(`${apiBase()}/api/squad/points-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ type, day: localDay() }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { awarded: number; bonus?: number };
  } catch {
    return null;
  }
}

export type QuestKey = "tour_complete" | "first_meal" | "first_workout" | "first_scan" | "first_friend";

// Award a one-time activation-quest bonus. Silent + idempotent server-side.
export async function completeQuest(key: QuestKey): Promise<{ awarded: number; alreadyDone: boolean } | null> {
  try {
    const res = await fetch(`${apiBase()}/api/squad/quest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ key, day: localDay() }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { awarded: number; alreadyDone: boolean };
  } catch {
    return null;
  }
}

// Persist a referral code captured from a ?ref= link until the user is signed
// in and can claim it.
const REF_KEY = "allur_ref";
export function captureRefFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) localStorage.setItem(REF_KEY, ref.trim().toUpperCase());
  } catch {
    /* ignore */
  }
}

// Redeem a stored referral code once the user is authenticated. No-op if none.
export async function claimStoredReferral(): Promise<void> {
  try {
    const code = localStorage.getItem(REF_KEY);
    if (!code) return;
    await fetch(`${apiBase()}/api/referral/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    });
    localStorage.removeItem(REF_KEY);
  } catch {
    /* ignore — will retry next load since we only remove on success path above */
  }
}
