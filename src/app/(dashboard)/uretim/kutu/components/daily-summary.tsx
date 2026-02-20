"use client";

import { Card } from "@/components/ui/card";
import { Box, CheckCircle, Clock, TrendingUp } from "lucide-react";

interface DailySummaryProps {
  todayTotal: number;
  todayCompleted: number;
  todayInProgress: number;
  todayParts: { part_id: string; part_adi: string; qty: number }[];
}

export function DailySummary({ todayTotal, todayCompleted, todayInProgress, todayParts }: DailySummaryProps) {
  if (todayTotal === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Bugünkü Özet
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <Box className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
          <p className="text-2xl font-bold tabular-nums">{todayTotal}</p>
          <p className="text-xs text-muted-foreground">Toplam Adet</p>
        </Card>
        <Card className="p-3 text-center">
          <CheckCircle className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
          <p className="text-2xl font-bold tabular-nums text-emerald-600">{todayCompleted}</p>
          <p className="text-xs text-muted-foreground">Tamamlanan</p>
        </Card>
        <Card className="p-3 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-blue-500" />
          <p className="text-2xl font-bold tabular-nums text-blue-600">{todayInProgress}</p>
          <p className="text-xs text-muted-foreground">Devam Eden</p>
        </Card>
      </div>

      {todayParts.length > 0 && (
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Parça Bazlı</span>
          </div>
          <div className="space-y-1">
            {todayParts.map((p) => (
              <div key={p.part_id} className="flex justify-between items-center text-sm">
                <span className="truncate flex-1 mr-2">{p.part_adi}</span>
                <span className="font-bold tabular-nums">{p.qty}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
