"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { OverviewCommand, type OverviewCommandData } from "./overview-command";
import type { OverviewKpiData } from "./overview-kpi-cards";
import type { DailyOverviewData } from "./overview-production-chart";
import type { MonthlyTrendData } from "./overview-trend-chart";

const OverviewTrendChart = dynamic(
  () => import("./overview-trend-chart").then((mod) => ({ default: mod.OverviewTrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

interface OverviewTabProps {
  kpiData: OverviewKpiData;
  dailyData: DailyOverviewData[];
  monthlyData: MonthlyTrendData[];
  cmdData: OverviewCommandData;
  onNavigate: (tab: string) => void;
}

export function OverviewTab({ cmdData, monthlyData, onNavigate }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <OverviewCommand data={cmdData} onNavigate={onNavigate} />
      <OverviewTrendChart data={monthlyData} />
    </div>
  );
}
