"use client";

import { cn } from "@/lib/utils";

interface StepProgressProps {
  current: number;
  total: number;
  className?: string;
}

export function StepProgress({ current, total, className }: StepProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            percentage === 100 ? "bg-emerald-500" : percentage > 0 ? "bg-blue-500" : "bg-muted"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">
        {current}/{total}
      </span>
    </div>
  );
}
