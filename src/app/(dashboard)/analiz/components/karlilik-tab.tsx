"use client";

import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, Coins, TrendingUp, Percent, TriangleAlert, Info } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface KarlilikRow {
  sku: string;
  urunAdi: string;
  adet: number;
  ciro: number;
  birimMaliyet: number | null;
  toplamMaliyet: number;
  kar: number;
  marj: number; // yüzde
  eksik: boolean;
}

export interface KarlilikKpi {
  ciro: number;
  maliyet: number;
  kar: number;
  marj: number;
  eksikSayi: number;
}

const KarlilikChart = dynamic(
  () => import("./karlilik-chart").then((m) => ({ default: m.KarlilikChart })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

const tl = (n: number) => `₺${formatNumber(Math.round(n))}`;
const marjRenk = (m: number) =>
  m >= 40 ? "text-emerald-600" : m >= 20 ? "text-amber-600" : "text-red-600";

export function KarlilikTab({ kpi, rows }: { kpi: KarlilikKpi; rows: KarlilikRow[] }) {
  const cards = [
    { title: "Toplam Ciro", value: tl(kpi.ciro), icon: DollarSign, bg: "bg-emerald-50", col: "text-vw-success" },
    { title: "Toplam Maliyet", value: tl(kpi.maliyet), icon: Coins, bg: "bg-amber-50", col: "text-vw-warning" },
    { title: "Toplam Kâr", value: tl(kpi.kar), icon: TrendingUp, bg: "bg-blue-50", col: kpi.kar >= 0 ? "text-vw-info" : "text-red-600" },
    { title: "Ort. Marj", value: `%${kpi.marj.toFixed(1)}`, icon: Percent, bg: "bg-purple-50", col: "text-purple-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {cards.map((c) => (
          <Card key={c.title} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{c.title}</p>
                  <p className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">{c.value}</p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
                  <c.icon className={`h-5 w-5 ${c.col}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 rounded border border-[#a99c7d]/40 bg-[#f0ede1] p-3 text-xs text-[#474237]">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          <b>Kâr</b> = seçili dönemdeki satış cirosu − (satılan adet × güncel birim maliyet).
          Birim maliyet, Maliyet Analizi motorundan gelir (malzeme + işçilik).
          {kpi.eksikSayi > 0 && (
            <> {kpi.eksikSayi} üründe birim maliyet eksik (fiyatsız parça/işçilik) — kârı yaklaşık, satırda uyarı var.</>
          )}
        </span>
      </div>

      {rows.length > 0 && <KarlilikChart rows={rows} />}

      <Card className="border-border/50 p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Adet</TableHead>
                <TableHead className="text-right">Ciro</TableHead>
                <TableHead className="text-right">Birim Maliyet</TableHead>
                <TableHead className="text-right">Toplam Kâr</TableHead>
                <TableHead className="text-right">Marj</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Bu dönemde satış yok.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.sku}>
                    <TableCell>
                      <span className="font-mono text-xs font-medium">{r.sku}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{r.urunAdi}</span>
                      {r.eksik && (
                        <Badge variant="outline" className="ml-1 border-amber-300 text-[9px] text-amber-700">
                          <TriangleAlert className="mr-0.5 size-2.5" />maliyet eksik
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.adet)}</TableCell>
                    <TableCell className="text-right tabular-nums">{tl(r.ciro)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.birimMaliyet != null ? tl(r.birimMaliyet) : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${r.kar >= 0 ? "" : "text-red-600"}`}>
                      {tl(r.kar)}
                    </TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${marjRenk(r.marj)}`}>
                      %{r.marj.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
