"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scissors, Wrench, Package } from "lucide-react";
import { KesimDataTable } from "./kesim-data-table";
import { MontajDataTable } from "./montaj-data-table";
import { PaketlemeDataTable } from "./paketleme-data-table";
import type { CutBatch, MontajSession, PackEvent } from "@/lib/supabase/types";

interface UretimDbTabsProps {
  activeTab: string;
  kesimData: CutBatch[];
  kesimCount: number;
  montajData: MontajSession[];
  montajCount: number;
  paketlemeData: PackEvent[];
  paketlemeCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  durum: string;
  makine: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function UretimDbTabs({
  activeTab,
  kesimData,
  kesimCount,
  montajData,
  montajCount,
  paketlemeData,
  paketlemeCount,
  pageIndex,
  pageSize,
  search,
  durum,
  makine,
  dateFrom,
  dateTo,
  sortBy,
  sortOrder,
}: UretimDbTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const buildUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return `/admin/uretim-db?${params.toString()}`;
    },
    [searchParams]
  );

  const navigate = useCallback(
    (updates: Record<string, string | undefined>) => {
      startTransition(() => {
        router.push(buildUrl(updates));
      });
    },
    [buildUrl, router]
  );

  const handleTabChange = (newTab: string) => {
    // Reset all filters when switching tabs
    navigate({
      tab: newTab === "kesim" ? undefined : newTab,
      page: undefined,
      search: undefined,
      durum: undefined,
      makine: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      operator: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-4">
        <TabsTrigger value="kesim" className="gap-1.5">
          <Scissors className="h-4 w-4" />
          <span>Kesim</span>
          <span className="ml-1 text-xs text-muted-foreground">
            ({activeTab === "kesim" ? kesimCount.toLocaleString("tr-TR") : "—"})
          </span>
        </TabsTrigger>
        <TabsTrigger value="montaj" className="gap-1.5">
          <Wrench className="h-4 w-4" />
          <span>Montaj</span>
          <span className="ml-1 text-xs text-muted-foreground">
            ({activeTab === "montaj" ? montajCount.toLocaleString("tr-TR") : "—"})
          </span>
        </TabsTrigger>
        <TabsTrigger value="paketleme" className="gap-1.5">
          <Package className="h-4 w-4" />
          <span>Paketleme</span>
          <span className="ml-1 text-xs text-muted-foreground">
            ({activeTab === "paketleme" ? paketlemeCount.toLocaleString("tr-TR") : "—"})
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="kesim">
        <KesimDataTable
          data={kesimData}
          totalCount={kesimCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          search={search}
          durum={durum}
          makine={makine}
          dateFrom={dateFrom}
          dateTo={dateTo}
          sortBy={sortBy}
          sortOrder={sortOrder}
          navigate={navigate}
        />
      </TabsContent>

      <TabsContent value="montaj">
        <MontajDataTable
          data={montajData}
          totalCount={montajCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          search={search}
          durum={durum}
          dateFrom={dateFrom}
          dateTo={dateTo}
          sortBy={sortBy}
          sortOrder={sortOrder}
          navigate={navigate}
        />
      </TabsContent>

      <TabsContent value="paketleme">
        <PaketlemeDataTable
          data={paketlemeData}
          totalCount={paketlemeCount}
          pageIndex={pageIndex}
          pageSize={pageSize}
          search={search}
          durum={durum}
          dateFrom={dateFrom}
          dateTo={dateTo}
          sortBy={sortBy}
          sortOrder={sortOrder}
          navigate={navigate}
        />
      </TabsContent>
    </Tabs>
  );
}
