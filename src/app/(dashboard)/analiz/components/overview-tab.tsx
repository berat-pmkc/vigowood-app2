"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import {
  OverviewKpiCards,
  type OverviewKpiData,
} from "./overview-kpi-cards";
import type { DailyOverviewData } from "./overview-production-chart";
import type { MonthlyTrendData } from "./overview-trend-chart";

const OverviewProductionChart = dynamic(
  () => import("./overview-production-chart").then(mod => ({ default: mod.OverviewProductionChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const OverviewTrendChart = dynamic(
  () => import("./overview-trend-chart").then(mod => ({ default: mod.OverviewTrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

interface OverviewTabProps {
  kpiData: OverviewKpiData;
  dailyData: DailyOverviewData[];
  monthlyData: MonthlyTrendData[];
}

export function OverviewTab({
  kpiData,
  dailyData,
  monthlyData,
}: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <OverviewKpiCards data={kpiData} />
      <OverviewProductionChart data={dailyData} />
      <OverviewTrendChart data={monthlyData} />
    </div>
  );
}
