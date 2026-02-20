"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MontajStatusBadge } from "./montaj-status-badge";
import { StepProgress } from "./step-progress";
import { MontajDetailSheet } from "./montaj-detail-sheet";
import { startMontaj } from "../actions";
import {
  MONTAJ_STATUS_BORDER_COLORS,
  type MontajStatus,
} from "@/lib/constants";
import { formatTime, formatDuration, cn } from "@/lib/utils";
import { Play, CheckCircle, User, Clock, Wrench } from "lucide-react";
import { toast } from "sonner";

export interface MontajBatchRow {
  montaj_id: string;
  sku: string;
  adet: number;
  durum: string;
  current_step_no: number;
  total_steps: number;
  operator_id: string | null;
  operator_name: string | null;
  email: string | null;
  baslama_zamani: string | null;
  bitis_zamani: string | null;
  notes: string | null;
  created_at: string;
  // Enriched
  urun_adi?: string;
}

interface MontajCardProps {
  batch: MontajBatchRow;
}

export function MontajCard({ batch }: MontajCardProps) {
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const durum = batch.durum as MontajStatus;
  const borderColor = MONTAJ_STATUS_BORDER_COLORS[durum] ?? MONTAJ_STATUS_BORDER_COLORS.bekliyor;
  const isTamamlandi = durum === "tamamlandi";

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await startMontaj(batch.montaj_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Montaj başlatıldı");
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
            <Badge variant="secondary" className="font-mono text-xs">
              {batch.montaj_id}
            </Badge>
            <MontajStatusBadge durum={batch.durum} />
          </div>

          {/* Body */}
          <div className="mb-3">
            <p className="font-medium text-foreground truncate">
              {batch.urun_adi ?? batch.sku}
            </p>
            {batch.notes && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{batch.notes}</p>
            )}
          </div>

          {/* Step progress */}
          <div className="mb-3">
            <StepProgress current={batch.current_step_no} total={batch.total_steps} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {batch.adet}
              </span>
              <span className="text-sm text-muted-foreground">adet</span>
            </div>

            {batch.operator_name && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{batch.operator_name}</span>
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
              {durum === "montajda" && batch.baslama_zamani && (
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

            {durum === "montajda" && (
              <Button
                size="sm"
                className="h-10 px-4"
                onClick={(e) => {
                  e.stopPropagation();
                  setSheetOpen(true);
                }}
              >
                <Wrench className="w-4 h-4 mr-1" />
                Detay
              </Button>
            )}

            {isTamamlandi && (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            )}
          </div>
        </div>
      </Card>

      <MontajDetailSheet
        batch={batch}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
