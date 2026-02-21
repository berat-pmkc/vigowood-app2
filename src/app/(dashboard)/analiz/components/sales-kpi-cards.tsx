"use client";

import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Receipt, ShoppingCart, Globe } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface SalesKpiData {
  toplamCiro: number;
  siparisSayisi: number;
  trSatis: number;
  ihracatSatis: number;
}

export function SalesKpiCards({ data }: { data: SalesKpiData }) {
  const cards = [
    {
      title: "Toplam Ciro",
      value: `₺${formatNumber(Math.round(data.toplamCiro))}`,
      subtitle: "Dönem toplam satış tutarı",
      icon: DollarSign,
      iconBg: "bg-emerald-50",
      iconColor: "text-vw-success",
    },
    {
      title: "Sipariş Sayısı",
      value: formatNumber(data.siparisSayisi),
      subtitle: "Benzersiz fatura adedi",
      icon: Receipt,
      iconBg: "bg-blue-50",
      iconColor: "text-vw-info",
    },
    {
      title: "TR Satış",
      value: `₺${formatNumber(Math.round(data.trSatis))}`,
      subtitle: "Yurtiçi satış toplamı",
      icon: ShoppingCart,
      iconBg: "bg-amber-50",
      iconColor: "text-vw-warning",
    },
    {
      title: "İhracat",
      value: `₺${formatNumber(Math.round(data.ihracatSatis))}`,
      subtitle: "Yurtdışı satış toplamı",
      icon: Globe,
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
