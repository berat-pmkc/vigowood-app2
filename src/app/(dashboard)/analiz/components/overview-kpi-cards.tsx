"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Factory, DollarSign, Warehouse, Truck } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface OverviewKpiData {
  gunlukUretim: number;
  donemSatis: number;
  mamulStok: number;
  bekleyenSevkiyat: number;
}

export function OverviewKpiCards({ data }: { data: OverviewKpiData }) {
  const cards = [
    {
      title: "Günlük Üretim",
      value: formatNumber(data.gunlukUretim),
      subtitle: "Bugün paketlenen adet",
      icon: Factory,
      iconBg: "bg-emerald-50",
      iconColor: "text-vw-success",
    },
    {
      title: "Dönem Satış",
      value: `₺${formatNumber(Math.round(data.donemSatis))}`,
      subtitle: "Seçili dönem toplamı",
      icon: DollarSign,
      iconBg: "bg-blue-50",
      iconColor: "text-vw-info",
    },
    {
      title: "Mamül Stok",
      value: formatNumber(data.mamulStok),
      subtitle: "Aktif ürün toplam stok",
      icon: Warehouse,
      iconBg: "bg-amber-50",
      iconColor: "text-vw-warning",
    },
    {
      title: "Bekleyen Sevkiyat",
      value: formatNumber(data.bekleyenSevkiyat),
      subtitle: "Bekliyor + Hazırlanıyor",
      icon: Truck,
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
