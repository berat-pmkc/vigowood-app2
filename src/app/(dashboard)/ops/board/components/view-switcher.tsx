"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, List, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export type BoardView = "pano" | "liste" | "takvim";

const VIEWS = [
  { key: "pano" as const, label: "Pano", icon: LayoutGrid },
  { key: "liste" as const, label: "Liste", icon: List },
  { key: "takvim" as const, label: "Takvim", icon: CalendarDays },
];

interface ViewSwitcherProps {
  activeView: BoardView;
}

export function ViewSwitcher({ activeView }: ViewSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setView = (view: BoardView) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "pano") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex rounded-md border">
      {VIEWS.map((v, i) => {
        const Icon = v.icon;
        const isActive = activeView === v.key;
        return (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors",
              i === 0 && "rounded-l-md",
              i === VIEWS.length - 1 && "rounded-r-md",
              i > 0 && "border-l",
              isActive
                ? "bg-vw-primary text-vw-dark"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
