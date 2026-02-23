"use client";

import { SatisKpiCards, type SatisKpiData } from "./kpi-cards";
import { PeriodFilter } from "./period-filter";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import type { DailySalesData } from "./satis-chart";

const SatisChart = dynamic(
  () => import("./satis-chart").then(mod => ({ default: mod.SatisChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
import { SatisTable, type SkuSalesRow } from "./satis-table";
import { ExcelUpload } from "./excel-upload";
import type { PeriodType } from "../actions";
import type { SalesChannel } from "@/lib/sales-settings";

interface SatisDashboardProps {
  period: PeriodType;
  kanal: string;
  kpiData: SatisKpiData;
  chartData: DailySalesData[];
  trRows: SkuSalesRow[];
  ihracatRows: SkuSalesRow[];
  trToplam: number;
  ihracatToplam: number;
  channels: SalesChannel[];
}

export function SatisDashboard({
  period,
  kanal,
  kpiData,
  chartData,
  trRows,
  ihracatRows,
  trToplam,
  ihracatToplam,
  channels,
}: SatisDashboardProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Satışlar
          </h1>
          <p className="text-sm text-muted-foreground">
            Satış özeti, kanal dağılımı ve Excel yükleme
          </p>
        </div>
        <ExcelUpload />
      </div>

      {/* Period Filter */}
      <PeriodFilter currentPeriod={period} currentKanal={kanal} channels={channels} />

      {/* KPI Cards */}
      <SatisKpiCards data={kpiData} />

      {/* Chart */}
      <SatisChart data={chartData} />

      {/* SKU Tables */}
      <SatisTable
        trRows={trRows}
        ihracatRows={ihracatRows}
        trToplam={trToplam}
        ihracatToplam={ihracatToplam}
      />
    </div>
  );
}
