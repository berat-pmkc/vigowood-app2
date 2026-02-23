"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { KpiCards, type IadeKpiData } from "./kpi-cards";
import type { DailyIadeChartData } from "./trend-chart";

const TrendChart = dynamic(
  () => import("./trend-chart").then(mod => ({ default: mod.TrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
import { IadeDataTable, type IadeRecord } from "./iade-data-table";
import { IadeGirisDialog } from "./iade-giris-dialog";

interface IadeClientProps {
  canAddIade: boolean;
  kpiData: IadeKpiData;
  chartData: DailyIadeChartData[];
  iadeData: IadeRecord[];
  iadeTotalCount: number;
  iadePageIndex: number;
  iadePageSize: number;
  iadeSearch: string;
  iadeDurum: string;
  iadeSortBy: string;
  iadeSortOrder: "asc" | "desc";
}

export function IadeClient({
  canAddIade,
  kpiData,
  chartData,
  iadeData,
  iadeTotalCount,
  iadePageIndex,
  iadePageSize,
  iadeSearch,
  iadeDurum,
  iadeSortBy,
  iadeSortOrder,
}: IadeClientProps) {
  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">İade Giriş</h1>
          <p className="text-sm text-muted-foreground">
            İade edilen ürünlerin kaydı ve takibi
          </p>
        </div>
        {canAddIade && <IadeGirisDialog />}
      </div>

      <KpiCards data={kpiData} />

      <TrendChart data={chartData} />

      <IadeDataTable
        data={iadeData}
        totalCount={iadeTotalCount}
        pageIndex={iadePageIndex}
        pageSize={iadePageSize}
        search={iadeSearch}
        durum={iadeDurum}
        sortBy={iadeSortBy}
        sortOrder={iadeSortOrder}
      />
    </div>
  );
}
