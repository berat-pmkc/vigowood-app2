"use client";

import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, CheckCircle, XCircle, ArrowDownUp } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface IadeKpiData {
  totalCount: number;
  kullanilabilirQty: number;
  kullanilamazQty: number;
  todayCount: number;
}

export function KpiCards({ data }: { data: IadeKpiData }) {
  const cards = [
    {
      title: "Toplam İade",
      value: formatNumber(data.totalCount),
      subtitle: "Kayıtlı iade adedi",
      icon: RotateCcw,
      iconBg: "bg-blue-50",
      iconColor: "text-vw-info",
    },
    {
      title: "Kullanılabilir",
      value: formatNumber(data.kullanilabilirQty),
      subtitle: "Stoğa giren adet",
      icon: CheckCircle,
      iconBg: "bg-emerald-50",
      iconColor: "text-vw-success",
    },
    {
      title: "Kullanılamaz",
      value: formatNumber(data.kullanilamazQty),
      subtitle: "Hurda / hasar adet",
      icon: XCircle,
      iconBg: "bg-red-50",
      iconColor: "text-vw-error",
    },
    {
      title: "Bugünkü İade",
      value: formatNumber(data.todayCount),
      subtitle: "Bugün girilen kayıt",
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
