"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Banknote, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency, getWeekRange, getMonthRange } from "@/lib/utils";

interface OdemeKpiRow {
  id: string;
  tutar: number;
  cinsi: string | null;
  tarih: string | null;
  turu: string | null;
  odeme_durum: string | null;
}

type TimeFilter = "bu-hafta" | "gecen-hafta" | "bu-ay" | "gelecek-ay";

const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: "bu-hafta", label: "Bu Hafta" },
  { key: "gecen-hafta", label: "Geçen Hafta" },
  { key: "bu-ay", label: "Bu Ay" },
  { key: "gelecek-ay", label: "Gelecek Ay" },
];

function getFilterRange(filter: TimeFilter): { start: Date; end: Date } {
  const now = new Date();
  switch (filter) {
    case "bu-hafta":
      return getWeekRange(now);
    case "gecen-hafta": {
      const prev = new Date(now);
      prev.setDate(prev.getDate() - 7);
      return getWeekRange(prev);
    }
    case "bu-ay":
      return getMonthRange(now.getFullYear(), now.getMonth());
    case "gelecek-ay": {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return getMonthRange(next.getFullYear(), next.getMonth());
    }
  }
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function OdemelerKpiCards({ allOdemeler }: { allOdemeler: OdemeKpiRow[] }) {
  const router = useRouter();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("bu-ay");

  const range = useMemo(() => getFilterRange(timeFilter), [timeFilter]);

  const filtered = useMemo(() => {
    const startStr = toDateStr(range.start);
    const endStr = toDateStr(range.end);
    return allOdemeler.filter((o) => {
      if (!o.tarih) return false;
      const d = o.tarih.substring(0, 10);
      return d >= startStr && d <= endStr;
    });
  }, [allOdemeler, range]);

  const bekleyenTl = useMemo(
    () => filtered.filter((o) => o.odeme_durum === "BEKLİYOR" && o.cinsi === "TL")
      .reduce((s, o) => s + Number(o.tutar), 0),
    [filtered]
  );

  const bekleyenUsd = useMemo(
    () => filtered.filter((o) => o.odeme_durum === "BEKLİYOR" && o.cinsi === "USD")
      .reduce((s, o) => s + Number(o.tutar), 0),
    [filtered]
  );

  const bekleyenCount = useMemo(
    () => filtered.filter((o) => o.odeme_durum === "BEKLİYOR").length,
    [filtered]
  );

  const tamamlananCount = useMemo(
    () => filtered.filter((o) => o.odeme_durum === "TAMAMLANDI").length,
    [filtered]
  );

  const handleCardClick = (filters: Record<string, string>) => {
    const params = new URLSearchParams();
    params.set("tab", "liste");
    const startStr = toDateStr(range.start);
    const endStr = toDateStr(range.end);
    params.set("dateFrom", startStr);
    params.set("dateTo", endStr);
    for (const [k, v] of Object.entries(filters)) {
      params.set(k, v);
    }
    router.push(`/muhasebe/odemeler?${params.toString()}`);
  };

  const cards = [
    {
      title: "Bekleyen (TL)",
      value: formatCurrency(bekleyenTl, "TL"),
      subtitle: "Ödenmemiş TL toplam",
      icon: Banknote,
      iconBg: "bg-amber-50",
      iconColor: "text-vw-warning",
      onClick: () => handleCardClick({ durum: "BEKLİYOR", cinsi: "TL" }),
    },
    {
      title: "Bekleyen (USD)",
      value: formatCurrency(bekleyenUsd, "USD"),
      subtitle: "Ödenmemiş USD toplam",
      icon: Banknote,
      iconBg: "bg-blue-50",
      iconColor: "text-vw-info",
      onClick: () => handleCardClick({ durum: "BEKLİYOR", cinsi: "USD" }),
    },
    {
      title: "Yaklaşan Ödeme",
      value: String(bekleyenCount),
      subtitle: "Bekleyen ödeme sayısı",
      icon: AlertTriangle,
      iconBg: "bg-red-50",
      iconColor: "text-vw-error",
      onClick: () => handleCardClick({ durum: "BEKLİYOR" }),
    },
    {
      title: "Tamamlanan",
      value: String(tamamlananCount),
      subtitle: "Tamamlanan ödeme sayısı",
      icon: CheckCircle2,
      iconBg: "bg-emerald-50",
      iconColor: "text-vw-success",
      onClick: () => handleCardClick({ durum: "TAMAMLANDI" }),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Time filter buttons */}
      <div className="flex flex-wrap gap-1.5">
        {TIME_FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={timeFilter === f.key ? "default" : "outline"}
            className="h-7 text-xs"
            onClick={() => setTimeFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="cursor-pointer border-border/50 transition-colors hover:bg-accent/50"
            onClick={card.onClick}
          >
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
    </div>
  );
}
