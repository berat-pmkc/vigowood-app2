"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { KesimStatusBadge } from "./kesim-status-badge";
import { getCutLines, updateCutBatch, deleteCutBatch } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { KESIM_MAKINE_IDS, MAKINE_LABELS, type MakineId } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { CutBatchRow } from "../types";

interface KesimDetailSheetProps {
  batch: CutBatchRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CutLine {
  cut_line_id: string;
  cut_id: string;
  part_id: string | null;
  part_adi: string;
  adet: number;
  renk: string | null;
  not_text: string | null;
}

export function KesimDetailSheet({ batch, open, onOpenChange }: KesimDetailSheetProps) {
  const router = useRouter();
  const [lines, setLines] = useState<CutLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);

  const [duzenle, setDuzenle] = useState(false);
  const [adet, setAdet] = useState(String(batch.adet ?? 1));
  const [makine, setMakine] = useState(batch.makine_id ?? "");
  const [notu, setNotu] = useState(batch.plk_notu ?? "");
  const [isliyor, setIsliyor] = useState(false);
  const [silOnay, setSilOnay] = useState(false);

  // Kayıt değişince form alanlarını tazele
  useEffect(() => {
    setAdet(String(batch.adet ?? 1));
    setMakine(batch.makine_id ?? "");
    setNotu(batch.plk_notu ?? "");
    setDuzenle(false);
  }, [batch.cut_id, batch.adet, batch.makine_id, batch.plk_notu]);

  const kaydet = async () => {
    setIsliyor(true);
    const r = await updateCutBatch(batch.cut_id, {
      adet: Number(adet),
      makine_id: makine,
      operator_id: batch.operator_id ?? "",
      plk_notu: notu || null,
    });
    setIsliyor(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Kesim güncellendi");
    setDuzenle(false);
    onOpenChange(false);
    router.refresh();
  };

  const sil = async () => {
    setIsliyor(true);
    const r = await deleteCutBatch(batch.cut_id);
    setIsliyor(false);
    setSilOnay(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Kesim silindi, stoklar geri alındı");
    onOpenChange(false);
    router.refresh();
  };

  useEffect(() => {
    if (open) {
      setLinesLoading(true);
      getCutLines(batch.cut_id).then((res) => {
        if (res.success) setLines(res.data);
        setLinesLoading(false);
      });
    }
  }, [open, batch.cut_id]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">{batch.cut_id}</Badge>
            <KesimStatusBadge durum={batch.durum} />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Batch bilgileri */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Plaka</p>
              <p className="font-medium">{batch.plaka_adi ?? batch.plaka_id ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">SKU</p>
              <p className="font-medium">{batch.sku ?? "—"}</p>
              {batch.urun_adi && (
                <p className="text-xs text-muted-foreground">{batch.urun_adi}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Makine</p>
              <p className="font-medium">
                {batch.makine_id ? MAKINE_LABELS[batch.makine_id as MakineId] ?? batch.makine_id : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Adet</p>
              <p className="font-semibold text-lg">{batch.adet}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Operatör</p>
              <p className="font-medium">{batch.operator_adi ?? batch.operator_id ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Tarih</p>
              <p className="font-medium">{formatDate(batch.tarih)}</p>
            </div>
          </div>

          {batch.plk_notu && (
            <div className="text-sm">
              <p className="text-muted-foreground">Not</p>
              <p className="font-medium">{batch.plk_notu}</p>
            </div>
          )}

          <Separator />

          {/* Cut Lines */}
          <div>
            <h3 className="font-semibold mb-3">Kesilen Parçalar</h3>
            {linesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Parça bilgisi yok</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium">Parça</th>
                      <th className="text-center px-3 py-2 font-medium w-16">Adet</th>
                      {lines.some(l => l.renk) && (
                        <th className="text-center px-3 py-2 font-medium w-20">Renk</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.cut_line_id} className="border-t">
                        <td className="px-3 py-2">
                          <span className="font-medium">{line.part_adi}</span>
                          <span className="text-xs text-muted-foreground ml-1">({line.part_id})</span>
                        </td>
                        <td className="text-center px-3 py-2 tabular-nums font-semibold">{line.adet}</td>
                        {lines.some(l => l.renk) && (
                          <td className="text-center px-3 py-2 text-xs">{line.renk ?? "—"}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Düzenleme — personel yanlış giriş yaptığında düzeltebilsin */}
          {duzenle && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground">KAYDI DÜZENLE</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="d-adet" className="text-xs">
                    Plaka adedi
                  </Label>
                  <Input
                    id="d-adet"
                    type="number"
                    min={1}
                    value={adet}
                    onChange={(e) => setAdet(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Makine</Label>
                  <Select value={makine} onValueChange={setMakine}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KESIM_MAKINE_IDS.map((id) => (
                        <SelectItem key={id} value={id}>
                          {MAKINE_LABELS[id] ?? id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="d-not" className="text-xs">
                  Not
                </Label>
                <Textarea
                  id="d-not"
                  rows={2}
                  value={notu}
                  onChange={(e) => setNotu(e.target.value)}
                />
              </div>

              {Number(adet) !== batch.adet && (
                <p className="rounded bg-amber-50 p-2 text-[11px] text-amber-900">
                  Adet değişiyor: çıkan parçalar, yarı mamül girişleri ve MDF stok
                  düşümü yeniden hesaplanacak.
                </p>
              )}

              <p className="text-[11px] text-muted-foreground">
                Ürün ve plaka değiştirilemez — çıkan parça kümesi tamamen değişir.
                Yanlışsa kaydı silip yeniden oluşturun.
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-2">
          {duzenle ? (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDuzenle(false)}
                disabled={isliyor}
              >
                Vazgeç
              </Button>
              <Button className="flex-1" onClick={kaydet} disabled={isliyor}>
                {isliyor ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                Kaydet
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDuzenle(true)}
              >
                <Pencil className="mr-1 size-4" />
                Düzenle
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={() => setSilOnay(true)}
              >
                <Trash2 className="mr-1 size-4" />
                Sil
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>

      <AlertDialog open={silOnay} onOpenChange={setSilOnay}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kesim kaydı silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-mono font-semibold">{batch.cut_id}</span> silinecek
                  ve bıraktığı tüm izler geri alınacak:
                </p>
                <ul className="ml-4 list-disc space-y-0.5 text-xs">
                  <li>Çıkan parça satırları silinir</li>
                  <li>Yarı mamül stok girişleri geri alınır</li>
                  <li>{batch.adet} plaka MDF stoğuna iade edilir</li>
                  <li>Bağlı kesim talebi varsa kesilen adet düşülür</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  MDF iadesi hareket kaydı olarak da yazılır, denetim izi kalır.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isliyor}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void sil();
              }}
              disabled={isliyor}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isliyor ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
