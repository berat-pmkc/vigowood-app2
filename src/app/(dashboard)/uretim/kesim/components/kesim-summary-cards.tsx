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
  // En kritik MDF bulma (stok/kritik oranı en düşük olan)
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

  // MDF stok: toplam adet ve kritik durumda olanların sayısı
  const totalMdfStok = mdfStok.reduce((sum, m) => sum + (m.hazir_eleman_aktif_stok ?? 0), 0);
  const kritikCount = mdfStok.filter(
    (m) => m.hazir_eleman_kritik_stok !== null && m.hazir_eleman_aktif_stok < m.hazir_eleman_kritik_stok
  ).length;

  function getMdfStokColor() {
    if (mdfStok.length === 0) return "text-muted-foreground";
    if (kritikCount > 0) return "text-red-600";
    return "text-emerald-600";
  }

  function getMdfStokBg() {
    if (mdfStok.length === 0) return "bg-gray-50";
    if (kritikCount > 0) return "bg-red-50";
    return "bg-amber-50";
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {/* 1: Bugün Kesilen */}
      <Card className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-50 p-1.5 rounded-lg shrink-0">
            <Scissors className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground leading-tight">Bugün Kesilen</p>
            <p className={cn("text-lg font-bold tabular-nums leading-tight", getBatchColor(todayTotalBatch))}>
              {todayTotalBatch}
            </p>
          </div>
        </div>
      </Card>

      {/* 2: Makine Bazlı */}
      <Card className="px-3 py-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-blue-50 p-1.5 rounded-lg shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">Makine Bazlı</p>
        </div>
        <div className="flex items-center gap-1">
          {KESIM_MAKINE_IDS.map((id) => {
            const count = machineCounts[id] ?? 0;
            const colors = MAKINE_COLORS[id] ?? { text: "text-gray-700", bg: "bg-gray-100" };
            return (
              <div key={id} className={cn("rounded px-1.5 py-0.5 text-center flex-1", colors.bg)}>
                <p className="text-[9px] text-muted-foreground truncate leading-tight">
                  {MAKINE_LABELS[id as KesimMakineId]?.split(" ")[0] ?? id}
                </p>
                <p className={cn("text-sm font-bold tabular-nums leading-tight", colors.text)}>{count}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3: MDF Stok */}
      <Card className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg shrink-0", getMdfStokBg())}>
            <Package className={cn("w-3.5 h-3.5", kritikCount > 0 ? "text-red-600" : "text-amber-600")} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground leading-tight">MDF Stok</p>
            {mdfStok.length === 0 ? (
              <p className="text-xs text-muted-foreground">Veri yok</p>
            ) : (
              <>
                <p className={cn("text-lg font-bold tabular-nums leading-tight", getMdfStokColor())}>
                  {totalMdfStok} <span className="text-[10px] font-normal">adet</span>
                </p>
                {kritikCount > 0 && (
                  <p className="text-[10px] text-red-600 leading-tight truncate">
                    {kritikCount} kalem kritik
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </Card>

      {/* 4: Stok Tahmini */}
      <Card className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg shrink-0", getTahminBg(stokTahminiGun))}>
            <Clock className={cn("w-3.5 h-3.5", getTahminColor(stokTahminiGun))} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground leading-tight">Stok Tahmini</p>
            {stokTahminiGun !== null ? (
              <>
                <p className={cn("text-lg font-bold tabular-nums leading-tight", getTahminColor(stokTahminiGun))}>
                  {stokTahminiGun} <span className="text-[10px] font-normal">gün</span>
                </p>
                {kritikMdf && (
                  <p className="text-[10px] text-muted-foreground leading-tight truncate">
                    {kritikMdf.part_adi ?? kritikMdf.part_id}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Hesaplanamıyor</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
