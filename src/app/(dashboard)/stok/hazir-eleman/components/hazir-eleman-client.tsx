"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { KpiCards, type HazirElemanKpiData } from "./kpi-cards";
import { TrendChart, type DailyChartData } from "./trend-chart";
import { ParcaStokDataTable, type HazirElemanStok } from "./parca-stok-data-table";
import { HareketlerDataTable, type HazirElemanHareket } from "./hareketler-data-table";
import { StokGirisDialog } from "./stok-giris-dialog";

interface HazirElemanClientProps {
  activeTab: string;
  canAddStock: boolean;
  kpiData: HazirElemanKpiData;
  chartData: DailyChartData[];
  stokData: HazirElemanStok[];
  stokTotalCount: number;
  stokPageIndex: number;
  stokPageSize: number;
  stokSearch: string;
  stokPartType: string;
  stokSortBy: string;
  stokSortOrder: "asc" | "desc";
  movementsData: HazirElemanHareket[];
  movementsTotalCount: number;
  movementsPageIndex: number;
  movementsPageSize: number;
  movementsSearch: string;
  movementsSortBy: string;
  movementsSortOrder: "asc" | "desc";
}

export function HazirElemanClient({
  activeTab,
  canAddStock,
  kpiData,
  chartData,
  stokData,
  stokTotalCount,
  stokPageIndex,
  stokPageSize,
  stokSearch,
  stokPartType,
  stokSortBy,
  stokSortOrder,
  movementsData,
  movementsTotalCount,
  movementsPageIndex,
  movementsPageSize,
  movementsSearch,
  movementsSortBy,
  movementsSortOrder,
}: HazirElemanClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams();
    if (tab !== "ozet") {
      params.set("tab", tab);
    }
    startTransition(() => {
      router.push(`/stok/hazir-eleman${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hazır Eleman Stok</h1>
          <p className="text-sm text-muted-foreground">
            Hazır eleman, kutu ve karton stok takibi, kritik uyarılar ve giriş işlemleri
          </p>
        </div>
        {canAddStock && <StokGirisDialog />}
      </div>

      <KpiCards data={kpiData} />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="ozet">Stok Özeti</TabsTrigger>
          <TabsTrigger value="hareketler">Hareketler</TabsTrigger>
        </TabsList>

        <TabsContent value="ozet" className="mt-4 space-y-4">
          <TrendChart data={chartData} />
          <ParcaStokDataTable
            data={stokData}
            totalCount={stokTotalCount}
            pageIndex={stokPageIndex}
            pageSize={stokPageSize}
            search={stokSearch}
            partType={stokPartType}
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
            sortBy={movementsSortBy}
            sortOrder={movementsSortOrder}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
