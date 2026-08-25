"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getKesimAnaliz, type KesimAnalizi } from "../../actions";
import { sonHaftalar, sonAylar, donemAciklama } from "@/lib/donem";
import { cn } from "@/lib/utils";
import {
  Scissors, Layers, Package, Boxes, Info, ArrowLeft, Gauge, Palette, TriangleAlert,
} from "lucide-react";

const Grafik = dynamic(
  () => import("./kesim-rapor-grafik").then((m) => m.KesimRaporGrafik),
  { ssr: false, loading: () => <Skeleton className="h-[240px] w-full" /> },
);

export function KesimRaporClient() {
  const [donem, setDonem] = useState<string>("tum");
  const [veri, setVeri] = useState<KesimAnalizi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const haftalar = useMemo(() => sonHaftalar(12), []);
  const aylar = useMemo(() => sonAylar(12), []);
  const haftaSecili = donem.includes(".");
  const aySecili = /^\d{4}_\d{2}$/.test(donem);

  useEffect(() => {
    let iptal = false;
    setYukleniyor(true);
    getKesimAnaliz(donem).then((r) => {
      if (iptal) return;
      if (r.success) { setVeri(r.data); setHata(null); }
      else { setVeri(null); setHata(r.error); }
      setYukleniyor(false);
    });
    return () => { iptal = true; };
  }, [donem]);

  const paretoEsik = useMemo(() => {
    if (!veri) return null;
    const i = veri.plakaPareto.findIndex((p) => p.kumulatif >= 80);
    return i >= 0 ? i + 1 : null;
  }, [veri]);

  const acikVerenler = useMemo(
    () => (veri?.parcalar ?? []).filter((p) => p.bakiye < 0).slice(0, 12),
    [veri],
  );
  const birikenler = useMemo(
    () => (veri?.parcalar ?? []).filter((p) => p.bakiye > 0).sort((a, b) => b.bakiye - a.bakiye).slice(0, 12),
    [veri],
  );

  const enYuklu = veri?.makineYuku[0];
  const enBos = veri?.makineYuku[veri.makineYuku.length - 1];
  const dengesizlik = enYuklu && enBos && enBos.saat > 0
    ? Math.round(((enYuklu.saat - enBos.saat) / enBos.saat) * 100)
    : 0;

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/uretim/kesim" className="rounded-md p-1.5 hover:bg-muted">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Kesimhane Raporu</h1>
            <p className="text-sm text-muted-foreground">{donemAciklama(donem)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["tum", "bugun"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDonem(d)}
              className={cn(
                "h-8 rounded-md border px-3 text-xs",
                donem === d ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
              )}
            >
              {d === "tum" ? "Tüm Zamanlar" : "Bugün"}
            </button>
          ))}
          <Select value={haftaSecili ? donem : ""} onValueChange={setDonem}>
            <SelectTrigger className={cn("h-8 w-[130px] text-xs", haftaSecili && "border-primary bg-primary/10")}>
              <SelectValue placeholder="Hafta" />
            </SelectTrigger>
            <SelectContent>
              {haftalar.map((h) => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={aySecili ? donem : ""} onValueChange={setDonem}>
            <SelectTrigger className={cn("h-8 w-[120px] text-xs", aySecili && "border-primary bg-primary/10")}>
              <SelectValue placeholder="Ay" />
            </SelectTrigger>
            <SelectContent>
              {aylar.map((a) => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {yukleniyor ? (
        <Skeleton className="h-[500px]" />
      ) : hata ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{hata}</Card>
      ) : !veri || veri.kpi.kesim === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {donemAciklama(donem)} için kesim kaydı yok.
        </Card>
      ) : (
        <>
          {/* ── Kısıt notu ─────────────────────────────────── */}
          <div className="flex gap-2 rounded border border-[#a99c7d]/40 bg-[#f0ede1] p-3 text-xs text-[#474237]">
            <Info className="mt-0.5 size-4 shrink-0" />
            <span>
              Kesimlerde gerçek başlangıç/bitiş süresi tutulmuyor; bu yüzden
              &quot;verimlilik&quot; ölçülemez. Tüm saatler <b>planlı makine-saati</b>
              = plakanın makine standart süresi × kesilen adet. Yani <i>iş yükü</i>
              göstergesi, hız değil.
            </span>
          </div>

          {/* ── KPI ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { ikon: Scissors, renk: "text-blue-600", et: "Kesim partisi", v: veri.kpi.kesim.toLocaleString("tr-TR"), alt: `${veri.gunSayisi} gün` },
              { ikon: Layers, renk: "text-[#8d9d70]", et: "Kesilen plaka", v: veri.kpi.plaka.toLocaleString("tr-TR"), alt: "toplam levha" },
              { ikon: Gauge, renk: "text-amber-600", et: "Planlı makine-saati", v: veri.kpi.makineSaati.toLocaleString("tr-TR"), alt: "3 makine toplam" },
              { ikon: Package, renk: "text-emerald-600", et: "Üretilen parça", v: veri.kpi.uretilenParca.toLocaleString("tr-TR"), alt: "yarı mamül adet" },
            ].map((k) => (
              <Card key={k.et} className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  <k.ikon className={cn("size-4", k.renk)} />
                  <span className="text-xs text-muted-foreground">{k.et}</span>
                </div>
                <p className="text-2xl font-bold tabular-nums">{k.v}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{k.alt}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* ── Makine yük dengesi ───────────────────────── */}
            <Card className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <Gauge className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Makine yük dengesi</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Planlı makine-saati. Dengesizse iş bir makineye yığılıyor demektir.
              </p>
              <Grafik tip="makine" makine={veri.makineYuku} />
              <div className="mt-2 space-y-1">
                {veri.makineYuku.map((m) => (
                  <div key={m.makine} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{m.makine}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {m.saat} saat · %{m.pay} · {m.kesim} kesim · {m.plaka.toLocaleString("tr-TR")} plaka
                    </span>
                  </div>
                ))}
              </div>
              {dengesizlik >= 15 && enYuklu && enBos && (
                <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                  <TriangleAlert className="mr-1 inline size-3.5" />
                  <b>{enYuklu.makine}</b>, <b>{enBos.makine}</b>&apos;den <b>%{dengesizlik}</b> daha
                  yüklü. İş dağılımı dengelenirse bekleme azalır.
                </p>
              )}
            </Card>

            {/* ── MDF tüketimi ─────────────────────────────── */}
            <Card className="p-4">
              <div className="mb-1 flex items-center gap-2">
                <Boxes className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">MDF tüketimi — kalınlık</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Kaç plaka (levha) tüketildi. Satın alma ve stok planlaması için.
              </p>
              <Grafik tip="mdf" mdf={veri.mdfTip} />
              <div className="mt-3 flex items-center gap-2">
                <Palette className="size-4 text-muted-foreground" />
                <h4 className="text-xs font-medium">Renge göre</h4>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {veri.mdfRenk.slice(0, 8).map((r) => (
                  <Badge key={r.ad} variant="secondary" className="text-[11px] font-normal">
                    {r.ad}: {r.plaka.toLocaleString("tr-TR")}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>

          {/* ── Plaka Pareto ───────────────────────────────── */}
          <Card className="p-4">
            <div className="mb-1 flex items-center gap-2">
              <Scissors className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Makine zamanını en çok yiyen plakalar</h3>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Planlı makine-saatine göre. Kesim kapasitesi darsa, iyileştirme/otomasyon
              önceliği buradaki plakalara verilmeli.
            </p>
            <Grafik tip="pareto" pareto={veri.plakaPareto} />
            {paretoEsik && (
              <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                Makine zamanının <b>%80&apos;i</b> yalnızca <b>{paretoEsik} plakaya</b> gidiyor.
              </p>
            )}
          </Card>

          {/* ── Parça: kesilen vs tüketilen ───────────────── */}
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Package className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Kesilen ⇄ montajda tüketilen</h3>
            </div>
            <div className="flex gap-2 border-b bg-[#f0ede1] px-4 py-2.5 text-xs text-[#474237]">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Bu dönemde kesilen (yarı mamül girişi) ile montajda tüketilen (çıkış).
                <b> Eksi bakiye</b> = tüketim kesimden fazla, stoktan yeniyor → kesim
                önceliği. <b>Artı bakiye</b> = birikiyor. (Dönem öncesi stok bu tabloya
                girmez; eksiler kısmen o yüzden olabilir.)
              </span>
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              <div className="border-b md:border-b-0 md:border-r">
                <p className="px-4 pt-3 text-xs font-medium text-red-700">
                  Açık verenler (kesim önceliği)
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parça</TableHead>
                      <TableHead className="text-right">Kesilen</TableHead>
                      <TableHead className="text-right">Tüketilen</TableHead>
                      <TableHead className="text-right">Bakiye</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acikVerenler.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="py-4 text-center text-xs text-muted-foreground">Açık veren parça yok.</TableCell></TableRow>
                    ) : acikVerenler.map((p) => (
                      <TableRow key={p.partId}>
                        <TableCell className="text-xs">
                          <span className="font-medium">{p.partId}</span>
                          <span className="ml-1 text-muted-foreground">{p.ad}</span>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{p.kesilen.toLocaleString("tr-TR")}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{p.tuketilen.toLocaleString("tr-TR")}</TableCell>
                        <TableCell className="text-right text-xs font-semibold tabular-nums text-red-700">{p.bakiye.toLocaleString("tr-TR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <p className="px-4 pt-3 text-xs font-medium text-emerald-700">
                  Birikenler (fazla kesim)
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parça</TableHead>
                      <TableHead className="text-right">Kesilen</TableHead>
                      <TableHead className="text-right">Tüketilen</TableHead>
                      <TableHead className="text-right">Bakiye</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {birikenler.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="py-4 text-center text-xs text-muted-foreground">Biriken parça yok.</TableCell></TableRow>
                    ) : birikenler.map((p) => (
                      <TableRow key={p.partId}>
                        <TableCell className="text-xs">
                          <span className="font-medium">{p.partId}</span>
                          <span className="ml-1 text-muted-foreground">{p.ad}</span>
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{p.kesilen.toLocaleString("tr-TR")}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{p.tuketilen.toLocaleString("tr-TR")}</TableCell>
                        <TableCell className="text-right text-xs font-semibold tabular-nums text-emerald-700">+{p.bakiye.toLocaleString("tr-TR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>

          {/* ── Operatör / makine hacmi ────────────────────── */}
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Layers className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Operatör hacmi</h3>
              <span className="text-xs text-muted-foreground">
                — hacim, hız değil (gerçek süre tutulmuyor)
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operatör</TableHead>
                  <TableHead className="text-right">Kesim</TableHead>
                  <TableHead className="text-right">Plaka</TableHead>
                  <TableHead className="text-right">Planlı makine-saati</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {veri.operatorler.map((o) => (
                  <TableRow key={o.ad}>
                    <TableCell className="font-medium">{o.ad}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.kesim}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.plaka.toLocaleString("tr-TR")}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.saat}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
