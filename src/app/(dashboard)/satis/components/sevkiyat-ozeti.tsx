"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Ship, Package, Layers, Weight, ArrowRight } from "lucide-react";

interface UlkeSatiri {
  country: string;
  ulke: string;
  sevkiyatSayisi: number;
  adet: number;
  palet: number;
  kg: number;
}
interface UrunSatiri { sku: string; adet: number; ulkeDagilim: string }

const BAYRAK: Record<string, string> = { DE: "🇩🇪", UK: "🇬🇧", USA: "🇺🇸", US: "🇺🇸", FR: "🇫🇷" };

export function SevkiyatOzeti({
  ulkeler, urunler, toplam,
}: {
  ulkeler: UlkeSatiri[];
  urunler: UrunSatiri[];
  toplam: { sevkiyat: number; adet: number; palet: number; kg: number };
}) {
  const [hepsi, setHepsi] = useState(false);
  const gosterilen = hepsi ? urunler : urunler.slice(0, 12);

  if (toplam.sevkiyat === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Ship className="size-4 text-muted-foreground" />
            İhracat Sevkiyatları
          </CardTitle>
          <Link href="/sevkiyat" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Sevkiyat ekranı <ArrowRight className="size-3" />
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Konteynerle yurtdışına giden fiziksel çıkışlar. Satış faturalarından
          ayrı — hangi ülkeye ne kadar, hangi üründen kaç adet gönderildiği.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        {/* Özet rozetler */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { ikon: Ship, et: "Sevkiyat", v: toplam.sevkiyat.toLocaleString("tr-TR") },
            { ikon: Package, et: "Toplam adet", v: toplam.adet.toLocaleString("tr-TR") },
            { ikon: Layers, et: "Palet", v: toplam.palet.toLocaleString("tr-TR") },
            { ikon: Weight, et: "Ağırlık (kg)", v: toplam.kg.toLocaleString("tr-TR") },
          ].map((k) => (
            <div key={k.et} className="rounded-lg border p-2.5">
              <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <k.ikon className="size-3.5" /> {k.et}
              </div>
              <p className="text-lg font-bold tabular-nums">{k.v}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Ülke bazlı */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Ülkeye göre</p>
            <div className="rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ülke</TableHead>
                    <TableHead className="text-right">Sevkiyat</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">Palet</TableHead>
                    <TableHead className="text-right">kg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ulkeler.map((u) => (
                    <TableRow key={u.country}>
                      <TableCell className="font-medium">
                        {BAYRAK[u.country] ?? ""} {u.ulke}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{u.sevkiyatSayisi}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{u.adet.toLocaleString("tr-TR")}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{u.palet.toLocaleString("tr-TR")}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{u.kg.toLocaleString("tr-TR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Ürün bazlı */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Ürüne göre (gönderilen adet)</p>
              {urunler.length > 12 && (
                <button type="button" onClick={() => setHepsi(!hepsi)} className="text-xs text-muted-foreground hover:text-foreground">
                  {hepsi ? "Daha az" : `Tümü (${urunler.length})`}
                </button>
              )}
            </div>
            <div className="max-h-[320px] overflow-y-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ürün</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead>Ülke dağılımı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gosterilen.map((p) => (
                    <TableRow key={p.sku}>
                      <TableCell className="font-mono text-xs font-medium">{p.sku}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{p.adet.toLocaleString("tr-TR")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.ulkeDagilim}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          <Badge variant="outline" className="mr-1 text-[10px]">Not</Badge>
          Tüm sevkiyatların toplamı gösteriliyor (satış dönem filtresinden bağımsız);
          sevkiyatlar aylık satıştan farklı bir takvimde ilerliyor.
        </p>
      </CardContent>
    </Card>
  );
}
