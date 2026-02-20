"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KutuCard, type KutuSessionRow } from "./kutu-card";
import { DailySummary } from "./daily-summary";
import { KritikStokPanel, type KritikStokItem } from "./kritik-stok-panel";
import { KUTU_STATUS, KUTU_STATUS_LABELS } from "@/lib/constants";
import { useKutuRealtime } from "@/hooks/use-kutu-realtime";
import { Plus, Box } from "lucide-react";
import Link from "next/link";

interface KutuListProps {
  sessions: KutuSessionRow[];
  counts: Record<string, number>;
  selectedStatus: string;
  todaySummary: {
    todayTotal: number;
    todayCompleted: number;
    todayInProgress: number;
    todayParts: { part_id: string; part_adi: string; qty: number }[];
  };
  kritikStokItems: KritikStokItem[];
}

export function KutuList({ sessions, counts, selectedStatus, todaySummary, kritikStokItems }: KutuListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  useKutuRealtime();

  const handleStatusChange = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("durum", status);
    router.push(`/uretim/kutu?${params.toString()}`);
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Box className="w-6 h-6" />
            Kutu - Koli
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kutu ve karton üretimi, parça stok girişi
          </p>
        </div>
        <div className="hidden md:block">
          <Button asChild>
            <Link href="/uretim/kutu/yeni">
              <Plus className="w-4 h-4 mr-1" />
              Yeni Üretim
            </Link>
          </Button>
        </div>
      </div>

      {/* Kritik Stok Paneli */}
      <KritikStokPanel items={kritikStokItems} />

      {/* Daily Summary */}
      <DailySummary {...todaySummary} />

      {/* Status tabs */}
      <Tabs value={selectedStatus} onValueChange={handleStatusChange}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="all" className="gap-1">
            Tümü
            <Badge variant="secondary" className="ml-1 text-xs">{totalCount}</Badge>
          </TabsTrigger>
          {KUTU_STATUS.map((status) => (
            <TabsTrigger key={status} value={status} className="gap-1">
              {KUTU_STATUS_LABELS[status]}
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
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Box className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-lg font-medium">Kutu üretimi bulunamadı</p>
          <p className="text-sm mt-1">Seçili filtre için kayıt yok</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sessions.map((session) => (
            <KutuCard key={session.session_id} session={session} />
          ))}
        </div>
      )}

      {/* FAB for mobile */}
      <Button
        asChild
        className="fixed bottom-24 right-4 md:bottom-8 md:hidden w-14 h-14 rounded-full shadow-lg z-40"
        size="icon"
      >
        <Link href="/uretim/kutu/yeni">
          <Plus className="w-6 h-6" />
        </Link>
      </Button>
    </div>
  );
}
