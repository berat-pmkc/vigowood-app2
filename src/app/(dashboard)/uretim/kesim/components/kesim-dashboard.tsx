"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { KesimSummaryCards } from "./kesim-summary-cards";
import { MachineStatusBar } from "./machine-status-bar";
import { KesimRecords } from "./kesim-records";
import { YeniKesimDialog } from "./yeni-kesim-dialog";
import type { CutBatchRow, MdfStokItem, MachineStatusEntry, MachineCounts } from "../types";
import { Plus, Scissors } from "lucide-react";
import { useServerDataCache } from "@/hooks/use-server-data-cache";

const DATE_FILTERS = [
  { key: "today", label: "Bugün" },
  { key: "yesterday", label: "Dün" },
  { key: "week", label: "Bu Hafta" },
  { key: "month", label: "Bu Ay" },
] as const;

const DATE_FILTER_LABELS: Record<string, string> = {
  today: "Bugün",
  yesterday: "Dün",
  week: "Bu Hafta",
  month: "Bu Ay",
};

interface KesimDashboardProps {
  records: CutBatchRow[];
  todayTotalBatch: number;
  dateFilter: string;
  machineCounts: MachineCounts;
  mdfStok: MdfStokItem[];
  machineStatus: MachineStatusEntry[];
  stokTahminiGun: number | null;
  dailyAvgConsumption: number;
}

export function KesimDashboard({
  records: serverRecords,
  todayTotalBatch: serverTodayTotalBatch,
  dateFilter,
  machineCounts,
  mdfStok,
  machineStatus,
  stokTahminiGun,
  dailyAvgConsumption,
}: KesimDashboardProps) {
  const router = useRouter();
  const records = useServerDataCache("kesim-records", serverRecords);
  const todayTotalBatch = useServerDataCache("kesim-batch", serverTodayTotalBatch);
  const [dialogOpen, setDialogOpen] = useState(false);

  const sectionLabel = DATE_FILTER_LABELS[dateFilter] || "Bugün";

  return (
    <div className="space-y-4">
      {/* Header + Machine Status */}
      <div className="flex flex-col gap-3">
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
        <MachineStatusBar machineStatus={machineStatus} />
      </div>

      {/* KPI Cards */}
      <KesimSummaryCards
        todayTotalBatch={todayTotalBatch}
        machineCounts={machineCounts}
        mdfStok={mdfStok}
        stokTahminiGun={stokTahminiGun}
        dailyAvgConsumption={dailyAvgConsumption}
      />

      {/* Kesim Kayıtları */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">
            Kesim Kayıtları
            {records.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                — {sectionLabel}
                {" "}({records.length})
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
        <KesimRecords records={records} />
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
