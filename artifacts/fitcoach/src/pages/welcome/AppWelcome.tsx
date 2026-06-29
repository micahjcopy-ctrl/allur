import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const ALLUR_LOGO = `${import.meta.env.BASE_URL}allur-logo.png`;

/**
 * Minimal branded entry screen shown ONLY when the app is launched as an
 * installed PWA (standalone) and the user is signed out. Unlike the marketing
 * landing (`/home`, browser-only), this is a native-app-style splash: just the
 * logo and the two actions a returning installer needs — log in (they created
 * their account on the website before installing) or get started.
 */
export default function AppWelcome() {
  const [, setLocation] = useLocation();

  return (
    <div className="w-full max-w-md mx-auto min-h-screen flex flex-col justify-between px-6 py-12">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <img
          src={ALLUR_LOGO}
          alt="ALLUR"
          className="w-52 select-none"
          draggable={false}
        />
        <p className="text-muted-foreground text-base mt-3">
          Your AI transformation coach
        </p>
      </div>

      <div className="space-y-3">
        <Button
          className="w-full h-12 text-base font-bold"
          onClick={() => setLocation("/auth?mode=login")}
        >
          Log In
        </Button>
        <Button
          variant="outline"
          className="w-full h-12 text-base font-semibold"
          onClick={() => setLocation("/auth?mode=signup")}
        >
          Get Started
        </Button>
        <p className="text-center text-xs text-muted-foreground pt-2">
          Strong. Modern. Refined.
        </p>
      </div>
    </div>
  );
}
