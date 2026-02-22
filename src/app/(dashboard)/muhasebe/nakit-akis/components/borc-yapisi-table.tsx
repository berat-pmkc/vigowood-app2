"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface BorcYapisiData {
  piyasaBorcu: number;
  kkBorc: number;
  finansalBorc: number;
}

export function BorcYapisiTable({ data }: { data: BorcYapisiData }) {
  const toplamBorc = data.piyasaBorcu + data.kkBorc + data.finansalBorc;

  const rows = [
    { label: "Piyasa Borcu", value: data.piyasaBorcu, color: "bg-blue-500" },
    { label: "Kredi Kartı Borcu", value: data.kkBorc, color: "bg-amber-500" },
    { label: "Finansal Borç", value: data.finansalBorc, color: "bg-red-500" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Borç Yapısı</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => {
          const pct = toplamBorc > 0 ? ((row.value / toplamBorc) * 100).toFixed(1) : "0";
          return (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(row.value, "TL")} ({pct}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${row.color}`}
                  style={{ width: `${Math.min(100, Number(pct))}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
          <span>Toplam Borç</span>
          <span className="tabular-nums text-vw-error">
            {formatCurrency(toplamBorc, "TL")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
