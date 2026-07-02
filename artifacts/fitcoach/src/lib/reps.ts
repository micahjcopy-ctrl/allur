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
