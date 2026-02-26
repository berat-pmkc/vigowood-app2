"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Kanban, FileText, RefreshCw } from "lucide-react";

const TABS = [
  { key: "gorevler", label: "Görevler", icon: Kanban },
  { key: "sablonlar", label: "Şablonlar", icon: FileText },
  { key: "tekrar-eden", label: "Tekrar Eden", icon: RefreshCw },
] as const;

interface BoardTabsProps {
  activeTab: string;
}

export function BoardTabs({ activeTab }: BoardTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.key === "gorevler" ? "/ops/board" : `/ops/board?tab=${tab.key}`}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-vw-dark shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
