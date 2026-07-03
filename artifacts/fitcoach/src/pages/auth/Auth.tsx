import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useRegisterAccount,
  useLoginAccount,
  useRequestPasswordReset,
} from "@workspace/api-client-react";
import { useAccount } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { offerToSaveCredential } from "@/lib/credentials";

const ALLUR_LOGO = `${import.meta.env.BASE_URL}allur-logo.png`;

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: unknown })?.data;
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error: unknown }).error);
  }
  return fallback;
}

type View = "signup" | "login" | "forgot";

export default function Auth() {
  const { toast } = useToast();
  const { refreshAuth, setAuthUser } = useAccount();
  const [, setLocation] = useLocation();
  const initialView: View =
    new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    ).get("mode") === "login"
      ? "login"
      : "signup";
  const [view, setView] = useState<View>(initialView);

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const registerMut = useRegisterAccount();
  const loginMut = useLoginAccount();
  const forgotMut = useRequestPasswordReset();
  const busy = registerMut.isPending || loginMut.isPending;

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await forgotMut.mutateAsync({ data: { email: forgotEmail.trim() } });
      setForgotSent(true);
    } catch (err) {
      toast({
        title: "Couldn't send reset email",
        description: errorMessage(err, "Please try again in a moment."),
        variant: "destructive",
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length < 3) {
      toast({ title: "Username too short", description: "Use at least 3 characters.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    try {
      const envelope = await registerMut.mutateAsync({
        data: { email: email.trim(), username: username.trim(), password },
      });
      // Seed the auth cache synchronously so `authUser` is non-null before we
      // navigate — otherwise the signed-out guard can bounce the brand-new user
      // to the marketing page before the auth query refetch lands.
      setAuthUser(envelope);
      // Offer to save the new login to the browser / OS password manager (native
      // "Save password?" prompt). Best-effort — never blocks the flow.
      await offerToSaveCredential(email.trim(), password, username.trim());
      await refreshAuth();
      toast({ title: "Welcome to ALLUR", description: "Your account is ready." });
      // A brand-new account always needs onboarding — go straight there.
      setLocation("/onboarding");
    } catch (err) {
      toast({ title: "Sign up failed", description: errorMessage(err, "Please try again."), variant: "destructive" });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const envelope = await loginMut.mutateAsync({
        data: { identifier: identifier.trim(), password: loginPassword },
      });
      // Seed the auth cache synchronously (see signup) so the RouteGuard can
      // route to dashboard/onboarding without a marketing-page bounce.
      setAuthUser(envelope);
      await offerToSaveCredential(identifier.trim(), loginPassword);
      await refreshAuth();
      toast({ title: "Welcome back" });
      setLocation("/");
    } catch (err) {
      toast({ title: "Login failed", description: errorMessage(err, "Check your details and try again."), variant: "destructive" });
    }
  };

  const Logo = (
    <div className="flex flex-col items-center">
      <img src={ALLUR_LOGO} alt="ALLUR" className="w-44 select-none" draggable={false} />
      <p className="text-muted-foreground text-sm mt-2">Your AI transformation coach</p>
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-center px-6 py-10">
      <button
        onClick={() => setLocation("/home")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 self-start"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="mb-8">{Logo}</div>

      {view === "signup" ? (
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1 text-center mb-2">
            <h2 className="text-xl font-bold">Create your account</h2>
            <p className="text-sm text-muted-foreground">Let's get you set up.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="su-email">Email</Label>
            <Input id="su-email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="su-username">Username</Label>
            <Input id="su-username" autoComplete="username" required value={username}
              onChange={(e) => setUsername(e.target.value)} placeholder="yourhandle" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="su-password">Password</Label>
            <Input id="su-password" type="password" autoComplete="new-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <Button type="submit" className="w-full font-bold h-12" disabled={busy}>
            {registerMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button type="button" onClick={() => setView("login")} className="text-primary font-medium hover:underline">
              Sign in
            </button>
          </p>
        </form>
      ) : view === "login" ? (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1 text-center mb-2">
            <h2 className="text-xl font-bold">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to continue.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="li-id">Email or Username</Label>
            <Input id="li-id" autoComplete="username" required value={identifier}
              onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="li-password">Password</Label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(identifier.includes("@") ? identifier.trim() : "");
                  setForgotSent(false);
                  setView("forgot");
                }}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <Input id="li-password" type="password" autoComplete="current-password" required value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)} placeholder="Your password" />
          </div>
          <Button type="submit" className="w-full font-bold h-12" disabled={busy}>
            {loginMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log In"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <button type="button" onClick={() => setView("signup")} className="text-primary font-medium hover:underline">
              Get started
            </button>
          </p>
        </form>
      ) : view === "forgot" ? (
        forgotSent ? (
          <div className="space-y-5 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <MailCheck className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Check your email</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                If an account exists for{" "}
                <span className="font-medium text-foreground">{forgotEmail.trim()}</span>, we've
                sent a link to reset your password. It expires in 1 hour.
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Don't see it? Check your spam or promotions folder, and make sure you entered the
                same email you signed up with.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full h-12"
              onClick={() => setView("login")}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="space-y-1 text-center mb-2">
              <h2 className="text-xl font-bold">Reset your password</h2>
              <p className="text-sm text-muted-foreground">
                Enter your account email and we'll send you a reset link.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fp-email">Email</Label>
              <Input id="fp-email" type="email" autoComplete="email" required value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <Button type="submit" className="w-full font-bold h-12" disabled={forgotMut.isPending}>
              {forgotMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send reset link"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Remembered it?{" "}
              <button type="button" onClick={() => setView("login")} className="text-primary font-medium hover:underline">
                Back to sign in
              </button>
            </p>
          </form>
        )
      ) : null}
    </div>
  );
}
