"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "today", label: "Bugun" },
  { value: "week", label: "Bu Hafta" },
  { value: "month", label: "Bu Ay" },
  { value: "last_month", label: "Gecen Ay" },
] as const;

type PeriodFilterProps = {
  activePeriod: string;
};

export function PeriodFilter({ activePeriod }: PeriodFilterProps) {
  return (
    <div className="flex gap-2">
      {PERIODS.map((p) => (
        <Link
          key={p.value}
          href={p.value === "today" ? "/" : `/?period=${p.value}`}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            activePeriod === p.value
              ? "bg-vw-deep text-white"
              : "bg-muted text-muted-foreground hover:bg-vw-side/30"
          )}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
