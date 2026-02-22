"use client";

import { cn } from "@/lib/utils";
import { ODEME_TURU_COLORS, type OdemeTuruConst } from "@/lib/constants";

interface CalendarOdeme {
  id: string;
  turu: string | null;
  tutar: number;
  cinsi: string | null;
  odeme_durum: string | null;
}

interface CalendarDayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  odemeler: CalendarOdeme[];
  onSelect: (date: Date) => void;
}

export function CalendarDayCell({
  date,
  isCurrentMonth,
  isToday,
  isSelected,
  odemeler,
  onSelect,
}: CalendarDayCellProps) {
  const maxDots = 3;
  const visibleOdemeler = odemeler.slice(0, maxDots);
  const extraCount = odemeler.length - maxDots;

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-md border p-1 text-left transition-colors",
        "min-h-[60px] sm:min-h-[72px] lg:min-h-[80px]",
        "hover:bg-accent/50",
        !isCurrentMonth && "opacity-40",
        isToday && "border-primary border-2",
        isSelected && "bg-accent ring-1 ring-primary",
        !isSelected && !isToday && "border-border/50"
      )}
    >
      <span
        className={cn(
          "text-xs font-medium sm:text-sm",
          isToday && "text-primary font-bold",
          !isCurrentMonth && "text-muted-foreground"
        )}
      >
        {date.getDate()}
      </span>

      {odemeler.length > 0 && (
        <div className="flex flex-wrap items-center gap-0.5 mt-auto">
          {visibleOdemeler.map((o) => {
            const colors = ODEME_TURU_COLORS[o.turu as OdemeTuruConst];
            return (
              <span
                key={o.id}
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  o.odeme_durum === "TAMAMLANDI" && "opacity-50"
                )}
                style={{
                  backgroundColor: colors?.text || "#616161",
                }}
                title={`${o.turu}: ${o.tutar}`}
              />
            );
          })}
          {extraCount > 0 && (
            <span className="text-[9px] font-medium text-muted-foreground leading-none">
              +{extraCount}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
