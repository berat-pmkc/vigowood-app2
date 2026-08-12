"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, TriangleAlert } from "lucide-react";

export interface IhtiyacSatiri {
  part_id: string;
  part_adi: string | null;
  tur: string;
  gereken: number;
  eldeki: number;
  net: number;
  urun_sayisi: number;
}
export interface SevkiyatSecenegi {
  sevkiyat_id: string;
  durum: string;
  sevkiyat_adi: string | null;
  ulke: string | null;
}

const TUR_ETIKET: Record<string, string> = {
  YARIMAMUL: "Kesilecek",
  HAZIR: "Hazır eleman",
  KUTU: "Kutu",
  KARTON: "Karton",
  BİLİNMİYOR: "Tanımsız",
};

export function IhtiyacClient({
  sevkiyatlar, seciliSevkiyat, satirlar, urunOzeti,
}: {
  sevkiyatlar: SevkiyatSecenegi[];
  seciliSevkiyat: string;
  satirlar: IhtiyacSatiri[];
  urunOzeti: { cesit: number; adet: number; eksik: number };
}) {
  const router = useRouter();
  const [tur, setTur] = useState("YARIMAMUL");
  const [arama, setArama] = useState("");
  const [sadeceEksik, setSadeceEksik] = useState(true);

  const turler = useMemo(
    () => [...new Set(satirlar.map((s) => s.tur))]
      .sort((a, b) => (a === "YARIMAMUL" ? -1 : b === "YARIMAMUL" ? 1 : a.localeCompare(b))),
    [satirlar],
  );

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    return satirlar.filter((s) => {
      if (tur !== "hepsi" && s.tur !== tur) return false;
      if (sadeceEksik && s.net <= 0) return false;
      if (!q) return true;
      return s.part_id.toLocaleLowerCase("tr").includes(q)
        || (s.part_adi ?? "").toLocaleLowerCase("tr").includes(q);
    });
  }, [satirlar, tur, arama, sadeceEksik]);

  const kesilecek = satirlar.filter((s) => s.tur === "YARIMAMUL" && s.net > 0);

  const sevkiyatDegis = (id: string) => {
    router.push(id ? `/uretim/kesim/ihtiyac?sevkiyat=${id}` : "/uretim/kesim/ihtiyac");
  };

  return (
    <div className="space-y-4">
      {/* Sevkiyat seçimi */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Sevkiyat:</span>
          <button
            type="button" onClick={() => sevkiyatDegis("")}
            className={cn("rounded-full border px-3 py-1 text-xs transition-colors",
              !seciliSevkiyat ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            Tümü ({sevkiyatlar.length})
          </button>
          {sevkiyatlar.map((s) => (
            <button
              key={s.sevkiyat_id} type="button" onClick={() => sevkiyatDegis(s.sevkiyat_id)}
              className={cn("rounded-full border px-3 py-1 text-xs transition-colors",
                seciliSevkiyat === s.sevkiyat_id
                  ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {s.sevkiyat_id}
              <span className="ml-1.5 opacity-70">{s.durum === "bekliyor" ? "bekliyor" : "hazırlanıyor"}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Özet */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Sevkiyattaki ürün", urunOzeti.adet.toLocaleString("tr-TR"), `${urunOzeti.cesit} çeşit`],
          ["Üretilecek ürün", urunOzeti.eksik.toLocaleString("tr-TR"), "stok düşülmüş"],
          ["Kesilecek parça çeşidi", String(kesilecek.length), "yarı mamül"],
          ["Kesilecek toplam", kesilecek.reduce((t, s) => t + s.net, 0).toLocaleString("tr-TR"), "adet"],
        ].map(([b, d, alt]) => (
          <Card key={b} className="p-3">
            <p className="text-xs text-muted-foreground">{b}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{d}</p>
            <p className="text-xs text-muted-foreground">{alt}</p>
          </Card>
        ))}
      </div>

      {urunOzeti.eksik === 0 && urunOzeti.adet > 0 && (
        <Card className="border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          Sevkiyattaki ürünlerin tamamı stokta görünüyor, üretim gerekmiyor.
          Mamül stoğu henüz yüklenmediyse bu sonuç yanıltıcı olabilir.
        </Card>
      )}

      {/* Filtreler */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {["hepsi", ...turler].map((t) => (
              <button
                key={t} type="button" onClick={() => setTur(t)}
                className={cn("rounded-full border px-3 py-1 text-xs transition-colors",
                  tur === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                {t === "hepsi" ? "Hepsi" : TUR_ETIKET[t] ?? t}
              </button>
            ))}
          </div>
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={arama} onChange={(e) => setArama(e.target.value)}
                   placeholder="Parça ara" className="pl-8" />
          </div>
          <button
            type="button" onClick={() => setSadeceEksik((v) => !v)}
            className={cn("rounded-full border px-3 py-1 text-xs transition-colors",
              sadeceEksik ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            Sadece eksikler
          </button>
        </div>
      </Card>

      {/* Tablo */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Parça</th>
                <th className="px-3 py-2 text-left font-medium">Ad</th>
                <th className="px-3 py-2 text-left font-medium">Tür</th>
                <th className="px-3 py-2 text-right font-medium">Gereken</th>
                <th className="px-3 py-2 text-right font-medium">Eldeki</th>
                <th className="px-3 py-2 text-right font-medium">Net ihtiyaç</th>
              </tr>
            </thead>
            <tbody>
              {gorunen.length === 0 ? (
                <tr><td colSpan={6} className="h-24 text-center text-muted-foreground">
                  Kayıt yok
                </td></tr>
              ) : gorunen.slice(0, 300).map((s) => (
                <tr key={s.part_id} className="border-t">
                  <td className="px-3 py-1.5 font-mono text-xs">{s.part_id}</td>
                  <td className="px-3 py-1.5">{s.part_adi ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant="secondary" className="text-[11px]">
                      {TUR_ETIKET[s.tur] ?? s.tur}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {s.gereken.toLocaleString("tr-TR")}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {s.eldeki.toLocaleString("tr-TR")}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right font-medium tabular-nums",
                    s.net > 0 ? "text-red-700" : "text-emerald-700")}>
                    {s.net > 0 ? s.net.toLocaleString("tr-TR") : "yeterli"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {gorunen.length > 300 && (
          <p className="border-t p-3 text-xs text-muted-foreground">
            {gorunen.length} satırın ilk 300&apos;ü gösteriliyor.
          </p>
        )}
      </Card>

      <Card className="border-amber-300 bg-amber-50 p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <TriangleAlert className="size-4" />
          Bu hesap neye dayanıyor
        </p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-amber-800">
          <li>Yalnızca <b>bekliyor</b> ve <b>hazırlanıyor</b> sevkiyatlar sayılır.</li>
          <li>Sevkiyat adedinden mevcut mamül stoğu düşülür, kalan üretilecek kabul edilir.</li>
          <li>Reçetedeki <b>ASM-</b> satırları atlanır — onlar önceki montaj adımının
              çıktısı, ayrı malzeme değil.</li>
          <li><b>Eldeki</b> sütunu parça stok bakiyelerinden gelir. Yarı mamül sayımı
              yapılmadığı sürece bu değer güvenilir değildir; o zamana kadar
              <b> Gereken</b> sütununu esas alın.</li>
        </ul>
      </Card>
    </div>
  );
}
