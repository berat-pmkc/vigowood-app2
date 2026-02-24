"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, CalendarIcon } from "lucide-react";
import { cn, getDaysInMonthGrid, formatCurrency, getWeekRange } from "@/lib/utils";
import {
  ODEME_DURUM_COLORS,
  ODEME_TURLERI,
  ODEME_TURU_COLORS,
  ODEME_TURU_LABELS,
  type OdemeDurumuConst,
  type OdemeTuruConst,
} from "@/lib/constants";
import { OdemeTuruBadge } from "./odeme-turu-badge";
import { CalendarDayCell } from "./calendar-day-cell";
import type { Odeme } from "@/lib/supabase/types";

const GUN_ISIMLERI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const AY_ISIMLERI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

type ViewMode = "ay" | "hafta";

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  if (value > 0) return value.toFixed(0);
  return "-";
}

interface OdemelerCalendarViewProps {
  calendarData: Odeme[];
  calYear: number;
  calMonth: number; // 0-indexed
  onEdit: (record: Odeme) => void;
  onNewWithDate: (dateStr: string) => void;
  onRangeChange?: (range: { start: Date; end: Date }) => void;
}

export function OdemelerCalendarView({
  calendarData,
  calYear,
  calMonth,
  onEdit,
  onNewWithDate,
  onRangeChange,
}: OdemelerCalendarViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("ay");
  const [selectedCategory, setSelectedCategory] = useState<OdemeTuruConst | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const gridDays = useMemo(
    () => getDaysInMonthGrid(calYear, calMonth),
    [calYear, calMonth]
  );

  // Hafta görünümü: bugün'ün haftası
  const weekDays = useMemo(() => {
    const { start } = getWeekRange(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [today]);

  const displayDays = viewMode === "hafta" ? weekDays : gridDays;

  // Group odemeler by date string
  const odemelerByDate = useMemo(() => {
    const map = new Map<string, Odeme[]>();
    for (const o of calendarData) {
      if (!o.tarih) continue;
      const key = o.tarih.substring(0, 10);
      const arr = map.get(key);
      if (arr) {
        arr.push(o);
      } else {
        map.set(key, [o]);
      }
    }
    return map;
  }, [calendarData]);

  // Kategori bazlı aylık toplamlar
  const categoryTotals = useMemo(() => {
    const map: Partial<Record<OdemeTuruConst, { tl: number; usd: number; count: number }>> = {};
    for (const turu of ODEME_TURLERI) {
      map[turu] = { tl: 0, usd: 0, count: 0 };
    }
    for (const o of calendarData) {
      if (!o.turu) continue;
      const entry = map[o.turu as OdemeTuruConst];
      if (!entry) continue;
      entry.count += 1;
      if (o.cinsi === "USD") {
        entry.usd += Number(o.tutar);
      } else {
        entry.tl += Number(o.tutar);
      }
    }
    return map;
  }, [calendarData]);

  const dateToKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const navigateMonth = (delta: number) => {
    const newDate = new Date(calYear, calMonth + delta, 1);
    const calMonthStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}`;
    const params = new URLSearchParams(searchParams.toString());
    params.set("calMonth", calMonthStr);
    params.set("tab", "takvim");
    router.push(`/muhasebe/odemeler?${params.toString()}`);
    setSelectedDate(null);
    setDialogOpen(false);
  };

  const selectedOdemeler = useMemo(() => {
    if (!selectedDate) return [];
    return odemelerByDate.get(dateToKey(selectedDate)) || [];
  }, [selectedDate, odemelerByDate]);

  const handleDaySelect = (date: Date) => {
    setSelectedDate(date);
    setDialogOpen(true);
  };

  // Madde 13: Takvim aralığını parent'a bildir
  useEffect(() => {
    if (!onRangeChange) return;

    if (viewMode === "ay") {
      onRangeChange({
        start: new Date(calYear, calMonth, 1),
        end: new Date(calYear, calMonth + 1, 0),
      });
    } else {
      const { start, end } = getWeekRange(today);
      onRangeChange({ start, end });
    }
  }, [viewMode, calYear, calMonth, onRangeChange, today]);

  return (
    <div className="space-y-4">
      {/* Category Filter Cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {ODEME_TURLERI.map((turu) => {
          const colors = ODEME_TURU_COLORS[turu];
          const totals = categoryTotals[turu];
          const isActive = selectedCategory === turu;
          const totalStr = totals && totals.tl > 0
            ? formatCompact(totals.tl) + " ₺"
            : totals && totals.usd > 0
              ? "$" + formatCompact(totals.usd)
              : "-";

          return (
            <button
              key={turu}
              type="button"
              onClick={() => setSelectedCategory(isActive ? null : turu)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all shrink-0",
                isActive ? "scale-105" : "hover:opacity-80"
              )}
              style={{
                backgroundColor: colors.bg,
                color: colors.text,
                ...(isActive ? { boxShadow: `0 0 0 2px ${colors.text}` } : {}),
              }}
            >
              <span>{ODEME_TURU_LABELS[turu]}</span>
              <span className="text-[10px] font-bold tabular-nums opacity-80">
                {totalStr}
              </span>
            </button>
          );
        })}
      </div>

      {/* Month Navigation + View Toggle */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold">
            {AY_ISIMLERI[calMonth]} {calYear}
          </h3>
          {/* View mode toggle */}
          <div className="flex rounded-md border border-border">
            <button
              type="button"
              className={`px-2.5 py-1 text-xs font-medium transition-colors rounded-l-md ${
                viewMode === "ay" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
              onClick={() => setViewMode("ay")}
            >
              Ay
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 text-xs font-medium transition-colors rounded-r-md ${
                viewMode === "hafta" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
              onClick={() => setViewMode("hafta")}
            >
              Hafta
            </button>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1">
        {GUN_ISIMLERI.map((gun) => (
          <div
            key={gun}
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {gun}
          </div>
        ))}

        {/* Calendar Grid */}
        {displayDays.map((day, i) => {
          const key = dateToKey(day);
          const dayOdemeler = odemelerByDate.get(key) || [];
          const isCurrentMonth = day.getMonth() === calMonth;
          const isToday = day.getTime() === today.getTime();
          const isSelected = selectedDate
            ? day.getTime() === selectedDate.getTime()
            : false;

          return (
            <CalendarDayCell
              key={i}
              date={day}
              isCurrentMonth={viewMode === "hafta" || isCurrentMonth}
              isToday={isToday}
              isSelected={isSelected}
              odemeler={dayOdemeler.map((o) => ({
                id: o.id,
                turu: o.turu,
                tutar: Number(o.tutar),
                cinsi: o.cinsi,
                odeme_durum: o.odeme_durum,
              }))}
              onSelect={handleDaySelect}
              highlightTuru={selectedCategory}
            />
          );
        })}
      </div>

      {/* Madde 10: Dialog popup yerine inline detail */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              {selectedDate?.toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                weekday: "long",
              })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {selectedOdemeler.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Bu tarihte ödeme bulunmuyor.
              </p>
            ) : (
              selectedOdemeler.map((o) => {
                const durumColors = ODEME_DURUM_COLORS[o.odeme_durum as OdemeDurumuConst];
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setDialogOpen(false);
                      onEdit(o);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-border/50 p-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{o.tanimi}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <OdemeTuruBadge turu={o.turu} />
                        {durumColors && (
                          <Badge
                            variant="outline"
                            className={`${durumColors.bg} ${durumColors.text} border-0 text-[10px]`}
                          >
                            {o.odeme_durum === "TAMAMLANDI" ? "Tamamlandı" : "Bekliyor"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(
                        Number(o.tutar),
                        (o.cinsi as "TL" | "USD" | "EUR") || "TL"
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {selectedDate && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                setDialogOpen(false);
                onNewWithDate(dateToKey(selectedDate));
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ödeme Ekle
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
