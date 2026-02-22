"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Banknote, TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface NakitKpiData {
  nakitTl: number;
  nakitUsd: number;
  toplamVarlik: number;
  toplamBorc: number;
  netPozisyon: number;
}

export function NakitKpiCards({ data }: { data: NakitKpiData }) {
  const borcVarlikOrani = data.toplamVarlik > 0
    ? ((data.toplamBorc / data.toplamVarlik) * 100).toFixed(1)
    : "0";

  const cards = [
    {
      title: "Nakit TL",
      value: formatCurrency(data.nakitTl, "TL"),
      icon: Banknote,
      iconBg: "bg-blue-50",
      iconColor: "text-vw-info",
    },
    {
      title: "Nakit USD",
      value: formatCurrency(data.nakitUsd, "USD"),
      icon: DollarSign,
      iconBg: "bg-emerald-50",
      iconColor: "text-vw-success",
    },
    {
      title: "Toplam Varlık",
      value: formatCurrency(data.toplamVarlik, "TL"),
      icon: TrendingUp,
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      title: "Toplam Borç",
      value: formatCurrency(data.toplamBorc, "TL"),
      icon: TrendingDown,
      iconBg: "bg-red-50",
      iconColor: "text-vw-error",
    },
    {
      title: "Net Pozisyon",
      value: formatCurrency(data.netPozisyon, "TL"),
      subtitle: `Borç/Varlık: %${borcVarlikOrani}`,
      icon: BarChart3,
      iconBg: data.netPozisyon >= 0 ? "bg-emerald-50" : "bg-red-50",
      iconColor: data.netPozisyon >= 0 ? "text-vw-success" : "text-vw-error",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {card.title}
                </p>
                <p className="mt-1 text-lg font-bold tracking-tight text-foreground">
                  {card.value}
                </p>
                {"subtitle" in card && card.subtitle && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {card.subtitle}
                  </p>
                )}
              </div>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
              >
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
