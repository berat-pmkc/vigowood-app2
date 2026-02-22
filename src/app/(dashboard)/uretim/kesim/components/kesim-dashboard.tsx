"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActiveCuts } from "./active-cuts";
import { TodayCompleted } from "./today-completed";
import { KesimSummaryCards } from "./kesim-summary-cards";
import { YeniKesimDialog } from "./yeni-kesim-dialog";
import type { CutBatchRow } from "./active-cut-card";
import { Plus, Scissors } from "lucide-react";

interface KesimDashboardProps {
  activeCuts: CutBatchRow[];
  completedCuts: CutBatchRow[];
  todayTotalAdet: number;
  todayTotalBatch: number;
  makineler: { makine_id: string; tipi: string; bolum: string; aktif: boolean }[];
}

export function KesimDashboard({
  activeCuts,
  completedCuts,
  todayTotalAdet,
  todayTotalBatch,
}: KesimDashboardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
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
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          Aktif Kesimler
          {activeCuts.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({activeCuts.length})
            </span>
          )}
        </h2>
        <ActiveCuts cuts={activeCuts} />
      </div>

      {/* Bugün Tamamlanan */}
      <div>
        <h2 className="text-base font-semibold mb-2">
          Bugün Tamamlanan
          {completedCuts.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({completedCuts.length})
            </span>
          )}
        </h2>
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
