"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import type { PeriodType } from "../actions";
import type { SalesChannel } from "@/lib/sales-settings";
import { cn } from "@/lib/utils";

const QUICK_PERIODS: { value: PeriodType; label: string }[] = [
  { value: "today", label: "Bugün" },
  { value: "week", label: "Bu Hafta" },
  { value: "month", label: "Bu Ay" },
  { value: "all", label: "Tüm Zamanlar" },
];

// Son 12 ay + geçmiş ayları oluştur
function getMonthOptions(): { value: string; label: string; start: string; end: string }[] {
  const options: { value: string; label: string; start: string; end: string }[] = [];
  const now = new Date();

  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Son gün

    const label = format(d, "MMMM yyyy", { locale: tr });
    const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

    options.push({
      value: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: capitalizedLabel,
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
    });
  }

  return options;
}

interface PeriodFilterProps {
  currentPeriod: PeriodType;
  currentKanal: string;
  channels: SalesChannel[];
  customStart?: string;
  customEnd?: string;
}

export function PeriodFilter({
  currentPeriod,
  currentKanal,
  channels,
  customStart,
  customEnd,
}: PeriodFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    customStart && customEnd
      ? { from: new Date(customStart + "T00:00:00"), to: new Date(customEnd + "T00:00:00") }
      : undefined,
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const monthOptions = getMonthOptions();

  // Aktif ay seçimini belirle
  const activeMonth = currentPeriod === "custom" && customStart
    ? monthOptions.find((m) => m.start === customStart && m.end === customEnd)?.value
    : undefined;

  function navigate(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());

    // Kanal her zaman koru
    if (params.kanal !== undefined) {
      if (params.kanal && params.kanal !== "all" && params.kanal !== "tumu") {
        sp.set("kanal", params.kanal);
      } else {
        sp.delete("kanal");
      }
    }

    // Hızlı dönem seçimi
    if (params.period !== undefined && params.period !== "custom") {
      sp.set("period", params.period);
      sp.delete("start");
      sp.delete("end");
    }

    // Custom tarih seçimi
    if (params.period === "custom" && params.start && params.end) {
      sp.set("period", "custom");
      sp.set("start", params.start);
      sp.set("end", params.end);
    }

    router.push(`/satis?${sp.toString()}`);
  }

  function handleQuickPeriod(value: PeriodType) {
    setDateRange(undefined);
    navigate({ period: value });
  }

  function handleMonthSelect(monthValue: string) {
    const opt = monthOptions.find((m) => m.value === monthValue);
    if (!opt) return;
    setDateRange({ from: new Date(opt.start + "T00:00:00"), to: new Date(opt.end + "T00:00:00") });
    navigate({ period: "custom", start: opt.start, end: opt.end });
  }

  function handleDateRangeApply() {
    if (!dateRange?.from || !dateRange?.to) return;
    const startStr = format(dateRange.from, "yyyy-MM-dd");
    const endStr = format(dateRange.to, "yyyy-MM-dd");
    navigate({ period: "custom", start: startStr, end: endStr });
    setCalendarOpen(false);
  }

  // Tarih aralığı label'ı
  const dateRangeLabel =
    currentPeriod === "custom" && customStart && customEnd && !activeMonth
      ? `${format(new Date(customStart + "T00:00:00"), "dd MMM yyyy", { locale: tr })} — ${format(new Date(customEnd + "T00:00:00"), "dd MMM yyyy", { locale: tr })}`
      : null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Hızlı filtreler */}
      <div className="flex gap-1">
        {QUICK_PERIODS.map((opt) => (
          <Button
            key={opt.value}
            variant={currentPeriod === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => handleQuickPeriod(opt.value)}
            className="text-xs sm:text-sm"
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Ay seçici dropdown */}
        <Select
          value={activeMonth || "none"}
          onValueChange={(v) => {
            if (v !== "none") handleMonthSelect(v);
          }}
        >
          <SelectTrigger className={cn(
            "h-8 w-[170px] text-xs sm:text-sm",
            activeMonth && "border-primary ring-1 ring-primary/30",
          )}>
            <CalendarIcon className="mr-1 size-3.5 shrink-0 opacity-60" />
            <SelectValue placeholder="Ay Seçin" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled className="text-muted-foreground">
              Ay Seçin
            </SelectItem>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tarih aralığı seçici */}
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={dateRangeLabel ? "default" : "outline"}
              size="sm"
              className={cn(
                "text-xs sm:text-sm justify-start font-normal",
                dateRangeLabel ? "min-w-[220px]" : "w-auto",
              )}
            >
              <CalendarIcon className="mr-1 size-3.5 shrink-0" />
              {dateRangeLabel || "Tarih Aralığı"}
              <ChevronDown className="ml-auto size-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              defaultMonth={dateRange?.from || new Date()}
              disabled={{ after: new Date() }}
            />
            <div className="flex items-center justify-between border-t p-3">
              <p className="text-xs text-muted-foreground">
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, "dd.MM.yyyy")} — ${format(dateRange.to, "dd.MM.yyyy")}`
                  : "Başlangıç ve bitiş seçin"}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setDateRange(undefined);
                    setCalendarOpen(false);
                  }}
                >
                  Temizle
                </Button>
                <Button
                  size="sm"
                  className="text-xs"
                  disabled={!dateRange?.from || !dateRange?.to}
                  onClick={handleDateRangeApply}
                >
                  Uygula
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Kanal filtresi */}
        <Select
          value={currentKanal || "tumu"}
          onValueChange={(v) => navigate({ kanal: v })}
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
    </div>
  );
}
