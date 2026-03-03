"use client";

import { Scissors, Package, Clock, AlertTriangle } from "lucide-react";
import { KESIM_MAKINE_IDS, MAKINE_LABELS, type KesimMakineId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MdfStokItem, MachineCounts } from "../types";

interface KesimSummaryCardsProps {
  todayTotalBatch: number;
  machineCounts: MachineCounts;
  mdfStok: MdfStokItem[];
  stokTahminiGun: number | null;
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

function getMdfStatusColor(kritikCount: number, total: number) {
  if (total === 0) return { text: "text-muted-foreground", dot: "bg-gray-400" };
  if (kritikCount > 0) return { text: "text-red-600", dot: "bg-red-500" };
  return { text: "text-emerald-600", dot: "bg-emerald-500" };
}

export function KesimSummaryCards({
  todayTotalBatch,
  machineCounts,
  mdfStok,
  stokTahminiGun,
}: KesimSummaryCardsProps) {
  const totalMdfStok = mdfStok.reduce((sum, m) => sum + (m.hazir_eleman_aktif_stok ?? 0), 0);
  const kritikCount = mdfStok.filter(
    (m) => m.hazir_eleman_kritik_stok !== null && m.hazir_eleman_aktif_stok < m.hazir_eleman_kritik_stok
  ).length;
  const mdfColors = getMdfStatusColor(kritikCount, mdfStok.length);

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

      {/* Makine Bazlı — compact inline */}
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

      {/* MDF Stok */}
      <div className="flex items-center gap-1.5 bg-card border rounded-md px-2.5 py-1.5">
        <Package className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">MDF</span>
        {mdfStok.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            <span className={cn("font-semibold tabular-nums", mdfColors.text)}>
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
      </div>

      {/* Stok Tahmini */}
      <div className="flex items-center gap-1.5 bg-card border rounded-md px-2.5 py-1.5">
        <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">Tahmin</span>
        {stokTahminiGun !== null ? (
          <span className={cn("font-semibold tabular-nums", getTahminColor(stokTahminiGun))}>
            {stokTahminiGun}g
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}
