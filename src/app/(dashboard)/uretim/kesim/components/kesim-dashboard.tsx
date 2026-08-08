"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KesimSummaryCards } from "./kesim-summary-cards";
import { MachineStatusBar } from "./machine-status-bar";
import { KesimRecords } from "./kesim-records";
import { YeniKesimDialog } from "./yeni-kesim-dialog";
import { AcikTalepSeridi } from "./acik-talep-seridi";
import { PlakaStokPaneli } from "./plaka-stok-paneli";
import type { KesimTalebi } from "../actions";
import type { CutBatchRow, MdfStokItem, MachineStatusEntry, MachineCounts } from "../types";
import { Plus, Scissors, CalendarDays } from "lucide-react";
import { useServerDataCache } from "@/hooks/use-server-data-cache";

const DATE_FILTERS = [
  { key: "today", label: "Bugün" },
  { key: "yesterday", label: "Dün" },
  { key: "week", label: "Bu Hafta" },
  { key: "month", label: "Bu Ay" },
  { key: "last_month", label: "Geçen Ay" },
] as const;

const AY_ISIMLERI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const DATE_FILTER_LABELS: Record<string, string> = {
  today: "Bugün",
  yesterday: "Dün",
  week: "Bu Hafta",
  month: "Bu Ay",
  last_month: "Geçen Ay",
};

/** Generate month options from a start date (e.g. Jan 2025) until last month */
function generateMonthOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  // Start from Jan 2025 up to last month
  const startYear = 2025;
  const startMonth = 0; // January
  for (let y = now.getFullYear(); y >= startYear; y--) {
    const endM = y === now.getFullYear() ? now.getMonth() - 1 : 11;
    const startM = y === startYear ? startMonth : 0;
    for (let m = endM; m >= startM; m--) {
      const value = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = `${AY_ISIMLERI[m]} ${y}`;
      options.push({ value, label });
    }
  }
  return options;
}

interface KesimDashboardProps {
  records: CutBatchRow[];
  todayTotalBatch: number;
  dateFilter: string;
  machineCounts: MachineCounts;
  mdfStok: MdfStokItem[];
  machineStatus: MachineStatusEntry[];
  stokTahminiGun: number | null;
  dailyAvgConsumption: number;
  /** Bekleyen kesim talepleri — üstteki şeritte gösterilir */
  acikTalepler: KesimTalebi[];
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

  acikTalepler,
}: KesimDashboardProps) {
  const router = useRouter();
  const records = useServerDataCache("kesim-records", serverRecords);
  const todayTotalBatch = useServerDataCache("kesim-batch", serverTodayTotalBatch);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aktifTalep, setAktifTalep] = useState<KesimTalebi | null>(null);

  const talepBaslat = (t: KesimTalebi) => {
    setAktifTalep(t);
    setDialogOpen(true);
  };
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  // Custom month filter label: "2025-11" → "Kasım 2025"
  const isCustomMonth = /^\d{4}-\d{2}$/.test(dateFilter);
  const sectionLabel = isCustomMonth
    ? (() => {
        const [y, m] = dateFilter.split("-").map(Number);
        return `${AY_ISIMLERI[m - 1]} ${y}`;
      })()
    : DATE_FILTER_LABELS[dateFilter] || "Bugün";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <AcikTalepSeridi talepler={acikTalepler} onKesimeBasla={talepBaslat} />
        </div>
        <PlakaStokPaneli mdfStok={mdfStok} />
      </div>

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
          <Select
            value={isCustomMonth ? dateFilter : ""}
            onValueChange={(value) => {
              if (value) {
                router.push(`/uretim/kesim?dateFilter=${value}`);
              }
            }}
          >
            <SelectTrigger className={`h-7 text-xs w-[140px] ${isCustomMonth ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}>
              <CalendarDays className="w-3.5 h-3.5 mr-1" />
              <SelectValue placeholder="Ay Seç" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      <YeniKesimDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setAktifTalep(null);
        }}
        talep={aktifTalep}
      />
    </div>
  );
}
