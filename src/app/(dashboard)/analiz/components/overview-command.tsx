"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Factory, PackageCheck, Scissors, DollarSign, Coins,
  TrendingUp, Percent, Truck, ArrowUpRight, ArrowDownRight, ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface OverviewCommandData {
  paketleme: number;
  montaj: number;
  kesim: number;
  ciro: number;
  maliyet: number;
  kar: number;
  marj: number;
  bekleyenSevkiyat: number;
  deltas: {
    paketleme: number | null;
    montaj: number | null;
    kesim: number | null;
    ciro: number | null;
  };
}

interface Kart {
  key: string;
  baslik: string;
  deger: string;
  alt?: string;
  delta: number | null;
  hedef: string | null;
  ikon: LucideIcon;
  bg: string;
  col: string;
}

const tl = (n: number) => `₺${formatNumber(Math.round(n))}`;

export function OverviewCommand({
  data,
  onNavigate,
}: {
  data: OverviewCommandData;
  onNavigate: (tab: string) => void;
}) {
  const kartlar: Kart[] = [
    { key: "paketleme", baslik: "Paketleme (Üretim)", deger: formatNumber(data.paketleme), alt: "bitmiş adet", delta: data.deltas.paketleme, hedef: "uretim", ikon: Factory, bg: "bg-emerald-50", col: "text-vw-success" },
    { key: "montaj", baslik: "Montaj", deger: formatNumber(data.montaj), alt: "adet", delta: data.deltas.montaj, hedef: "uretim", ikon: PackageCheck, bg: "bg-amber-50", col: "text-vw-warning" },
    { key: "kesim", baslik: "Plaka Kesim", deger: formatNumber(data.kesim), alt: "plaka", delta: data.deltas.kesim, hedef: "uretim", ikon: Scissors, bg: "bg-blue-50", col: "text-vw-info" },
    { key: "ciro", baslik: "Ciro", deger: tl(data.ciro), alt: "dönem satışı", delta: data.deltas.ciro, hedef: "satis", ikon: DollarSign, bg: "bg-emerald-50", col: "text-vw-success" },
    { key: "maliyet", baslik: "Toplam Maliyet", deger: tl(data.maliyet), alt: "satılan malların", delta: null, hedef: "karlilik", ikon: Coins, bg: "bg-amber-50", col: "text-vw-warning" },
    { key: "kar", baslik: "Kâr", deger: tl(data.kar), alt: "ciro − maliyet", delta: null, hedef: "karlilik", ikon: TrendingUp, bg: "bg-blue-50", col: "text-vw-info" },
    { key: "marj", baslik: "Kâr Marjı", deger: `%${data.marj.toFixed(1)}`, alt: "kâr / ciro", delta: null, hedef: "karlilik", ikon: Percent, bg: "bg-purple-50", col: "text-purple-600" },
    { key: "sevkiyat", baslik: "Bekleyen Sevkiyat", deger: formatNumber(data.bekleyenSevkiyat), alt: "bekliyor + hazırlanıyor", delta: null, hedef: null, ikon: Truck, bg: "bg-purple-50", col: "text-purple-600" },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kartlar.map((k) => {
          const tiklanir = k.hedef != null;
          return (
            <Card
              key={k.key}
              onClick={tiklanir ? () => onNavigate(k.hedef!) : undefined}
              className={`border-border/50 transition ${tiklanir ? "cursor-pointer hover:border-[#a99c7d] hover:shadow-md" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <p className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{k.baslik}</p>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${k.bg}`}>
                    <k.ikon className={`h-5 w-5 ${k.col}`} />
                  </div>
                </div>
                <p className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums text-foreground">{k.deger}</p>
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {k.delta != null && (
                      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${k.delta >= 0 ? "text-vw-success" : "text-vw-error"}`}>
                        {k.delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                        %{Math.abs(k.delta).toFixed(0)}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {k.delta != null ? "geçen döneme göre" : k.alt}
                    </span>
                  </div>
                  {tiklanir && <ChevronRight className="size-4 text-muted-foreground" />}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Karta tıkla → ilgili detay ve grafiklere geç. Değişimler bir önceki döneme göredir.
      </p>
    </div>
  );
}
