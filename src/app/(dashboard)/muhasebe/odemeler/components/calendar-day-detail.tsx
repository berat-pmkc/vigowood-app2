"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CalendarIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ODEME_DURUM_COLORS, type OdemeDurumuConst } from "@/lib/constants";
import { OdemeTuruBadge } from "./odeme-turu-badge";
import type { Odeme } from "@/lib/supabase/types";

interface CalendarDayDetailProps {
  selectedDate: Date;
  odemeler: Odeme[];
  onEdit: (record: Odeme) => void;
  onNewWithDate: (dateStr: string) => void;
}

export function CalendarDayDetail({
  selectedDate,
  odemeler,
  onEdit,
  onNewWithDate,
}: CalendarDayDetailProps) {
  const dateStr = selectedDate.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  const isoDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            {dateStr}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNewWithDate(isoDate)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ödeme Ekle
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {odemeler.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Bu tarihte ödeme bulunmuyor.
          </p>
        ) : (
          <div className="space-y-2">
            {odemeler.map((o) => {
              const durumColors = ODEME_DURUM_COLORS[o.odeme_durum as OdemeDurumuConst];
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onEdit(o)}
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
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
