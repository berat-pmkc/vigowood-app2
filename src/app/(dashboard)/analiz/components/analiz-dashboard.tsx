"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { PeriodFilter } from "./period-filter";
import { OverviewTab } from "./overview-tab";
import { ProductionTab } from "./production-tab";
import { SalesTab } from "./sales-tab";
import { StockTab } from "./stock-tab";
import { KarlilikTab, type KarlilikRow, type KarlilikKpi } from "./karlilik-tab";
import type { PeriodType, TabType } from "../actions";
import type { OverviewKpiData } from "./overview-kpi-cards";
import type { DailyOverviewData } from "./overview-production-chart";
import type { MonthlyTrendData } from "./overview-trend-chart";
import type { ProductionKpiData } from "./production-kpi-cards";
import type { DailyProductionData } from "./production-daily-chart";
import type { EfficiencyData } from "./production-efficiency";
import type { SalesKpiData } from "./sales-kpi-cards";
import type { ChannelSalesData } from "./sales-channel-chart";
import type { TopProductRow } from "./sales-top-products";
import type { StockKpiData } from "./stock-kpi-cards";
import type { StockMovementData } from "./stock-movement-chart";
import type { CriticalStockRow } from "./stock-critical-table";

export interface AnalizDashboardProps {
  period: PeriodType;
  tab: TabType;
  // Overview
  overviewKpi: OverviewKpiData;
  overviewDaily: DailyOverviewData[];
  overviewMonthly: MonthlyTrendData[];
  // Production
  productionKpi: ProductionKpiData;
  productionDaily: DailyProductionData[];
  productionEfficiency: EfficiencyData[];
  // Sales
  salesKpi: SalesKpiData;
  salesChannel: ChannelSalesData[];
  salesTopProducts: TopProductRow[];
  // Stock
  stockKpi: StockKpiData;
  stockMovement: StockMovementData[];
  stockCritical: CriticalStockRow[];
  // Kârlılık
  karlilikKpi: KarlilikKpi;
  karlilikRows: KarlilikRow[];
}

export function AnalizDashboard({
  period,
  tab,
  overviewKpi,
  overviewDaily,
  overviewMonthly,
  productionKpi,
  productionDaily,
  productionEfficiency,
  salesKpi,
  salesChannel,
  salesTopProducts,
  stockKpi,
  stockMovement,
  stockCritical,
  karlilikKpi,
  karlilikRows,
}: AnalizDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const handleTabChange = (newTab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newTab !== "genel") {
      params.set("tab", newTab);
    } else {
      params.delete("tab");
    }
    startTransition(() => {
      router.push(`/analiz${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  return (
    <div className="space-y-4 pb-20 sm:space-y-6 md:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Analiz & Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Üretim, satış, stok ve sevkiyat verilerinin genel analizi
        </p>
      </div>

      {/* Period Filter */}
      <PeriodFilter currentPeriod={period} />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="genel">Genel Özet</TabsTrigger>
          <TabsTrigger value="uretim">Üretim</TabsTrigger>
          <TabsTrigger value="satis">Satış</TabsTrigger>
          <TabsTrigger value="stok">Stok</TabsTrigger>
          <TabsTrigger value="karlilik">Kârlılık</TabsTrigger>
        </TabsList>

        <TabsContent value="genel" className="mt-4">
          <OverviewTab
            kpiData={overviewKpi}
            dailyData={overviewDaily}
            monthlyData={overviewMonthly}
          />
        </TabsContent>

        <TabsContent value="uretim" className="mt-4">
          <ProductionTab
            kpiData={productionKpi}
            dailyData={productionDaily}
            efficiencyData={productionEfficiency}
          />
        </TabsContent>

        <TabsContent value="satis" className="mt-4">
          <SalesTab
            kpiData={salesKpi}
            channelData={salesChannel}
            topProducts={salesTopProducts}
          />
        </TabsContent>

        <TabsContent value="stok" className="mt-4">
          <StockTab
            kpiData={stockKpi}
            movementData={stockMovement}
            criticalData={stockCritical}
          />
        </TabsContent>

        <TabsContent value="karlilik" className="mt-4">
          <KarlilikTab kpi={karlilikKpi} rows={karlilikRows} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
