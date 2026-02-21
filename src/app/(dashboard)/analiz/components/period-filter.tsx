"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PeriodType } from "../actions";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "today", label: "Bugün" },
  { value: "week", label: "Bu Hafta" },
  { value: "month", label: "Bu Ay" },
  { value: "all", label: "Tüm Zamanlar" },
];

interface PeriodFilterProps {
  currentPeriod: PeriodType;
}

export function PeriodFilter({ currentPeriod }: PeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updatePeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "month") {
      params.set("period", value);
    } else {
      params.delete("period");
    }
    router.push(`/analiz?${params.toString()}`);
  }

  return (
    <div className="flex gap-1">
      {PERIOD_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={currentPeriod === opt.value ? "default" : "outline"}
          size="sm"
          onClick={() => updatePeriod(opt.value)}
          className="text-xs sm:text-sm"
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
