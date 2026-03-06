"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MAKINE_LABELS,
  type MakineId,
} from "@/lib/constants";
import { formatTime } from "@/lib/utils";
import { User, Clock, Layers, CheckCircle } from "lucide-react";

export interface TemizlikBatchRow {
  cut_id: string;
  tarih: string;
  sku: string | null;
  plaka_id: string | null;
  makine_id: string | null;
  adet: number;
  operator_id: string | null;
  line_count: number;
  // Enriched
  urun_adi?: string;
  plaka_adi?: string;
  operator_adi?: string;
}

interface TemizlikCardProps {
  batch: TemizlikBatchRow;
}

export function TemizlikCard({ batch }: TemizlikCardProps) {
  return (
    <Card className="border-l-4 border-l-emerald-400 transition-all hover:shadow-md opacity-90">
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
          <Badge
            variant="outline"
            className="text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            Temizlendi
          </Badge>
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
        {batch.operator_adi && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="size-3" />
            <span className="truncate max-w-[200px]">
              Kesim: {batch.operator_adi}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{formatTime(batch.tarih)}</span>
          </div>

          <CheckCircle className="size-5 text-emerald-500" />
        </div>
      </div>
    </Card>
  );
}
