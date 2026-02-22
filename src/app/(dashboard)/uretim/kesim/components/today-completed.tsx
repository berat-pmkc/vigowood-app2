"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MAKINE_LABELS, type MakineId } from "@/lib/constants";
import { formatTime, formatDuration } from "@/lib/utils";
import { CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { CutBatchRow } from "./active-cut-card";
import { KesimDetailSheet } from "./kesim-detail-sheet";

interface TodayCompletedProps {
  cuts: CutBatchRow[];
}

export function TodayCompleted({ cuts }: TodayCompletedProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<CutBatchRow | null>(null);

  if (cuts.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Bugün henüz tamamlanan kesim yok
      </div>
    );
  }

  const displayCuts = expanded ? cuts : cuts.slice(0, 5);

  return (
    <div className="space-y-1">
      {displayCuts.map((cut) => (
        <div
          key={cut.cut_id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
          onClick={() => setSelectedBatch(cut)}
        >
          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{cut.cut_id}</span>
              {cut.makine_id && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {MAKINE_LABELS[cut.makine_id as MakineId] ?? cut.makine_id}
                </Badge>
              )}
            </div>
            <p className="text-sm truncate">
              {cut.urun_adi ?? cut.sku ?? "—"}
            </p>
          </div>

          <div className="text-right flex-shrink-0">
            <span className="font-bold tabular-nums">{cut.adet}</span>
            <span className="text-xs text-muted-foreground ml-1">ad.</span>
          </div>

          <div className="text-right flex-shrink-0 text-xs text-muted-foreground hidden sm:block">
            {cut.baslama_zamani && cut.bitis_zamani
              ? formatDuration(cut.baslama_zamani, cut.bitis_zamani)
              : cut.bitis_zamani
                ? formatTime(cut.bitis_zamani)
                : "—"}
          </div>
        </div>
      ))}

      {cuts.length > 5 && (
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
              <ChevronDown className="w-3 h-3 mr-1" /> {cuts.length - 5} kesim daha
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
