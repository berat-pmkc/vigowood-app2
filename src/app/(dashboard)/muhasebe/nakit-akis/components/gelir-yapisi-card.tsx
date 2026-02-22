"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface GelirYapisiData {
  organikGelir: number;
  dovizSatisi: number;
  nakitKredi: number;
  toplamTl: number;
}

export function GelirYapisiCard({ data }: { data: GelirYapisiData }) {
  const getPercent = (value: number) =>
    data.toplamTl > 0 ? ((value / data.toplamTl) * 100).toFixed(1) : "0";

  const rows = [
    {
      label: "Organik Gelir",
      value: data.organikGelir,
      pct: getPercent(data.organikGelir),
      color: "bg-vw-success",
    },
    {
      label: "Döviz Satışı",
      value: data.dovizSatisi,
      pct: getPercent(data.dovizSatisi),
      color: "bg-vw-info",
    },
    {
      label: "Nakit Kredi",
      value: data.nakitKredi,
      pct: getPercent(data.nakitKredi),
      color: "bg-vw-warning",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gelir Yapısı Analizi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(row.value, "TL")} ({row.pct}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${row.color}`}
                style={{ width: `${Math.min(100, Number(row.pct))}%` }}
              />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
          <span>Toplam</span>
          <span className="tabular-nums">{formatCurrency(data.toplamTl, "TL")}</span>
        </div>
      </CardContent>
    </Card>
  );
}
