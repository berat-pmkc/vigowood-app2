"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { CutBatchRow } from "../types";
import { cn } from "@/lib/utils";
import { Layers, Search, Clock, Boxes, X } from "lucide-react";

/**
 * Dönem özeti + proje arama.
 *
 * Sol taraf: seçili tarih aralığında kesilen toplam plaka.
 * Sağ taraf: proje/plaka araması — bulunan kalemin hangi gün kaç adet
 * kesildiğini ve tahmini süresini gün gün gösterir.
 *
 * Süre gerçek ölçüm değil: plakalar.kesim_sureleri'ndeki makine bazlı
 * dakika değeri adetle çarpılıyor. Bu yüzden ekranda "tahmini" deniyor —
 * kesim kayıtlarında başlangıç/bitiş ayrı ayrı tutulmuyor.
 */
export function KesimDonemOzeti({
  records,
  donemEtiketi,
}: {
  records: CutBatchRow[];
  donemEtiketi: string;
}) {
  const [arama, setArama] = useState("");
  /** Rozetlerden seçilen proje; null ise hepsi */
  const [seciliProje, setSeciliProje] = useState<string | null>(null);

  const ozet = useMemo(() => {
    let plaka = 0;
    let sureDk = 0;
    const projeler = new Set<string>();
    for (const r of records) {
      plaka += r.adet ?? 0;
      if (r.kesim_suresi_dk) sureDk += (r.adet ?? 0) * r.kesim_suresi_dk;
      if (r.plaka_id) projeler.add(r.plaka_id);
    }
    return { plaka, sureDk, parti: records.length, proje: projeler.size };
  }, [records]);

  /** Aramaya uyan kayıtlar; proje rozeti seçiliyse ona daraltılır */
  const sonuc = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    if (q.length < 2) return null;

    const uyan = records.filter((r) =>
      [r.plaka_id, r.plaka_adi, r.sku, r.urun_adi]
        .some((v) => v && v.toLocaleLowerCase("tr").includes(q)),
    );
    if (uyan.length === 0) return { bos: true as const };

    const projeAdi = (r: CutBatchRow) => r.plaka_adi ?? r.plaka_id ?? "—";

    // Rozetler aramanın TAMAMINDAN çıkar; seçim yapılınca listeden kaybolmasın
    const projeler = new Map<string, number>();
    for (const r of uyan) {
      const ad = projeAdi(r);
      projeler.set(ad, (projeler.get(ad) ?? 0) + (r.adet ?? 0));
    }

    const secili = seciliProje && projeler.has(seciliProje) ? seciliProje : null;
    const kapsam = secili ? uyan.filter((r) => projeAdi(r) === secili) : uyan;

    const gunler = new Map<string, {
      tarih: string; adet: number; sureDk: number;
      makineler: Set<string>; operatorler: Set<string>;
    }>();

    let toplamAdet = 0;
    let toplamSure = 0;

    for (const r of kapsam) {
      const gun = r.tarih.slice(0, 10);
      const g = gunler.get(gun) ?? {
        tarih: gun, adet: 0, sureDk: 0,
        makineler: new Set<string>(), operatorler: new Set<string>(),
      };
      const sure = r.kesim_suresi_dk ? (r.adet ?? 0) * r.kesim_suresi_dk : 0;
      g.adet += r.adet ?? 0;
      g.sureDk += sure;
      if (r.makine_id) g.makineler.add(r.makine_id);
      if (r.operator_adi ?? r.operator_id) g.operatorler.add(r.operator_adi ?? r.operator_id!);
      gunler.set(gun, g);

      toplamAdet += r.adet ?? 0;
      toplamSure += sure;
    }

    return {
      bos: false as const,
      gunler: [...gunler.values()].sort((a, b) => b.tarih.localeCompare(a.tarih)),
      toplamAdet, toplamSure, parti: kapsam.length,
      projeler: [...projeler.entries()].sort((a, b) => b[1] - a[1]),
      secili,
    };
  }, [records, arama, seciliProje]);

  const sureYaz = (dk: number) => {
    if (!dk) return "—";
    const saat = Math.floor(dk / 60);
    const kalan = Math.round(dk % 60);
    return saat > 0 ? `${saat} sa ${kalan} dk` : `${kalan} dk`;
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(260px,340px)_1fr]">
      {/* Dönem toplamı */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Layers className="size-3.5" />
          Toplam Kesilen Plaka
        </div>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {ozet.plaka.toLocaleString("tr-TR")}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{donemEtiketi}</p>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-center">
          <div>
            <p className="text-sm font-semibold tabular-nums">{ozet.parti}</p>
            <p className="text-[11px] text-muted-foreground">kesim</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">{ozet.proje}</p>
            <p className="text-[11px] text-muted-foreground">proje</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">{sureYaz(ozet.sureDk)}</p>
            <p className="text-[11px] text-muted-foreground">tahmini</p>
          </div>
        </div>
      </Card>

      {/* Proje arama */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={arama}
            onChange={(e) => { setArama(e.target.value); setSeciliProje(null); }}
            placeholder="Proje veya plaka ara — ör. KD50C, PLK-318, kitaplık"
            className="pl-8 pr-8"
          />
          {arama && (
            <button
              type="button"
              onClick={() => { setArama(""); setSeciliProje(null); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Aramayı temizle"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {!sonuc && (
          <p className="mt-3 text-sm text-muted-foreground">
            Ürün kodu, plaka kodu veya proje adı yazın. Seçili dönemde o projeden
            hangi gün kaç plaka kesildiğini gösterir.
          </p>
        )}

        {sonuc?.bos && (
          <p className="mt-3 text-sm text-muted-foreground">
            <b>{donemEtiketi}</b> içinde eşleşen kesim yok. Üstteki tarih
            filtresinden başka bir dönem seçmeyi deneyin.
          </p>
        )}

        {sonuc && !sonuc.bos && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <Boxes className="size-3.5 text-muted-foreground" />
                <b className="tabular-nums">{sonuc.toplamAdet.toLocaleString("tr-TR")}</b> plaka
              </span>
              <span className="text-muted-foreground">{sonuc.parti} kesim</span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                <span className="tabular-nums">{sureYaz(sonuc.toplamSure)}</span>
                <span className="text-xs text-muted-foreground">tahmini</span>
              </span>
            </div>

            {sonuc.projeler.length > 1 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSeciliProje(null)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                    sonuc.secili === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted",
                  )}
                >
                  Tümü
                </button>
                {sonuc.projeler.map(([ad, adet]) => (
                  <button
                    key={ad}
                    type="button"
                    onClick={() => setSeciliProje(sonuc.secili === ad ? null : ad)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                      sonuc.secili === ad
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted",
                    )}
                  >
                    {ad}
                    <span className="ml-1.5 opacity-70 tabular-nums">{adet}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 max-h-[280px] overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs">
                  <tr>
                    <th className="px-2.5 py-1.5 text-left font-medium">Tarih</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Plaka</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Süre</th>
                    <th className="px-2.5 py-1.5 text-left font-medium">Makine</th>
                    <th className="px-2.5 py-1.5 text-left font-medium">Operatör</th>
                  </tr>
                </thead>
                <tbody>
                  {sonuc.gunler.map((g) => (
                    <tr key={g.tarih} className="border-t">
                      <td className="px-2.5 py-1.5">
                        {new Date(g.tarih).toLocaleDateString("tr-TR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                        })}
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-medium tabular-nums">
                        {g.adet.toLocaleString("tr-TR")}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                        {sureYaz(g.sureDk)}
                      </td>
                      <td className="px-2.5 py-1.5 text-xs text-muted-foreground">
                        {[...g.makineler].join(", ") || "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-xs text-muted-foreground">
                        {[...g.operatorler].join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              Süre tahminidir: plakanın makine bazlı kesim süresi adetle çarpılır.
              Kesim kayıtlarında gerçek başlangıç/bitiş ayrı tutulmuyor.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
