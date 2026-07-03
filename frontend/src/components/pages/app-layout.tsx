import { Link } from "@tanstack/react-router";
import {
  Layers,
  CloudSun,
  Satellite,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type NavKey = "fields" | "weather" | "field";

const items: { key: NavKey; icon: typeof Layers; to: string; label: string }[] = [
  { key: "field", icon: Satellite, to: "/field", label: "Field Detail" },
  { key: "fields", icon: Layers, to: "/fields", label: "Select Fields" },
  { key: "weather", icon: CloudSun, to: "/weather", label: "Historical Weather" },
];

export function AppLayout({
  active,
  children,
}: {
  active: NavKey;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground p-3 md:p-5">
      <div className="flex gap-3 md:gap-4 h-[calc(100vh-1.5rem)] md:h-[calc(100vh-2.5rem)]">
        {/* Left navbar */}
        <aside className="flex flex-col items-center justify-between rounded-2xl border border-border bg-card py-4 px-2 w-14 shrink-0">
          <button className="p-2 rounded-lg hover:bg-secondary text-primary" aria-label="Agroloop">
            <LeafOnWater />
          </button>
          <nav className="flex flex-col gap-2">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  className={cn(
                    "p-2.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              );
            })}
          </nav>
          <button className="p-1.5 rounded-full bg-secondary text-muted-foreground" aria-label="Profile">
            <User className="h-5 w-5" />
          </button>
        </aside>
        {/* Main */}
        <div className="flex-1 min-w-0 h-full">{children}</div>
      </div>
    </div>
  );
}

function LeafOnWater() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* leaf */}
      <path d="M5 13c0-5 4-9 9-9 2 0 4 .5 5 1-1 7-5 11-10 11-2 0-3-.5-4-1 0-1 .2-1.5 0-2z" fill="currentColor" fillOpacity="0.18" />
      <path d="M6 14c3-3 6-5 13-9" />
      {/* water waves */}
      <path d="M3 18c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3.5 0 2.3 1 3.5 0 2.3-1 3.5 0" />
      <path d="M3 21c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3.5 0 2.3 1 3.5 0 2.3-1 3.5 0" opacity="0.6" />
    </svg>
  );
}
