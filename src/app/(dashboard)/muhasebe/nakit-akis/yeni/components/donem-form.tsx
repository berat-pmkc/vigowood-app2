"use client";

import { useState, useTransition, useMemo } from "react";
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
import { ChevronDown, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { createDonem } from "../../actions";
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

function generateDonemKodu(): { kodu: string; baslangic: string; bitis: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const donemNo = d <= 14 ? "D1" : "D2";
  const kodu = `${y}-${m}-${donemNo}`;
  const baslangic = donemNo === "D1"
    ? `${y}-${String(m).padStart(2, "0")}-01`
    : `${y}-${String(m).padStart(2, "0")}-15`;
  const bitis = donemNo === "D1"
    ? `${y}-${String(m).padStart(2, "0")}-14`
    : `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
  return { kodu, baslangic, bitis };
}

export function DonemForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultDonem = generateDonemKodu();

  const [donemKodu, setDonemKodu] = useState(defaultDonem.kodu);
  const [baslangicTarihi, setBaslangicTarihi] = useState(defaultDonem.baslangic);
  const [bitisTarihi, setBitisTarihi] = useState(defaultDonem.bitis);
  const [kurBilgisi, setKurBilgisi] = useState(0);

  // Varlık / Borç
  const [varlikAcilisTl, setVarlikAcilisTl] = useState(0);
  const [varlikAcilisUsd, setVarlikAcilisUsd] = useState(0);
  const [varlikTl, setVarlikTl] = useState(0);
  const [varlikUsd, setVarlikUsd] = useState(0);
  const [yatirimTl, setYatirimTl] = useState(0);
  const [gayrinakitIslem, setGayrinakitIslem] = useState(0);
  const [toplamPiyasaBorcu, setToplamPiyasaBorcu] = useState(0);
  const [toplamKkBorc, setToplamKkBorc] = useState(0);
  const [toplamFinansalBorc, setToplamFinansalBorc] = useState(0);

  // Girişler
  const [girisler, setGirisler] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    [...NAKIT_GIRIS_TL_KOLONLAR, ...NAKIT_GIRIS_USD_KOLONLAR].forEach((col) => {
      init[col] = 0;
    });
    return init;
  });

  // Çıkışlar
  const [cikislar, setCikislar] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    [...NAKIT_CIKIS_TL_KOLONLAR, ...NAKIT_CIKIS_USD_KOLONLAR].forEach((col) => {
      init[col] = 0;
    });
    return init;
  });

  // Accordion states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    donem: true,
    giris: true,
    cikis: true,
    varlik: true,
  });

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Auto-totals
  const toplamGirisTl = useMemo(
    () => NAKIT_GIRIS_TL_KOLONLAR.reduce((sum, col) => sum + (girisler[col] || 0), 0),
    [girisler]
  );
  const toplamGirisUsd = useMemo(
    () => NAKIT_GIRIS_USD_KOLONLAR.reduce((sum, col) => sum + (girisler[col] || 0), 0),
    [girisler]
  );
  const toplamCikisTl = useMemo(
    () => NAKIT_CIKIS_TL_KOLONLAR.reduce((sum, col) => sum + (cikislar[col] || 0), 0),
    [cikislar]
  );
  const toplamCikisUsd = useMemo(
    () => NAKIT_CIKIS_USD_KOLONLAR.reduce((sum, col) => sum + (cikislar[col] || 0), 0),
    [cikislar]
  );

  const toplamVarlikTl = varlikTl + yatirimTl;

  const handleGirisChange = (col: string, value: number) => {
    setGirisler((prev) => ({ ...prev, [col]: value }));
  };

  const handleCikisChange = (col: string, value: number) => {
    setCikislar((prev) => ({ ...prev, [col]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!donemKodu.trim()) {
      toast.error("Dönem kodu gereklidir");
      return;
    }

    startTransition(async () => {
      const result = await createDonem({
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
          toplam_tl: toplamGirisTl,
          toplam_yurtdisi: toplamGirisUsd,
        },
        cikislar: {
          ...cikislar,
          toplam_tl: toplamCikisTl,
          toplam_yurtdisi_usd: toplamCikisUsd,
        },
      });

      if (result.success) {
        toast.success("Dönem oluşturuldu");
        router.push("/muhasebe/nakit-akis");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/muhasebe/nakit-akis">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Geri
        </Link>
      </Button>

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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Dönem Kodu *</Label>
                  <Input
                    value={donemKodu}
                    onChange={(e) => setDonemKodu(e.target.value)}
                    placeholder="2026-2-D1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Başlangıç Tarihi</Label>
                  <Input
                    type="date"
                    value={baslangicTarihi}
                    onChange={(e) => setBaslangicTarihi(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bitiş Tarihi</Label>
                  <Input
                    type="date"
                    value={bitisTarihi}
                    onChange={(e) => setBitisTarihi(e.target.value)}
                  />
                </div>
              </div>
              <div className="w-full sm:w-1/3">
                <div className="space-y-2">
                  <Label>USD/TRY Kur</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={kurBilgisi || ""}
                    onChange={(e) => setKurBilgisi(Number(e.target.value) || 0)}
                  />
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
                    TL: {formatCurrency(toplamGirisTl, "TL")} | USD: {formatCurrency(toplamGirisUsd, "USD")}
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
                <span className="text-sm font-bold tabular-nums">{formatCurrency(toplamGirisTl, "TL")}</span>
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
                <span className="text-sm font-bold tabular-nums">{formatCurrency(toplamGirisUsd, "USD")}</span>
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
                    TL: {formatCurrency(toplamCikisTl, "TL")} | USD: {formatCurrency(toplamCikisUsd, "USD")}
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
                <span className="text-sm font-bold tabular-nums">{formatCurrency(toplamCikisTl, "TL")}</span>
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
                <span className="text-sm font-bold tabular-nums">{formatCurrency(toplamCikisUsd, "USD")}</span>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
                  {formatCurrency(toplamPiyasaBorcu + toplamKkBorc + toplamFinansalBorc, "TL")}
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
          Dönem Oluştur
        </Button>
        <Button variant="outline" asChild>
          <Link href="/muhasebe/nakit-akis">İptal</Link>
        </Button>
      </div>
    </form>
  );
}
