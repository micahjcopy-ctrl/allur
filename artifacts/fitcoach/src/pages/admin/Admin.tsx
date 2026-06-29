import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Loader2, LogOut, Users, Eye } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { useFitCoach } from "@/context/FitCoachContext";

type AdminCheck = "idle" | "checking" | "granted" | "denied";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { isLoading, isAuthenticated, logout } = useAuth();
  const { enterAdminMode } = useFitCoach();
  const [status, setStatus] = useState<AdminCheck>("idle");

  const login = () => {
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
    window.location.href = `/api/login?returnTo=${encodeURIComponent(`${base}/admin`)}`;
  };

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("checking");
    fetch("/api/admin/status", { credentials: "include" })
      .then((res) => res.json() as Promise<{ isAdmin: boolean }>)
      .then((data) => {
        if (cancelled) return;
        setStatus(data.isAdmin ? "granted" : "denied");
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });

    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated]);

  return (
    <div className="w-full min-h-screen max-w-md mx-auto flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full bg-secondary/30 border border-white/5 rounded-3xl p-8 flex flex-col items-center gap-5"
      >
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          {status === "granted" ? (
            <ShieldCheck className="h-8 w-8 text-primary" />
          ) : (
            <Lock className="h-8 w-8 text-primary" />
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold">Admin Access</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Restricted to the app owner and approved team members. View member
            accounts or preview every screen without completing onboarding.
          </p>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking session...
          </div>
        )}

        {!isLoading && !isAuthenticated && (
          <Button
            onClick={login}
            className="w-full rounded-full h-12 text-base font-semibold"
          >
            Unlock Admin Mode
          </Button>
        )}

        {!isLoading && isAuthenticated && status === "checking" && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying access...
          </div>
        )}

        {!isLoading && isAuthenticated && status === "granted" && (
          <div className="w-full flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2 text-primary text-sm font-medium">
              <ShieldCheck className="h-4 w-4" /> Access granted
            </div>
            <Button
              onClick={() => setLocation("/admin/users")}
              className="w-full rounded-full h-12 text-base font-semibold gap-2"
            >
              <Users className="h-4 w-4" /> Member Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                enterAdminMode();
                setLocation("/dashboard");
              }}
              className="w-full rounded-full h-11 gap-2"
            >
              <Eye className="h-4 w-4" /> Preview app as demo user
            </Button>
          </div>
        )}

        {!isLoading && isAuthenticated && status === "denied" && (
          <div className="w-full flex flex-col gap-3">
            <p className="text-destructive text-sm font-medium">
              This account doesn't have admin access.
            </p>
            <Button
              variant="outline"
              onClick={logout}
              className="w-full rounded-full h-11 gap-2"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        )}
      </motion.div>

      <button
        onClick={() => setLocation("/onboarding")}
        className="mt-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Back to app
      </button>
    </div>
  );
}
