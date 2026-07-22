import React from "react";
import { Link, useLocation } from "wouter";
import {
  Dumbbell,
  Home,
  TrendingUp,
  User,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFitCoach } from "@/context/FitCoachContext";
import { isEnabled, type FeatureKey } from "@/lib/features";

interface NavItem {
  name: string;
  href: string;
  icon: typeof Home;
  /** When set, the item only renders while that feature is toggled on. */
  feature?: FeatureKey;
}

const ALL_ITEMS: NavItem[] = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Train", href: "/plan", icon: Dumbbell },
  { name: "Nutrition", href: "/macros", icon: UtensilsCrossed, feature: "macros" },
  { name: "Progress", href: "/progress", icon: TrendingUp, feature: "progress" },
  { name: "You", href: "/account", icon: User },
];

export function BottomNav() {
  const [location] = useLocation();
  const { featureToggles } = useFitCoach();

  const items = ALL_ITEMS.filter(
    (item) => !item.feature || isEnabled(featureToggles, item.feature),
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border pb-safe">
      <nav className="flex justify-around items-center h-16 px-2 max-w-md mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_6px_rgba(91,224,230,0.35)]")} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
