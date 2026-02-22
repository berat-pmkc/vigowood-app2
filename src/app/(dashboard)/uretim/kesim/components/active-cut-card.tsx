"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KesimStatusBadge } from "./kesim-status-badge";
import { KesimDetailSheet } from "./kesim-detail-sheet";
import { completeCut, cancelCut } from "../actions";
import {
  MAKINE_LABELS,
  type MakineId,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CheckCircle, User, Timer, XCircle } from "lucide-react";
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

interface ActiveCutCardProps {
  batch: CutBatchRow;
}

const MAKINE_BADGE_COLORS: Record<string, string> = {
  "MAK-1": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "MAK-2": "bg-blue-100 text-blue-800 border-blue-200",
  "MAK-3": "bg-purple-100 text-purple-800 border-purple-200",
  KUTU: "bg-amber-100 text-amber-800 border-amber-200",
};

function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const update = () => {
      const start = new Date(startTime).getTime();
      const diff = Date.now() - start;
      const totalSec = Math.floor(diff / 1000);
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      if (hrs > 0) {
        setElapsed(`${hrs}s ${String(mins).padStart(2, "0")}dk ${String(secs).padStart(2, "0")}sn`);
      } else {
        setElapsed(`${mins}dk ${String(secs).padStart(2, "0")}sn`);
      }
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => clearInterval(intervalRef.current);
  }, [startTime]);

  return (
    <span className="text-lg font-bold tabular-nums text-blue-700">
      {elapsed}
    </span>
  );
}

export function ActiveCutCard({ batch }: ActiveCutCardProps) {
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const makineLabel = batch.makine_id
    ? MAKINE_LABELS[batch.makine_id as MakineId] ?? batch.makine_id
    : "—";

  const makineBadge = batch.makine_id
    ? MAKINE_BADGE_COLORS[batch.makine_id] ?? "bg-gray-100 text-gray-800"
    : "";

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await completeCut(batch.cut_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Kesim tamamlandı, stok güncellendi");
    setLoading(false);
  };

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    const result = await cancelCut(batch.cut_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Kesim iptal edildi");
    setLoading(false);
  };

  return (
    <>
      <Card
        className={cn(
          "border-l-4 border-l-blue-500 cursor-pointer transition-all hover:shadow-md",
          "bg-blue-50/30"
        )}
        onClick={() => setSheetOpen(true)}
      >
        <div className="p-4">
          {/* Header — ID + Makine + Status */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {batch.cut_id}
              </Badge>
              {batch.makine_id && (
                <Badge variant="outline" className={cn("text-xs", makineBadge)}>
                  {makineLabel}
                </Badge>
              )}
            </div>
            <KesimStatusBadge durum={batch.durum} />
          </div>

          {/* Ürün + Plaka */}
          <div className="mb-2">
            <p className="font-medium text-foreground truncate text-sm">
              {batch.urun_adi ?? batch.sku ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {batch.plaka_adi ?? batch.plaka_id ?? "—"}
            </p>
          </div>

          {/* Adet + Timer */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-foreground tabular-nums">
                {batch.adet}
              </span>
              <span className="text-sm text-muted-foreground">adet</span>
            </div>

            {batch.baslama_zamani && (
              <div className="flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-blue-600" />
                <LiveTimer startTime={batch.baslama_zamani} />
              </div>
            )}
          </div>

          {/* Operatör */}
          {batch.operator_adi && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
              <User className="w-3 h-3" />
              <span>{batch.operator_adi}</span>
            </div>
          )}

          {/* Bitir butonu */}
          <div className="flex gap-2">
            <Button
              className="flex-1 h-12 text-base"
              onClick={handleComplete}
              disabled={loading}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Bitir
            </Button>
            <Button
              variant="outline"
              className="h-12 px-3"
              onClick={handleCancel}
              disabled={loading}
            >
              <XCircle className="w-5 h-5" />
            </Button>
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
