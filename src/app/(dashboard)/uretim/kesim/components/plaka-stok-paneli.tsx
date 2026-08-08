"use client";

import { Card } from "@/components/ui/card";
import type { MdfStokItem } from "../types";
import { cn } from "@/lib/utils";
import { Layers, AlertTriangle } from "lucide-react";

/**
 * Kesimhane ekranında kalıcı plaka stok paneli.
 *
 * Kesim yapıldıkça all_parts.hazir_eleman_aktif_stok düşüyor ve sayfa
 * yeniden doğrulandığı için buradaki sayılar kendiliğinden güncelleniyor.
 * Amaç: talep karşılanabilir mi sorusunu ekranı terk etmeden cevaplamak.
 */
export function PlakaStokPaneli({ mdfStok }: { mdfStok: MdfStokItem[] }) {
  if (mdfStok.length === 0) return null;

  const toplam = mdfStok.reduce((s, m) => s + (m.hazir_eleman_aktif_stok ?? 0), 0);

  const kritikMi = (m: MdfStokItem) =>
    m.hazir_eleman_kritik_stok != null &&
    m.hazir_eleman_aktif_stok <= m.hazir_eleman_kritik_stok;

  const tukendiMi = (m: MdfStokItem) => m.hazir_eleman_aktif_stok <= 0;

  // Önce tükenenler, sonra kritikler, sonra stoğu az olanlar
  const sirali = [...mdfStok].sort((a, b) => {
    const skor = (m: MdfStokItem) => (tukendiMi(m) ? 0 : kritikMi(m) ? 1 : 2);
    const fark = skor(a) - skor(b);
    return fark !== 0 ? fark : a.hazir_eleman_aktif_stok - b.hazir_eleman_aktif_stok;
  });

  const kritikSayisi = mdfStok.filter((m) => kritikMi(m) || tukendiMi(m)).length;

  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-blue-600" />
          <span className="text-sm font-semibold">Plaka Stoğu</span>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold tabular-nums">
            {toplam.toLocaleString("tr-TR")}
          </span>
          <span className="ml-1 text-xs text-muted-foreground">plaka</span>
        </div>
      </div>

      {kritikSayisi > 0 && (
        <div className="mb-2 flex items-center gap-1.5 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
          <AlertTriangle className="size-3.5 shrink-0" />
          {kritikSayisi} çeşit kritik seviyede veya tükendi
        </div>
      )}

      <div className="space-y-1">
        {sirali.map((m) => {
          const tukendi = tukendiMi(m);
          const kritik = kritikMi(m);
          return (
            <div
              key={m.part_id}
              className={cn(
                "flex items-center justify-between gap-2 rounded px-2 py-1 text-xs",
                tukendi
                  ? "bg-red-100 text-red-800"
                  : kritik
                    ? "bg-amber-50 text-amber-800"
                    : "hover:bg-muted/50"
              )}
            >
              <span className="truncate">{m.part_adi ?? m.part_id}</span>
              <span
                className={cn(
                  "shrink-0 font-semibold tabular-nums",
                  tukendi ? "text-red-700" : kritik ? "text-amber-700" : "text-foreground"
                )}
              >
                {m.hazir_eleman_aktif_stok.toLocaleString("tr-TR")}
                {m.hazir_eleman_kritik_stok != null && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    /{m.hazir_eleman_kritik_stok.toLocaleString("tr-TR")}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        Kesim yapıldıkça sayılar otomatik düşer. Sağdaki ikinci sayı kritik eşiktir.
      </p>
    </Card>
  );
}
