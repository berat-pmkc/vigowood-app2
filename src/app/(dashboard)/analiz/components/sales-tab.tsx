"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { SalesKpiCards, type SalesKpiData } from "./sales-kpi-cards";
import type { ChannelSalesData } from "./sales-channel-chart";
import { SalesTopProducts, type TopProductRow } from "./sales-top-products";

const SalesChannelChart = dynamic(
  () => import("./sales-channel-chart").then(mod => ({ default: mod.SalesChannelChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

interface SalesTabProps {
  kpiData: SalesKpiData;
  channelData: ChannelSalesData[];
  topProducts: TopProductRow[];
}

export function SalesTab({
  kpiData,
  channelData,
  topProducts,
}: SalesTabProps) {
  return (
    <div className="space-y-4">
      <SalesKpiCards data={kpiData} />
      <SalesChannelChart data={channelData} />
      <SalesTopProducts data={topProducts} />
    </div>
  );
}
