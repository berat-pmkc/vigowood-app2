"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { KesimStatusBadge } from "./kesim-status-badge";
import { getCutLines, startCut, completeCut, cancelCut } from "../actions";
import { MAKINE_LABELS, type MakineId, type CutStatus } from "@/lib/constants";
import { formatDate, formatTime, formatDuration } from "@/lib/utils";
import { Play, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { CutBatchRow } from "./active-cut-card";

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
  const [lines, setLines] = useState<CutLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const durum = batch.durum as CutStatus;

  useEffect(() => {
    if (open) {
      setLinesLoading(true);
      getCutLines(batch.cut_id).then((res) => {
        if (res.success) setLines(res.data);
        setLinesLoading(false);
      });
    }
  }, [open, batch.cut_id]);

  const handleStart = async () => {
    setActionLoading(true);
    const result = await startCut(batch.cut_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Kesim başlatıldı"); onOpenChange(false); }
    setActionLoading(false);
  };

  const handleComplete = async () => {
    setActionLoading(true);
    const result = await completeCut(batch.cut_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Kesim tamamlandı, stok güncellendi"); onOpenChange(false); }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    setActionLoading(true);
    const result = await cancelCut(batch.cut_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Kesim iptal edildi"); onOpenChange(false); }
    setActionLoading(false);
  };

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
            {batch.baslama_zamani && (
              <div>
                <p className="text-muted-foreground">Başlama</p>
                <p className="font-medium">{formatTime(batch.baslama_zamani)}</p>
              </div>
            )}
            {batch.bitis_zamani && (
              <div>
                <p className="text-muted-foreground">Bitiş</p>
                <p className="font-medium">{formatTime(batch.bitis_zamani)}</p>
              </div>
            )}
            {batch.baslama_zamani && batch.bitis_zamani && (
              <div>
                <p className="text-muted-foreground">Süre</p>
                <p className="font-medium">{formatDuration(batch.baslama_zamani, batch.bitis_zamani)}</p>
              </div>
            )}
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

          <Separator />

          {/* Aksiyon butonları */}
          <div className="flex gap-2 pb-4">
            {durum === "bekliyor" && (
              <Button
                className="flex-1 h-14 text-base bg-vw-success hover:bg-vw-success/90 text-white"
                onClick={handleStart}
                disabled={actionLoading}
              >
                <Play className="w-5 h-5 mr-2" />
                Kesimi Başlat
              </Button>
            )}

            {durum === "kesiliyor" && (
              <>
                <Button
                  className="flex-1 h-14 text-base"
                  onClick={handleComplete}
                  disabled={actionLoading}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Kesimi Bitir
                </Button>
                <Button
                  variant="outline"
                  className="h-14 px-4"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
