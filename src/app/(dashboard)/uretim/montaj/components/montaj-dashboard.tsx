"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Wrench, ClipboardList, Package } from "lucide-react";
import Link from "next/link";
import { ActiveSessions } from "./active-sessions";
import { NewSessionDialog } from "./new-session-dialog";
import { CloseSessionDialog } from "./close-session-dialog";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { SummaryCards } from "./summary-cards";
import { MontajAnaliz } from "./montaj-analiz";
import { PackageReadyDialog } from "./package-ready-widget";

const StepPerformanceChart = dynamic(
  () => import("./step-performance-chart").then(mod => ({ default: mod.StepPerformanceChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const ProductTrendChart = dynamic(
  () => import("./product-trend-chart").then(mod => ({ default: mod.ProductTrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
import type { ActiveMontajSession } from "./session-card";
import { cancelMontajSession } from "../actions";
import { toast } from "sonner";
import { useMontajSessionRealtime } from "@/hooks/use-montaj-session-realtime";
import { useServerDataCache } from "@/hooks/use-server-data-cache";

interface ProductOption {
  sku: string;
  urun_adi: string;
}

interface MontajDashboardProps {
  activeSessions: ActiveMontajSession[];
  productOptions: ProductOption[];
  /** Seans iptali yalnızca ofis rolleri için (PRODUCTION_CANCEL_ROLES). */
  canCancel: boolean;
  /** Saha hesapları analizleri görmez — kişi/adım karşılaştırması içeriyor */
  analizGorebilir: boolean;
}

export function MontajDashboard({
  canCancel,
  analizGorebilir,
  activeSessions: serverActiveSessions,
  productOptions: serverProductOptions,
}: MontajDashboardProps) {
  const activeSessions = useServerDataCache("montaj-sessions", serverActiveSessions);
  const productOptions = useServerDataCache("montaj-products", serverProductOptions);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [packageReadyOpen, setPackageReadyOpen] = useState(false);
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
            onClick={() => setPackageReadyOpen(true)}
            className="h-10"
          >
            <Package className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Hazır Stok</span>
            <span className="sm:hidden">Stok</span>
          </Button>
          <Link href="/uretim/montaj/tamamlananlar">
            <Button variant="outline" className="h-10">
              <ClipboardList className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Tamamlananlar</span>
              <span className="sm:hidden">Geçmiş</span>
            </Button>
          </Link>
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
          canCancel={canCancel}
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

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProductTrendChart products={productOptions} />
        <StepPerformanceChart products={productOptions} />
      </section>

      {/* Analiz — yalnızca Yönetici + Endüstri Mühendisi */}
      {analizGorebilir && (
        <>
          <Separator />
          <MontajAnaliz />
        </>
      )}

      {/* Dialogs & Sheets */}
      <NewSessionDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} />
      <CloseSessionDialog
        session={selectedSession}
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
      />
      <PackageReadyDialog
        open={packageReadyOpen}
        onOpenChange={setPackageReadyOpen}
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
