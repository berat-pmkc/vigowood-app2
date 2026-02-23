"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { KpiCards } from "./kpi-cards";
import type { DailyChartData } from "./trend-chart";

const TrendChart = dynamic(
  () => import("./trend-chart").then(mod => ({ default: mod.TrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
import { StokDataTable, type StokProduct } from "./stok-data-table";
import { HareketlerDataTable, type StokMovement } from "./hareketler-data-table";
import { useStokMamulRealtime } from "@/hooks/use-stok-mamul-realtime";
import { LastUpdatedBadge } from "@/components/shared/last-updated-badge";

interface KpiData {
  totalStock: number;
  criticalCount: number;
  todayMovements: number;
  todayProduction: number;
}

interface MamulStokClientProps {
  // Tab
  activeTab: string;
  // KPI
  kpiData: KpiData;
  // Chart
  chartData: DailyChartData[];
  // Stock table
  stokData: StokProduct[];
  stokTotalCount: number;
  stokPageIndex: number;
  stokPageSize: number;
  stokSearch: string;
  stokKategori: string;
  stokSortBy: string;
  stokSortOrder: "asc" | "desc";
  // Movements table
  movementsData: StokMovement[];
  movementsTotalCount: number;
  movementsPageIndex: number;
  movementsPageSize: number;
  movementsSearch: string;
  movementsSource: string;
  movementsSortBy: string;
  movementsSortOrder: "asc" | "desc";
}

export function MamulStokClient({
  activeTab,
  kpiData,
  chartData,
  stokData,
  stokTotalCount,
  stokPageIndex,
  stokPageSize,
  stokSearch,
  stokKategori,
  stokSortBy,
  stokSortOrder,
  movementsData,
  movementsTotalCount,
  movementsPageIndex,
  movementsPageSize,
  movementsSearch,
  movementsSource,
  movementsSortBy,
  movementsSortOrder,
}: MamulStokClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { lastUpdated } = useStokMamulRealtime();

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams();
    if (tab !== "ozet") {
      params.set("tab", tab);
    }
    startTransition(() => {
      router.push(`/stok/mamul${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ürün Stok</h1>
          <p className="text-sm text-muted-foreground">
            Ürün stok takibi, hareketler ve trend analizi
          </p>
        </div>
        <LastUpdatedBadge lastUpdated={lastUpdated} />
      </div>

      <KpiCards data={kpiData} />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="ozet">Stok Özeti</TabsTrigger>
          <TabsTrigger value="hareketler">Hareketler</TabsTrigger>
        </TabsList>

        <TabsContent value="ozet" className="mt-4 space-y-4">
          <TrendChart data={chartData} />
          <StokDataTable
            data={stokData}
            totalCount={stokTotalCount}
            pageIndex={stokPageIndex}
            pageSize={stokPageSize}
            search={stokSearch}
            kategori={stokKategori}
            sortBy={stokSortBy}
            sortOrder={stokSortOrder}
          />
        </TabsContent>

        <TabsContent value="hareketler" className="mt-4">
          <HareketlerDataTable
            data={movementsData}
            totalCount={movementsTotalCount}
            pageIndex={movementsPageIndex}
            pageSize={movementsPageSize}
            search={movementsSearch}
            source={movementsSource}
            sortBy={movementsSortBy}
            sortOrder={movementsSortOrder}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
