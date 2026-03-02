"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MAKINE_LABELS, type MakineId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import { CheckCircle, ChevronDown, ChevronUp, User, XCircle } from "lucide-react";
import type { CutBatchRow } from "../types";
import { KesimDetailSheet } from "./kesim-detail-sheet";
import { completeCut, cancelCut } from "../actions";
import { toast } from "sonner";

const MAKINE_BADGE_COLORS: Record<string, string> = {
  "MAK-1": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "MAK-2": "bg-blue-100 text-blue-800 border-blue-200",
  "MAK-3": "bg-purple-100 text-purple-800 border-purple-200",
  KUTU: "bg-amber-100 text-amber-800 border-amber-200",
};

interface KesimRecordsProps {
  activeCuts: CutBatchRow[];
  completedCuts: CutBatchRow[];
}

export function KesimRecords({ activeCuts, completedCuts }: KesimRecordsProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<CutBatchRow | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Birleşik liste: kesiliyor önce, sonra tamamlandi
  const allCuts = [...activeCuts, ...completedCuts];
  const displayCuts = expanded ? allCuts : allCuts.slice(0, 8);

  const handleComplete = async (e: React.MouseEvent, cutId: string) => {
    e.stopPropagation();
    setLoadingId(cutId);
    const result = await completeCut(cutId);
    if (!result.success) toast.error(result.error);
    else toast.success("Kesim tamamlandı, stok güncellendi");
    setLoadingId(null);
  };

  const handleCancel = async (e: React.MouseEvent, cutId: string) => {
    e.stopPropagation();
    setLoadingId(cutId);
    const result = await cancelCut(cutId);
    if (!result.success) toast.error(result.error);
    else toast.success("Kesim iptal edildi");
    setLoadingId(null);
  };

  if (allCuts.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        Henüz kesim kaydı yok
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {displayCuts.map((cut) => {
          const isActive = cut.durum === "kesiliyor";
          const skuStyle = cut.sku ? getSkuBadgeStyle(cut.sku) : null;
          const makineLabel = cut.makine_id
            ? MAKINE_LABELS[cut.makine_id as MakineId] ?? cut.makine_id
            : null;
          const makineBadge = cut.makine_id
            ? MAKINE_BADGE_COLORS[cut.makine_id] ?? "bg-gray-100 text-gray-800"
            : "";
          const isLoading = loadingId === cut.cut_id;

          return (
            <Card
              key={cut.cut_id}
              className={cn(
                "border-l-4 cursor-pointer transition-all hover:shadow-md",
                isActive
                  ? !skuStyle && "border-l-amber-500 bg-amber-50/30"
                  : !skuStyle && "border-l-emerald-500 bg-emerald-50/30"
              )}
              style={skuStyle ? {
                borderLeftColor: isActive ? "#f59e0b" : skuStyle.borderColor,
                backgroundColor: `${skuStyle.backgroundColor}${isActive ? "40" : "30"}`,
              } : undefined}
              onClick={() => setSelectedBatch(cut)}
            >
              <div className="p-3">
                {/* Header — ID + Makine + Status */}
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {cut.cut_id}
                    </Badge>
                    {makineLabel && (
                      <Badge variant="outline" className={cn("text-xs", makineBadge)}>
                        {makineLabel}
                      </Badge>
                    )}
                  </div>
                  {isActive ? (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Kesiliyor
                    </span>
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  )}
                </div>

                {/* Ürün + Plaka */}
                <div className="mb-1.5">
                  <p className="font-medium text-foreground truncate text-sm">
                    {cut.urun_adi ?? cut.sku ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {cut.plaka_adi ?? cut.plaka_id ?? "—"}
                  </p>
                </div>

                {/* Adet + Operatör */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-foreground tabular-nums">
                      {cut.adet}
                    </span>
                    <span className="text-xs text-muted-foreground">adet</span>
                  </div>
                  {cut.operator_adi && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>{cut.operator_adi}</span>
                    </div>
                  )}
                </div>

                {/* Bitir butonu (sadece aktif kesimler) */}
                {isActive && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      className="flex-1 h-9 text-sm"
                      onClick={(e) => handleComplete(e, cut.cut_id)}
                      disabled={isLoading}
                    >
                      <CheckCircle className="w-4 h-4 mr-1.5" />
                      Bitir
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 px-2.5"
                      onClick={(e) => handleCancel(e, cut.cut_id)}
                      disabled={isLoading}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {allCuts.length > 8 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-1" /> Daha az göster
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-1" /> {allCuts.length - 8} kesim daha
            </>
          )}
        </Button>
      )}

      {selectedBatch && (
        <KesimDetailSheet
          batch={selectedBatch}
          open={!!selectedBatch}
          onOpenChange={(open) => {
            if (!open) setSelectedBatch(null);
          }}
        />
      )}
    </div>
  );
}
