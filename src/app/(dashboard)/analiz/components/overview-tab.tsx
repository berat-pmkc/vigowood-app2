"use client";

import {
  OverviewKpiCards,
  type OverviewKpiData,
} from "./overview-kpi-cards";
import {
  OverviewProductionChart,
  type DailyOverviewData,
} from "./overview-production-chart";
import {
  OverviewTrendChart,
  type MonthlyTrendData,
} from "./overview-trend-chart";

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
