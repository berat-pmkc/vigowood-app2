"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KesimStatusBadge } from "./kesim-status-badge";
import { KesimDetailSheet } from "./kesim-detail-sheet";
import { startCut, completeCut, cancelCut } from "../actions";
import {
  CUT_STATUS_BORDER_COLORS,
  MAKINE_LABELS,
  type CutStatus,
  type MakineId,
} from "@/lib/constants";
import { formatTime, formatDuration, formatElapsed, cn } from "@/lib/utils";
import { Play, CheckCircle, User, Clock } from "lucide-react";
import { toast } from "sonner";

export interface CutBatchRow {
  cut_id: string;
  tarih: string;
  sku: string | null;
  plaka_id: string | null;
  makine_id: string | null;
  adet: number;
  operator_id: string | null;
  plk_notu: string | null;
  durum: string;
  baslama_zamani: string | null;
  bitis_zamani: string | null;
  created_at: string;
  // Enriched fields
  plaka_adi?: string;
  urun_adi?: string;
  operator_adi?: string;
}

interface KesimCardProps {
  batch: CutBatchRow;
}

export function KesimCard({ batch }: KesimCardProps) {
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const durum = batch.durum as CutStatus;
  const borderColor = CUT_STATUS_BORDER_COLORS[durum] ?? CUT_STATUS_BORDER_COLORS.bekliyor;
  const isTamamlandi = durum === "tamamlandi";

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await startCut(batch.cut_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Kesim başlatıldı");
    setLoading(false);
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await completeCut(batch.cut_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Kesim tamamlandı, stok güncellendi");
    setLoading(false);
  };

  return (
    <>
      <Card
        className={cn(
          "border-l-4 cursor-pointer transition-all hover:shadow-md",
          borderColor,
          isTamamlandi && "opacity-70"
        )}
        onClick={() => setSheetOpen(true)}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {batch.cut_id}
              </Badge>
              {batch.makine_id && (
                <Badge variant="outline" className="text-xs">
                  {MAKINE_LABELS[batch.makine_id as MakineId] ?? batch.makine_id}
                </Badge>
              )}
            </div>
            <KesimStatusBadge durum={batch.durum} />
          </div>

          {/* Body */}
          <div className="mb-3">
            <p className="font-medium text-foreground truncate">
              {batch.plaka_adi ?? batch.plaka_id ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {batch.urun_adi ?? batch.sku ?? "—"}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {batch.adet}
              </span>
              <span className="text-sm text-muted-foreground">adet</span>
            </div>

            {batch.operator_adi && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{batch.operator_adi}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {durum === "tamamlandi" && batch.baslama_zamani && batch.bitis_zamani && (
                <span>{formatDuration(batch.baslama_zamani, batch.bitis_zamani)}</span>
              )}
              {durum === "kesiliyor" && batch.baslama_zamani && (
                <span>{formatTime(batch.baslama_zamani)}&apos;den beri</span>
              )}
              {durum === "bekliyor" && (
                <span>{formatTime(batch.created_at)}</span>
              )}
            </div>

            {durum === "bekliyor" && (
              <Button
                size="sm"
                className="h-10 px-4 bg-vw-success hover:bg-vw-success/90 text-white"
                onClick={handleStart}
                disabled={loading}
              >
                <Play className="w-4 h-4 mr-1" />
                Başlat
              </Button>
            )}

            {durum === "kesiliyor" && (
              <Button
                size="sm"
                className="h-10 px-4"
                onClick={handleComplete}
                disabled={loading}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Bitir
              </Button>
            )}

            {isTamamlandi && (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            )}
          </div>
        </div>
      </Card>

      <KesimDetailSheet
        batch={batch}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
