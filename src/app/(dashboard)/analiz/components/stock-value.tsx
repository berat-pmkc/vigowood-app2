"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Warehouse } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export interface StockValueRow {
  sku: string;
  urunAdi: string;
  adet: number;
  birimMaliyet: number;
  deger: number;
}
export interface StockValueData {
  toplam: number;
  eksikSayi: number;
  urunler: StockValueRow[];
}

const tl = (n: number) => `₺${formatNumber(Math.round(n))}`;

export function StockValue({ data }: { data: StockValueData }) {
  if (data.toplam <= 0) return null;
  const max = Math.max(...data.urunler.map((u) => u.deger), 1);
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Warehouse className="size-4 text-vw-warning" />
            Envanter Değeri (Bitmiş Ürün)
          </CardTitle>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-foreground">{tl(data.toplam)}</p>
            <p className="text-[11px] text-muted-foreground">mamül stok × birim maliyet</p>
          </div>
        </div>
        {data.eksikSayi > 0 && (
          <p className="text-[11px] text-amber-700">
            {data.eksikSayi} üründe birim maliyet eksik — değerlemeye dahil edilmedi.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5 pb-4">
        <p className="mb-1 text-xs font-medium text-muted-foreground">En değerli 10 ürün</p>
        {data.urunler.map((u) => (
          <div key={u.sku} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 truncate font-mono">{u.sku}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded bg-[#cdbd9d]"
                style={{ width: `${(u.deger / max) * 100}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right font-medium tabular-nums">{tl(u.deger)}</span>
            <Badge variant="outline" className="hidden shrink-0 text-[9px] sm:inline-flex">
              {formatNumber(u.adet)} ad
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
