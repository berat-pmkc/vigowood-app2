"use client";

import { SalesKpiCards, type SalesKpiData } from "./sales-kpi-cards";
import {
  SalesChannelChart,
  type ChannelSalesData,
} from "./sales-channel-chart";
import { SalesTopProducts, type TopProductRow } from "./sales-top-products";

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
