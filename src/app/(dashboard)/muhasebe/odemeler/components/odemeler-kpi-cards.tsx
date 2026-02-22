"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Banknote, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface KpiData {
  bekleyenTl: number;
  bekleyenUsd: number;
  yaklasan7Gun: number;
  buAyOdenen: number;
}

export function OdemelerKpiCards({ data }: { data: KpiData }) {
  const cards = [
    {
      title: "Bekleyen (TL)",
      value: formatCurrency(data.bekleyenTl, "TL"),
      subtitle: "Ödenmemiş toplam",
      icon: Banknote,
      iconBg: "bg-amber-50",
      iconColor: "text-vw-warning",
    },
    {
      title: "Bekleyen (USD)",
      value: formatCurrency(data.bekleyenUsd, "USD"),
      subtitle: "Ödenmemiş toplam",
      icon: Banknote,
      iconBg: "bg-blue-50",
      iconColor: "text-vw-info",
    },
    {
      title: "Yaklaşan (7 Gün)",
      value: String(data.yaklasan7Gun),
      subtitle: "Yaklaşan ödeme sayısı",
      icon: AlertTriangle,
      iconBg: "bg-red-50",
      iconColor: "text-vw-error",
    },
    {
      title: "Bu Ay Ödenen",
      value: String(data.buAyOdenen),
      subtitle: "Tamamlanan ödeme sayısı",
      icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconColor: "text-vw-success",
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
                <p className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
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
