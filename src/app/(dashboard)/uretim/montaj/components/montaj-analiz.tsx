"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getMontajAnaliz, type MontajAnalizi } from "../actions";
import { sonHaftalar, sonAylar, donemAciklama } from "@/lib/donem";
import { cn } from "@/lib/utils";
import { Layers, Activity, Package, Info, TriangleAlert, CircleAlert } from "lucide-react";

export function MontajAnaliz() {
  const [donem, setDonem] = useState<string>("bugun");
  const [veri, setVeri] = useState<MontajAnalizi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const haftalar = useMemo(() => sonHaftalar(12), []);
  const aylar = useMemo(() => sonAylar(12), []);
  const haftaSecili = donem.includes(".");
  const aySecili = !haftaSecili && donem !== "bugun";

  useEffect(() => {
    let iptal = false;
    setYukleniyor(true);
    getMontajAnaliz(donem).then((r) => {
      if (iptal) return;
      if (r.success) { setVeri(r.data); setHata(null); }
      else { setVeri(null); setHata(r.error); }
      setYukleniyor(false);
    });
    return () => { iptal = true; };
  }, [donem]);

  /** İş gücünün %80'ini yiyen adım sayısı — Pareto'nun kritik azınlığı */
  const paretoEsik = useMemo(() => {
    if (!veri) return null;
    const i = veri.adimYuku.findIndex((a) => a.kumulatif >= 80);
    return i >= 0 ? i + 1 : null;
  }, [veri]);

  const azVeri = veri != null && veri.kullanilanSeans < 30;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Montaj Analizi</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDonem("bugun")}
            className={cn(
              "h-8 rounded-md border px-3 text-xs",
              donem === "bugun" ? "border-vw-primary bg-vw-primary/10 font-medium" : "bg-background hover:bg-muted",
            )}
          >
            Bugün
          </button>
          <Select value={haftaSecili ? donem : ""} onValueChange={setDonem}>
            <SelectTrigger className={cn("h-8 w-[130px] text-xs", haftaSecili && "border-vw-primary bg-vw-primary/10")}>
              <SelectValue placeholder="Hafta" />
            </SelectTrigger>
            <SelectContent>
              {haftalar.map((h) => (
                <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={aySecili ? donem : ""} onValueChange={setDonem}>
            <SelectTrigger className={cn("h-8 w-[120px] text-xs", aySecili && "border-vw-primary bg-vw-primary/10")}>
              <SelectValue placeholder="Ay" />
            </SelectTrigger>
            <SelectContent>
              {aylar.map((a) => (
                <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {yukleniyor ? (
        <Skeleton className="h-[380px]" />
      ) : hata ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{hata}</Card>
      ) : !veri || veri.kullanilanSeans === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {donemAciklama(donem)} için tamamlanmış montaj seansı yok.
        </Card>
      ) : (
        <>
          {/* ── Yöntem ve veri durumu ───────────────────── */}
          <div className="flex gap-2 rounded border border-[#a99c7d]/40 bg-[#f0ede1] p-3 text-xs text-[#474237]">
            <Info className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p>
                Ölçü <b>işçilik dk/adet</b> = süre × kişi ÷ adet. Süre olarak
                molası düşülmüş net süre kullanılıyor
                (<b>%{veri.netOran}</b>&apos;inde mevcut); 1 dakikanın altındaki
                seanslar hatalı giriş sayılıp dışlanıyor.
              </p>
              <p className="opacity-80">
                {veri.kullanilanSeans} seans değerlendirildi.
                {veri.sarkanSeans > 0 && (
                  <>
                    {" "}
                    <b>{veri.sarkanSeans} seans</b> 10 saati aştığı için elendi —
                    bunlar kapatılmayı unutulmuş kayıtlar; dahil edilseler
                    ortalamaları tek başlarına bozarlardı.
                  </>
                )}
                {veri.kisaSeans > 0 && ` ${veri.kisaSeans} seans 1 dakikanın altında olduğu için elendi.`}
              </p>
            </div>
          </div>

          {azVeri && (
            <div className="flex gap-2 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Bu dönemde <b>{veri.kullanilanSeans} seans</b> var. Rakamlar yön
                gösterir ama karar vermek için erken — birkaç hafta veri
                biriktikçe medyanlar oturacak.
              </span>
            </div>
          )}

          {/* ── AKSİYON: kapatılmayı unutulan seanslar ──── */}
          {veri.sarkanListe.length > 0 && (
            <Card className="border-red-300 p-0">
              <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-3">
                <CircleAlert className="size-4 text-red-600" />
                <h3 className="text-sm font-medium text-red-800">
                  Kapatılmayı unutulan seanslar ({veri.sarkanListe.length})
                </h3>
              </div>
              <p className="border-b px-4 py-2 text-xs text-muted-foreground">
                4 saati aşan bu seanslar &quot;bitirilmiş&quot; görünüyor ama süreleri
                gerçekçi değil — kapatma unutulmuş. <b>Aksiyon:</b> her birinin
                bitiş saatini gerçek değerine düzeltin (Tamamlananlar → Düzenle).
                Düzeltilene kadar analizden dışlanıyorlar.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ürün</TableHead>
                      <TableHead>Adım</TableHead>
                      <TableHead>Operatör</TableHead>
                      <TableHead className="text-right">Süre</TableHead>
                      <TableHead>Tarih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {veri.sarkanListe.map((s) => (
                      <TableRow key={s.sessionId}>
                        <TableCell><span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{s.urun}</span></TableCell>
                        <TableCell className="text-xs">{s.adim}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.operator}</TableCell>
                        <TableCell className="text-right text-xs font-semibold tabular-nums text-red-700">
                          {s.sureSaat} sa
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.tarih ? new Date(s.tarih).toLocaleDateString("tr-TR") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* ── 1) Adım bazlı yük ───────────────────────── */}
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Layers className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Hangi ürünün hangi adımı iş gücünü yiyor?</h3>
            </div>
            <p className="border-b px-4 py-2 text-xs text-muted-foreground">
              Montaj çok adımlı. Her satır bir <b>ürün + adım</b>; hattı tıkayan
              noktayı doğrudan gösterir. Sıralama toplam işçilik dakikasına göre —
              en üsttekiler önce ele alınmalı.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[110px]">Ürün</TableHead>
                    <TableHead className="min-w-[180px]">Adım</TableHead>
                    <TableHead className="text-right">Seans</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">İşçilik (sa)</TableHead>
                    <TableHead className="text-right">Medyan dk/adet</TableHead>
                    <TableHead className="min-w-[130px]">Kümülatif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {veri.adimYuku.slice(0, 15).map((a) => (
                    <TableRow key={`${a.urun}-${a.adim}`}>
                      <TableCell><span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{a.urun}</span></TableCell>
                      <TableCell className="font-medium">{a.adim}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.seans}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.adet.toLocaleString("tr-TR")}</TableCell>
                      <TableCell className="text-right tabular-nums">{(a.iscilikDk / 60).toFixed(1)}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.medyanBirim}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-[#8d9d70]" style={{ width: `${a.kumulatif}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">%{a.kumulatif}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {paretoEsik && (
              <p className="m-4 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                İş gücünün <b>%80&apos;i</b> yalnızca <b>{paretoEsik} ürün-adım</b>
                satırına gidiyor. İyileştirmeye tam olarak bunlardan başlayın.
              </p>
            )}
          </Card>

          {/* ── 2) Kararlılık ───────────────────────────── */}
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Activity className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Kararsız adımlar</h3>
            </div>
            <p className="border-b px-4 py-2 text-xs text-muted-foreground">
              Aynı adım her seferinde aynı sürmeli. Sürmüyorsa yöntem, malzeme
              ya da eğitim farkı var demektir — ve o adımın standart süresi de
              güvenilmez olur. <b>Hedef</b>, adımın kendi en iyi %25 dilimi:
              hayali değil, defalarca ulaşılmış hız.
            </p>
            {veri.kararlilik.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Henüz yeterli ölçüm yok. Bir adımın değerlendirilmesi için en az
                3 seans gerekiyor.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Ürün</TableHead>
                      <TableHead className="min-w-[180px]">Adım</TableHead>
                      <TableHead className="text-right">Ölçüm</TableHead>
                      <TableHead className="text-right">Hedef (iyi %25)</TableHead>
                      <TableHead className="text-right">Medyan</TableHead>
                      <TableHead className="text-right">Kötü %25</TableHead>
                      <TableHead className="text-right">Kazanılabilir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {veri.kararlilik.slice(0, 12).map((k) => (
                      <TableRow key={`${k.urun}-${k.adim}`}>
                        <TableCell><span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{k.urun}</span></TableCell>
                        <TableCell className="font-medium">{k.adim}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{k.olcum}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-700">{k.iyiCeyrek}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{k.medyan}</TableCell>
                        <TableCell className="text-right tabular-nums text-amber-700">{k.kotuCeyrek}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {k.kazanilabilirSaat} sa
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* ── 3) Ürün bazlı toplam işçilik ─────────────── */}
          <Card className="p-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Package className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Ürün başına montaj işçiliği</h3>
              <Badge variant="secondary" className="ml-auto text-[11px]">
                {veri.urunYuku.length} ürün
              </Badge>
            </div>
            <p className="border-b px-4 py-2 text-xs text-muted-foreground">
              Bir ürünü baştan sona montajlamanın toplam işçiliği. Her adım
              kendi adedine bölünüp toplanıyor — adımlar farklı partilerde
              çalışıldığı için toplam süreyi toplam adede bölmek yanıltıcı olurdu.
              Maliyetleme ve fiyatlama için doğrudan kullanılabilir.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ürün</TableHead>
                    <TableHead className="text-right">Adım</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">Toplam dk/adet</TableHead>
                    <TableHead className="min-w-[200px]">En pahalı adım</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {veri.urunYuku.slice(0, 20).map((u) => (
                    <TableRow key={u.urun}>
                      <TableCell className="font-medium">{u.urun}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{u.adimSayisi}</TableCell>
                      <TableCell className="text-right tabular-nums">{u.adet.toLocaleString("tr-TR")}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{u.toplamBirim}</TableCell>
                      <TableCell className="text-xs">
                        {u.enPahaliAdim}
                        <span className="ml-1.5 text-muted-foreground">%{u.enPahaliPay}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="m-4 rounded border bg-muted/40 p-2 text-xs text-muted-foreground">
              <b>Not:</b> &quot;Adım&quot; kolonu, o üründe bu dönemde <i>çalışılan</i>
              adım sayısıdır — ürünün tüm adımları değil. Sayı reçetedeki adım
              sayısından azsa, ürünün montajı bu dönemde tamamlanmamış demektir.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
