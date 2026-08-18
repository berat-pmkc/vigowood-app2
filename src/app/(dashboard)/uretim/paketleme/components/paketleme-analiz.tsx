"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPaketlemeAnaliz, type AnalizVerisi } from "../actions";
import { cn } from "@/lib/utils";
import { TrendingUp, Users, Package, TriangleAlert, Target } from "lucide-react";

// Recharts ağır; sayfa açılışını bekletmesin
const Grafik = dynamic(() => import("./paketleme-analiz-grafik").then((m) => m.PaketlemeAnalizGrafik), {
  ssr: false,
  loading: () => <Skeleton className="h-[280px] w-full" />,
});

type Donem = "month" | "last_month" | "all";

const DONEM_ETIKET: Record<Donem, string> = {
  month: "Bu Ay",
  last_month: "Geçen Ay",
  all: "Tüm Zamanlar",
};

export function PaketlemeAnaliz() {
  const [donem, setDonem] = useState<Donem>("month");
  // Ürün grubu varsayılan: tek tek SKU yerine model bazında bakmak daha okunur
  const [kirilim, setKirilim] = useState<"sku" | "grup">("grup");
  const [veri, setVeri] = useState<AnalizVerisi | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    let iptal = false;
    setYukleniyor(true);
    getPaketlemeAnaliz(donem, kirilim).then((r) => {
      if (iptal) return;
      setVeri(r.success ? r.data : null);
      setYukleniyor(false);
    });
    return () => { iptal = true; };
  }, [donem, kirilim]);

  /** 80% eşiğini geçen ilk ürün — Pareto'nun kritik azınlığı */
  const paretoEsik = useMemo(() => {
    if (!veri) return null;
    const i = veri.pareto.findIndex((p) => p.kumulatif >= 80);
    return i >= 0 ? i + 1 : null;
  }, [veri]);

  /** Ürünlerin ne kadarında 3 kişi daha hızlı + ortalama kazanç */
  const kisiBulgu = useMemo(() => {
    if (!veri || veri.kisiEtkisi.length < 3) return null;
    const d = veri.kisiEtkisi;
    const hizli = d.filter((x) => x.hiz3 < x.hiz2).length;
    const hizKazanc = (d.reduce((t, x) => t + (x.hiz2 - x.hiz3) / x.hiz2, 0) / d.length) * 100;
    const iscilikArtis =
      (d.reduce((t, x) => t + (x.iscilik3 - x.iscilik2) / x.iscilik2, 0) / d.length) * 100;
    return { toplam: d.length, hizli, hizKazanc, iscilikArtis };
  }, [veri]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Paketleme Analizi</h2>
        <div className="flex flex-wrap gap-1.5">
          <div className="mr-2 flex gap-1.5 rounded-full border p-0.5">
            {([["grup", "Ürün grubu"], ["sku", "Tek tek ürün"]] as const).map(([k, e]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKirilim(k)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs transition-colors",
                  kirilim === k ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {e}
              </button>
            ))}
          </div>
          {(Object.keys(DONEM_ETIKET) as Donem[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDonem(d)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                donem === d
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {DONEM_ETIKET[d]}
            </button>
          ))}
        </div>
      </div>

      {yukleniyor ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[320px]" />
          <Skeleton className="h-[320px]" />
        </div>
      ) : !veri || veri.pareto.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Bu dönemde tamamlanmış paketleme seansı yok.
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {/* 1. Pareto — işçilik dakikası */}
            <Card className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <TrendingUp className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">
                  İşçilik yükü — Pareto
                </h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Hangi ürün paketleme iş gücünün ne kadarını yiyor. Çubuk toplam
                işçilik dakikası, çizgi kümülatif pay.
              </p>
              <Grafik tip="pareto" veri={veri.pareto} />
              {paretoEsik && (
                <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  İş gücünün <b>%80&apos;i</b> yalnızca <b>{paretoEsik} ürüne</b> gidiyor.
                  İyileştirme yapacaksanız önce bunlara bakın.
                </p>
              )}
            </Card>

            {/* 2. En çok paketlenen ürünler */}
            <Card className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <Package className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">En çok paketlenen ürünler</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Adet bazında. İşçilik sıralamasıyla farklıysa, çok üretilen ama
                hızlı paketlenen ürünler var demektir.
              </p>
              <Grafik tip="adet" veri={veri.pareto} />
            </Card>
          </div>


          {/* 4. İyileştirme potansiyeli */}
          {veri.potansiyel.length > 0 && (
            <Card className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <Target className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">İyileştirme potansiyeli</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Yeşil kısım <b>ulaşılabilir süre</b> — ürünün kendi en iyi %20
                seansının ortalaması, yani zaten defalarca yakaladığınız hız.
                Turuncu kısım <b>kazanılabilir</b> fark. Teorik hedef değil,
                kendi kayıtlarınız.
              </p>
              <Grafik tip="potansiyel" veri={veri.potansiyel} />

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Ürün grubu</th>
                      <th className="px-2 py-1.5 text-right font-medium">Adet</th>
                      <th className="px-2 py-1.5 text-right font-medium">Şu an</th>
                      <th className="px-2 py-1.5 text-right font-medium">Ulaşılabilir</th>
                      <th className="px-2 py-1.5 text-right font-medium">Kazanç</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veri.potansiyel.slice(0, 10).map((x) => (
                      <tr key={x.grup} className="border-t">
                        <td className="px-2 py-1.5">{x.grup}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {x.adet.toLocaleString("tr-TR")}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{x.ortalama.toFixed(2)} dk</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">
                          {x.hedef.toFixed(2)} dk
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums text-amber-700">
                          {x.kazanilabilirSaat} saat
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-2 rounded border border-emerald-300 bg-emerald-50 p-2 text-xs leading-relaxed text-emerald-900">
                İlk 10 grupta toplam{" "}
                <b>
                  {veri.potansiyel.slice(0, 10).reduce((t, x) => t + x.kazanilabilirSaat, 0)} saat
                </b>{" "}
                iş gücü geri kazanılabilir. Hesap SKU seviyesinde yapılır — grup
                içindeki büyük ve küçük ürünler birbiriyle kıyaslanmaz.
              </p>
            </Card>
          )}

          {/* 3. Kişi sayısı etkisi */}
          {veri.kisiEtkisi.length > 0 && (
            <Card className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Kişi sayısı gerçekten hızlandırıyor mu?</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                <b>Aynı ürün</b> üzerinde 2 kişi ile 3 kişi karşılaştırılıyor —
                ürün sabitlenmeden bakmak yanıltıcıydı, çünkü ekipler farklı
                ürünlere atanıyor. Çubuklar adet başına <b>gerçek süre</b>
                (duvar saati); kısa olan daha hızlı.
              </p>
              <Grafik tip="kisi" veri={veri.kisiEtkisi} />

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Ürün</th>
                      <th className="px-2 py-1.5 text-right font-medium">Hız 2 kişi</th>
                      <th className="px-2 py-1.5 text-right font-medium">Hız 3 kişi</th>
                      <th className="px-2 py-1.5 text-right font-medium">Hız kazancı</th>
                      <th className="px-2 py-1.5 text-right font-medium">İşçilik 2 / 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veri.kisiEtkisi.map((x) => {
                      const kazanc = ((x.hiz2 - x.hiz3) / x.hiz2) * 100;
                      return (
                        <tr key={x.sku} className="border-t">
                          <td className="px-2 py-1.5 font-mono">{x.sku}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{x.hiz2.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{x.hiz3.toFixed(2)}</td>
                          <td className={cn("px-2 py-1.5 text-right font-medium tabular-nums",
                            kazanc > 0 ? "text-emerald-700" : "text-red-700")}>
                            %{kazanc.toFixed(0)}
                          </td>
                          <td className={cn("px-2 py-1.5 text-right tabular-nums",
                            x.iscilik3 > x.iscilik2 ? "text-red-700" : "text-emerald-700")}>
                            {x.iscilik2.toFixed(2)} / {x.iscilik3.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {kisiBulgu && (
                <div className="mt-2 rounded border border-blue-300 bg-blue-50 p-2 text-xs leading-relaxed text-blue-900">
                  <b>{kisiBulgu.toplam} üründen {kisiBulgu.hizli}&apos;inde</b> 3 kişi
                  daha hızlı — ortalama <b>%{kisiBulgu.hizKazanc.toFixed(0)}</b> hız
                  kazancı. Buna karşılık adet başına işçilik ortalama{" "}
                  <b>%{Math.abs(kisiBulgu.iscilikArtis).toFixed(0)}</b>{" "}
                  {kisiBulgu.iscilikArtis > 0 ? "artıyor" : "azalıyor"}.
                  <br />
                  Yani 3. kişi işe yarıyor ama bedava değil: <b>termin baskısı
                  varsa</b> 3 kişi doğru, <b>maliyet önceliğinizse</b> 2 kişi daha
                  verimli.
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
