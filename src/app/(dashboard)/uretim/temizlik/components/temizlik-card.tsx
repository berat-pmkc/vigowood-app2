"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TemizlikStatusBadge } from "./temizlik-status-badge";
import { startClean, completeClean, cancelClean } from "../actions";
import {
  CLEAN_STATUS_BORDER_COLORS,
  MAKINE_LABELS,
  type CleanStatus,
  type MakineId,
} from "@/lib/constants";
import { formatTime, formatDuration, formatElapsed, cn } from "@/lib/utils";
import { Play, CheckCircle, User, Clock, X, Layers } from "lucide-react";
import { toast } from "sonner";

export interface TemizlikBatchRow {
  // cut_batches kaynak bilgileri
  cut_id: string;
  tarih: string;
  sku: string | null;
  plaka_id: string | null;
  makine_id: string | null;
  adet: number;
  kesim_operator_id: string | null;
  // Temizlik durumu (aggregate)
  clean_status: CleanStatus;
  clean_batch_id: string | null;
  start_time: string | null;
  end_time: string | null;
  operator_id: string | null;
  operator_name: string | null;
  // Parca sayisi
  line_count: number;
  // Enriched
  urun_adi?: string;
  plaka_adi?: string;
  kesim_operator_adi?: string;
}

interface TemizlikCardProps {
  batch: TemizlikBatchRow;
}

export function TemizlikCard({ batch }: TemizlikCardProps) {
  const [loading, setLoading] = useState(false);

  const status = batch.clean_status;
  const borderColor = CLEAN_STATUS_BORDER_COLORS[status] ?? CLEAN_STATUS_BORDER_COLORS.bekliyor;
  const isTamamlandi = status === "tamamlandi";

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await startClean(batch.cut_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Temizlik baslatildi");
    setLoading(false);
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await completeClean(batch.cut_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Temizlik tamamlandi");
    setLoading(false);
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await cancelClean(batch.cut_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Temizlik iptal edildi");
    setLoading(false);
  };

  return (
    <Card
      className={cn(
        "border-l-4 transition-all hover:shadow-md",
        borderColor,
        isTamamlandi && "opacity-70"
      )}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
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
          <TemizlikStatusBadge status={status} />
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

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="size-3" />
            <span>{batch.line_count} parca</span>
          </div>
        </div>

        {/* Operator */}
        {(batch.operator_name || batch.kesim_operator_adi) && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="size-3" />
            <span className="truncate max-w-[200px]">
              {status === "bekliyor"
                ? `Kesim: ${batch.kesim_operator_adi ?? "—"}`
                : batch.operator_name ?? batch.kesim_operator_adi ?? "—"}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {status === "tamamlandi" && batch.start_time && batch.end_time && (
              <span>{formatDuration(batch.start_time, batch.end_time)}</span>
            )}
            {status === "temizleniyor" && batch.start_time && (
              <span>{formatTime(batch.start_time)}&apos;den beri</span>
            )}
            {status === "bekliyor" && (
              <span>Kesim: {formatTime(batch.tarih)}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {status === "bekliyor" && (
              <Button
                size="sm"
                className="h-11 px-5 bg-vw-success hover:bg-vw-success/90 text-white text-sm font-semibold"
                onClick={handleStart}
                disabled={loading}
              >
                <Play className="size-4 mr-1" />
                Baslat
              </Button>
            )}

            {status === "temizleniyor" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 px-3"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  <X className="size-4" />
                </Button>
                <Button
                  size="sm"
                  className="h-11 px-5 text-sm font-semibold"
                  onClick={handleComplete}
                  disabled={loading}
                >
                  <CheckCircle className="size-4 mr-1" />
                  Bitir
                </Button>
              </>
            )}

            {isTamamlandi && (
              <CheckCircle className="size-5 text-emerald-500" />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
