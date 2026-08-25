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

  /** Son haftanın karışım düzeltmeli durumu */
  const haftaBulgu = useMemo(() => {
    if (!veri || veri.haftalik.length < 2) return null;
    const son = veri.haftalik[veri.haftalik.length - 1];
    const oncekiler = veri.haftalik.slice(0, -1);
    const ortOran = oncekiler.reduce((t, h) => t + h.oran, 0) / oncekiler.length;
    return { son, ortOran };
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
                <b>Şu an</b> = ürünün <b>medyan</b> işçiliği (ortalama değil, tek
                uzun seans bozmasın diye). <b>Ulaşılabilir</b> = temiz seansların
                iyi çeyreği (P25) — zaten defalarca yakaladığınız hız, teorik hedef
                değil. Kapatılmayı unutulan (4 saat üstü) ve öğle molasını kapsayan
                seanslar hesaba katılmaz; aksi halde fark olduğundan büyük görünür.
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
                  <tfoot>
                    <tr className="border-t-2 border-emerald-300 bg-emerald-50/60 font-medium">
                      <td className="px-2 py-1.5">TOPLAM</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {veri.potansiyel.reduce((t, x) => t + x.adet, 0).toLocaleString("tr-TR")}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-amber-700">
                        {veri.potansiyel.reduce((t, x) => t + x.kazanilabilirSaat, 0)} saat
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {(() => {
                const toplamKazanc = veri.potansiyel.reduce((t, x) => t + x.kazanilabilirSaat, 0);
                const toplamAdet = veri.potansiyel.reduce((t, x) => t + x.adet, 0);
                // 1 kişinin dönemdeki net mesaisi: çalışılan gün × 7,5 saat
                // (öğle molası hariç — hesap zaten molalı seansları eliyor).
                const NET_SAAT = 7.5;
                const kisiSaat = veri.calisilanGun * NET_SAAT;
                const kisiKapasite = kisiSaat > 0 ? toplamKazanc / kisiSaat : 0;
                return (
                  <p className="mt-2 rounded border border-emerald-300 bg-emerald-50 p-2 text-xs leading-relaxed text-emerald-900">
                    Değerlendirilen <b>{toplamAdet.toLocaleString("tr-TR")} ürün</b>de
                    toplam <b>{toplamKazanc} saat</b> iş gücü geri kazanılabilir.
                    {veri.calisilanGun > 0 && kisiKapasite >= 0.1 && (
                      <>
                        {" "}Bu dönemde <b>{veri.calisilanGun} gün</b> paketleme
                        yapıldı; kişi başı ~7,5 saat üzerinden bu kayıp kabaca{" "}
                        <b>{kisiKapasite.toFixed(1)} kişilik</b> iş gücüne denk.
                      </>
                    )}
                    <br />
                    <span className="text-emerald-700">
                      Not: Teorik ÜST SINIR — her ürün her seansta kendi iyi çeyreği
                      (P25) hızında paketlenseydi. Gerçekte hep o hıza ulaşılmaz;
                      &quot;fazla işçi&quot; kararı değil, iyileştirme kapasitesinin
                      kaba ölçüsüdür. Hesap SKU seviyesinde yapılır.
                    </span>
                  </p>
                );
              })()}
            </Card>
          )}

          {/* 3. Haftalık tempo ve verimlilik */}
          {veri.haftalik.length > 0 && (
            <Card className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Haftalık tempo ve verimlilik</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Çubuk haftalık <b>paketlenen adet</b>. Mavi çizgi{" "}
                <b>verimlilik oranı</b>: gerçekleşen işçiliğin, o haftaki ürün
                karışımına göre beklenen işçiliğe oranı. <b>1,00 normal</b>;
                üstü beklenenden kötü, altı iyi. Ham dk/adet bakmak yanıltıcı —
                ağır ürün paketlenen hafta kendiliğinden yükselir.
              </p>
              <Grafik tip="hafta" veri={veri.haftalik} />

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Hafta</th>
                      <th className="px-2 py-1.5 text-right font-medium">Adet</th>
                      <th className="px-2 py-1.5 text-right font-medium">Seans</th>
                      <th className="px-2 py-1.5 text-right font-medium">Gerçekleşen</th>
                      <th className="px-2 py-1.5 text-right font-medium">Beklenen</th>
                      <th className="px-2 py-1.5 text-right font-medium">Oran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veri.haftalik.map((h) => (
                      <tr key={h.hafta} className="border-t">
                        <td className="px-2 py-1.5">{h.etiket}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {h.adet.toLocaleString("tr-TR")}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{h.seans}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{h.gerceklesen.toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {h.beklenen.toFixed(2)}
                        </td>
                        <td className={cn("px-2 py-1.5 text-right font-medium tabular-nums",
                          h.oran <= 1 ? "text-emerald-700" : "text-red-700")}>
                          {h.oran.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {haftaBulgu && (
                <div className={cn("mt-2 rounded border p-2 text-xs leading-relaxed",
                  haftaBulgu.son.oran > 1.1
                    ? "border-red-300 bg-red-50 text-red-900"
                    : "border-emerald-300 bg-emerald-50 text-emerald-900")}>
                  {haftaBulgu.son.oran > 1.1 ? (
                    <>
                      <TriangleAlert className="mr-1 inline size-3.5" />
                      Son hafta oranı <b>{haftaBulgu.son.oran.toFixed(2)}</b> — karışıma
                      göre beklenenden kötü. Sebebi ürün değil, süreçte bir şey.
                    </>
                  ) : (
                    <>
                      Verimlilik beklenen seviyede (son hafta{" "}
                      <b>{haftaBulgu.son.oran.toFixed(2)}</b>, önceki haftaların
                      ortalaması <b>{haftaBulgu.ortOran.toFixed(2)}</b>). Ham
                      dk/adet oynasa bile bu oran sabitse süreç bozulmamıştır.
                    </>
                  )}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
