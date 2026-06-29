import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useResetPassword } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const ALLUR_LOGO = `${import.meta.env.BASE_URL}allur-logo.png`;

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: unknown })?.data;
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error: unknown }).error);
  }
  return fallback;
}

export default function ResetPassword() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const token =
    new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    ).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const resetMut = useResetPassword();

  const Logo = (
    <div className="flex flex-col items-center mb-8">
      <img src={ALLUR_LOGO} alt="ALLUR" className="w-44 select-none" draggable={false} />
      <p className="text-muted-foreground text-sm mt-2">Your AI transformation coach</p>
    </div>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", description: "Please re-enter them.", variant: "destructive" });
      return;
    }
    try {
      await resetMut.mutateAsync({ data: { token, password } });
      setDone(true);
    } catch (err) {
      toast({
        title: "Couldn't reset password",
        description: errorMessage(err, "This link may be invalid or expired."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-center px-6 py-10">
      {Logo}

      {!token ? (
        <div className="space-y-5 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">Invalid reset link</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              This link is missing its reset token. Request a new one from the sign-in screen.
            </p>
          </div>
          <Button type="button" className="w-full h-12 font-bold" onClick={() => setLocation("/auth?mode=login")}>
            Back to sign in
          </Button>
        </div>
      ) : done ? (
        <div className="space-y-5 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Password updated</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Your password has been changed. You can now sign in with your new password.
            </p>
          </div>
          <Button type="button" className="w-full h-12 font-bold" onClick={() => setLocation("/auth?mode=login")}>
            Sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-center mb-2">
            <h2 className="text-xl font-bold">Choose a new password</h2>
            <p className="text-sm text-muted-foreground">Make it at least 8 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-password">New password</Label>
            <Input id="rp-password" type="password" autoComplete="new-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-confirm">Confirm new password</Label>
            <Input id="rp-confirm" type="password" autoComplete="new-password" required value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter your password" />
          </div>
          <Button type="submit" className="w-full font-bold h-12" disabled={resetMut.isPending}>
            {resetMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset password"}
          </Button>
        </form>
      )}
    </div>
  );
}
