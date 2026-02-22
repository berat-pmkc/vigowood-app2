"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PeriodType } from "../actions";
import type { SalesChannel } from "@/lib/sales-settings";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "today", label: "Bugün" },
  { value: "week", label: "Bu Hafta" },
  { value: "month", label: "Bu Ay" },
  { value: "all", label: "Tüm Zamanlar" },
];

interface PeriodFilterProps {
  currentPeriod: PeriodType;
  currentKanal: string;
  channels: SalesChannel[];
}

export function PeriodFilter({
  currentPeriod,
  currentKanal,
  channels,
}: PeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all" && value !== "tumu") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/satis?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1">
        {PERIOD_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={currentPeriod === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => updateParam("period", opt.value)}
            className="text-xs sm:text-sm"
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <Select
        value={currentKanal || "tumu"}
        onValueChange={(v) => updateParam("kanal", v)}
      >
        <SelectTrigger className="h-8 w-[160px] text-xs sm:text-sm">
          <SelectValue placeholder="Tüm Kanallar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tumu">Tüm Kanallar</SelectItem>
          {channels.map((ch) => (
            <SelectItem key={ch.id} value={ch.id}>
              {ch.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
