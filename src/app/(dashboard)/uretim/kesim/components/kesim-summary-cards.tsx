"use client";

import { Card } from "@/components/ui/card";
import { Scissors, Layers, Timer, Zap } from "lucide-react";
import type { CutBatchRow } from "./active-cut-card";

interface KesimSummaryCardsProps {
  activeCuts: CutBatchRow[];
  todayTotalAdet: number;
  todayTotalBatch: number;
}

export function KesimSummaryCards({ activeCuts, todayTotalAdet, todayTotalBatch }: KesimSummaryCardsProps) {
  const kpis = [
    {
      label: "Aktif Kesim",
      value: activeCuts.length,
      icon: Zap,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Bugün Tamamlanan",
      value: todayTotalBatch,
      icon: Scissors,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Bugün Kesilen Adet",
      value: todayTotalAdet,
      icon: Layers,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Ort. Süre",
      value: "—",
      icon: Timer,
      color: "text-purple-600",
      bg: "bg-purple-50",
      isText: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="p-3">
          <div className="flex items-center gap-3">
            <div className={`${kpi.bg} p-2 rounded-lg`}>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold tabular-nums">{kpi.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
