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
import { KesimDonemOzeti } from "./kesim-donem-ozeti";
import type { KesimTalebi } from "../actions";
import type { CutBatchRow, MdfStokItem, MachineStatusEntry, MachineCounts } from "../types";
import { Plus, Scissors, CalendarDays } from "lucide-react";
import { useServerDataCache } from "@/hooks/use-server-data-cache";
import { sonHaftalar, sonAylar, donemAciklama } from "@/lib/donem";

/**
 * Hızlı gün seçimleri. Hafta ve ay artık tek tek seçiliyor (montaj
 * ekranıyla aynı mantık): "bu hafta / bu ay" gibi kayan aralıklar,
 * iki gün sonra bakıldığında farklı sonuç veriyordu.
 */
const GUN_FILTRELERI = [
  { key: "bugun", label: "Bugün" },
  { key: "dun", label: "Dün" },
] as const;

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

  /** Dönem değişimi URL'e yazılıyor; sunucu tarafı yeniden sorguluyor */
  const donemSec = (kod: string) => {
    if (!kod) return;
    const params = new URLSearchParams();
    if (kod !== "bugun") params.set("dateFilter", kod);
    router.push(`/uretim/kesim${params.toString() ? `?${params}` : ""}`);
  };

  const talepBaslat = (t: KesimTalebi) => {
    setAktifTalep(t);
    setDialogOpen(true);
  };
  const haftalar = useMemo(() => sonHaftalar(12), []);
  const aylar = useMemo(() => sonAylar(12), []);
  const haftaSecili = dateFilter.includes(".");
  const aySecili = /^\d{4}_\d{2}$/.test(dateFilter);

  const sectionLabel = donemAciklama(dateFilter);

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
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {GUN_FILTRELERI.map((f) => (
            <Button
              key={f.key}
              variant={dateFilter === f.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => donemSec(f.key)}
            >
              {f.label}
            </Button>
          ))}

          <Select value={haftaSecili ? dateFilter : ""} onValueChange={donemSec}>
            <SelectTrigger className={`h-7 w-[130px] text-xs ${haftaSecili ? "border-primary bg-primary text-primary-foreground" : ""}`}>
              <CalendarDays className="mr-1 h-3.5 w-3.5" />
              <SelectValue placeholder="Hafta" />
            </SelectTrigger>
            <SelectContent>
              {haftalar.map((h) => (
                <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={aySecili ? dateFilter : ""} onValueChange={donemSec}>
            <SelectTrigger className={`h-7 w-[120px] text-xs ${aySecili ? "border-primary bg-primary text-primary-foreground" : ""}`}>
              <CalendarDays className="mr-1 h-3.5 w-3.5" />
              <SelectValue placeholder="Ay" />
            </SelectTrigger>
            <SelectContent>
              {aylar.map((a) => (
                <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground">{sectionLabel}</span>
        </div>
        <KesimDonemOzeti records={records} donemEtiketi={sectionLabel} />

        <div className="mt-3">
          <KesimRecords records={records} />
        </div>
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
