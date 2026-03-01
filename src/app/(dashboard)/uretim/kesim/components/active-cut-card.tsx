"use client";

import { useState } from "react";
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
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import { CheckCircle, User, XCircle } from "lucide-react";
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

export function ActiveCutCard({ batch }: ActiveCutCardProps) {
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const makineLabel = batch.makine_id
    ? MAKINE_LABELS[batch.makine_id as MakineId] ?? batch.makine_id
    : "—";

  const makineBadge = batch.makine_id
    ? MAKINE_BADGE_COLORS[batch.makine_id] ?? "bg-gray-100 text-gray-800"
    : "";

  const skuStyle = batch.sku ? getSkuBadgeStyle(batch.sku) : null;

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
          "border-l-4 cursor-pointer transition-all hover:shadow-md",
          !skuStyle && "border-l-blue-500 bg-blue-50/30"
        )}
        style={skuStyle ? {
          borderLeftColor: skuStyle.borderColor,
          backgroundColor: `${skuStyle.backgroundColor}40`,
        } : undefined}
        onClick={() => setSheetOpen(true)}
      >
        <div className="p-3">
          {/* Header — ID + Makine + Status */}
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1.5">
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
          <div className="mb-1.5">
            <p className="font-medium text-foreground truncate text-sm">
              {batch.urun_adi ?? batch.sku ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {batch.plaka_adi ?? batch.plaka_id ?? "—"}
            </p>
          </div>

          {/* Adet + Operatör */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold text-foreground tabular-nums">
                {batch.adet}
              </span>
              <span className="text-xs text-muted-foreground">adet</span>
            </div>
            {batch.operator_adi && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                <span>{batch.operator_adi}</span>
              </div>
            )}
          </div>

          {/* Bitir butonu */}
          <div className="flex gap-2">
            <Button
              className="flex-1 h-9 text-sm"
              onClick={handleComplete}
              disabled={loading}
            >
              <CheckCircle className="w-4 h-4 mr-1.5" />
              Bitir
            </Button>
            <Button
              variant="outline"
              className="h-9 px-2.5"
              onClick={handleCancel}
              disabled={loading}
            >
              <XCircle className="w-4 h-4" />
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
