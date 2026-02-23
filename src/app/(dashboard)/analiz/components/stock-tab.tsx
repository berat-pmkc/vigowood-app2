"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { StockKpiCards, type StockKpiData } from "./stock-kpi-cards";
import type { StockMovementData } from "./stock-movement-chart";
import {
  StockCriticalTable,
  type CriticalStockRow,
} from "./stock-critical-table";

const StockMovementChart = dynamic(
  () => import("./stock-movement-chart").then(mod => ({ default: mod.StockMovementChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

interface StockTabProps {
  kpiData: StockKpiData;
  movementData: StockMovementData[];
  criticalData: CriticalStockRow[];
}

export function StockTab({
  kpiData,
  movementData,
  criticalData,
}: StockTabProps) {
  return (
    <div className="space-y-4">
      <StockKpiCards data={kpiData} />
      <StockMovementChart data={movementData} />
      <StockCriticalTable data={criticalData} />
    </div>
  );
}
