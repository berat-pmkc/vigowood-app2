"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  diaBaglantiTest, diaOnizle, diaElleCek, diaAyarlariKaydet,
  type BaglantiSonucu, type OnizlemeSonucu,
} from "../actions";
import type { DiaSatisAyarlari, SyncKaydi } from "@/lib/dia/satis";
import {
  PlugZap, Eye, Download, Save, CircleCheck, CircleAlert, CircleX, Clock,
} from "lucide-react";

const bugun = () => new Date().toISOString().slice(0, 10);
const gunOnce = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const ALAN_ETIKET: Record<string, string> = {
  tarih: "Tarih",
  faturaNo: "Fatura No",
  cariUnvan: "Cari Ünvan",
  satisElemani: "Satış Elemanı (kanal)",
  sku: "Stok/Hizmet Kodu",
  miktar: "Miktar",
  birimFiyat: "Birim Fiyat",
  toplamTutar: "Toplam Tutar",
  kdvOrani: "KDV %",
  doviz: "Döviz",
};

export function DiaClient({
  ayarlar: ilkAyarlar,
  gunluk,
}: {
  ayarlar: DiaSatisAyarlari;
  gunluk: SyncKaydi[];
}) {
  const [bekliyor, basla] = useTransition();

  const [baglanti, setBaglanti] = useState<BaglantiSonucu | null>(null);
  const [onizleme, setOnizleme] = useState<OnizlemeSonucu | null>(null);

  const [baslangic, setBaslangic] = useState(gunOnce(2));
  const [bitis, setBitis] = useState(bugun());

  const [ayarlar, setAyarlar] = useState<DiaSatisAyarlari>(ilkAyarlar);

  const sonKayit = gunluk[0];

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">DİA Entegrasyonu</h1>
          <p className="text-sm text-muted-foreground">
            Satış faturaları her gün <b>18:10</b>&apos;da DİA&apos;dan otomatik çekilir.
            Excel yükleme yedek yol olarak duruyor.
          </p>
        </div>
        {sonKayit && (
          <Badge
            variant="outline"
            className="gap-1.5 py-1"
            title={sonKayit.mesaj ?? undefined}
          >
            {sonKayit.durum === "basarili" ? (
              <CircleCheck className="size-3.5 text-emerald-600" />
            ) : sonKayit.durum === "uyari" ? (
              <CircleAlert className="size-3.5 text-amber-600" />
            ) : (
              <CircleX className="size-3.5 text-red-600" />
            )}
            Son çalışma:{" "}
            {new Date(sonKayit.created_at).toLocaleString("tr-TR", {
              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            })}
            {" · "}
            {sonKayit.yazilan} satır
          </Badge>
        )}
      </div>

      <Tabs defaultValue="cekim">
        <TabsList>
          <TabsTrigger value="cekim">Çekim</TabsTrigger>
          <TabsTrigger value="eslesme">Alan Eşleştirme</TabsTrigger>
          <TabsTrigger value="gunluk">Geçmiş</TabsTrigger>
        </TabsList>

        {/* ── ÇEKİM ───────────────────────────────────────────── */}
        <TabsContent value="cekim" className="space-y-4 pt-4">
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <PlugZap className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">1. Bağlantı</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Kullanıcı adı, şifre, firma ve dönem kodu Vercel ortam
              değişkenlerinde tutulur — bu ekranda görünmez, değiştirilmez.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={bekliyor}
              onClick={() =>
                basla(async () => {
                  const r = await diaBaglantiTest();
                  setBaglanti(r);
                  if (r.baglandi) toast.success("DİA bağlantısı kuruldu");
                  else toast.error(r.mesaj);
                })
              }
            >
              Bağlantıyı test et
            </Button>

            {baglanti && (
              <div
                className={`rounded border p-2 text-xs ${
                  baglanti.baglandi
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-red-300 bg-red-50 text-red-900"
                }`}
              >
                {baglanti.mesaj}
                {baglanti.kontor != null && (
                  <div className="mt-1 opacity-80">
                    Kontör: {JSON.stringify(baglanti.kontor)}
                  </div>
                )}
                {baglanti.firmalar != null && (
                  <details className="mt-1">
                    <summary className="cursor-pointer">Yetkili firma / dönem listesi</summary>
                    <pre className="mt-1 max-h-52 overflow-auto rounded bg-white/60 p-2">
                      {JSON.stringify(baglanti.firmalar, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Eye className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">2. Önizleme (yazmaz)</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Veriyi çeker ama sisteme işlemez. Otomatik çekimi açmadan önce
              alanların doğru eşleştiğini burada doğrulayın.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Başlangıç</Label>
                <Input
                  type="date" value={baslangic} className="h-8 w-40"
                  onChange={(e) => setBaslangic(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bitiş</Label>
                <Input
                  type="date" value={bitis} className="h-8 w-40"
                  onChange={(e) => setBitis(e.target.value)}
                />
              </div>
              <Button
                size="sm" variant="outline" disabled={bekliyor}
                onClick={() =>
                  basla(async () => {
                    const r = await diaOnizle(baslangic, bitis);
                    setOnizleme(r);
                    if (!r.success) toast.error(r.error ?? "Önizleme başarısız");
                    else toast.success(`${r.gecerliSatir} geçerli satır bulundu`);
                  })
                }
              >
                Önizle
              </Button>
              <Button
                size="sm" disabled={bekliyor}
                onClick={() =>
                  basla(async () => {
                    const r = await diaElleCek(baslangic, bitis);
                    if (r.success) {
                      const d = r.data as { yazilan: number; atlanan: number };
                      toast.success(
                        `${d.yazilan} satır işlendi${d.atlanan ? `, ${d.atlanan} mükerrer atlandı` : ""}`,
                      );
                    } else {
                      toast.error(r.error ?? "Çekim başarısız");
                    }
                  })
                }
              >
                <Download className="mr-1 size-3.5" />
                Şimdi çek ve işle
              </Button>
            </div>

            {onizleme?.success && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">
                    DİA&apos;dan gelen: {onizleme.hamKayitSayisi}
                  </Badge>
                  <Badge variant="secondary">
                    Geçerli satır: {onizleme.gecerliSatir}
                  </Badge>
                </div>

                {onizleme.eslesmeyenAlanlar && onizleme.eslesmeyenAlanlar.length > 0 && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    <b>Eşleşmeyen alanlar:</b>{" "}
                    {onizleme.eslesmeyenAlanlar.map((a) => ALAN_ETIKET[a] ?? a).join(", ")}.
                    Aşağıdaki ham kayıttan doğru kolon adını bulup{" "}
                    <b>Alan Eşleştirme</b> sekmesine yazın.
                  </div>
                )}

                {onizleme.ilkSatirlar && onizleme.ilkSatirlar.length > 0 && (
                  <div className="max-h-72 overflow-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Fatura</TableHead>
                          <TableHead>Kanal</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Miktar</TableHead>
                          <TableHead className="text-right">Tutar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(onizleme.ilkSatirlar as Record<string, unknown>[]).map((s, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{String(s.tarih ?? "—")}</TableCell>
                            <TableCell className="text-xs">{String(s.fatura_no ?? "—")}</TableCell>
                            <TableCell className="text-xs">{String(s.satis_kanali ?? "—")}</TableCell>
                            <TableCell className="text-xs font-medium">{String(s.sku)}</TableCell>
                            <TableCell className="text-right text-xs">{String(s.miktar)}</TableCell>
                            <TableCell className="text-right text-xs">
                              {Number(s.toplam_tutar).toLocaleString("tr-TR", {
                                minimumFractionDigits: 2, maximumFractionDigits: 2,
                              })}{" "}
                              {String(s.doviz)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {onizleme.ornekKayit && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      DİA&apos;nın döndürdüğü ham kayıt ({onizleme.ornekAnahtarlar?.length} kolon)
                    </summary>
                    <pre className="mt-1 max-h-72 overflow-auto rounded bg-muted p-2">
                      {JSON.stringify(onizleme.ornekKayit, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {onizleme && !onizleme.success && (
              <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-900">
                {onizleme.error}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── EŞLEŞTİRME ──────────────────────────────────────── */}
        <TabsContent value="eslesme" className="space-y-4 pt-4">
          <Card className="space-y-4 p-4">
            <p className="text-xs text-muted-foreground">
              DİA&apos;nın kolon adları kurulumdan kuruluma değişebiliyor. Kod
              yaygın adları kendi deniyor; yalnızca <b>eşleşmeyen</b> bir alan
              varsa buraya doğru kolon adını yazın. Boş bırakılanlar otomatik
              bulunur.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Servis adı</Label>
                <Input
                  className="h-8" value={ayarlar.servis}
                  onChange={(e) => setAyarlar({ ...ayarlar, servis: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tarih filtresi kolonu</Label>
                <Input
                  className="h-8" value={ayarlar.tarihFiltreAlani}
                  onChange={(e) => setAyarlar({ ...ayarlar, tarihFiltreAlani: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {Object.keys(ALAN_ETIKET).map((alan) => (
                <div key={alan} className="space-y-1">
                  <Label className="text-xs">{ALAN_ETIKET[alan]}</Label>
                  <Input
                    className="h-8"
                    placeholder="otomatik"
                    value={
                      (ayarlar.alanEslesme as Record<string, string>)[alan] ?? ""
                    }
                    onChange={(e) =>
                      setAyarlar({
                        ...ayarlar,
                        alanEslesme: {
                          ...ayarlar.alanEslesme,
                          [alan]: e.target.value.trim() || undefined,
                        } as DiaSatisAyarlari["alanEslesme"],
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Sabit filtreler (JSON)</Label>
              <Input
                className="h-8 font-mono text-xs"
                value={JSON.stringify(ayarlar.sabitFiltreler)}
                onChange={(e) => {
                  try {
                    const v = JSON.parse(e.target.value);
                    if (Array.isArray(v)) setAyarlar({ ...ayarlar, sabitFiltreler: v });
                  } catch {
                    /* yazarken geçersiz JSON normal */
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Yalnızca satış faturaları gelsin diye. Alış faturaları da
                geliyorsa buradaki alan/değer kurulumunuza göre düzeltilmeli.
              </p>
            </div>

            <Button
              size="sm" disabled={bekliyor}
              onClick={() =>
                basla(async () => {
                  const r = await diaAyarlariKaydet(ayarlar);
                  if (r.success) toast.success("Ayarlar kaydedildi");
                  else toast.error(r.error ?? "Kaydedilemedi");
                })
              }
            >
              <Save className="mr-1 size-3.5" />
              Kaydet
            </Button>
          </Card>
        </TabsContent>

        {/* ── GEÇMİŞ ──────────────────────────────────────────── */}
        <TabsContent value="gunluk" className="pt-4">
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Aralık</TableHead>
                  <TableHead className="text-right">Çekilen</TableHead>
                  <TableHead className="text-right">Yazılan</TableHead>
                  <TableHead className="text-right">Atlanan</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Not</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gunluk.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      <Clock className="mx-auto mb-2 size-4" />
                      Henüz çalışma kaydı yok.
                    </TableCell>
                  </TableRow>
                ) : (
                  gunluk.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="text-xs">
                        {new Date(k.created_at).toLocaleString("tr-TR")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {k.baslangic_tarihi} → {k.bitis_tarihi}
                      </TableCell>
                      <TableCell className="text-right text-xs">{k.cekilen}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{k.yazilan}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{k.atlanan}</TableCell>
                      <TableCell>
                        <Badge
                          variant={k.durum === "basarili" ? "secondary" : "outline"}
                          className={
                            k.durum === "hata"
                              ? "border-red-300 text-red-700"
                              : k.durum === "uyari"
                                ? "border-amber-300 text-amber-700"
                                : ""
                          }
                        >
                          {k.durum}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                        {k.mesaj ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
