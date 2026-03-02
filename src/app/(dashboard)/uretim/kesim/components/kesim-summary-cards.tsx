"use client";

import { Card } from "@/components/ui/card";
import { Scissors, BarChart3, Package, Clock } from "lucide-react";
import { KESIM_MAKINE_IDS, MAKINE_LABELS, type KesimMakineId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { MdfStokItem, MachineCounts } from "../types";

interface KesimSummaryCardsProps {
  todayTotalBatch: number;
  machineCounts: MachineCounts;
  mdfStok: MdfStokItem[];
  stokTahminiGun: number | null;
}

const MAKINE_COLORS: Record<string, { text: string; bg: string }> = {
  "MAK-1": { text: "text-emerald-700", bg: "bg-emerald-100" },
  "MAK-2": { text: "text-blue-700", bg: "bg-blue-100" },
  "MAK-3": { text: "text-purple-700", bg: "bg-purple-100" },
};

function getBatchColor(count: number) {
  if (count >= 10) return "text-emerald-600";
  if (count >= 5) return "text-amber-600";
  return "text-red-600";
}

function getStokColor(stok: number, kritik: number | null) {
  if (kritik === null) return "text-foreground";
  if (stok < kritik) return "text-red-600";
  if (stok <= kritik * 1.5) return "text-amber-600";
  return "text-emerald-600";
}

function getStokBg(stok: number, kritik: number | null) {
  if (kritik === null) return "";
  if (stok < kritik) return "bg-red-50";
  if (stok <= kritik * 1.5) return "bg-amber-50";
  return "";
}

function getTahminColor(gun: number | null) {
  if (gun === null) return "text-muted-foreground";
  if (gun > 14) return "text-emerald-600";
  if (gun >= 7) return "text-amber-600";
  return "text-red-600";
}

function getTahminBg(gun: number | null) {
  if (gun === null) return "bg-gray-50";
  if (gun > 14) return "bg-emerald-50";
  if (gun >= 7) return "bg-amber-50";
  return "bg-red-50";
}

export function KesimSummaryCards({
  todayTotalBatch,
  machineCounts,
  mdfStok,
  stokTahminiGun,
}: KesimSummaryCardsProps) {
  // En kritik MDF bulma
  const kritikMdf = mdfStok.length > 0
    ? mdfStok.reduce((min, m) => {
        const minRatio = min.hazir_eleman_kritik_stok
          ? min.hazir_eleman_aktif_stok / min.hazir_eleman_kritik_stok
          : Infinity;
        const mRatio = m.hazir_eleman_kritik_stok
          ? m.hazir_eleman_aktif_stok / m.hazir_eleman_kritik_stok
          : Infinity;
        return mRatio < minRatio ? m : min;
      })
    : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1: Bugün Kesilen */}
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 p-2 rounded-lg">
            <Scissors className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bugün Kesilen</p>
            <p className={cn("text-xl font-bold tabular-nums", getBatchColor(todayTotalBatch))}>
              {todayTotalBatch}
            </p>
          </div>
        </div>
      </Card>

      {/* 2: Makine Bazlı */}
      <Card className="p-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-blue-50 p-2 rounded-lg">
            <BarChart3 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xs text-muted-foreground">Makine Bazlı</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {KESIM_MAKINE_IDS.map((id) => {
            const count = machineCounts[id] ?? 0;
            const colors = MAKINE_COLORS[id] ?? { text: "text-gray-700", bg: "bg-gray-100" };
            return (
              <div key={id} className={cn("rounded-md px-2 py-0.5 text-center flex-1", colors.bg)}>
                <p className="text-[10px] text-muted-foreground truncate">
                  {MAKINE_LABELS[id as KesimMakineId]?.split(" ")[0] ?? id}
                </p>
                <p className={cn("text-lg font-bold tabular-nums", colors.text)}>{count}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3: MDF Stok */}
      <Card className="p-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-amber-50 p-2 rounded-lg">
            <Package className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xs text-muted-foreground">MDF Stok</p>
        </div>
        {mdfStok.length === 0 ? (
          <p className="text-sm text-muted-foreground">Veri yok</p>
        ) : (
          <div className="space-y-0.5 mt-1 max-h-20 overflow-y-auto">
            {mdfStok.map((m) => (
              <div
                key={m.part_id}
                className={cn(
                  "flex items-center justify-between text-xs rounded px-1",
                  getStokBg(m.hazir_eleman_aktif_stok, m.hazir_eleman_kritik_stok)
                )}
              >
                <span className="truncate flex-1 mr-2">{m.part_adi ?? m.part_id}</span>
                <span className={cn("font-bold tabular-nums", getStokColor(m.hazir_eleman_aktif_stok, m.hazir_eleman_kritik_stok))}>
                  {m.hazir_eleman_aktif_stok}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 4: Stok Tahmini */}
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", getTahminBg(stokTahminiGun))}>
            <Clock className={cn("w-4 h-4", getTahminColor(stokTahminiGun))} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stok Tahmini</p>
            {stokTahminiGun !== null ? (
              <div>
                <p className={cn("text-xl font-bold tabular-nums", getTahminColor(stokTahminiGun))}>
                  {stokTahminiGun} <span className="text-sm font-normal">gün</span>
                </p>
                {kritikMdf && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {kritikMdf.part_adi ?? kritikMdf.part_id}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Hesaplanamıyor</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
