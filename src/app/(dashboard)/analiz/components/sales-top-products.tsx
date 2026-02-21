"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export interface TopProductRow {
  sku: string;
  urunAdi: string;
  toplamAdet: number;
  toplamTutar: number;
}

export function SalesTopProducts({ data }: { data: TopProductRow[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          En Çok Satan 10 Ürün
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">#</th>
                <th className="pb-2 pr-4 font-medium">SKU</th>
                <th className="hidden pb-2 pr-4 font-medium sm:table-cell">
                  Ürün Adı
                </th>
                <th className="pb-2 pr-4 text-right font-medium">Adet</th>
                <th className="pb-2 text-right font-medium">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.sku}
                  className="border-b border-border/30 last:border-0"
                >
                  <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{row.sku}</td>
                  <td className="hidden max-w-[200px] truncate py-2 pr-4 sm:table-cell">
                    {row.urunAdi || "—"}
                  </td>
                  <td className="py-2 pr-4 text-right font-semibold">
                    {formatNumber(row.toplamAdet)}
                  </td>
                  <td className="py-2 text-right font-semibold">
                    ₺{formatNumber(Math.round(row.toplamTutar))}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Veri bulunamadı
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
