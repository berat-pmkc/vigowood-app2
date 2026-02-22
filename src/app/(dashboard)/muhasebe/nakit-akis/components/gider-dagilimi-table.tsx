"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NAKIT_CIKIS_TL_LABELS, NAKIT_CIKIS_TL_KOLONLAR, NAKIT_CIKIS_USD_LABELS, NAKIT_CIKIS_USD_KOLONLAR } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface GiderDagilimiData {
  tlValues: Record<string, number>;
  usdValues: Record<string, number>;
  toplamTl: number;
  toplamUsd: number;
}

export function GiderDagilimiTable({ data }: { data: GiderDagilimiData }) {
  const tlRows = NAKIT_CIKIS_TL_KOLONLAR
    .map((col) => ({
      label: NAKIT_CIKIS_TL_LABELS[col] || col,
      value: data.tlValues[col] || 0,
      pct: data.toplamTl > 0
        ? (((data.tlValues[col] || 0) / data.toplamTl) * 100).toFixed(1)
        : "0",
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  const usdRows = NAKIT_CIKIS_USD_KOLONLAR
    .map((col) => ({
      label: NAKIT_CIKIS_USD_LABELS[col] || col,
      value: data.usdValues[col] || 0,
      pct: data.toplamUsd > 0
        ? (((data.usdValues[col] || 0) / data.toplamUsd) * 100).toFixed(1)
        : "0",
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Gider Dağılımı</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Kategori</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Tutar</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Pay %</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tlRows.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2 text-muted-foreground">{row.label}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {formatCurrency(row.value, "TL")}
                  </td>
                  <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                    {row.pct}%
                  </td>
                </tr>
              ))}
              {tlRows.length > 0 && (
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-4 py-2">Toplam TL</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(data.toplamTl, "TL")}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">100%</td>
                </tr>
              )}
              {usdRows.length > 0 && (
                <>
                  <tr>
                    <td colSpan={3} className="bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                      USD Giderler
                    </td>
                  </tr>
                  {usdRows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-4 py-2 text-muted-foreground">{row.label}</td>
                      <td className="px-4 py-2 text-right font-medium tabular-nums">
                        {formatCurrency(row.value, "USD")}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                        {row.pct}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-4 py-2">Toplam USD</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatCurrency(data.toplamUsd, "USD")}
                    </td>
                    <td className="px-4 py-2 text-right text-xs">100%</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
