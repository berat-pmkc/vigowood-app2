"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

export interface CriticalStockRow {
  sku: string;
  urunAdi: string;
  mevcut: number;
  kritikEsik: number;
}

export function StockCriticalTable({ data }: { data: CriticalStockRow[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Kritik Stok Ürünleri (Top 15)
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">SKU</th>
                <th className="hidden pb-2 pr-4 font-medium sm:table-cell">
                  Ürün Adı
                </th>
                <th className="pb-2 pr-4 text-right font-medium">Mevcut</th>
                <th className="pb-2 pr-4 text-right font-medium">Kritik</th>
                <th className="pb-2 text-right font-medium">Fark</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const fark = row.mevcut - row.kritikEsik;
                return (
                  <tr
                    key={row.sku}
                    className="border-b border-border/30 last:border-0"
                  >
                    <td className="py-2 pr-4 font-mono text-xs">{row.sku}</td>
                    <td className="hidden max-w-[200px] truncate py-2 pr-4 sm:table-cell">
                      {row.urunAdi || "—"}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold">
                      {formatNumber(row.mevcut)}
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {formatNumber(row.kritikEsik)}
                    </td>
                    <td className="py-2 text-right">
                      <Badge
                        variant={fark < 0 ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {fark >= 0 ? "+" : ""}
                        {formatNumber(fark)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-6 text-center text-muted-foreground"
                  >
                    Kritik stokta ürün yok
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
