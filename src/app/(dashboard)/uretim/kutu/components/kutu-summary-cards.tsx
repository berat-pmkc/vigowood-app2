"use client";

import { Card } from "@/components/ui/card";
import { Zap, Box, Layers, AlertTriangle } from "lucide-react";

interface KutuSummaryCardsProps {
  activeCount: number;
  todayTotalAdet: number;
  todayTotalBatch: number;
  kritikStokCount: number;
}

export function KutuSummaryCards({
  activeCount,
  todayTotalAdet,
  todayTotalBatch,
  kritikStokCount,
}: KutuSummaryCardsProps) {
  const kpis = [
    {
      label: "Aktif Üretim",
      value: activeCount,
      icon: Zap,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Bugün Tamamlanan",
      value: todayTotalBatch,
      icon: Box,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Bugün Üretilen Adet",
      value: todayTotalAdet,
      icon: Layers,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Kritik Stok",
      value: kritikStokCount,
      icon: AlertTriangle,
      color: kritikStokCount > 0 ? "text-red-600" : "text-emerald-600",
      bg: kritikStokCount > 0 ? "bg-red-50" : "bg-emerald-50",
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
