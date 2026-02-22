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

function getValueColors(value: number): { bg: string; iconBg: string; iconColor: string } {
  if (value < 0) return { bg: "bg-red-50 border-red-200", iconBg: "bg-red-100", iconColor: "text-red-600" };
  if (value === 0) return { bg: "bg-gray-50 border-gray-200", iconBg: "bg-gray-100", iconColor: "text-gray-500" };
  return { bg: "", iconBg: "", iconColor: "" }; // default
}

function getRatioColors(ratio: number): { bg: string; iconBg: string; iconColor: string } {
  if (ratio > 1) return { bg: "bg-red-50 border-red-200", iconBg: "bg-red-100", iconColor: "text-red-600" };
  if (ratio > 0.7) return { bg: "bg-amber-50 border-amber-200", iconBg: "bg-amber-100", iconColor: "text-amber-600" };
  return { bg: "bg-emerald-50 border-emerald-200", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" };
}

export function NakitKpiCards({ data }: { data: NakitKpiData }) {
  const borcVarlikOrani = data.toplamVarlik > 0
    ? data.toplamBorc / data.toplamVarlik
    : 0;
  const borcVarlikYuzde = (borcVarlikOrani * 100).toFixed(1);

  const nakitTlColors = getValueColors(data.nakitTl);
  const nakitUsdColors = getValueColors(data.nakitUsd);
  const netColors = getValueColors(data.netPozisyon);
  const ratioColors = getRatioColors(borcVarlikOrani);

  const cards = [
    {
      title: "Nakit TL",
      value: formatCurrency(data.nakitTl, "TL"),
      icon: Banknote,
      cardBg: nakitTlColors.bg || "",
      iconBg: nakitTlColors.iconBg || "bg-blue-50",
      iconColor: nakitTlColors.iconColor || "text-vw-info",
    },
    {
      title: "Nakit USD",
      value: formatCurrency(data.nakitUsd, "USD"),
      icon: DollarSign,
      cardBg: nakitUsdColors.bg || "",
      iconBg: nakitUsdColors.iconBg || "bg-emerald-50",
      iconColor: nakitUsdColors.iconColor || "text-vw-success",
    },
    {
      title: "Toplam Varlık",
      value: formatCurrency(data.toplamVarlik, "TL"),
      icon: TrendingUp,
      cardBg: "",
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      title: "Toplam Borç",
      value: formatCurrency(data.toplamBorc, "TL"),
      icon: TrendingDown,
      cardBg: "",
      iconBg: "bg-red-50",
      iconColor: "text-vw-error",
    },
    {
      title: "Net Pozisyon",
      value: formatCurrency(data.netPozisyon, "TL"),
      subtitle: `Borç/Varlık: %${borcVarlikYuzde}`,
      icon: BarChart3,
      cardBg: netColors.bg || ratioColors.bg,
      iconBg: netColors.iconBg || ratioColors.iconBg,
      iconColor: netColors.iconColor || ratioColors.iconColor,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={`border-border/50 ${card.cardBg}`}>
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
