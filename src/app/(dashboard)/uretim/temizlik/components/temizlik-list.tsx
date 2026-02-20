"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TemizlikCard, type TemizlikBatchRow } from "./temizlik-card";
import { CLEAN_STATUS, CLEAN_STATUS_LABELS } from "@/lib/constants";
import { useTemizlikRealtime } from "@/hooks/use-temizlik-realtime";
import { SprayCan } from "lucide-react";

interface TemizlikListProps {
  batches: TemizlikBatchRow[];
  counts: Record<string, number>;
  selectedStatus: string;
}

export function TemizlikList({ batches, counts, selectedStatus }: TemizlikListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  useTemizlikRealtime();

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("durum", status);
    router.push(`/uretim/temizlik?${params.toString()}`);
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <SprayCan className="size-6" />
          Temizlik
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kesimi tamamlanan parcalarin temizlik takibi
        </p>
      </div>

      {/* Status tabs */}
      <Tabs value={selectedStatus} onValueChange={handleStatusChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="gap-1">
            Tumu
            <Badge variant="secondary" className="ml-1 text-xs">
              {totalCount}
            </Badge>
          </TabsTrigger>
          {CLEAN_STATUS.map((status) => (
            <TabsTrigger key={status} value={status} className="gap-1">
              <span className="hidden sm:inline">{CLEAN_STATUS_LABELS[status]}</span>
              <span className="sm:hidden">
                {status === "bekliyor" ? "Bekl." : status === "temizleniyor" ? "Devam" : "Bitti"}
              </span>
              {(counts[status] ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {counts[status]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Cards grid */}
      {batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <SprayCan className="mb-3 size-12 opacity-30" />
          <p className="text-lg font-medium">Temizlik kaydi bulunamadi</p>
          <p className="mt-1 text-sm">
            {selectedStatus === "bekliyor"
              ? "Temizlik bekleyen parca yok"
              : selectedStatus === "temizleniyor"
                ? "Devam eden temizlik yok"
                : "Secili filtre icin kayit yok"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((batch) => (
            <TemizlikCard key={batch.cut_id} batch={batch} />
          ))}
        </div>
      )}
    </div>
  );
}
