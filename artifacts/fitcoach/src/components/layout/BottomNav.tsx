import React from "react";
import { Link, useLocation } from "wouter";
import { Home, Dumbbell, TrendingUp, Mic, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const items = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Plan", href: "/plan", icon: Dumbbell },
    { name: "Progress", href: "/progress", icon: TrendingUp },
    { name: "Coach", href: "/coach", icon: Mic },
    { name: "Squad", href: "/squad", icon: Users },
    { name: "Account", href: "/account", icon: User },
  ];

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
