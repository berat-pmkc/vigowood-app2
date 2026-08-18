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

  const kisiBulgu = useMemo(() => {
    if (!veri) return null;
    const iki = veri.kisiEtkisi.find((k) => k.kisi === 2);
    const uc = veri.kisiEtkisi.find((k) => k.kisi === 3);
    if (!iki || !uc || iki.seans < 5 || uc.seans < 5) return null;
    const kazanc = ((iki.gercekDk - uc.gercekDk) / iki.gercekDk) * 100;
    return { iki, uc, kazanc };
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
          <Card className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Kişi sayısı gerçekten hızlandırıyor mu?</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Mavi çubuk <b>birim süre</b> (dk/adet/kişi) — kişi arttıkça matematiksel
              olarak düşer. Turuncu çizgi <b>gerçek geçen süre</b> (dk/adet) — asıl
              hızı bu gösterir. Turuncu düzse, eklenen kişi hıza katkı vermiyor.
            </p>
            <Grafik tip="kisi" veri={veri.kisiEtkisi} />

            {kisiBulgu && (
              <div
                className={cn(
                  "mt-2 rounded border p-2 text-xs",
                  kisiBulgu.kazanc < 10
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-emerald-300 bg-emerald-50 text-emerald-900",
                )}
              >
                {kisiBulgu.kazanc < 10 ? (
                  <>
                    <TriangleAlert className="mr-1 inline size-3.5" />
                    2 kişiyle adet başına <b>{kisiBulgu.iki.gercekDk.toFixed(2)} dk</b>,
                    3 kişiyle <b>{kisiBulgu.uc.gercekDk.toFixed(2)} dk</b>. Yani
                    %50 daha fazla işçilikle yalnızca{" "}
                    <b>%{kisiBulgu.kazanc.toFixed(1)}</b> hız kazanılıyor — 3. kişi
                    başka istasyonda daha faydalı olabilir.
                  </>
                ) : (
                  <>
                    3 kişi, 2 kişiye göre adet başına{" "}
                    <b>%{kisiBulgu.kazanc.toFixed(1)}</b> hız kazandırıyor.
                  </>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
