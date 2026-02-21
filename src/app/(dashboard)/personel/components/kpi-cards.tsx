"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, Building2, AlertTriangle } from "lucide-react";

interface KpiData {
  todayTotal: number;
  avgHours: number;
  activeDeptCount: number;
  lateCount: number;
}

export function KpiCards({ data }: { data: KpiData }) {
  const cards = [
    {
      title: "Bugün Toplam",
      value: String(data.todayTotal),
      subtitle: "Yoklama kaydı sayısı",
      icon: Users,
      iconBg: "bg-blue-50",
      iconColor: "text-vw-info",
    },
    {
      title: "Ortalama Mesai",
      value: data.avgHours > 0 ? `${data.avgHours} sa` : "—",
      subtitle: "Bugünkü ortalama",
      icon: Clock,
      iconBg: "bg-emerald-50",
      iconColor: "text-vw-success",
    },
    {
      title: "Aktif Departman",
      value: String(data.activeDeptCount),
      subtitle: "Bugün kaydı olan",
      icon: Building2,
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      title: "Geç Gelenler",
      value: String(data.lateCount),
      subtitle: "08:30 sonrası giriş",
      icon: AlertTriangle,
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
