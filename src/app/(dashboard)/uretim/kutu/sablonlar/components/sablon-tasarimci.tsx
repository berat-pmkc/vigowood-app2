"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { dieLineHesapla, FEFCO_ADLARI, type FefcoKodu } from "@/lib/kutu/fefco";
import { sablonKaydet, sablonSil, type SablonKaydi } from "../actions";
import { cn } from "@/lib/utils";
import { Box, Loader2, Save, Trash2 } from "lucide-react";

interface Secenek { id: string; ad: string }

const PANEL_RENK: Record<string, string> = {
  govde: "#cdbd9d",
  kapak: "#f0ede1",
  yapistirma: "#a99c7d",
};

export function SablonTasarimci({
  sablonlar, kutuParcalari, urunler,
}: {
  sablonlar: SablonKaydi[];
  kutuParcalari: Secenek[];
  urunler: Secenek[];
}) {
  const router = useRouter();
  const [kod, setKod] = useState<FefcoKodu>("0201");
  const [uzunluk, setUzunluk] = useState("570");
  const [genislik, setGenislik] = useState("310");
  const [yukseklik, setYukseklik] = useState("50");
  const [ad, setAd] = useState("");
  const [partId, setPartId] = useState("");
  const [sku, setSku] = useState("");
  const [olukTipi, setOlukTipi] = useState("");
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const sayi = (v: string) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const die = useMemo(
    () => dieLineHesapla(kod, {
      uzunluk: sayi(uzunluk), genislik: sayi(genislik), yukseklik: sayi(yukseklik),
    }),
    [kod, uzunluk, genislik, yukseklik],
  );

  const kaydet = async () => {
    if (!die) { toast.error("Ölçüler sıfırdan büyük olmalı"); return; }
    setKaydediliyor(true);
    const r = await sablonKaydet({
      ad, fefco_kodu: kod,
      ic_uzunluk: sayi(uzunluk), ic_genislik: sayi(genislik), ic_yukseklik: sayi(yukseklik),
      part_id: partId || null, sku: sku || null, oluk_tipi: olukTipi || null,
    });
    setKaydediliyor(false);
    if (!r.success) { toast.error(r.error); return; }
    toast.success("Şablon kaydedildi");
    setAd("");
    router.refresh();
  };

  const sil = async (id: string) => {
    const r = await sablonSil(id);
    if (!r.success) { toast.error(r.error); return; }
    toast.success("Şablon silindi");
    router.refresh();
  };

  const sablonYukle = (s: SablonKaydi) => {
    setKod(s.fefco_kodu as FefcoKodu);
    setUzunluk(String(s.ic_uzunluk));
    setGenislik(String(s.ic_genislik));
    setYukseklik(String(s.ic_yukseklik));
    setAd(s.ad);
    setPartId(s.part_id ?? "");
    setSku(s.sku ?? "");
    setOlukTipi(s.oluk_tipi ?? "");
    toast.info(`"${s.ad}" tasarıma yüklendi`);
  };

  // Çizim ölçekleme: levha viewBox'a sığsın, kenarda pay kalsın
  const pay = die ? Math.max(die.en, die.boy) * 0.06 : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Ölçü girişi */}
        <Card className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label>Kutu tipi</Label>
            <Select value={kod} onValueChange={(v) => setKod(v as FefcoKodu)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FEFCO_ADLARI) as FefcoKodu[]).map((k) => (
                  <SelectItem key={k} value={k}>{FEFCO_ADLARI[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([
              ["Uzunluk (L)", uzunluk, setUzunluk],
              ["Genişlik (W)", genislik, setGenislik],
              ["Yükseklik (H)", yukseklik, setYukseklik],
            ] as const).map(([etiket, deger, ayarla]) => (
              <div key={etiket} className="space-y-1.5">
                <Label className="text-xs">{etiket}</Label>
                <Input
                  value={deger}
                  onChange={(e) => ayarla(e.target.value)}
                  inputMode="decimal"
                  className="text-center tabular-nums"
                />
              </div>
            ))}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">İç ölçüler, milimetre</p>

          <div className="space-y-1.5">
            <Label>Şablon adı</Label>
            <Input
              value={ad} onChange={(e) => setAd(e.target.value)}
              placeholder="BT301 İç Kutu"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Ambalaj parçası (stok takibi için)</Label>
            <Select value={partId || "yok"} onValueChange={(v) => setPartId(v === "yok" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yok">— Bağlama —</SelectItem>
                {kutuParcalari.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.ad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Ürün (opsiyonel)</Label>
              <Select value={sku || "yok"} onValueChange={(v) => setSku(v === "yok" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yok">—</SelectItem>
                  {urunler.slice(0, 300).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Oluk tipi</Label>
              <Input
                value={olukTipi} onChange={(e) => setOlukTipi(e.target.value)}
                placeholder="B, C, BC…"
              />
            </div>
          </div>

          <Button onClick={kaydet} disabled={kaydediliyor || !die} className="w-full">
            {kaydediliyor ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Şablon Olarak Kaydet
          </Button>
        </Card>

        {/* Çizim */}
        <Card className="p-4">
          {!die ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Geçerli ölçü girin
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <span>Levha eni <b className="tabular-nums">{die.en}</b> mm</span>
                <span>Levha boyu <b className="tabular-nums">{die.boy}</b> mm</span>
                <span>Alan <b className="tabular-nums">{die.alanM2.toFixed(3)}</b> m²</span>
                <Badge variant="secondary">{FEFCO_ADLARI[die.kod]}</Badge>
              </div>

              <svg
                viewBox={`${-pay} ${-pay} ${die.en + pay * 2} ${die.boy + pay * 2}`}
                className="block h-auto w-full rounded border bg-muted/20"
                preserveAspectRatio="xMidYMid meet"
              >
                {die.paneller.map((p, i) => (
                  <g key={i}>
                    <rect
                      x={p.x} y={p.y} width={p.w} height={p.h}
                      fill={PANEL_RENK[p.tur]} stroke="#5e5747"
                      strokeWidth={Math.max(die.en, die.boy) / 500}
                    />
                    {p.w > die.en / 14 && p.h > die.boy / 12 && (
                      <text
                        x={p.x + p.w / 2} y={p.y + p.h / 2}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize={Math.max(die.en, die.boy) / 45}
                        fill="#474237"
                      >
                        {p.etiket}
                      </text>
                    )}
                  </g>
                ))}
                {die.katlamalar.map((k, i) => (
                  <line
                    key={i} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2}
                    stroke="#3368b1"
                    strokeWidth={Math.max(die.en, die.boy) / 700}
                    strokeDasharray={`${Math.max(die.en, die.boy) / 90} ${Math.max(die.en, die.boy) / 140}`}
                  />
                ))}
              </svg>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-4 rounded-sm border" style={{ background: PANEL_RENK.govde }} />
                  Gövde
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-4 rounded-sm border" style={{ background: PANEL_RENK.kapak }} />
                  Kapak / kulak
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-5" style={{ background: "#3368b1" }} />
                  Katlama çizgisi
                </span>
              </div>

              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-900">
                <b>Formül:</b> en = {die.formul.en} · boy = {die.formul.boy}
                <br />
                Bu standart FEFCO geometrisidir; makinenizin bıçak payı ve oluk
                kalınlığı dahil değil. İlk şablonda makinedeki hesapla
                karşılaştırın — sabit bir fark çıkarsa pay olarak ekleyelim.
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Kayıtlı şablonlar */}
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-medium">
          Kayıtlı şablonlar
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({sablonlar.length})
          </span>
        </h2>

        {sablonlar.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Henüz şablon yok. Soldan ölçü girip kaydedin.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sablonlar.map((s) => (
              <div key={s.sablon_id} className={cn("rounded-lg border p-3")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.ad}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.ic_uzunluk} × {s.ic_genislik} × {s.ic_yukseklik} mm
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[11px]">
                    {s.fefco_kodu}
                  </Badge>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Levha {s.hesaplanan_en} × {s.hesaplanan_boy} mm
                  {s.alan_m2 != null && ` · ${Number(s.alan_m2).toFixed(3)} m²`}
                </p>

                <div className="mt-2 flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 flex-1 text-xs"
                          onClick={() => sablonYukle(s)}>
                    <Box className="mr-1 size-3.5" />
                    Kullan
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 px-2">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Şablon silinsin mi?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &quot;{s.ad}&quot; kalıcı olarak silinecek. Bu şablonla
                          yapılmış üretim kayıtları etkilenmez.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                        <AlertDialogAction onClick={() => sil(s.sablon_id)}>Sil</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
