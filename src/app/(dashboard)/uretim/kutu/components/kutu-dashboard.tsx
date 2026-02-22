"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActiveKutuSessions } from "./active-kutu-sessions";
import { TodayKutuCompleted } from "./today-kutu-completed";
import { KutuSummaryCards } from "./kutu-summary-cards";
import { YeniKutuDialog } from "./yeni-kutu-dialog";
import { useKutuRealtime } from "@/hooks/use-kutu-realtime";
import type { KutuSessionEnriched } from "../page";
import { Plus, Box } from "lucide-react";

interface KutuDashboardProps {
  activeSessions: KutuSessionEnriched[];
  completedSessions: KutuSessionEnriched[];
  todayTotalAdet: number;
  todayTotalBatch: number;
  kritikStokCount: number;
}

export function KutuDashboard({
  activeSessions,
  completedSessions,
  todayTotalAdet,
  todayTotalBatch,
  kritikStokCount,
}: KutuDashboardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  useKutuRealtime();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 p-2 rounded-lg">
            <Box className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-vw-dark">Kutu - Koli</h1>
            <p className="text-sm text-muted-foreground">Karton kesim istasyonu</p>
          </div>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="h-11 px-5"
        >
          <Plus className="w-5 h-5 mr-2" />
          Yeni Üretim
        </Button>
      </div>

      {/* KPI Cards */}
      <KutuSummaryCards
        activeCount={activeSessions.length}
        todayTotalAdet={todayTotalAdet}
        todayTotalBatch={todayTotalBatch}
        kritikStokCount={kritikStokCount}
      />

      {/* Aktif Üretimler */}
      <div>
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          Aktif Üretimler
          {activeSessions.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({activeSessions.length})
            </span>
          )}
        </h2>
        <ActiveKutuSessions sessions={activeSessions} />
      </div>

      {/* Bugün Tamamlanan */}
      <div>
        <h2 className="text-base font-semibold mb-2">
          Bugün Tamamlanan
          {completedSessions.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({completedSessions.length})
            </span>
          )}
        </h2>
        <TodayKutuCompleted sessions={completedSessions} />
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

      {/* Yeni Kutu Dialog */}
      <YeniKutuDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
