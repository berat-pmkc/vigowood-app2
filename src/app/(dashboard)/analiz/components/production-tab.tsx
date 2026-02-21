"use client";

import {
  ProductionKpiCards,
  type ProductionKpiData,
} from "./production-kpi-cards";
import {
  ProductionDailyChart,
  type DailyProductionData,
} from "./production-daily-chart";
import { ProductionEfficiency, type EfficiencyData } from "./production-efficiency";

interface ProductionTabProps {
  kpiData: ProductionKpiData;
  dailyData: DailyProductionData[];
  efficiencyData: EfficiencyData[];
}

export function ProductionTab({
  kpiData,
  dailyData,
  efficiencyData,
}: ProductionTabProps) {
  return (
    <div className="space-y-4">
      <ProductionKpiCards data={kpiData} />
      <ProductionDailyChart data={dailyData} />
      <ProductionEfficiency data={efficiencyData} />
    </div>
  );
}
