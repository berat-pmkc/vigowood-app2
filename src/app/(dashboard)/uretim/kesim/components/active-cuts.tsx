"use client";

import { ActiveCutCard, type CutBatchRow } from "./active-cut-card";
import { Scissors } from "lucide-react";

interface ActiveCutsProps {
  cuts: CutBatchRow[];
}

export function ActiveCuts({ cuts }: ActiveCutsProps) {
  if (cuts.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-8 text-center">
        <Scissors className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">
          Aktif kesim yok
        </p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Yeni kesim başlatmak için + butonuna basın
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cuts.map((cut) => (
        <ActiveCutCard key={cut.cut_id} batch={cut} />
      ))}
    </div>
  );
}
