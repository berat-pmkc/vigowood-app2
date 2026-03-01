"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActiveCuts } from "./active-cuts";
import { TodayCompleted } from "./today-completed";
import { KesimSummaryCards } from "./kesim-summary-cards";
import { YeniKesimDialog } from "./yeni-kesim-dialog";
import type { CutBatchRow } from "./active-cut-card";
import { Plus, Scissors } from "lucide-react";
import { useServerDataCache } from "@/hooks/use-server-data-cache";

const DATE_FILTERS = [
  { key: "today", label: "Bugün" },
  { key: "yesterday", label: "Dün" },
  { key: "week", label: "Bu Hafta" },
  { key: "month", label: "Bu Ay" },
] as const;

const DATE_FILTER_LABELS: Record<string, string> = {
  today: "Bugün Tamamlanan",
  yesterday: "Dün Tamamlanan",
  week: "Bu Hafta Tamamlanan",
  month: "Bu Ay Tamamlanan",
};

interface KesimDashboardProps {
  activeCuts: CutBatchRow[];
  completedCuts: CutBatchRow[];
  todayTotalAdet: number;
  todayTotalBatch: number;
  dateFilter: string;
  makineler: { makine_id: string; tipi: string; bolum: string; aktif: boolean }[];
}

export function KesimDashboard({
  activeCuts: serverActiveCuts,
  completedCuts: serverCompletedCuts,
  todayTotalAdet: serverTodayTotalAdet,
  todayTotalBatch: serverTodayTotalBatch,
  dateFilter,
}: KesimDashboardProps) {
  const router = useRouter();
  const activeCuts = useServerDataCache("kesim-active", serverActiveCuts);
  const completedCuts = useServerDataCache("kesim-completed", serverCompletedCuts);
  const todayTotalAdet = useServerDataCache("kesim-adet", serverTodayTotalAdet);
  const todayTotalBatch = useServerDataCache("kesim-batch", serverTodayTotalBatch);
  const [dialogOpen, setDialogOpen] = useState(false);

  const sectionTitle = DATE_FILTER_LABELS[dateFilter] || "Tamamlanan";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-lg">
            <Scissors className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-vw-dark">Kesim</h1>
            <p className="text-sm text-muted-foreground">Lazer kesim istasyonu</p>
          </div>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="h-11 px-5"
        >
          <Plus className="w-5 h-5 mr-2" />
          Yeni Kesim
        </Button>
      </div>

      {/* KPI Cards */}
      <KesimSummaryCards
        activeCuts={activeCuts}
        todayTotalAdet={todayTotalAdet}
        todayTotalBatch={todayTotalBatch}
      />

      {/* Aktif Kesimler */}
      <div>
        <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
          Aktif Kesimler
          {activeCuts.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({activeCuts.length})
            </span>
          )}
        </h2>
        <ActiveCuts cuts={activeCuts} />
      </div>

      {/* Tarih Filtre + Tamamlanan */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">
            {sectionTitle}
            {completedCuts.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({completedCuts.length})
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {DATE_FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={dateFilter === f.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const params = new URLSearchParams();
                if (f.key !== "today") params.set("dateFilter", f.key);
                router.push(`/uretim/kesim${params.toString() ? `?${params}` : ""}`);
              }}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <TodayCompleted cuts={completedCuts} />
      </div>

      {/* FAB — Mobile */}
      <div className="fixed bottom-24 right-4 md:hidden z-40">
        <Button
          size="lg"
          className="rounded-full w-14 h-14 shadow-lg"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Yeni Kesim Dialog */}
      <YeniKesimDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
