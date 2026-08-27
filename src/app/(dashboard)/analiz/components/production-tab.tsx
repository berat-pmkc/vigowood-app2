"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import {
  ProductionKpiCards,
  type ProductionKpiData,
} from "./production-kpi-cards";
import type { DailyProductionData } from "./production-daily-chart";
import type { EfficiencyData } from "./production-efficiency";
import { ProductionLaborCost, type LaborCostData } from "./production-labor-cost";

const ProductionDailyChart = dynamic(
  () => import("./production-daily-chart").then(mod => ({ default: mod.ProductionDailyChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const ProductionEfficiency = dynamic(
  () => import("./production-efficiency").then(mod => ({ default: mod.ProductionEfficiency })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

interface ProductionTabProps {
  kpiData: ProductionKpiData;
  dailyData: DailyProductionData[];
  efficiencyData: EfficiencyData[];
  laborCost: LaborCostData;
}

export function ProductionTab({
  kpiData,
  dailyData,
  efficiencyData,
  laborCost,
}: ProductionTabProps) {
  return (
    <div className="space-y-4">
      <ProductionKpiCards data={kpiData} />
      <ProductionLaborCost data={laborCost} />
      <ProductionDailyChart data={dailyData} />
      <ProductionEfficiency data={efficiencyData} />
    </div>
  );
}
