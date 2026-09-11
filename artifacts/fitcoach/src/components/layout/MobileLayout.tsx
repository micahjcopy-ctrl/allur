import React from "react";
import { MessageCircle, ShieldCheck, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { BottomNav } from "./BottomNav";
import { StreakBar } from "@/components/StreakBar";
import { useFitCoach } from "@/context/FitCoachContext";

interface MobileLayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export function MobileLayout({ children, showNav = true }: MobileLayoutProps) {
  const { adminMode, exitAdminMode } = useFitCoach();
  const [location] = useLocation();
  // The floating Coach button is a shortcut TO the coach; on the coach screen
  // itself it only sits on top of the send button.
  const showCoachFab = showNav && location !== "/coach";

  return (
    <div className="allur-app min-h-[100dvh] pt-safe bg-background text-foreground flex flex-col mx-auto max-w-md w-full shadow-2xl overflow-hidden relative">
      {adminMode && (
        <div className="flex items-center justify-between gap-2 bg-primary/15 border-b border-primary/30 px-4 py-2 text-xs flex-shrink-0">
          <span className="flex items-center gap-1.5 font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin preview
          </span>
          <button
            onClick={exitAdminMode}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            Exit <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {showNav && <StreakBar />}
      <main className="flex-1 flex flex-col w-full h-full overflow-y-auto pb-safe">
        {children}
        {showNav && <div className="h-16 flex-shrink-0" />} {/* Spacer for bottom nav */}
      </main>
      {showCoachFab && (
        <Link
          href="/coach"
          aria-label="Coach"
          className="absolute bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 transition-transform active:scale-90"
        >
          <MessageCircle className="h-6 w-6" />
        </Link>
      )}
      {showNav && <BottomNav />}
    </div>
  );
}
