"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Save, Loader2, ChevronDown, Receipt } from "lucide-react";
import { toast } from "sonner";
import { MALIYET_KATEGORILERI, MALIYET_KATEGORI_TURLERI } from "@/lib/constants";
import { saveMaliyetGiris } from "../actions";
import type { MaliyetGiris } from "@/lib/supabase/types";

interface DonemInfo {
  id: string;
  yil: number;
  ay_no: number;
  kur: number;
  label: string;
}

interface KategoriData {
  vw_direkt: number;
  vw_cari: string;
  hm_direkt: number;
  hm_cari: string;
  ortak: number;
  ortak_oran: number;
  ortak_cari: string;
}

interface Props {
  donemData: DonemInfo | null;
  existingMaliyetler: MaliyetGiris[];
}

function initKategoriData(existingMaliyetler: MaliyetGiris[]): Record<string, KategoriData> {
  const data: Record<string, KategoriData> = {};

  for (const kat of MALIYET_KATEGORILERI) {
    data[kat] = {
      vw_direkt: 0,
      vw_cari: "",
      hm_direkt: 0,
      hm_cari: "",
      ortak: 0,
      ortak_oran: 50,
      ortak_cari: "",
    };
  }

  // Pre-fill from existing data
  for (const m of existingMaliyetler) {
    const kat = m.kategori as string;
    if (!data[kat]) continue;

    if (m.maliyet_grubu === "ORTAK") {
      // ORTAK entries come in pairs (VW + HM). Reconstruct from VW entry.
      if (m.marka === "VIGO WOOD") {
        const oran = Number(m.vigo_wood_orani) || 50;
        // Reconstruct original total: vw_pay = total * (oran/100) → total = vw_pay / (oran/100)
        const total = oran > 0 ? (Number(m.tl_maliyet) || 0) / (oran / 100) : 0;
        data[kat].ortak = Math.round(total);
        data[kat].ortak_oran = oran;
        data[kat].ortak_cari = m.cari_adi ?? "";
      }
    } else if (m.maliyet_grubu === "VIGO_WOOD") {
      data[kat].vw_direkt = Number(m.tl_maliyet) || 0;
      data[kat].vw_cari = m.cari_adi ?? "";
    } else if (m.maliyet_grubu === "HAS_MOB") {
      data[kat].hm_direkt = Number(m.tl_maliyet) || 0;
      data[kat].hm_cari = m.cari_adi ?? "";
    }
  }

  return data;
}

export function MaliyetGirisTab({ donemData, existingMaliyetler }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [kur, setKur] = useState(donemData?.kur ?? 0);
  const [kategoriData, setKategoriData] = useState(() =>
    initKategoriData(existingMaliyetler)
  );
  const [showOverwrite, setShowOverwrite] = useState(false);
  const [openKategoriler, setOpenKategoriler] = useState<Record<string, boolean>>({});

  if (!donemData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Receipt className="h-16 w-16 text-muted-foreground/40" />
        <p className="text-muted-foreground">
          Once bir donem secin veya olusturun.
        </p>
      </div>
    );
  }

  const updateKategori = (kat: string, field: keyof KategoriData, value: string | number) => {
    setKategoriData((prev) => ({
      ...prev,
      [kat]: { ...prev[kat], [field]: value },
    }));
  };

  const toggleKategori = (kat: string) => {
    setOpenKategoriler((prev) => ({ ...prev, [kat]: !prev[kat] }));
  };

  const getKategoriTotal = (kat: string) => {
    const d = kategoriData[kat];
    if (!d) return 0;
    return d.vw_direkt + d.hm_direkt + d.ortak;
  };

  const getOrtakVwPay = (kat: string) => {
    const d = kategoriData[kat];
    if (!d) return 0;
    return Math.round(d.ortak * (d.ortak_oran / 100));
  };

  const getOrtakHmPay = (kat: string) => {
    const d = kategoriData[kat];
    if (!d) return 0;
    return Math.round(d.ortak * (1 - d.ortak_oran / 100));
  };

  // Grand totals
  const faaliyetKategoriler = MALIYET_KATEGORILERI.slice(0, 9);
  const fdKategoriler = MALIYET_KATEGORILERI.slice(9);

  const grandTotalVw = MALIYET_KATEGORILERI.reduce(
    (s, k) => s + (kategoriData[k]?.vw_direkt ?? 0) + getOrtakVwPay(k),
    0
  );
  const grandTotalHm = MALIYET_KATEGORILERI.reduce(
    (s, k) => s + (kategoriData[k]?.hm_direkt ?? 0) + getOrtakHmPay(k),
    0
  );
  const grandTotal = MALIYET_KATEGORILERI.reduce((s, k) => s + getKategoriTotal(k), 0);

  const handleSave = () => {
    if (existingMaliyetler.length > 0) {
      setShowOverwrite(true);
    } else {
      doSave();
    }
  };

  const doSave = () => {
    startTransition(async () => {
      // Build rows from kategoriData
      const satirlar: Array<{
        kategori: string;
        maliyet_grubu: "VIGO_WOOD" | "HAS_MOB" | "ORTAK";
        cari_adi: string | null;
        tl_maliyet: number;
        vigo_wood_orani: number | null;
      }> = [];

      for (const kat of MALIYET_KATEGORILERI) {
        const d = kategoriData[kat];
        if (!d) continue;

        if (d.vw_direkt > 0) {
          satirlar.push({
            kategori: kat,
            maliyet_grubu: "VIGO_WOOD",
            cari_adi: d.vw_cari || null,
            tl_maliyet: d.vw_direkt,
            vigo_wood_orani: null,
          });
        }
        if (d.hm_direkt > 0) {
          satirlar.push({
            kategori: kat,
            maliyet_grubu: "HAS_MOB",
            cari_adi: d.hm_cari || null,
            tl_maliyet: d.hm_direkt,
            vigo_wood_orani: null,
          });
        }
        if (d.ortak > 0) {
          satirlar.push({
            kategori: kat,
            maliyet_grubu: "ORTAK",
            cari_adi: d.ortak_cari || null,
            tl_maliyet: d.ortak,
            vigo_wood_orani: d.ortak_oran,
          });
        }
      }

      if (satirlar.length === 0) {
        toast.error("En az bir maliyet kalemi giriniz");
        return;
      }

      const res = await saveMaliyetGiris({
        donem_yil: donemData.yil,
        donem_ay: donemData.ay_no,
        kur_tl_usd: kur,
        satirlar,
      });

      if (res.success) {
        toast.success("Maliyet verileri kaydedildi");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const renderKategori = (kat: string) => {
    const d = kategoriData[kat];
    if (!d) return null;
    const total = getKategoriTotal(kat);
    const isOpen = openKategoriler[kat] ?? false;

    return (
      <Collapsible key={kat} open={isOpen} onOpenChange={() => toggleKategori(kat)}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
            <span className="text-sm font-medium">{kat}</span>
            <div className="flex items-center gap-3">
              {total > 0 && (
                <span className="text-sm text-muted-foreground">
                  {total.toLocaleString("tr-TR")} TL
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 rounded-b-lg border border-t-0 p-4">
            {/* VW Direkt */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">VIGO WOOD direkt (TL)</Label>
                <Input
                  type="number"
                  value={d.vw_direkt || ""}
                  onChange={(e) => updateKategori(kat, "vw_direkt", Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cari</Label>
                <Input
                  value={d.vw_cari}
                  onChange={(e) => updateKategori(kat, "vw_cari", e.target.value)}
                  className="h-8"
                  placeholder="Cari adi"
                />
              </div>
            </div>

            {/* HM Direkt */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">HAS-MOB direkt (TL)</Label>
                <Input
                  type="number"
                  value={d.hm_direkt || ""}
                  onChange={(e) => updateKategori(kat, "hm_direkt", Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cari</Label>
                <Input
                  value={d.hm_cari}
                  onChange={(e) => updateKategori(kat, "hm_cari", e.target.value)}
                  className="h-8"
                  placeholder="Cari adi"
                />
              </div>
            </div>

            {/* ORTAK */}
            <div className="rounded-md bg-muted/30 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">ORTAK paylasimli (TL)</Label>
                  <Input
                    type="number"
                    value={d.ortak || ""}
                    onChange={(e) => updateKategori(kat, "ortak", Number(e.target.value))}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">VW orani %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={d.ortak_oran}
                    onChange={(e) => updateKategori(kat, "ortak_oran", Number(e.target.value))}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cari</Label>
                  <Input
                    value={d.ortak_cari}
                    onChange={(e) => updateKategori(kat, "ortak_cari", e.target.value)}
                    className="h-8"
                    placeholder="Cari adi"
                  />
                </div>
              </div>
              {d.ortak > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  VW payi: {getOrtakVwPay(kat).toLocaleString("tr-TR")} TL |
                  HM payi: {getOrtakHmPay(kat).toLocaleString("tr-TR")} TL
                </p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Maliyet Girisi - {donemData.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Kur */}
          <div className="flex items-end gap-4">
            <div className="w-48 space-y-2">
              <Label>USD/TRY Kur</Label>
              <Input
                type="number"
                step="0.01"
                value={kur || ""}
                onChange={(e) => setKur(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Faaliyet Giderleri */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-vw-dark">
              Faaliyet Giderleri
            </h3>
            <div className="space-y-1">
              {faaliyetKategoriler.map(renderKategori)}
            </div>
          </div>

          {/* Faaliyet Dışı Giderler */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-vw-dark">
              Faaliyet Disi Giderler
            </h3>
            <div className="space-y-1">
              {fdKategoriler.map(renderKategori)}
            </div>
          </div>

          {/* Grand Total */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">VW Toplam</p>
                <p className="text-lg font-bold">
                  {grandTotalVw.toLocaleString("tr-TR")} TL
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">HM Toplam</p>
                <p className="text-lg font-bold">
                  {grandTotalHm.toLocaleString("tr-TR")} TL
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Genel Toplam</p>
                <p className="text-lg font-bold">
                  {grandTotal.toLocaleString("tr-TR")} TL
                </p>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Kaydet
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Overwrite dialog */}
      <AlertDialog open={showOverwrite} onOpenChange={setShowOverwrite}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mevcut Veriyi Degistir</AlertDialogTitle>
            <AlertDialogDescription>
              Bu donem icin {existingMaliyetler.length} maliyet kaydi mevcut.
              Kaydetmek mevcut verilerin uzerine yazacaktir. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Iptal</AlertDialogCancel>
            <AlertDialogAction onClick={doSave}>
              Uzerine Yaz
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
