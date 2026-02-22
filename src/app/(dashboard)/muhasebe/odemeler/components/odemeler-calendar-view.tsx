"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDaysInMonthGrid } from "@/lib/utils";
import { CalendarDayCell } from "./calendar-day-cell";
import { CalendarDayDetail } from "./calendar-day-detail";
import type { Odeme } from "@/lib/supabase/types";

const GUN_ISIMLERI = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const AY_ISIMLERI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

interface OdemelerCalendarViewProps {
  calendarData: Odeme[];
  calYear: number;
  calMonth: number; // 0-indexed
  onEdit: (record: Odeme) => void;
  onNewWithDate: (dateStr: string) => void;
}

export function OdemelerCalendarView({
  calendarData,
  calYear,
  calMonth,
  onEdit,
  onNewWithDate,
}: OdemelerCalendarViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const gridDays = useMemo(
    () => getDaysInMonthGrid(calYear, calMonth),
    [calYear, calMonth]
  );

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
  };

  const selectedOdemeler = useMemo(() => {
    if (!selectedDate) return [];
    return odemelerByDate.get(dateToKey(selectedDate)) || [];
  }, [selectedDate, odemelerByDate]);

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-base font-semibold">
          {AY_ISIMLERI[calMonth]} {calYear}
        </h3>
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
        {gridDays.map((day, i) => {
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
              isCurrentMonth={isCurrentMonth}
              isToday={isToday}
              isSelected={isSelected}
              odemeler={dayOdemeler.map((o) => ({
                id: o.id,
                turu: o.turu,
                tutar: Number(o.tutar),
                cinsi: o.cinsi,
                odeme_durum: o.odeme_durum,
              }))}
              onSelect={setSelectedDate}
            />
          );
        })}
      </div>

      {/* Day Detail Panel */}
      {selectedDate && (
        <CalendarDayDetail
          selectedDate={selectedDate}
          odemeler={selectedOdemeler}
          onEdit={onEdit}
          onNewWithDate={onNewWithDate}
        />
      )}
    </div>
  );
}
