"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Package, ClipboardList } from "lucide-react";
import { ActiveSessions } from "./active-sessions";
import { NewSessionDialog } from "./new-session-dialog";
import { CloseSessionDialog } from "./close-session-dialog";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { SummaryCards } from "./summary-cards";

import { PaketlemeAnaliz } from "./paketleme-analiz";

const ProductTrendChart = dynamic(
  () => import("./product-trend-chart").then(mod => ({ default: mod.ProductTrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
import { CompletedSessionsSheet, type CompletedSession } from "./completed-sessions";
import type { ActiveSession } from "./session-card";
import { cancelSession } from "../actions";
import { toast } from "sonner";
import { usePaketlemeRealtime } from "@/hooks/use-paketleme-realtime";
import { useServerDataCache } from "@/hooks/use-server-data-cache";

interface ProductOption {
  sku: string;
  urun_adi: string;
}

interface PaketlemeDashboardProps {
  /** Saha hesapları analizleri görmez — kişi bazlı karşılaştırma içeriyor */
  analizGorebilir: boolean;
  activeSessions: ActiveSession[];
  completedSessions: CompletedSession[];
  productOptions: ProductOption[];
}

export function PaketlemeDashboard({
  analizGorebilir,
  activeSessions: serverActiveSessions,
  completedSessions: serverCompletedSessions,
  productOptions: serverProductOptions,
}: PaketlemeDashboardProps) {
  const activeSessions = useServerDataCache("paketleme-sessions", serverActiveSessions);
  const completedSessions = useServerDataCache("paketleme-completed", serverCompletedSessions);
  const productOptions = useServerDataCache("paketleme-products", serverProductOptions);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [completedSheetOpen, setCompletedSheetOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);

  // Realtime subscription
  usePaketlemeRealtime();

  // Bugün tamamlanan sayısı (badge için)
  const todayCompletedCount = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return completedSessions.filter(
      (s) => s.end_time && new Date(s.end_time) >= todayStart
    ).length;
  }, [completedSessions]);

  const handleClose = (session: ActiveSession) => {
    setSelectedSession(session);
    setCloseDialogOpen(true);
  };

  const handleCancel = async (sessionId: string) => {
    const result = await cancelSession(sessionId);
    if (result.success) {
      toast.success("Seans iptal edildi");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6" />
            Paketleme
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paketleme seansları ve analiz
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCompletedSheetOpen(true)}
            className="h-10"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Tamamlananlar</span>
            <span className="sm:hidden">Geçmiş</span>
            {todayCompletedCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5" title="Bugün tamamlanan">
                {todayCompletedCount}
              </span>
            )}
          </Button>
          <Button
            onClick={() => setNewDialogOpen(true)}
            className="bg-vw-primary hover:bg-vw-deep text-white h-10"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Yeni Seans</span>
            <span className="sm:hidden">Yeni</span>
          </Button>
        </div>
      </div>

      {/* Active Sessions */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Devam Eden Seanslar
          {activeSessions.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
              {activeSessions.length}
            </span>
          )}
        </h2>
        <ActiveSessions
          sessions={activeSessions}
          onClose={handleClose}
          onCancel={handleCancel}
        />
      </section>

      <Separator />

      {/* Summary Cards */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Özet
        </h2>
        <SummaryCards />
      </section>

      <Separator />

      {/* Product Trend Chart */}
      <section>
        {/* Genel analiz — yalnızca yönetim rolleri */}
        {analizGorebilir && <PaketlemeAnaliz />}

        {/* Tek ürünün birim süre seyri — detaya inmek isteyene */}
        <ProductTrendChart products={productOptions} />
      </section>

      {/* Dialogs & Sheets */}
      <NewSessionDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} />
      <CloseSessionDialog
        session={selectedSession}
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
      />
      <CompletedSessionsSheet
        sessions={completedSessions}
        open={completedSheetOpen}
        onOpenChange={setCompletedSheetOpen}
      />

      {/* Mobile FAB */}
      <div className="fixed bottom-20 right-4 md:hidden z-40">
        <Button
          size="lg"
          className="rounded-full w-14 h-14 bg-vw-primary hover:bg-vw-deep text-white shadow-lg"
          onClick={() => setNewDialogOpen(true)}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
