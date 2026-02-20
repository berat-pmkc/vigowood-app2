"use client";

import { Card } from "@/components/ui/card";
import { Box, Package, Weight, Ruler } from "lucide-react";

interface ShipmentSummaryProps {
  totals: {
    palet: number;
    koli: number;
    adet: number;
    agirlik: number;
    hacim: number;
  };
}

export function ShipmentSummary({ totals }: ShipmentSummaryProps) {
  const kpiItems = [
    {
      icon: Box,
      label: "Palet",
      value: totals.palet,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Package,
      label: "Koli",
      value: totals.koli.toLocaleString("tr-TR"),
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      icon: Weight,
      label: "Ağırlık",
      value: `${Math.round(totals.agirlik).toLocaleString("tr-TR")} kg`,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      icon: Ruler,
      label: "Hacim",
      value: `${totals.hacim.toFixed(1)} m³`,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpiItems.map((item) => (
        <Card key={item.label} className="p-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${item.bg}`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-semibold text-sm tabular-nums">{item.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
