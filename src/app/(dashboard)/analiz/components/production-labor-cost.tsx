"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Wrench, PackageCheck, Coins } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface LaborCostData {
  montajToplam: number;
  paketToplam: number;
  toplam: number;
  adet: number; // dönemde paketlenen (bitmiş) adet
  montajBirim: number;
  paketBirim: number;
  birim: number;
}

const tl = (n: number) => `₺${formatNumber(Math.round(n))}`;
const tl2 = (n: number) =>
  `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function ProductionLaborCost({ data }: { data: LaborCostData }) {
  if (data.toplam <= 0) return null;
  const cards = [
    { title: "Montaj İşçilik", value: tl(data.montajToplam), sub: `${tl2(data.montajBirim)}/adet`, icon: Wrench, bg: "bg-amber-50", col: "text-vw-warning" },
    { title: "Paketleme İşçilik", value: tl(data.paketToplam), sub: `${tl2(data.paketBirim)}/adet`, icon: PackageCheck, bg: "bg-emerald-50", col: "text-vw-success" },
    { title: "Toplam İşçilik", value: tl(data.toplam), sub: `${tl2(data.birim)}/adet · ${formatNumber(data.adet)} adet`, icon: Coins, bg: "bg-blue-50", col: "text-vw-info" },
  ];
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">
          İşçilik Maliyeti <span className="text-xs font-normal text-muted-foreground">(seçili dönem · adet-ağırlıklı seans süreleri × saat ücreti)</span>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="flex items-start justify-between rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">{c.title}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{c.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.sub}</p>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`h-5 w-5 ${c.col}`} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
