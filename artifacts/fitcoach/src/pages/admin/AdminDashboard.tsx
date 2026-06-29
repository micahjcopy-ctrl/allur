import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Search,
  ShieldCheck,
  Users,
  Dumbbell,
  Camera,
  Trophy,
  Scale,
  Coins,
  Save,
  Mail,
} from "lucide-react";
import {
  useListAdminUsers,
  useGetAdminUserDetail,
  useUpdateAdminUser,
  useSendUserReminder,
  getListAdminUsersQueryKey,
  getGetAdminUserDetailQueryKey,
  type AdminUserSummary,
  type UpdateAdminUserRequestGoal,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const GOALS = ["Weight Loss", "Muscle Gain", "Strength", "Athleticism"] as const;
const NO_GOAL = "__none__";

function fmtDate(value: string | Date | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeTime(value: string | Date | null): string {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Never";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(value);
}

function displayName(u: AdminUserSummary): string {
  return u.name || u.username || u.email || "Unnamed user";
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-secondary/40 py-2.5">
      <div className="text-primary">{icon}</div>
      <div className="text-sm font-semibold leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Re-verify admin server-side; non-admins are bounced back to the gate.
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLocation("/admin");
      return;
    }
    let cancelled = false;
    fetch("/api/admin/status", { credentials: "include" })
      .then((res) => res.json() as Promise<{ isAdmin: boolean }>)
      .then((data) => {
        if (!cancelled && !data.isAdmin) setLocation("/admin");
      })
      .catch(() => {
        if (!cancelled) setLocation("/admin");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, setLocation]);

  const { data, isLoading, isError } = useListAdminUsers({
    query: { queryKey: getListAdminUsersQueryKey() },
  });

  const users = data?.users ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.username, u.email, u.goal]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [users, query]);

  const activeMembers = useMemo(
    () => filtered.filter((u) => u.onboardingComplete),
    [filtered],
  );
  const incompleteMembers = useMemo(
    () => filtered.filter((u) => !u.onboardingComplete),
    [filtered],
  );

  return (
    <div className="w-full min-h-screen max-w-md mx-auto px-5 pb-16 pt-8">
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => setLocation("/admin")}
          className="h-9 w-9 rounded-full bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Members</h1>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-5 ml-12">
        {isLoading ? "Loading…" : `${users.length} registered`}
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, or goal"
          className="pl-9 rounded-full bg-secondary/30 border-white/5 h-11"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {isError && (
        <div className="text-center py-20 text-destructive text-sm">
          Couldn't load members. Try refreshing.
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <Users className="h-8 w-8" />
          <p className="text-sm">No members found.</p>
        </div>
      )}

      {!isLoading && !isError && activeMembers.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Active members · {activeMembers.length}
          </h2>
          <div className="flex flex-col gap-3">
            {activeMembers.map((u, i) => (
              <MemberCard key={u.id} u={u} index={i} onSelect={setSelectedId} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && !isError && incompleteMembers.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-400/90 mb-2">
            Onboarding not complete · {incompleteMembers.length}
          </h2>
          <div className="flex flex-col gap-3">
            {incompleteMembers.map((u, i) => (
              <MemberCard key={u.id} u={u} index={i} onSelect={setSelectedId} />
            ))}
          </div>
        </section>
      )}

      <UserDetailDialog
        userId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function MemberCard({
  u,
  index,
  onSelect,
}: {
  u: AdminUserSummary;
  index: number;
  onSelect: (id: string) => void;
}) {
  const { toast } = useToast();
  const remind = useSendUserReminder();

  const sendReminder = () => {
    remind.mutate(
      { userId: u.id },
      {
        onSuccess: (res) => {
          toast({
            title: "Reminder sent",
            description: `Emailed ${res.sentTo}.`,
          });
        },
        onError: () => {
          toast({
            title: "Couldn't send reminder",
            description: "Check the email connection and try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      onClick={() => onSelect(u.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(u.id);
        }
      }}
      className="cursor-pointer text-left rounded-2xl bg-secondary/30 border border-white/5 p-4 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{displayName(u)}</div>
          <div className="text-xs text-muted-foreground truncate">
            {u.email ?? u.username ?? "—"}
          </div>
        </div>
        {u.goal ? (
          <Badge
            variant="secondary"
            className="shrink-0 bg-primary/15 text-primary border-0"
          >
            {u.goal}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 text-muted-foreground">
            No goal
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Dumbbell className="h-3.5 w-3.5" />
          {u.planDays > 0 ? `${u.planDays}-day plan` : "No plan"}
        </span>
        <span className="flex items-center gap-1">
          <Camera className="h-3.5 w-3.5" />
          {u.photoCount}
        </span>
        <span className="flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5" />
          {u.prCount}
        </span>
        <span className="ml-auto">Active {relativeTime(u.lastActive)}</span>
      </div>

      {/* One-tap nudge for members who never finished onboarding. Only shown
          when we have an email to send to. stopPropagation keeps the card's
          open-detail click from firing. */}
      {!u.onboardingComplete && u.email && (
        <Button
          variant="outline"
          size="sm"
          disabled={remind.isPending}
          onClick={(e) => {
            e.stopPropagation();
            sendReminder();
          }}
          className="mt-3 w-full gap-2 rounded-full border-amber-400/30 text-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
        >
          {remind.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="h-3.5 w-3.5" />
          )}
          Send reminder
        </Button>
      )}
    </motion.div>
  );
}

function UserDetailDialog({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        {userId && <UserDetailBody userId={userId} />}
      </DialogContent>
    </Dialog>
  );
}

function UserDetailBody({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError } = useGetAdminUserDetail(userId, {
    query: { queryKey: getGetAdminUserDetailQueryKey(userId) },
  });

  const [coaching, setCoaching] = useState("");
  const [photo, setPhoto] = useState("");
  const [bodyScan, setBodyScan] = useState("");
  const [goal, setGoal] = useState<string>(NO_GOAL);

  const detail = data?.user;
  const summary = detail?.summary;

  // Seed the editable fields once the detail loads.
  useEffect(() => {
    if (!summary) return;
    setCoaching(String(summary.credits?.coaching ?? ""));
    setPhoto(String(summary.credits?.photo ?? ""));
    setBodyScan(String(summary.credits?.bodyScan ?? ""));
    setGoal(summary.goal ?? NO_GOAL);
  }, [summary]);

  const mutation = useUpdateAdminUser();

  const hasState = !!summary?.credits || (summary?.onboardingComplete ?? false);

  const save = () => {
    if (!summary) return;
    const toInt = (v: string, fallback: number) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    mutation.mutate(
      {
        userId,
        data: {
          credits: summary.credits
            ? {
                coaching: toInt(coaching, summary.credits.coaching),
                photo: toInt(photo, summary.credits.photo),
                bodyScan: toInt(bodyScan, summary.credits.bodyScan),
              }
            : undefined,
          goal: goal === NO_GOAL ? null : (goal as UpdateAdminUserRequestGoal),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetAdminUserDetailQueryKey(userId),
          });
          queryClient.invalidateQueries({
            queryKey: getListAdminUsersQueryKey(),
          });
          toast({ title: "Saved", description: "Member updated." });
        },
        onError: () => {
          toast({
            title: "Couldn't save",
            description: "Something went wrong. Try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !detail || !summary) {
    return (
      <div className="py-12 text-center text-sm text-destructive">
        Couldn't load this member.
      </div>
    );
  }

  const plan = detail.plan as Array<{
    title?: string;
    dayName?: string;
    exercises?: unknown[];
  }>;
  const prs = detail.prs as Array<{ exercise?: string; weight?: string; reps?: string }>;
  const weightLogs = detail.weightLogs as Array<{ weight?: number; date?: string }>;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {displayName(summary)}
        </DialogTitle>
        <DialogDescription>
          {summary.email ?? summary.username ?? "—"} · Joined{" "}
          {fmtDate(summary.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-4 gap-2 mt-2">
        <Stat
          icon={<Dumbbell className="h-4 w-4" />}
          value={summary.planDays}
          label="Plan days"
        />
        <Stat
          icon={<Camera className="h-4 w-4" />}
          value={summary.photoCount}
          label="Photos"
        />
        <Stat
          icon={<Trophy className="h-4 w-4" />}
          value={summary.prCount}
          label="PRs"
        />
        <Stat
          icon={<Scale className="h-4 w-4" />}
          value={summary.latestWeight ?? "—"}
          label="Weight"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary" className="bg-secondary/60 border-0">
          Last active {relativeTime(summary.lastActive)}
        </Badge>
        {summary.bodyFat != null && (
          <Badge variant="secondary" className="bg-secondary/60 border-0">
            Body fat ~{summary.bodyFat}%
          </Badge>
        )}
        {!summary.onboardingComplete && (
          <Badge variant="outline" className="text-amber-400 border-amber-400/40">
            Onboarding incomplete
          </Badge>
        )}
      </div>

      {/* Edit panel */}
      <div className="mt-5 rounded-2xl border border-white/5 bg-secondary/20 p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <Coins className="h-4 w-4 text-primary" /> Edit member
        </div>

        <label className="text-xs text-muted-foreground">Goal</label>
        <Select value={goal} onValueChange={setGoal}>
          <SelectTrigger className="mt-1 mb-3 rounded-xl bg-background/60">
            <SelectValue placeholder="Select goal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_GOAL}>No goal</SelectItem>
            {GOALS.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {summary.credits ? (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Coaching</label>
              <Input
                type="number"
                min={0}
                value={coaching}
                onChange={(e) => setCoaching(e.target.value)}
                className="mt-1 rounded-xl bg-background/60"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Photo</label>
              <Input
                type="number"
                min={0}
                value={photo}
                onChange={(e) => setPhoto(e.target.value)}
                className="mt-1 rounded-xl bg-background/60"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Body scan</label>
              <Input
                type="number"
                min={0}
                value={bodyScan}
                onChange={(e) => setBodyScan(e.target.value)}
                className="mt-1 rounded-xl bg-background/60"
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            This member has no saved credit balance yet.
          </p>
        )}

        <Button
          onClick={save}
          disabled={mutation.isPending || !hasState}
          className="w-full mt-4 rounded-full gap-2"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save changes
        </Button>
      </div>

      {/* Plan */}
      {plan.length > 0 && (
        <div className="mt-5">
          <div className="text-sm font-semibold mb-2">Training plan</div>
          <div className="flex flex-col gap-1.5">
            {plan.map((day, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-sm"
              >
                <span className="truncate">
                  {day.title || day.dayName || `Day ${i + 1}`}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {Array.isArray(day.exercises) ? day.exercises.length : 0} ex
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRs */}
      {prs.length > 0 && (
        <div className="mt-5">
          <div className="text-sm font-semibold mb-2">Personal records</div>
          <div className="flex flex-col gap-1.5">
            {prs.slice(0, 8).map((pr, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-sm"
              >
                <span className="truncate">{pr.exercise || "—"}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {pr.weight} × {pr.reps}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weight history */}
      {weightLogs.length > 0 && (
        <div className="mt-5">
          <div className="text-sm font-semibold mb-2">Recent weight logs</div>
          <div className="flex flex-col gap-1.5">
            {[...weightLogs]
              .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
              .slice(0, 5)
              .map((w, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-sm"
                >
                  <span>{fmtDate(w.date ?? null)}</span>
                  <span className="text-xs text-muted-foreground">
                    {w.weight}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
