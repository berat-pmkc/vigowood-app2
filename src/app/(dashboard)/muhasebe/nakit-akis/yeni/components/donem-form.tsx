"use client";

import { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Loader2, ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createDonem, updateDonem, getLastDonem, getAutoKur } from "../../actions";
import {
  NAKIT_GIRIS_LABELS,
  NAKIT_GIRIS_TL_KOLONLAR,
  NAKIT_GIRIS_USD_KOLONLAR,
  NAKIT_CIKIS_TL_LABELS,
  NAKIT_CIKIS_TL_KOLONLAR,
  NAKIT_CIKIS_USD_LABELS,
  NAKIT_CIKIS_USD_KOLONLAR,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import {
  suggestNextDonem,
  getDonemDates,
  buildDonemKodu,
  computeLiveTotals,
} from "../../utils";

// ─── Types ───

interface DonemFormInitialData {
  id: string;
  donemKodu: string;
  baslangicTarihi: string;
  bitisTarihi: string;
  kurBilgisi: number;
  varlikAcilisTl: number;
  varlikAcilisUsd: number;
  varlikTl: number;
  varlikUsd: number;
  yatirimTl: number;
  gayrinakitIslem: number;
  toplamPiyasaBorcu: number;
  toplamKkBorc: number;
  toplamFinansalBorc: number;
  girisler: Record<string, number>;
  cikislar: Record<string, number>;
}

interface DonemFormProps {
  initialData?: DonemFormInitialData;
}

// ─── Yıl/Ay seçenekleri ───

const YILLAR = Array.from({ length: 5 }, (_, i) => 2024 + i);
const AYLAR = [
  { value: 1, label: "Ocak" },
  { value: 2, label: "Şubat" },
  { value: 3, label: "Mart" },
  { value: 4, label: "Nisan" },
  { value: 5, label: "Mayıs" },
  { value: 6, label: "Haziran" },
  { value: 7, label: "Temmuz" },
  { value: 8, label: "Ağustos" },
  { value: 9, label: "Eylül" },
  { value: 10, label: "Ekim" },
  { value: 11, label: "Kasım" },
  { value: 12, label: "Aralık" },
];

export function DonemForm({ initialData }: DonemFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditMode = !!initialData;

  // ─── Dönem seçici state'leri ───
  const now = new Date();
  const [yil, setYil] = useState(initialData ? Number(initialData.donemKodu.split("-")[0]) : now.getFullYear());
  const [ay, setAy] = useState(initialData ? Number(initialData.donemKodu.split("-")[1]) : now.getMonth() + 1);
  const [donemNo, setDonemNo] = useState(initialData ? Number(initialData.donemKodu.split("-")[2]?.replace("D", "")) : (now.getDate() <= 14 ? 1 : 2));

  // ─── Computed dönem kodu & tarihleri ───
  const donemKodu = buildDonemKodu(yil, ay, donemNo);
  const { baslangic: baslangicTarihi, bitis: bitisTarihi } = getDonemDates(yil, ay, donemNo);

  // ─── Kur ───
  const [kurBilgisi, setKurBilgisi] = useState(initialData?.kurBilgisi || 0);
  const [kurOtomatik, setKurOtomatik] = useState<{ kur: number; tarih: string } | null>(null);

  // ─── Varlık / Borç ───
  const [varlikAcilisTl, setVarlikAcilisTl] = useState(initialData?.varlikAcilisTl || 0);
  const [varlikAcilisUsd, setVarlikAcilisUsd] = useState(initialData?.varlikAcilisUsd || 0);
  const [varlikTl, setVarlikTl] = useState(initialData?.varlikTl || 0);
  const [varlikUsd, setVarlikUsd] = useState(initialData?.varlikUsd || 0);
  const [yatirimTl, setYatirimTl] = useState(initialData?.yatirimTl || 0);
  const [gayrinakitIslem, setGayrinakitIslem] = useState(initialData?.gayrinakitIslem || 0);
  const [toplamPiyasaBorcu, setToplamPiyasaBorcu] = useState(initialData?.toplamPiyasaBorcu || 0);
  const [toplamKkBorc, setToplamKkBorc] = useState(initialData?.toplamKkBorc || 0);
  const [toplamFinansalBorc, setToplamFinansalBorc] = useState(initialData?.toplamFinansalBorc || 0);

  // ─── Önceki dönemden taşındı flag ───
  const [prevCarried, setPrevCarried] = useState(false);

  // ─── Girişler ───
  const [girisler, setGirisler] = useState<Record<string, number>>(() => {
    if (initialData?.girisler) return { ...initialData.girisler };
    const init: Record<string, number> = {};
    [...NAKIT_GIRIS_TL_KOLONLAR, ...NAKIT_GIRIS_USD_KOLONLAR].forEach((col) => {
      init[col] = 0;
    });
    return init;
  });

  // ─── Çıkışlar ───
  const [cikislar, setCikislar] = useState<Record<string, number>>(() => {
    if (initialData?.cikislar) return { ...initialData.cikislar };
    const init: Record<string, number> = {};
    [...NAKIT_CIKIS_TL_KOLONLAR, ...NAKIT_CIKIS_USD_KOLONLAR].forEach((col) => {
      init[col] = 0;
    });
    return init;
  });

  // ─── Accordion states ───
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    donem: true,
    giris: true,
    cikis: true,
    varlik: true,
  });

  // ─── Özet dialog ───
  const [showSummary, setShowSummary] = useState(false);

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // ─── Canlı toplamlar (Madde 5) ───
  const liveTotals = useMemo(
    () => computeLiveTotals(girisler, cikislar),
    [girisler, cikislar]
  );

  const toplamVarlikTl = varlikTl + yatirimTl;
  const toplamBorc = toplamPiyasaBorcu + toplamKkBorc + toplamFinansalBorc;

  // ─── Madde 1: Otomatik dönem önerisi + Madde 2: Kapanış → Açılış ───
  useEffect(() => {
    if (isEditMode) return; // Düzenleme modunda otomatik önerme yapma

    const loadPreviousData = async () => {
      const lastDonem = await getLastDonem();
      if (!lastDonem) return;

      // Madde 1: Sonraki dönemi öner
      const suggested = suggestNextDonem(lastDonem.donemKodu);
      setYil(suggested.yil);
      setAy(suggested.ay);
      setDonemNo(suggested.donemNo);

      // Madde 2: Kapanış → Açılış auto-fill
      setVarlikAcilisTl(lastDonem.varlikTl);
      setVarlikAcilisUsd(lastDonem.varlikUsd);
      setPrevCarried(true);
    };

    loadPreviousData();
  }, [isEditMode]);

  // ─── Madde 4: Otomatik kur ───
  const fetchKur = useCallback(async () => {
    const result = await getAutoKur();
    if (result) {
      setKurOtomatik(result);
      if (!kurBilgisi || kurBilgisi === 0) {
        setKurBilgisi(result.kur);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isEditMode) {
      fetchKur();
    }
  }, [isEditMode, fetchKur]);

  const handleGirisChange = (col: string, value: number) => {
    setGirisler((prev) => ({ ...prev, [col]: value }));
  };

  const handleCikisChange = (col: string, value: number) => {
    setCikislar((prev) => ({ ...prev, [col]: value }));
  };

  // ─── Madde 7: Kaydet öncesi özet dialog ───
  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donemKodu.trim()) {
      toast.error("Dönem kodu gereklidir");
      return;
    }
    setShowSummary(true);
  };

  const handleSubmit = () => {
    setShowSummary(false);
    startTransition(async () => {
      const payload = {
        donem_kodu: donemKodu,
        baslangic_tarihi: baslangicTarihi,
        bitis_tarihi: bitisTarihi,
        kur_bilgisi: kurBilgisi,
        varlik_acilis_tl: varlikAcilisTl,
        varlik_acilis_usd: varlikAcilisUsd,
        varlik_tl: varlikTl,
        varlik_usd: varlikUsd,
        yatirim_tl: yatirimTl,
        toplam_varlik_tl: toplamVarlikTl,
        gayrinakit_islem: gayrinakitIslem,
        toplam_piyasa_borcu: toplamPiyasaBorcu,
        toplam_kk_borc: toplamKkBorc,
        toplam_finansal_borc: toplamFinansalBorc,
        girisler: {
          ...girisler,
          toplam_tl: liveTotals.girisTl,
          toplam_yurtdisi: liveTotals.girisUsd,
        },
        cikislar: {
          ...cikislar,
          toplam_tl: liveTotals.cikisTl,
          toplam_yurtdisi_usd: liveTotals.cikisUsd,
        },
      };

      const result = isEditMode
        ? await updateDonem(initialData!.id, payload)
        : await createDonem(payload);

      if (result.success) {
        toast.success(isEditMode ? "Dönem güncellendi" : "Dönem oluşturuldu");
        router.push("/muhasebe/nakit-akis");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      <form onSubmit={handlePreSubmit} className="space-y-4">
        {/* Back button */}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/muhasebe/nakit-akis">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Geri
          </Link>
        </Button>

        {/* Madde 2: Önceki dönemden taşınan uyarı */}
        {prevCarried && !isEditMode && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Önceki dönemden taşınan değerler otomatik dolduruldu. Gerekirse düzenleyebilirsiniz.</span>
          </div>
        )}

        {/* Dönem Bilgileri */}
        <Collapsible open={openSections.donem} onOpenChange={() => toggleSection("donem")}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Dönem Bilgileri</CardTitle>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      openSections.donem ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {/* Madde 1: Dönem seçiciler */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Yıl</Label>
                    <Select value={String(yil)} onValueChange={(v) => setYil(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {YILLAR.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ay</Label>
                    <Select value={String(ay)} onValueChange={(v) => setAy(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AYLAR.map((a) => (
                          <SelectItem key={a.value} value={String(a.value)}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Dönem</Label>
                    <Select value={String(donemNo)} onValueChange={(v) => setDonemNo(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">D1 (1-14)</SelectItem>
                        <SelectItem value="2">D2 (15-son)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Dönem Kodu</Label>
                    <Input value={donemKodu} disabled className="h-9 text-sm bg-muted/50" />
                  </div>
                </div>

                {/* Madde 6: Tarih alanları sabit (readonly) */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Başlangıç Tarihi</Label>
                    <Input type="date" value={baslangicTarihi} disabled className="h-9 text-sm bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Bitiş Tarihi</Label>
                    <Input type="date" value={bitisTarihi} disabled className="h-9 text-sm bg-muted/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>USD/TRY Kur</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.0001"
                        value={kurBilgisi || ""}
                        onChange={(e) => setKurBilgisi(Number(e.target.value) || 0)}
                        className="h-9 text-sm pr-8"
                      />
                      {/* Madde 4: Kur yenile butonu */}
                      <button
                        type="button"
                        onClick={fetchKur}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        title="Otomatik kur çek"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* Madde 4: Otomatik kur bilgisi */}
                    {kurOtomatik && (
                      <p className="text-[11px] text-muted-foreground">
                        Otomatik: {kurOtomatik.kur.toFixed(4)} ({new Date(kurOtomatik.tarih).toLocaleDateString("tr-TR")})
                      </p>
                    )}
                    {!kurOtomatik && !isEditMode && (
                      <p className="text-[11px] text-amber-600">Kur bilgisi bulunamadı</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Nakit Girişler */}
        <Collapsible open={openSections.giris} onOpenChange={() => toggleSection("giris")}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Nakit Girişler
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      TL: {formatCurrency(liveTotals.girisTl, "TL")} | USD: {formatCurrency(liveTotals.girisUsd, "USD")}
                    </span>
                  </CardTitle>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      openSections.giris ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <p className="text-xs font-medium text-muted-foreground">TL Kanalları</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {NAKIT_GIRIS_TL_KOLONLAR.map((col) => (
                    <div key={col} className="space-y-1">
                      <Label className="text-xs">{NAKIT_GIRIS_LABELS[col]}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={girisler[col] || ""}
                        onChange={(e) => handleGirisChange(col, Number(e.target.value) || 0)}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <span className="text-sm font-medium">Toplam TL</span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(liveTotals.girisTl, "TL")}</span>
                </div>

                <p className="text-xs font-medium text-muted-foreground">USD Kanalları</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {NAKIT_GIRIS_USD_KOLONLAR.map((col) => (
                    <div key={col} className="space-y-1">
                      <Label className="text-xs">{NAKIT_GIRIS_LABELS[col]}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={girisler[col] || ""}
                        onChange={(e) => handleGirisChange(col, Number(e.target.value) || 0)}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <span className="text-sm font-medium">Toplam USD</span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(liveTotals.girisUsd, "USD")}</span>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Nakit Çıkışlar */}
        <Collapsible open={openSections.cikis} onOpenChange={() => toggleSection("cikis")}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Nakit Çıkışlar
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      TL: {formatCurrency(liveTotals.cikisTl, "TL")} | USD: {formatCurrency(liveTotals.cikisUsd, "USD")}
                    </span>
                  </CardTitle>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      openSections.cikis ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <p className="text-xs font-medium text-muted-foreground">TL Gider Kategorileri</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {NAKIT_CIKIS_TL_KOLONLAR.map((col) => (
                    <div key={col} className="space-y-1">
                      <Label className="text-xs">{NAKIT_CIKIS_TL_LABELS[col]}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={cikislar[col] || ""}
                        onChange={(e) => handleCikisChange(col, Number(e.target.value) || 0)}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <span className="text-sm font-medium">Toplam TL</span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(liveTotals.cikisTl, "TL")}</span>
                </div>

                <p className="text-xs font-medium text-muted-foreground">USD Gider Kategorileri</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {NAKIT_CIKIS_USD_KOLONLAR.map((col) => (
                    <div key={col} className="space-y-1">
                      <Label className="text-xs">{NAKIT_CIKIS_USD_LABELS[col]}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={cikislar[col] || ""}
                        onChange={(e) => handleCikisChange(col, Number(e.target.value) || 0)}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <span className="text-sm font-medium">Toplam USD</span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(liveTotals.cikisUsd, "USD")}</span>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Madde 5: Canlı Net Özet Bar */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Net TL</p>
                <p className={`text-lg font-bold tabular-nums ${liveTotals.netTl >= 0 ? "text-vw-success" : "text-vw-error"}`}>
                  {formatCurrency(liveTotals.netTl, "TL")}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Net USD</p>
                <p className={`text-lg font-bold tabular-nums ${liveTotals.netUsd >= 0 ? "text-vw-success" : "text-vw-error"}`}>
                  {formatCurrency(liveTotals.netUsd, "USD")}
                </p>
              </div>
              <div className="text-center col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Giriş - Çıkış</p>
                <p className="text-xs text-muted-foreground mt-1">
                  TL: {formatCurrency(liveTotals.girisTl, "TL")} - {formatCurrency(liveTotals.cikisTl, "TL")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Varlık / Borç */}
        <Collapsible open={openSections.varlik} onOpenChange={() => toggleSection("varlik")}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Varlık, Borç & Yatırım</CardTitle>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      openSections.varlik ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <p className="text-xs font-medium text-muted-foreground">Varlık</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Açılış Varlık TL</Label>
                    <Input
                      type="number" step="0.01"
                      value={varlikAcilisTl || ""}
                      onChange={(e) => setVarlikAcilisTl(Number(e.target.value) || 0)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Açılış Varlık USD</Label>
                    <Input
                      type="number" step="0.01"
                      value={varlikAcilisUsd || ""}
                      onChange={(e) => setVarlikAcilisUsd(Number(e.target.value) || 0)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kapanış Varlık TL</Label>
                    <Input
                      type="number" step="0.01"
                      value={varlikTl || ""}
                      onChange={(e) => setVarlikTl(Number(e.target.value) || 0)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kapanış Varlık USD</Label>
                    <Input
                      type="number" step="0.01"
                      value={varlikUsd || ""}
                      onChange={(e) => setVarlikUsd(Number(e.target.value) || 0)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Yatırım TL</Label>
                    <Input
                      type="number" step="0.01"
                      value={yatirimTl || ""}
                      onChange={(e) => setYatirimTl(Number(e.target.value) || 0)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gayrinakit İşlem</Label>
                    <Input
                      type="number" step="0.01"
                      value={gayrinakitIslem || ""}
                      onChange={(e) => setGayrinakitIslem(Number(e.target.value) || 0)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <span className="text-sm font-medium">Toplam Varlık TL</span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(toplamVarlikTl, "TL")}</span>
                </div>

                <p className="text-xs font-medium text-muted-foreground">Borç</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Piyasa Borcu</Label>
                    <Input
                      type="number" step="0.01"
                      value={toplamPiyasaBorcu || ""}
                      onChange={(e) => setToplamPiyasaBorcu(Number(e.target.value) || 0)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kredi Kartı Borcu</Label>
                    <Input
                      type="number" step="0.01"
                      value={toplamKkBorc || ""}
                      onChange={(e) => setToplamKkBorc(Number(e.target.value) || 0)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Finansal Borç</Label>
                    <Input
                      type="number" step="0.01"
                      value={toplamFinansalBorc || ""}
                      onChange={(e) => setToplamFinansalBorc(Number(e.target.value) || 0)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-md bg-red-50 px-3 py-2">
                  <span className="text-sm font-medium text-red-800">Toplam Borç</span>
                  <span className="text-sm font-bold tabular-nums text-red-800">
                    {formatCurrency(toplamBorc, "TL")}
                  </span>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? "Güncelle" : "Dönem Oluştur"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/muhasebe/nakit-akis">İptal</Link>
          </Button>
        </div>
      </form>

      {/* Madde 7: Kaydet öncesi özet dialog */}
      <AlertDialog open={showSummary} onOpenChange={setShowSummary}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isEditMode ? "Dönem Güncelleme Özeti" : "Dönem Oluşturma Özeti"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Lütfen bilgileri kontrol edin.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Dönem</p>
                <p className="font-semibold">{donemKodu}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kur</p>
                <p className="font-semibold">{kurBilgisi.toFixed(4)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-md bg-green-50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Toplam Giriş TL</p>
                <p className="font-semibold text-green-700">{formatCurrency(liveTotals.girisTl, "TL")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam Giriş USD</p>
                <p className="font-semibold text-green-700">{formatCurrency(liveTotals.girisUsd, "USD")}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-md bg-red-50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Toplam Çıkış TL</p>
                <p className="font-semibold text-red-700">{formatCurrency(liveTotals.cikisTl, "TL")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam Çıkış USD</p>
                <p className="font-semibold text-red-700">{formatCurrency(liveTotals.cikisUsd, "USD")}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Net TL</p>
                <p className={`font-semibold ${liveTotals.netTl >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {formatCurrency(liveTotals.netTl, "TL")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam Varlık</p>
                <p className="font-semibold">{formatCurrency(toplamVarlikTl, "TL")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Toplam Borç</p>
                <p className="font-semibold text-red-700">{formatCurrency(toplamBorc, "TL")}</p>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Düzenle</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Onayla ve Kaydet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
