"use client";

import { Scissors, Package, Clock, AlertTriangle, ChevronDown } from "lucide-react";
import { KESIM_MAKINE_IDS, MAKINE_LABELS, type KesimMakineId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MdfStokItem, MachineCounts } from "../types";

interface KesimSummaryCardsProps {
  todayTotalBatch: number;
  machineCounts: MachineCounts;
  mdfStok: MdfStokItem[];
  stokTahminiGun: number | null;
  dailyAvgConsumption: number;
}

const MAKINE_DOT: Record<string, string> = {
  "MAK-1": "bg-emerald-500",
  "MAK-2": "bg-blue-500",
  "MAK-3": "bg-purple-500",
};

function getBatchColor(count: number) {
  if (count >= 10) return "text-emerald-600";
  if (count >= 5) return "text-amber-600";
  return "text-red-600";
}

function getTahminColor(gun: number | null) {
  if (gun === null) return "text-muted-foreground";
  if (gun > 14) return "text-emerald-600";
  if (gun >= 7) return "text-amber-600";
  return "text-red-600";
}

function getStokStatus(stok: number, kritik: number | null): { label: string; color: string; bg: string } {
  if (kritik === null) return { label: "—", color: "text-muted-foreground", bg: "bg-gray-100" };
  if (stok < kritik) return { label: "Kritik", color: "text-red-700", bg: "bg-red-50" };
  if (stok <= kritik * 1.5) return { label: "Düşük", color: "text-amber-700", bg: "bg-amber-50" };
  return { label: "Yeterli", color: "text-emerald-700", bg: "bg-emerald-50" };
}

function getItemTahminGun(stok: number, dailyAvg: number): number | null {
  if (dailyAvg <= 0) return null;
  return Math.floor(stok / dailyAvg);
}

export function KesimSummaryCards({
  todayTotalBatch,
  machineCounts,
  mdfStok,
  stokTahminiGun,
  dailyAvgConsumption,
}: KesimSummaryCardsProps) {
  const totalMdfStok = mdfStok.reduce((sum, m) => sum + (m.hazir_eleman_aktif_stok ?? 0), 0);
  const kritikCount = mdfStok.filter(
    (m) => m.hazir_eleman_kritik_stok !== null && m.hazir_eleman_aktif_stok < m.hazir_eleman_kritik_stok
  ).length;

  // Sort: kritik önce, sonra düşük, sonra yeterli
  const sortedMdfStok = [...mdfStok].sort((a, b) => {
    const aStatus = getStokStatus(a.hazir_eleman_aktif_stok, a.hazir_eleman_kritik_stok);
    const bStatus = getStokStatus(b.hazir_eleman_aktif_stok, b.hazir_eleman_kritik_stok);
    const order: Record<string, number> = { "Kritik": 0, "Düşük": 1, "Yeterli": 2, "—": 3 };
    return (order[aStatus.label] ?? 3) - (order[bStatus.label] ?? 3);
  });

  const mdfPopoverContent = (
    <PopoverContent
      className="w-[420px] p-0"
      align="start"
      side="bottom"
      sideOffset={8}
    >
      <div className="px-3 py-2.5 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">MDF Stok Durumu</h4>
          <span className="text-xs text-muted-foreground">
            {mdfStok.length} ürün
          </span>
        </div>
        {dailyAvgConsumption > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Günlük ort. tüketim: {dailyAvgConsumption.toFixed(1)} adet/gün
          </p>
        )}
      </div>
      <ScrollArea className="max-h-[360px]">
        <div className="divide-y">
          {sortedMdfStok.map((item) => {
            const status = getStokStatus(item.hazir_eleman_aktif_stok, item.hazir_eleman_kritik_stok);
            const tahminGun = getItemTahminGun(item.hazir_eleman_aktif_stok, dailyAvgConsumption);

            return (
              <div
                key={item.part_id}
                className={cn(
                  "px-3 py-2 flex items-center gap-3 text-xs",
                  status.label === "Kritik" && "bg-red-50/50"
                )}
              >
                {/* Part name */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-foreground">
                    {item.part_adi ?? item.part_id}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {item.part_id}
                  </p>
                </div>

                {/* Stok */}
                <div className="text-right shrink-0 w-14">
                  <p className={cn("font-semibold tabular-nums", status.color)}>
                    {item.hazir_eleman_aktif_stok.toLocaleString("tr-TR")}
                  </p>
                  {item.hazir_eleman_kritik_stok !== null && (
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      / {item.hazir_eleman_kritik_stok.toLocaleString("tr-TR")}
                    </p>
                  )}
                </div>

                {/* Durum badge */}
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 w-12 text-center",
                  status.bg, status.color
                )}>
                  {status.label}
                </span>

                {/* Tahmini gün */}
                <div className="text-right shrink-0 w-12">
                  {tahminGun !== null ? (
                    <span className={cn("font-semibold tabular-nums", getTahminColor(tahminGun))}>
                      {tahminGun}g
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      {/* Footer */}
      <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Toplam: <span className="font-semibold text-foreground">{totalMdfStok.toLocaleString("tr-TR")}</span> adet
        </span>
        {kritikCount > 0 && (
          <span className="flex items-center gap-1 text-red-600 font-medium">
            <AlertTriangle className="w-3 h-3" />
            {kritikCount} kritik
          </span>
        )}
      </div>
    </PopoverContent>
  );

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-xs">
      {/* Bugün Kesilen */}
      <div className="flex items-center gap-1.5 bg-card border rounded-md px-2.5 py-1.5">
        <Scissors className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">Bugün</span>
        <span className={cn("font-semibold tabular-nums", getBatchColor(todayTotalBatch))}>
          {todayTotalBatch}
        </span>
      </div>

      {/* Makine Bazlı */}
      {KESIM_MAKINE_IDS.map((id) => {
        const count = machineCounts[id] ?? 0;
        const dot = MAKINE_DOT[id] ?? "bg-gray-400";
        const shortLabel = MAKINE_LABELS[id as KesimMakineId]?.split(" ")[0] ?? id;
        return (
          <div key={id} className="flex items-center gap-1.5 bg-card border rounded-md px-2.5 py-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dot)} />
            <span className="text-muted-foreground">{shortLabel}</span>
            <span className="font-semibold tabular-nums">{count}</span>
          </div>
        );
      })}

      {/* MDF Stok — Tıklanabilir, Popover ile detay */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 bg-card border rounded-md px-2.5 py-1.5",
              "hover:bg-accent/50 transition-colors cursor-pointer",
              kritikCount > 0 && "border-red-200 bg-red-50/30"
            )}
          >
            <Package className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">MDF</span>
            {mdfStok.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <>
                <span className={cn(
                  "font-semibold tabular-nums",
                  kritikCount > 0 ? "text-red-600" : "text-emerald-600"
                )}>
                  {totalMdfStok.toLocaleString("tr-TR")}
                </span>
                {kritikCount > 0 && (
                  <span className="flex items-center gap-0.5 text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="font-medium">{kritikCount}</span>
                  </span>
                )}
              </>
            )}
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        {mdfPopoverContent}
      </Popover>

      {/* Stok Tahmini — Aynı Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 bg-card border rounded-md px-2.5 py-1.5",
              "hover:bg-accent/50 transition-colors cursor-pointer",
              stokTahminiGun !== null && stokTahminiGun < 7 && "border-red-200 bg-red-50/30"
            )}
          >
            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Tahmin</span>
            {stokTahminiGun !== null ? (
              <span className={cn("font-semibold tabular-nums", getTahminColor(stokTahminiGun))}>
                {stokTahminiGun}g
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        {mdfPopoverContent}
      </Popover>
    </div>
  );
}
