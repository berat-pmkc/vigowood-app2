"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BarChart3 } from "lucide-react";
import { KpiCards, type YariMamulKpiData } from "./kpi-cards";
import { ParcaStokDataTable, type ParcaStok } from "./parca-stok-data-table";
import { HareketlerDataTable, type YariMamulHareket } from "./hareketler-data-table";
import { useStokYariMamulRealtime } from "@/hooks/use-stok-yari-mamul-realtime";
import { LastUpdatedBadge } from "@/components/shared/last-updated-badge";

interface YariMamulStokClientProps {
  activeTab: string;
  kpiData: YariMamulKpiData;
  // Parts stock table
  stokData: ParcaStok[];
  stokTotalCount: number;
  stokPageIndex: number;
  stokPageSize: number;
  stokSearch: string;
  stokSortBy: string;
  stokSortOrder: "asc" | "desc";
  // Movements table
  movementsData: YariMamulHareket[];
  movementsTotalCount: number;
  movementsPageIndex: number;
  movementsPageSize: number;
  movementsSearch: string;
  movementsSource: string;
  movementsSortBy: string;
  movementsSortOrder: "asc" | "desc";
}

export function YariMamulStokClient({
  activeTab,
  kpiData,
  stokData,
  stokTotalCount,
  stokPageIndex,
  stokPageSize,
  stokSearch,
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
}: YariMamulStokClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { lastUpdated } = useStokYariMamulRealtime();

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams();
    if (tab !== "ozet") {
      params.set("tab", tab);
    }
    startTransition(() => {
      router.push(`/stok/yari-mamul${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yarı Mamül Stok</h1>
          <p className="text-sm text-muted-foreground">
            Parça bazlı yarı mamül stok takibi ve hareketler
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/stok/yari-mamul/grafik">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Grafik
            </Link>
          </Button>
          <LastUpdatedBadge lastUpdated={lastUpdated} />
        </div>
      </div>

      <KpiCards data={kpiData} />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="ozet">Stok Özeti</TabsTrigger>
          <TabsTrigger value="hareketler">Hareketler</TabsTrigger>
        </TabsList>

        <TabsContent value="ozet" className="mt-4">
          <ParcaStokDataTable
            data={stokData}
            totalCount={stokTotalCount}
            pageIndex={stokPageIndex}
            pageSize={stokPageSize}
            search={stokSearch}
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
