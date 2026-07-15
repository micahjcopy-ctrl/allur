import React, { useEffect, useMemo, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useFitCoach } from "@/context/FitCoachContext";
import { localDay, completeQuest } from "@/lib/reps";
import { cn } from "@/lib/utils";
import {
  Users,
  Copy,
  Swords,
  Flame,
  Trophy,
  Bell,
  Loader2,
  CheckCircle2,
  Zap,
  HandMetal,
  UserPlus,
} from "lucide-react";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

interface SquadFriend {
  id: string;
  name: string;
  weekReps: number;
  respectedToday: boolean;
}
interface SquadDuel {
  id: string;
  status: string;
  winnerId: string | null;
  challengerId: string;
  opponentId: string;
  endAt: string;
  challengerReps: number;
  opponentReps: number;
}
interface SquadNotification {
  id: string;
  type: string;
  body: string;
  read: boolean;
  createdAt: string;
}
interface Overview {
  plan: "free" | "base" | "premium";
  inviteCode: string;
  reps: { week: number };
  momentum: { weeks: number; state: string; currentWeekReps: number };
  soloChallenge: { target: number; current: number; bonus: number; done: boolean };
  friends: SquadFriend[];
  duels: SquadDuel[];
  notifications: SquadNotification[];
  unreadCount: number;
}

function MomentumRing({ weeks, state, weekReps, target }: { weeks: number; state: string; weekReps: number; target: number }) {
  const pct = Math.min(weekReps / target, 1);
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" className="stroke-secondary" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className="stroke-primary transition-all duration-700"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold leading-none">{weeks}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
          {weeks === 1 ? "week" : "weeks"}
        </span>
        {state === "bent" && (
          <span className="text-[9px] text-warning font-medium">bent, not broken</span>
        )}
      </div>
    </div>
  );
}

// Fires once per session when we detect the user already has a squad friend —
// covers friends who joined via the user's own invite code (the accept path only
// marked the quest for the person entering a code).
let firstFriendMarked = false;

export default function Squad() {
  const { toast } = useToast();
  const { profile } = useFitCoach();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [dueling, setDueling] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  // "unsupported" | "unavailable" (server keys missing) | "off" | "on" | "blocked"
  const [pushState, setPushState] = useState<string>("unsupported");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
      try {
        const res = await fetch(`${apiBase()}/api/squad/push/public-key`, { credentials: "include" });
        const { enabled } = (await res.json()) as { enabled: boolean };
        if (!enabled) {
          setPushState("unavailable");
          return;
        }
        if (Notification.permission === "denied") {
          setPushState("blocked");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushState(sub ? "on" : "off");
      } catch {
        // A transient network failure is NOT "notifications unavailable" —
        // leave the enable button visible; tapping it retries and surfaces
        // any real error as a toast.
        setPushState("off");
      }
    })();
  }, []);

  const enablePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const res = await fetch(`${apiBase()}/api/squad/push/public-key`, { credentials: "include" });
      const { key } = (await res.json()) as { key: string | null };
      if (!key) {
        setPushState("unavailable");
        return;
      }
      const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
      const appKey = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      const json = sub.toJSON();
      await fetch(`${apiBase()}/api/squad/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });
      setPushState("on");
      toast({ title: "Notifications on", description: "Duels, Respect, and your Monday recap — max a few a week." });
    } catch {
      toast({ variant: "destructive", title: "Couldn't enable notifications", description: "Try again in a moment." });
    } finally {
      setPushBusy(false);
    }
  };

  const load = async () => {
    try {
      const res = await fetch(`${apiBase()}/api/squad/overview?day=${localDay()}`, { credentials: "include" });
      if (res.ok) {
        const ov = (await res.json()) as Overview;
        setData(ov);
        if (!firstFriendMarked && ov.friends.length > 0) {
          firstFriendMarked = true;
          void completeQuest("first_friend");
        }
      }
    } catch {
      /* keep last data */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const post = async (path: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${apiBase()}/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let error = "Something went wrong.";
        try {
          const j = (await res.json()) as { error?: string };
          if (j?.error) error = j.error;
        } catch {
          /* default */
        }
        return { ok: false, error };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error — try again." };
    }
  };

  const copyInvite = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(
        `Join my squad on ALLUR — use invite code ${data.inviteCode} in the Squad tab. https://allur-mauve.vercel.app`,
      );
      toast({ title: "Invite copied", description: "Send it to a friend." });
    } catch {
      toast({ title: `Your code: ${data.inviteCode}`, description: "Share it with a friend." });
    }
  };

  const acceptCode = async () => {
    if (!code.trim() || joining) return;
    setJoining(true);
    const r = await post("/squad/invite/accept", { code: code.trim() });
    setJoining(false);
    if (r.ok) {
      setCode("");
      void completeQuest("first_friend");
      toast({ title: "Squad up 👊", description: "You're now training together." });
      void load();
    } else {
      toast({ variant: "destructive", title: "Couldn't join", description: r.error });
    }
  };

  const sendRespect = async (friend: SquadFriend) => {
    if (friend.respectedToday) return;
    setData((d) =>
      d
        ? { ...d, friends: d.friends.map((f) => (f.id === friend.id ? { ...f, respectedToday: true } : f)) }
        : d,
    );
    const r = await post("/squad/respect", { friendId: friend.id, day: localDay() });
    if (!r.ok) toast({ variant: "destructive", title: "Couldn't send Respect", description: r.error });
  };

  const startDuel = async (friend: SquadFriend) => {
    if (dueling) return;
    setDueling(friend.id);
    const r = await post("/squad/duel", { friendId: friend.id });
    setDueling(null);
    if (r.ok) {
      toast({ title: "Duel on ⚔️", description: `7 days. Most Reps wins. ${friend.name} has been notified.` });
      void load();
    } else {
      toast({ variant: "destructive", title: "Couldn't start duel", description: r.error });
    }
  };

  const markRead = async () => {
    setShowNotifications((s) => !s);
    if (data && data.unreadCount > 0) {
      setData({ ...data, unreadCount: 0, notifications: data.notifications.map((n) => ({ ...n, read: true })) });
      await post("/squad/notifications/read", {});
    }
  };

  const leaderboard = useMemo(() => {
    if (!data) return [];
    const me = { id: "me", name: profile.name ? `${profile.name} (you)` : "You", weekReps: data.reps.week, respectedToday: true };
    return [...data.friends, me].sort((a, b) => b.weekReps - a.weekReps);
  }, [data, profile.name]);

  const nameOf = (id: string) => {
    if (!data) return "";
    const f = data.friends.find((x) => x.id === id);
    return f ? f.name : "You";
  };

  if (loading) {
    return (
      <MobileLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </MobileLayout>
    );
  }

  if (!data) {
    return (
      <MobileLayout>
        <div className="p-6 pt-10 text-center space-y-3">
          <Users className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Couldn't load your squad. Pull to refresh or try again shortly.</p>
        </div>
      </MobileLayout>
    );
  }

  const activeDuels = data.duels.filter((d) => d.status === "active");
  const finishedDuels = data.duels.filter((d) => d.status === "finished").slice(0, 3);

  return (
    <MobileLayout>
      <div className="p-6 space-y-6">
        <header className="pt-2 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" /> Squad
            </h1>
            <p className="text-muted-foreground">Train together. Compete on adherence.</p>
          </div>
          <button
            type="button"
            onClick={() => void markRead()}
            className="relative p-2 rounded-full bg-secondary/60 hover:bg-secondary transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {data.unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                {data.unreadCount}
              </span>
            )}
          </button>
        </header>

        {showNotifications && (
          <Card className="border-border bg-card/60">
            <CardContent className="p-4 space-y-3">
              {data.notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet — invite a friend to get things moving.</p>
              ) : (
                data.notifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {n.type === "respect" ? (
                        <HandMetal className="w-4 h-4 text-primary" />
                      ) : n.type.startsWith("duel") ? (
                        <Swords className="w-4 h-4 text-warning" />
                      ) : (
                        <Zap className="w-4 h-4 text-primary" />
                      )}
                    </span>
                    <p className={cn("leading-snug", n.read ? "text-muted-foreground" : "text-foreground")}>{n.body}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Momentum + weekly challenge */}
        <Card className="border-border bg-hero-gradient overflow-hidden">
          <CardContent className="p-5 flex items-center gap-5">
            <MomentumRing
              weeks={data.momentum.weeks}
              state={data.momentum.state}
              weekReps={data.soloChallenge.current}
              target={data.soloChallenge.target}
            />
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Momentum</p>
                <p className="text-sm text-foreground leading-snug">
                  {data.momentum.weeks === 0
                    ? "Your first week on plan starts now."
                    : data.momentum.state === "bent"
                      ? "Quiet week — the plan bent so this doesn't break."
                      : `${data.momentum.weeks} ${data.momentum.weeks === 1 ? "week" : "weeks"} on plan. Keep stacking.`}
                </p>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-primary" /> This week's challenge
                  </span>
                  <span className="font-semibold">
                    {data.soloChallenge.current}
                    <span className="text-muted-foreground font-normal">/{data.soloChallenge.target} Reps</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min((data.soloChallenge.current / data.soloChallenge.target) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {data.soloChallenge.done
                    ? `Done — +${data.soloChallenge.bonus} bonus Reps banked. 🏆`
                    : `Finish the week on plan → +${data.soloChallenge.bonus} bonus Reps.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active duels */}
        {activeDuels.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Swords className="w-5 h-5 text-warning" /> Active duels
            </h2>
            {activeDuels.map((d) => {
              const daysLeft = Math.max(0, Math.ceil((new Date(d.endAt).getTime() - Date.now()) / 86400000));
              const max = Math.max(d.challengerReps, d.opponentReps, 1);
              return (
                <Card key={d.id} className="border-warning/30 bg-card/60">
                  <CardContent className="p-4 space-y-2.5">
                    {[
                      { id: d.challengerId, reps: d.challengerReps },
                      { id: d.opponentId, reps: d.opponentReps },
                    ].map((side) => (
                      <div key={side.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{nameOf(side.id)}</span>
                          <span className="font-bold">{side.reps} Reps</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", side.reps >= max ? "bg-warning" : "bg-primary/60")}
                            style={{ width: `${(side.reps / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground">
                      {daysLeft} {daysLeft === 1 ? "day" : "days"} left · most Reps wins · +100 Reps to the winner
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}

        {/* Friends + weekly leaderboard */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" /> This week
          </h2>
          {data.friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 bg-secondary/40 rounded-2xl border border-dashed border-border text-center gap-1">
              <UserPlus className="w-7 h-7 text-muted-foreground" />
              <p className="text-sm font-medium">No squad yet</p>
              <p className="text-xs text-muted-foreground">
                Training with friends is the single biggest consistency boost. Send your code below.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((f, i) => (
                <div
                  key={f.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    f.id === "me" ? "border-primary/40 bg-primary/5" : "border-border bg-card/50",
                  )}
                >
                  <span className={cn("w-6 text-center font-bold", i === 0 ? "text-warning" : "text-muted-foreground")}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-sm">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">{f.weekReps} Reps this week</p>
                  </div>
                  {f.id !== "me" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void sendRespect(f as SquadFriend)}
                        disabled={f.respectedToday}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          f.respectedToday ? "text-primary" : "bg-secondary/60 hover:bg-secondary text-muted-foreground",
                        )}
                        aria-label={`Send Respect to ${f.name}`}
                      >
                        {f.respectedToday ? <CheckCircle2 className="w-4 h-4" /> : <HandMetal className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void startDuel(f as SquadFriend)}
                        disabled={dueling === f.id}
                        className="p-2 rounded-lg bg-secondary/60 hover:bg-secondary text-muted-foreground transition-colors"
                        aria-label={`Challenge ${f.name} to a duel`}
                      >
                        {dueling === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent results */}
        {finishedDuels.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Recent duels</h3>
            {finishedDuels.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm rounded-xl border border-border bg-card/40 p-3">
                <span className="truncate">
                  {nameOf(d.challengerId)} {d.challengerReps} — {d.opponentReps} {nameOf(d.opponentId)}
                </span>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {d.winnerId ? `${nameOf(d.winnerId)} won` : "Draw"}
                </span>
              </div>
            ))}
          </section>
        )}

        {/* Push notifications opt-in */}
        {(pushState === "off" || pushState === "blocked") && (
          <Card className="border-border bg-card/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-primary/15 shrink-0">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Duel updates & Monday recap</p>
                <p className="text-xs text-muted-foreground">
                  {pushState === "blocked"
                    ? "Notifications are blocked in your browser settings for this app."
                    : "Coach-voice only, a few per week. Never guilt."}
                </p>
              </div>
              {pushState === "off" && (
                <button
                  type="button"
                  onClick={() => void enablePush()}
                  disabled={pushBusy}
                  className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 shrink-0"
                >
                  {pushBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Turn on"}
                </button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invite */}
        <Card className="border-border bg-card/60">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-primary" /> Grow your squad
            </p>
            <button
              type="button"
              onClick={() => void copyInvite()}
              className="w-full flex items-center justify-between rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3"
            >
              <span className="font-mono font-bold tracking-widest">{data.inviteCode}</span>
              <span className="text-xs text-primary font-medium flex items-center gap-1">
                <Copy className="w-3.5 h-3.5" /> Copy invite
              </span>
            </button>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void acceptCode();
                }}
                placeholder="Have a friend's code?"
                className="h-9 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => void acceptCode()}
                disabled={joining || !code.trim()}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
              >
                {joining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Join"}
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="h-4" />
      </div>
    </MobileLayout>
  );
}
