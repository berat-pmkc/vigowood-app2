"use client";

import { useState, useTransition, useCallback } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Save, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { FAALIYET_MARKALAR, FAALIYET_KANALLARI } from "@/lib/constants";
import { saveSatisGiris } from "../actions";
import type { SatisGiris } from "@/lib/supabase/types";

interface DonemInfo {
  id: string;
  yil: number;
  ay_no: number;
  kur: number;
  label: string;
}

interface SatisRow {
  key: string;
  marka: string;
  kanal: string;
  tur: string;
  pazaryeri: string;
  ulke: string;
  tl_satislar: number;
  usd_satislar: number;
}

interface Props {
  donemData: DonemInfo | null;
  existingSatislar: SatisGiris[];
  pazaryerleri: string[];
}

function newRow(): SatisRow {
  return {
    key: crypto.randomUUID(),
    marka: "VIGO WOOD",
    kanal: "YURTİÇİ",
    tur: "FAALIYET",
    pazaryeri: "",
    ulke: "",
    tl_satislar: 0,
    usd_satislar: 0,
  };
}

export function SatisGirisTab({ donemData, existingSatislar, pazaryerleri }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Initialize from existing data or empty rows
  const initialRows: SatisRow[] = existingSatislar.length > 0
    ? existingSatislar.map((s) => ({
        key: s.id,
        marka: s.marka ?? "VIGO WOOD",
        kanal: s.kanal ?? "YURTİÇİ",
        tur: s.tur ?? "FAALIYET",
        pazaryeri: s.pazaryeri ?? "",
        ulke: s.ulke ?? "",
        tl_satislar: Number(s.tl_satislar) || 0,
        usd_satislar: Number(s.usd_satislar) || 0,
      }))
    : [newRow()];

  const [rows, setRows] = useState<SatisRow[]>(initialRows);
  const [kur, setKur] = useState(donemData?.kur ?? 0);
  const [showOverwrite, setShowOverwrite] = useState(false);
  const [pazaryeriInput, setPazaryeriInput] = useState<Record<string, string>>({});

  const allPazaryerleri = useCallback(() => {
    const fromRows = rows.map((r) => r.pazaryeri).filter(Boolean);
    return [...new Set([...pazaryerleri, ...fromRows])].sort();
  }, [rows, pazaryerleri]);

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

  const updateRow = (index: number, field: keyof SatisRow, value: string | number) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const calcHesaplananTl = (tl: number, usd: number) =>
    kur > 0 ? tl + usd * kur : tl;

  const calcHesaplananUsd = (tl: number, usd: number) =>
    kur > 0 ? usd + tl / kur : usd;

  // Totals
  const totalTl = rows.reduce((s, r) => s + r.tl_satislar, 0);
  const totalUsd = rows.reduce((s, r) => s + r.usd_satislar, 0);
  const totalHespTl = rows.reduce((s, r) => s + calcHesaplananTl(r.tl_satislar, r.usd_satislar), 0);

  const handleSave = () => {
    // Validate
    const emptyPazar = rows.some((r) => !r.pazaryeri.trim());
    if (emptyPazar) {
      toast.error("Tum satirlarda pazaryeri alani doldurulmalidir");
      return;
    }

    if (existingSatislar.length > 0) {
      setShowOverwrite(true);
    } else {
      doSave();
    }
  };

  const doSave = () => {
    startTransition(async () => {
      const res = await saveSatisGiris({
        donem_yil: donemData.yil,
        donem_ay: donemData.ay_no,
        kur_tl_usd: kur,
        satirlar: rows.map((r) => ({
          marka: r.marka,
          kanal: r.kanal,
          tur: r.tur as "FAALIYET" | "FAALIYET_DISI",
          pazaryeri: r.pazaryeri,
          ulke: r.ulke || null,
          tl_satislar: r.tl_satislar,
          usd_satislar: r.usd_satislar,
        })),
      });

      if (res.success) {
        toast.success("Satis verileri kaydedildi");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Satis Girisi - {donemData.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Kur Input */}
          <div className="flex items-end gap-4">
            <div className="w-48 space-y-2">
              <Label>USD/TRY Kur</Label>
              <Input
                type="number"
                step="0.01"
                value={kur || ""}
                onChange={(e) => setKur(Number(e.target.value))}
                placeholder="ornegin: 36.50"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2 font-medium">Marka</th>
                  <th className="p-2 font-medium">Kanal</th>
                  <th className="p-2 font-medium">Tur</th>
                  <th className="p-2 font-medium">Pazaryeri</th>
                  <th className="p-2 font-medium">Ulke</th>
                  <th className="p-2 font-medium text-right">TL Satis</th>
                  <th className="p-2 font-medium text-right">USD Satis</th>
                  <th className="p-2 font-medium text-right">Hesp. TL</th>
                  <th className="w-10 p-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.key} className="border-b">
                    <td className="p-1">
                      <Select value={row.marka} onValueChange={(v) => updateRow(i, "marka", v)}>
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FAALIYET_MARKALAR.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-1">
                      <Select value={row.kanal} onValueChange={(v) => updateRow(i, "kanal", v)}>
                        <SelectTrigger className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FAALIYET_KANALLARI.map((k) => (
                            <SelectItem key={k} value={k}>{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-1">
                      <Select value={row.tur} onValueChange={(v) => updateRow(i, "tur", v)}>
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FAALIYET">Faaliyet</SelectItem>
                          <SelectItem value="FAALIYET_DISI">Faaliyet Disi</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-1">
                      <div className="relative">
                        <Input
                          className="h-8 w-36"
                          value={pazaryeriInput[row.key] ?? row.pazaryeri}
                          onChange={(e) => {
                            setPazaryeriInput((prev) => ({ ...prev, [row.key]: e.target.value }));
                            updateRow(i, "pazaryeri", e.target.value);
                          }}
                          onFocus={() => setPazaryeriInput((prev) => ({ ...prev, [row.key]: row.pazaryeri }))}
                          onBlur={() => setPazaryeriInput((prev) => {
                            const copy = { ...prev };
                            delete copy[row.key];
                            return copy;
                          })}
                          placeholder="Pazaryeri"
                          list={`pazar-${row.key}`}
                        />
                        <datalist id={`pazar-${row.key}`}>
                          {allPazaryerleri().map((p) => (
                            <option key={p} value={p} />
                          ))}
                        </datalist>
                      </div>
                    </td>
                    <td className="p-1">
                      <Input
                        className="h-8 w-20"
                        value={row.ulke}
                        onChange={(e) => updateRow(i, "ulke", e.target.value)}
                        placeholder="Ulke"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        className="h-8 w-28 text-right"
                        value={row.tl_satislar || ""}
                        onChange={(e) => updateRow(i, "tl_satislar", Number(e.target.value))}
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        className="h-8 w-28 text-right"
                        value={row.usd_satislar || ""}
                        onChange={(e) => updateRow(i, "usd_satislar", Number(e.target.value))}
                      />
                    </td>
                    <td className="p-1 text-right font-medium text-muted-foreground">
                      {calcHesaplananTl(row.tl_satislar, row.usd_satislar).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
                    </td>
                    <td className="p-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeRow(i)}
                        disabled={rows.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td colSpan={5} className="p-2">Toplam</td>
                  <td className="p-2 text-right">
                    {totalTl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
                  </td>
                  <td className="p-2 text-right">
                    {totalUsd.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} $
                  </td>
                  <td className="p-2 text-right">
                    {totalHespTl.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1 h-4 w-4" />
              Satir Ekle
            </Button>
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
              Bu donem icin {existingSatislar.length} satis kaydi mevcut.
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
