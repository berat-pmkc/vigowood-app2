"use client";

import { useMemo } from "react";
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
  highlightTuru?: string | null;
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
}

export function CalendarDayCell({
  date,
  isCurrentMonth,
  isToday,
  isSelected,
  odemeler,
  onSelect,
  highlightTuru,
}: CalendarDayCellProps) {
  const maxDots = 3;
  const visibleOdemeler = odemeler.slice(0, maxDots);
  const extraCount = odemeler.length - maxDots;

  // Madde 10: TL + USD toplamları
  const totals = useMemo(() => {
    let tl = 0;
    let usd = 0;
    for (const o of odemeler) {
      if (o.cinsi === "USD") usd += o.tutar;
      else tl += o.tutar;
    }
    return { tl, usd };
  }, [odemeler]);

  // Hücre rengi: toplama göre yoğunluk
  const intensityClass = useMemo(() => {
    if (odemeler.length === 0) return "";
    const total = totals.tl + totals.usd * 36; // Rough TL equivalent
    if (total > 500000) return "bg-red-50/80";
    if (total > 100000) return "bg-amber-50/80";
    if (total > 0) return "bg-blue-50/50";
    return "";
  }, [odemeler.length, totals]);

  // Kategori highlight
  const hasHighlightMatch = highlightTuru
    ? odemeler.some((o) => o.turu === highlightTuru)
    : false;
  const highlightColors = highlightTuru
    ? ODEME_TURU_COLORS[highlightTuru as OdemeTuruConst]
    : null;

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
        !isSelected && !isToday && !hasHighlightMatch && "border-border/50",
        !isSelected && !hasHighlightMatch && intensityClass,
        highlightTuru && !hasHighlightMatch && isCurrentMonth && "opacity-40"
      )}
      style={
        hasHighlightMatch && highlightColors
          ? {
              borderLeftWidth: "4px",
              borderLeftColor: highlightColors.text,
              backgroundColor: highlightColors.bg,
            }
          : undefined
      }
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
        <div className="flex flex-col gap-0.5 mt-auto w-full">
          {/* Madde 10: Compact totals */}
          <div className="flex flex-col gap-0 w-full">
            {totals.tl > 0 && (
              <span className="text-[9px] font-semibold text-amber-700 tabular-nums leading-tight truncate">
                {formatCompact(totals.tl)} ₺
              </span>
            )}
            {totals.usd > 0 && (
              <span className="text-[9px] font-semibold text-blue-700 tabular-nums leading-tight truncate">
                ${formatCompact(totals.usd)}
              </span>
            )}
          </div>

          {/* Dots */}
          <div className="flex flex-wrap items-center gap-0.5">
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
        </div>
      )}
    </button>
  );
}
