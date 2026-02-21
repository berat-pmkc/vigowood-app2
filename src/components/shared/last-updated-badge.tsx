"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface LastUpdatedBadgeProps {
  lastUpdated: Date | null;
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "az once";
  if (seconds < 60) return `${seconds}sn once`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}dk once`;
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export function LastUpdatedBadge({ lastUpdated }: LastUpdatedBadgeProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  if (!lastUpdated) return null;

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-vw-success/10 px-2.5 py-1 text-xs text-vw-success">
      <RefreshCw className="size-3 animate-spin" style={{ animationDuration: "3s" }} />
      {formatRelativeTime(lastUpdated)}
    </span>
  );
}
