import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FitCoachProvider, useFitCoach } from "@/context/FitCoachContext";
import { AuthProvider, useAccount } from "@/context/AuthContext";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// Pages
import NotFound from "@/pages/not-found";
import Auth from "@/pages/auth/Auth";
import ResetPassword from "@/pages/auth/ResetPassword";
import Onboarding from "@/pages/onboarding/Onboarding";
import Dashboard from "@/pages/dashboard/Dashboard";
import Plan from "@/pages/plan/Plan";
import Progress from "@/pages/progress/Progress";
import Macros from "@/pages/macros/Macros";
import Coach from "@/pages/coach/Coach";
import Account from "@/pages/account/Account";
import Settings from "@/pages/settings/Settings";
import Session from "@/pages/session/Session";
import Admin from "@/pages/admin/Admin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Paywall from "@/pages/paywall/Paywall";
import GetApp from "@/pages/get/GetApp";
import Landing from "@/pages/landing/Landing";
import AppWelcome from "@/pages/welcome/AppWelcome";
import { isStandalone } from "@/hooks/usePwaInstall";
import Privacy from "@/pages/legal/Privacy";
import Terms from "@/pages/legal/Terms";
import About from "@/pages/legal/About";
import Disclaimer from "@/pages/legal/Disclaimer";
import Pricing from "@/pages/pricing/Pricing";
import InstallAppPrompt from "@/components/InstallAppPrompt";

const queryClient = new QueryClient();

function RouteGuard() {
  const [location, setLocation] = useLocation();
  const { onboardingComplete, subscription, subscriptionLoading } = useFitCoach();

  // DEV-only direct preview of the post-onboarding payment screen.
  const isPaywallPreview = import.meta.env.DEV && location === "/paywall";

  useEffect(() => {
    if (location.startsWith("/admin")) return;
    if (isPaywallPreview) return;
    if (location === "/" || location === "") {
      if (onboardingComplete) {
        setLocation("/dashboard");
      } else {
        setLocation("/onboarding");
      }
    } else if (!onboardingComplete && location !== "/onboarding") {
      setLocation("/onboarding");
    }
  }, [location, onboardingComplete, setLocation, isPaywallPreview]);

  // Preview-only: render the upfront payment screen directly so it can be
  // inspected without completing onboarding. Never reachable in production
  // (import.meta.env.DEV is false in the published build).
  if (isPaywallPreview) {
    return <Paywall />;
  }

  // Force brand-new users (finished onboarding, never subscribed) to start their
  // trial before entering the app. /account stays reachable so they can manage
  // billing / return from Stripe Checkout; lapsed users (hasEverSubscribed) get
  // limited free access instead of being re-gated.
  const isAdmin = location.startsWith("/admin");
  if (!isAdmin && location !== "/account" && onboardingComplete) {
    if (subscription === null) {
      if (subscriptionLoading) {
        return (
          <div className="w-full min-h-screen flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        );
      }
      // Subscription load failed — fail open; feature locks still protect.
    } else if (!subscription.hasEverSubscribed) {
      return <Paywall />;
    }
  }

  return (
    <Switch>
      <Route path="/admin" component={Admin} />
      <Route path="/admin/users" component={AdminDashboard} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/plan" component={Plan} />
      <Route path="/progress" component={Progress} />
      <Route path="/macros" component={Macros} />
      <Route path="/coach" component={Coach} />
      <Route path="/account" component={Account} />
      <Route path="/settings" component={Settings} />
      <Route path="/session/:id" component={Session} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate() {
  const { authUser, isLoading } = useAccount();
  const { hydrated, showInstallPrompt, setShowInstallPrompt } = useFitCoach();
  const [location, setLocation] = useLocation();
  // Installed PWA vs. browser tab — branches the signed-out entry experience.
  const standalone = isStandalone();

  useEffect(() => {
    if (location === "/admin") return;
    if (location === "/reset-password") return;
    if (location === "/get") return;
    if (location === "/privacy" || location === "/terms") return;
    if (location === "/about" || location === "/disclaimer") return;
    if (location === "/pricing") return;
    if (import.meta.env.DEV && location === "/paywall") return;
    if (isLoading) return;
    if (!authUser) {
      // Signed out. The installed PWA (standalone) must NOT show the marketing
      // website — it opens to a minimal app welcome screen (/welcome). The
      // browser shows the full marketing landing (/home). In both cases the auth
      // flow (/auth) and password reset (/reset-password) stay reachable.
      if (standalone) {
        if (
          location !== "/welcome" &&
          location !== "/auth" &&
          location !== "/reset-password"
        )
          setLocation("/welcome");
      } else if (
        location !== "/home" &&
        location !== "/auth" &&
        location !== "/reset-password"
      ) {
        setLocation("/home");
      }
    } else if (location === "/auth" || (standalone && location === "/home")) {
      // Signed in: no point showing the login/signup form — hand off to RouteGuard
      // (onboarding for new users, dashboard for returning). The marketing landing
      // (/home) stays viewable while signed in.
      setLocation("/");
    }
  }, [isLoading, authUser, location, setLocation, standalone]);

  if (location === "/admin") {
    return <Admin />;
  }

  // The password-reset screen is reachable from an emailed link regardless of
  // auth state (the token in the URL is the credential).
  if (location === "/reset-password") {
    return <ResetPassword />;
  }

  // The install / "get the app" page (with the downloadable QR code) is public —
  // it only explains how to install and routes into the normal sign-up funnel,
  // so it never grants access to paid features.
  if (location === "/get") {
    return <GetApp />;
  }

  // Public legal pages — reachable signed-in or signed-out (linked from the
  // landing footer and required for app-store / payment compliance).
  if (location === "/privacy") {
    return <Privacy />;
  }
  if (location === "/terms") {
    return <Terms />;
  }
  if (location === "/about") {
    return <About />;
  }
  if (location === "/disclaimer") {
    return <Disclaimer />;
  }
  if (location === "/pricing") {
    return <Pricing />;
  }

  // DEV-only: let the upfront payment screen be previewed directly, even when
  // signed out. Never reachable in the published build.
  if (import.meta.env.DEV && location === "/paywall") {
    return <Paywall />;
  }

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!authUser) {
    if (location === "/auth") return <Auth />;
    // Installed app gets the minimal welcome screen; the website gets the full
    // marketing landing page.
    return standalone ? <AppWelcome /> : <Landing />;
  }

  // Wait for the user's saved state to load before routing, so returning users
  // land on the dashboard instead of briefly flashing onboarding.
  if (!hydrated) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // The marketing landing stays viewable while signed in — but only in the
  // browser. The installed app never shows the website; it's already redirecting
  // /home → "/", so hold a spinner for that one render instead of flashing it.
  if (location === "/home") {
    return standalone ? (
      <div className="w-full min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    ) : (
      <Landing />
    );
  }

  // Signed in but still on the auth route: hold a spinner for the one render
  // before the redirect above lands, so we don't flash the NotFound route.
  if (location === "/auth") {
    return (
      <div className="w-full min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <InstallAppPrompt
        open={showInstallPrompt}
        onClose={() => setShowInstallPrompt(false)}
      />
      <RouteGuard />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <FitCoachProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <div className="dark bg-background text-foreground w-full min-h-screen flex justify-center">
                <AuthGate />
              </div>
            </WouterRouter>
          </FitCoachProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
