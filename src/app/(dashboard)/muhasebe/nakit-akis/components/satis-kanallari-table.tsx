"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NAKIT_GIRIS_LABELS, NAKIT_GIRIS_TL_KOLONLAR } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface SatisKanallariData {
  current: Record<string, number>;
  prev?: Record<string, number>;
}

export function SatisKanallariTable({ data }: { data: SatisKanallariData }) {
  const rows = NAKIT_GIRIS_TL_KOLONLAR
    .filter((col) => col !== "doviz_satisi" && col !== "nakit_kredi")
    .map((col) => {
      const currentVal = data.current[col] || 0;
      const prevVal = data.prev?.[col] || 0;
      const change = prevVal > 0
        ? (((currentVal - prevVal) / prevVal) * 100).toFixed(1)
        : null;
      return {
        label: NAKIT_GIRIS_LABELS[col] || col,
        current: currentVal,
        prev: prevVal,
        change,
      };
    })
    .sort((a, b) => b.current - a.current);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Satış Kanalları (TL)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Kanal</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Cari Dönem</th>
                <th className="hidden px-4 py-2 text-right font-medium text-muted-foreground md:table-cell">Önceki</th>
                <th className="hidden px-4 py-2 text-right font-medium text-muted-foreground md:table-cell">Değişim</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2 text-muted-foreground">{row.label}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {formatCurrency(row.current, "TL")}
                  </td>
                  <td className="hidden px-4 py-2 text-right tabular-nums text-muted-foreground md:table-cell">
                    {formatCurrency(row.prev, "TL")}
                  </td>
                  <td className="hidden px-4 py-2 text-right md:table-cell">
                    {row.change && (
                      <span
                        className={`text-xs font-medium ${
                          row.change.startsWith("-")
                            ? "text-vw-error"
                            : "text-vw-success"
                        }`}
                      >
                        {row.change.startsWith("-") ? "" : "+"}
                        {row.change}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
