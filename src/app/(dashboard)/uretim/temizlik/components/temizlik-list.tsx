"use client";

import { TemizlikCard, type TemizlikBatchRow } from "./temizlik-card";
import { useTemizlikRealtime } from "@/hooks/use-temizlik-realtime";
import { SprayCan } from "lucide-react";
import { useServerDataCache } from "@/hooks/use-server-data-cache";

interface TemizlikListProps {
  batches: TemizlikBatchRow[];
}

export function TemizlikList({ batches: serverBatches }: TemizlikListProps) {
  const batches = useServerDataCache("temizlik-batches", serverBatches);
  useTemizlikRealtime();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <SprayCan className="size-6" />
          Temizlik
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kesimden gelen parcalar otomatik olarak temizlenir ve yari mamul stoga eklenir
        </p>
      </div>

      {/* Cards grid */}
      {batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <SprayCan className="mb-3 size-12 opacity-30" />
          <p className="text-lg font-medium">Temizlik kaydi bulunamadi</p>
          <p className="mt-1 text-sm">
            Son 30 gunde tamamlanan kesim bulunmuyor
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Son 30 gun — {batches.length} kesim
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((batch) => (
              <TemizlikCard key={batch.cut_id} batch={batch} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
