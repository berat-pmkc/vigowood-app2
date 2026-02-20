"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Layers, AlertTriangle, TrendingUp, ArrowDownUp } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface YariMamulKpiData {
  totalPartCount: number;
  criticalCount: number;
  todayIn: number;
  todayMovements: number;
}

export function KpiCards({ data }: { data: YariMamulKpiData }) {
  const cards = [
    {
      title: "Toplam Parça Çeşidi",
      value: formatNumber(data.totalPartCount),
      subtitle: "Yarı mamül parça tipi",
      icon: Layers,
      iconBg: "bg-blue-50",
      iconColor: "text-vw-info",
    },
    {
      title: "Kritik Stok",
      value: formatNumber(data.criticalCount),
      subtitle: "Eşik altında parça sayısı",
      icon: AlertTriangle,
      iconBg: "bg-red-50",
      iconColor: "text-vw-error",
    },
    {
      title: "Bugünkü Giriş",
      value: `+${formatNumber(data.todayIn)}`,
      subtitle: "Kesim/temizlikten gelen",
      icon: TrendingUp,
      iconBg: "bg-emerald-50",
      iconColor: "text-vw-success",
    },
    {
      title: "Bugünkü Hareket",
      value: formatNumber(data.todayMovements),
      subtitle: "Toplam stok hareketi",
      icon: ArrowDownUp,
      iconBg: "bg-amber-50",
      iconColor: "text-vw-warning",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">
                  {card.title}
                </p>
                <p className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {card.value}
                </p>
                <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                  {card.subtitle}
                </p>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
