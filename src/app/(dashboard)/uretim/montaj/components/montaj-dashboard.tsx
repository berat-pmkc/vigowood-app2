"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Wrench, ClipboardList } from "lucide-react";
import { ActiveSessions } from "./active-sessions";
import { NewSessionDialog } from "./new-session-dialog";
import { CloseSessionDialog } from "./close-session-dialog";
import { SummaryCards } from "./summary-cards";
import { StepPerformanceChart } from "./step-performance-chart";
import { ProductTrendChart } from "./product-trend-chart";
import { PackageReadyWidget } from "./package-ready-widget";
import { CompletedSessionsSheet, type CompletedMontajSession } from "./completed-sessions-sheet";
import type { ActiveMontajSession } from "./session-card";
import { cancelMontajSession } from "../actions";
import { toast } from "sonner";
import { useMontajSessionRealtime } from "@/hooks/use-montaj-session-realtime";

interface ProductOption {
  sku: string;
  urun_adi: string;
}

interface MontajDashboardProps {
  activeSessions: ActiveMontajSession[];
  completedSessions: CompletedMontajSession[];
  productOptions: ProductOption[];
}

export function MontajDashboard({
  activeSessions,
  completedSessions,
  productOptions,
}: MontajDashboardProps) {
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [completedSheetOpen, setCompletedSheetOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ActiveMontajSession | null>(null);

  // Realtime subscription
  useMontajSessionRealtime();

  const handleClose = (session: ActiveMontajSession) => {
    setSelectedSession(session);
    setCloseDialogOpen(true);
  };

  const handleCancel = async (sessionId: string) => {
    const result = await cancelMontajSession(sessionId);
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
            <Wrench className="w-6 h-6" />
            Montaj
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Montaj seansları ve analiz
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
            {completedSessions.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5">
                {completedSessions.length}
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

      {/* Package Ready Widget */}
      <section>
        <PackageReadyWidget />
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

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProductTrendChart products={productOptions} />
        <StepPerformanceChart products={productOptions} />
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
