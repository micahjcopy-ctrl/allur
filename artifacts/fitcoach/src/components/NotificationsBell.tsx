import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFitCoach, type NotificationPrefs } from "@/context/FitCoachContext";
import { usePush } from "@/hooks/usePush";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isStandalone } from "@/hooks/usePwaInstall";
import { Bell, BellRing, Dumbbell, UtensilsCrossed, Camera, Users, Loader2, Check } from "lucide-react";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

interface FeedNotification {
  id: string;
  type: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export const REMINDER_OPTIONS: {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  icon: typeof Dumbbell;
}[] = [
  { key: "workouts", label: "Workout days", description: "A nudge on days you're scheduled to train.", icon: Dumbbell },
  { key: "meals", label: "Meal logging", description: "Reminders to snap your meals and hit your macros.", icon: UtensilsCrossed },
  { key: "progress", label: "Weekly progress", description: "Weekly photo + physique scan check-ins.", icon: Camera },
  { key: "squad", label: "Squad & recap", description: "Duels, Respect, and your Monday week recap.", icon: Users },
];

/** The four reminder toggles — shared by onboarding and the bell sheet. */
export function ReminderPrefToggles({ compact = false }: { compact?: boolean }) {
  const { notificationPrefs, setNotificationPrefs } = useFitCoach();
  return (
    <div className="space-y-2">
      {REMINDER_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const on = notificationPrefs[opt.key];
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setNotificationPrefs({ ...notificationPrefs, [opt.key]: !on })}
            className={cn(
              "w-full flex items-center gap-3 rounded-2xl border px-4 text-left transition-colors",
              compact ? "py-2.5" : "py-3",
              on ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30",
            )}
          >
            <Icon className={cn("w-4 h-4 shrink-0", on ? "text-primary" : "text-muted-foreground")} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{opt.label}</p>
              {!compact && <p className="text-xs text-muted-foreground">{opt.description}</p>}
            </div>
            <span
              className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center shrink-0",
                on ? "bg-primary border-primary" : "border-border",
              )}
            >
              {on && <Check className="w-3 h-3 text-primary-foreground" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Bell on the home screen: unread badge, the notification feed, and the place
 * to flip push notifications on at any time (even if they said no during
 * onboarding).
 */
export function NotificationsBell() {
  const { toast } = useToast();
  const push = usePush();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FeedNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadFeed = async (markRead: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/api/squad/overview`, { credentials: "include" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { notifications: FeedNotification[]; unreadCount: number };
      setItems(data.notifications);
      setUnread(data.unreadCount);
      if (markRead && data.unreadCount > 0) {
        setUnread(0);
        void fetch(`${apiBase()}/api/squad/notifications/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: "{}",
        });
      }
    } catch {
      if (items === null) setItems([]); // show empty state rather than spinner forever
    } finally {
      setLoading(false);
    }
  };

  // Badge count on mount (quietly; failures just mean no badge).
  useEffect(() => {
    void loadFeed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSheet = () => {
    setOpen(true);
    void loadFeed(true);
  };

  const enablePush = async () => {
    try {
      const result = await push.enable();
      if (result === "on") {
        toast({ title: "Notifications on", description: "You'll only hear from us about what you've picked below." });
      } else if (result === "blocked") {
        toast({
          variant: "destructive",
          title: "Notifications blocked",
          description: "Enable them for ALLUR in your device settings, then try again.",
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't enable notifications",
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label="Notifications"
        className="relative w-12 h-12 bg-secondary rounded-full flex items-center justify-center border border-border"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-[92%] rounded-3xl border-border bg-card max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-primary" /> Notifications
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Enable / status */}
            {push.state === "on" ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-success" /> Push notifications are on for this device.
              </p>
            ) : push.state === "unsupported" ? (
              <div className="rounded-2xl bg-secondary/40 border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {isStandalone()
                    ? "This device doesn't support push notifications."
                    : "Notifications work in the installed app — add ALLUR to your home screen, then enable them here."}
                </p>
              </div>
            ) : push.state === "blocked" ? (
              <div className="rounded-2xl bg-secondary/40 border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Notifications are blocked at the device level. Allow them for ALLUR in your phone's settings, then reopen this panel.
                </p>
              </div>
            ) : push.state === "unavailable" ? (
              <p className="text-xs text-muted-foreground">Notifications aren't available right now.</p>
            ) : (
              <button
                type="button"
                onClick={() => void enablePush()}
                disabled={push.busy}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {push.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                Turn on notifications
              </button>
            )}

            {/* Reminder preferences */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remind me about</p>
              <ReminderPrefToggles compact />
            </div>

            {/* Feed */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
              {loading && items === null ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : !items || items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nothing yet — your duels, Respect, and weekly recaps will land here.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "rounded-2xl border px-4 py-3",
                        n.read ? "border-border bg-secondary/20" : "border-primary/30 bg-primary/5",
                      )}
                    >
                      <p className="text-sm leading-snug">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
