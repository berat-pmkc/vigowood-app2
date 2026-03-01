"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MAKINE_LABELS, type MakineId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import { CheckCircle, ChevronDown, ChevronUp, User } from "lucide-react";
import type { CutBatchRow } from "./active-cut-card";
import { KesimDetailSheet } from "./kesim-detail-sheet";

const MAKINE_BADGE_COLORS: Record<string, string> = {
  "MAK-1": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "MAK-2": "bg-blue-100 text-blue-800 border-blue-200",
  "MAK-3": "bg-purple-100 text-purple-800 border-purple-200",
  KUTU: "bg-amber-100 text-amber-800 border-amber-200",
};

interface TodayCompletedProps {
  cuts: CutBatchRow[];
}

export function TodayCompleted({ cuts }: TodayCompletedProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<CutBatchRow | null>(null);

  if (cuts.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Henüz tamamlanan kesim yok
      </div>
    );
  }

  const displayCuts = expanded ? cuts : cuts.slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {displayCuts.map((cut) => {
          const skuStyle = cut.sku ? getSkuBadgeStyle(cut.sku) : null;
          const makineLabel = cut.makine_id
            ? MAKINE_LABELS[cut.makine_id as MakineId] ?? cut.makine_id
            : null;
          const makineBadge = cut.makine_id
            ? MAKINE_BADGE_COLORS[cut.makine_id] ?? "bg-gray-100 text-gray-800"
            : "";

          return (
            <Card
              key={cut.cut_id}
              className={cn(
                "border-l-4 cursor-pointer transition-all hover:shadow-md",
                !skuStyle && "border-l-emerald-500 bg-emerald-50/30"
              )}
              style={skuStyle ? {
                borderLeftColor: skuStyle.borderColor,
                backgroundColor: `${skuStyle.backgroundColor}30`,
              } : undefined}
              onClick={() => setSelectedBatch(cut)}
            >
              <div className="p-3">
                {/* Header — ID + Makine + Check */}
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
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
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
                <div className="flex items-center justify-between">
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
              </div>
            </Card>
          );
        })}
      </div>

      {cuts.length > 8 && (
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
              <ChevronDown className="w-3 h-3 mr-1" /> {cuts.length - 8} kesim daha
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
