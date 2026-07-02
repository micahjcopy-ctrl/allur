import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, UtensilsCrossed, Dumbbell, Camera, Users, Compass, ChevronRight, Trophy } from "lucide-react";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

// key must match the server QUEST_CATALOG keys.
const QUESTS = [
  { key: "tour_complete", label: "Take the tour", reps: 25, icon: Compass, href: null as string | null },
  { key: "first_meal", label: "Log your first meal", reps: 30, icon: UtensilsCrossed, href: "/macros" },
  { key: "first_workout", label: "Finish your first workout", reps: 50, icon: Dumbbell, href: "/plan" },
  { key: "first_scan", label: "Run a body-composition scan", reps: 40, icon: Camera, href: "/progress" },
  { key: "first_friend", label: "Add your first friend", reps: 25, icon: Users, href: "/squad" },
];

// Dashboard "Getting Started" checklist. Reads completed quests from the squad
// overview and hides itself once everything is done.
export function GettingStarted() {
  const [, setLocation] = useLocation();
  const [done, setDone] = useState<Set<string> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${apiBase()}/api/squad/overview`, { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { quests?: string[] };
          setDone(new Set(data.quests ?? []));
        } else {
          setDone(new Set());
        }
      } catch {
        setDone(new Set());
      }
    })();
  }, []);

  if (!done) return null;
  const completed = QUESTS.filter((q) => done.has(q.key)).length;
  if (completed === QUESTS.length) return null; // all done → hide

  const totalReps = QUESTS.reduce((s, q) => s + q.reps, 0);

  return (
    <Card className="border-primary/30 bg-primary/5 overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-primary" /> Getting started
            </p>
            <p className="text-xs text-muted-foreground">
              Finish these to learn the app and earn {totalReps} Reps.
            </p>
          </div>
          <span className="text-sm font-bold text-primary">{completed}/{QUESTS.length}</span>
        </div>

        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(completed / QUESTS.length) * 100}%` }}
          />
        </div>

        <div className="space-y-1.5">
          {QUESTS.map((q) => {
            const isDone = done.has(q.key);
            const Icon = q.icon;
            return (
              <button
                key={q.key}
                type="button"
                disabled={isDone || !q.href}
                onClick={() => q.href && setLocation(q.href)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                  isDone ? "opacity-60" : "hover:bg-secondary/60",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                )}
                <Icon className={cn("w-4 h-4 shrink-0", isDone ? "text-muted-foreground" : "text-primary")} />
                <span className={cn("flex-1 text-sm", isDone && "line-through")}>{q.label}</span>
                <span className="text-[11px] font-semibold text-primary shrink-0">+{q.reps}</span>
                {!isDone && q.href && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
