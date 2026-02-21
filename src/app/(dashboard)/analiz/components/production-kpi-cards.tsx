"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Scissors, SprayCan, Wrench, Package } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface ProductionKpiData {
  kesimCount: number;
  temizlikCount: number;
  montajCount: number;
  paketlemeAdet: number;
}

export function ProductionKpiCards({ data }: { data: ProductionKpiData }) {
  const cards = [
    {
      title: "Kesim",
      value: formatNumber(data.kesimCount),
      subtitle: "Tamamlanan parti",
      icon: Scissors,
      iconBg: "bg-emerald-50",
      iconColor: "text-vw-success",
    },
    {
      title: "Temizlik",
      value: formatNumber(data.temizlikCount),
      subtitle: "Tamamlanan kayıt",
      icon: SprayCan,
      iconBg: "bg-blue-50",
      iconColor: "text-vw-info",
    },
    {
      title: "Montaj",
      value: formatNumber(data.montajCount),
      subtitle: "Tamamlanan parti",
      icon: Wrench,
      iconBg: "bg-amber-50",
      iconColor: "text-vw-warning",
    },
    {
      title: "Paketleme",
      value: formatNumber(data.paketlemeAdet),
      subtitle: "Toplam adet",
      icon: Package,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
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
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
              >
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
