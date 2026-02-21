"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Package } from "lucide-react";
import { ActiveSessions } from "./active-sessions";
import { NewSessionDialog } from "./new-session-dialog";
import { CloseSessionDialog } from "./close-session-dialog";
import { SummaryCards } from "./summary-cards";
import { ProductTrendChart } from "./product-trend-chart";
import { CompletedSessions, type CompletedSession } from "./completed-sessions";
import type { ActiveSession } from "./session-card";
import { cancelSession } from "../actions";
import { toast } from "sonner";
import { usePaketlemeRealtime } from "@/hooks/use-paketleme-realtime";

interface ProductOption {
  sku: string;
  urun_adi: string;
}

interface PaketlemeDashboardProps {
  activeSessions: ActiveSession[];
  completedSessions: CompletedSession[];
  productOptions: ProductOption[];
}

export function PaketlemeDashboard({
  activeSessions,
  completedSessions,
  productOptions,
}: PaketlemeDashboardProps) {
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);

  // Realtime subscription
  usePaketlemeRealtime();

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
        <Button
          onClick={() => setNewDialogOpen(true)}
          className="bg-vw-primary hover:bg-vw-deep text-white h-10"
        >
          <Plus className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Yeni Seans</span>
          <span className="sm:hidden">Yeni</span>
        </Button>
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
        <ProductTrendChart products={productOptions} />
      </section>

      <Separator />

      {/* Completed Sessions */}
      <section>
        <CompletedSessions sessions={completedSessions} />
      </section>

      {/* Dialogs */}
      <NewSessionDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} />
      <CloseSessionDialog
        session={selectedSession}
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
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
