"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BarChart3, ArrowRightLeft } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { StokDataTable, type StokProduct } from "./stok-data-table";
import { HareketlerDataTable, type StokMovement } from "./hareketler-data-table";
import { useStokMamulRealtime } from "@/hooks/use-stok-mamul-realtime";
import { LastUpdatedBadge } from "@/components/shared/last-updated-badge";

interface KpiData {
  productCount: number;
  totalStock: number;
  criticalCount: number;
  todayMovements: number;
  todayProduction: number;
}

interface MamulStokClientProps {
  depolar: { depo_id: string; ad: string }[];
  seciliDepo: string;
  activeTab: string;
  kpiData: KpiData;
  /** Depo transferi yetkisi (STOCK_ACCESS_ROLES) */
  canTransfer: boolean;
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
  movementsYon: string;
  movementsSortBy: string;
  movementsSortOrder: "asc" | "desc";
}

export function MamulStokClient({
  activeTab,
  depolar,
  seciliDepo,
  kpiData,
  canTransfer,
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
  movementsYon,
  movementsSortBy,
  movementsSortOrder,
}: MamulStokClientProps) {
  const router = useRouter();
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

  /** Depo değişince sayfalama sıfırlanır, diğer filtreler korunur */
  const handleDepoChange = (depoId: string) => {
    const params = new URLSearchParams(window.location.search);
    if (depoId) params.set("depo", depoId);
    else params.delete("depo");
    params.delete("page");
    params.delete("mPage");
    startTransition(() => {
      router.push(`/stok/mamul?${params.toString()}`);
    });
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ürün Stok</h1>
          <p className="text-sm text-muted-foreground">
            Ürün stok takibi ve hareketler
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/stok/mamul/grafik">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Grafik
            </Link>
          </Button>
          <LastUpdatedBadge lastUpdated={lastUpdated} />
        </div>
      </div>

      {/* Depo seçimi — KPI'lar, tablo ve hareketler seçili depoya göre */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">Depo:</span>
        <button
          type="button"
          onClick={() => handleDepoChange("")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            seciliDepo === ""
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted",
          )}
        >
          Ana Depo (tümü)
        </button>
        {depolar.map((d) => (
          <button
            key={d.depo_id}
            type="button"
            onClick={() => handleDepoChange(d.depo_id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              seciliDepo === d.depo_id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted",
            )}
          >
            {d.ad}
          </button>
        ))}
        {canTransfer && (
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-7 rounded-full px-3 text-xs"
          >
            <Link href="/stok/transfer">
              <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
              Depo Transferi
            </Link>
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="ozet">Stok Özeti</TabsTrigger>
          <TabsTrigger value="hareketler">Hareketler</TabsTrigger>
        </TabsList>

        <TabsContent value="ozet" className="mt-4 space-y-3">
          {/* Özet şeridi — tek satır, mobilde yatay kaydırılır */}
          <div className="overflow-x-auto">
            <p className="whitespace-nowrap text-sm text-muted-foreground">
              Ürün: <span className="font-medium text-foreground">{formatNumber(kpiData.productCount)}</span>
              {" · "}Toplam Stok: <span className="font-medium text-foreground">{formatNumber(kpiData.totalStock)}</span>
              {" · "}Kritik Altı: <span className="font-medium text-foreground">{formatNumber(kpiData.criticalCount)}</span>
              {" · "}Bugün Üretim: <span className="font-medium text-foreground">{formatNumber(kpiData.todayProduction)}</span>
            </p>
          </div>
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
            yon={movementsYon}
            sortBy={movementsSortBy}
            sortOrder={movementsSortOrder}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
