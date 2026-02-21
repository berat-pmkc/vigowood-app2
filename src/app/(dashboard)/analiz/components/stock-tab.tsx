"use client";

import { StockKpiCards, type StockKpiData } from "./stock-kpi-cards";
import {
  StockMovementChart,
  type StockMovementData,
} from "./stock-movement-chart";
import {
  StockCriticalTable,
  type CriticalStockRow,
} from "./stock-critical-table";

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
