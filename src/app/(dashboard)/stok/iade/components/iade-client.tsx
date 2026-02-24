"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";
import { KpiCards, type IadeKpiData } from "./kpi-cards";
import { IadeDataTable, type IadeRecord } from "./iade-data-table";
import { IadeGirisDialog } from "./iade-giris-dialog";

interface IadeClientProps {
  canAddIade: boolean;
  kpiData: IadeKpiData;
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/stok/iade/grafik">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Grafik
            </Link>
          </Button>
          {canAddIade && <IadeGirisDialog />}
        </div>
      </div>

      <KpiCards data={kpiData} />

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
