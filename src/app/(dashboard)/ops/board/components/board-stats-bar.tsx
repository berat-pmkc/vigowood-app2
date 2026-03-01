"use client";

import { ListChecks, Clock, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardStats } from "../../actions";

export type QuickFilter = "all" | "overdue" | "blocked" | "due_today";

interface BoardStatsBarProps {
  stats: BoardStats;
  activeFilter: QuickFilter;
  onFilterChange: (f: QuickFilter) => void;
}

const ITEMS: {
  key: QuickFilter;
  label: string;
  icon: typeof ListChecks;
  color: string;
  activeBg: string;
}[] = [
  { key: "all", label: "Açık", icon: ListChecks, color: "text-blue-600", activeBg: "bg-blue-50 border-blue-200" },
  { key: "due_today", label: "Bugün", icon: Clock, color: "text-amber-600", activeBg: "bg-amber-50 border-amber-200" },
  { key: "overdue", label: "Geciken", icon: AlertTriangle, color: "text-red-600", activeBg: "bg-red-50 border-red-200" },
  { key: "blocked", label: "Engelli", icon: ShieldAlert, color: "text-red-600", activeBg: "bg-red-50 border-red-200" },
];

function getStatValue(stats: BoardStats, key: QuickFilter): number {
  switch (key) {
    case "all": return stats.openCount;
    case "due_today": return stats.dueTodayCount;
    case "overdue": return stats.overdueCount;
    case "blocked": return stats.blockedCount;
  }
}

export function BoardStatsBar({ stats, activeFilter, onFilterChange }: BoardStatsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const value = getStatValue(stats, item.key);
        const isActive = activeFilter === item.key;
        const hasIssue = item.key !== "all" && value > 0;

        return (
          <button
            key={item.key}
            onClick={() => onFilterChange(isActive && item.key !== "all" ? "all" : item.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              isActive
                ? item.activeBg
                : "border-border hover:bg-muted",
              isActive && item.color
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{item.label}</span>
            <span
              className={cn(
                "font-bold tabular-nums",
                !isActive && hasIssue && item.color
              )}
            >
              {value}
            </span>
          </button>
        );
      })}
    </div>
  );
}
