"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileDown } from "lucide-react";
import { OdemelerKpiCards } from "./odemeler-kpi-cards";
import { OdemelerDataTable } from "./odemeler-data-table";
import { OdemelerToolbar } from "./odemeler-toolbar";
import { OdemeFormSheet } from "./odeme-form-sheet";
import { OdemelerTrendChart } from "./odemeler-trend-chart";
import type { Odeme } from "@/lib/supabase/types";

interface KpiData {
  bekleyenTl: number;
  bekleyenUsd: number;
  yaklasan7Gun: number;
  buAyOdenen: number;
}

interface TrendItem {
  month: string;
  label: string;
  tamamlanan: number;
  bekleyen: number;
}

interface OdemelerClientProps {
  activeTab: string;
  kpiData: KpiData;
  trendData: TrendItem[];
  listData: Odeme[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  turu: string;
  durum: string;
  cinsi: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function OdemelerClient({
  activeTab,
  kpiData,
  trendData,
  listData,
  totalCount,
  pageIndex,
  pageSize,
  search,
  turu,
  durum,
  cinsi,
  dateFrom,
  dateTo,
  sortBy,
  sortOrder,
}: OdemelerClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Odeme | null>(null);

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams();
    if (tab !== "liste") {
      params.set("tab", tab);
    }
    startTransition(() => {
      router.push(`/muhasebe/odemeler${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  const handleNewRecord = () => {
    setEditingRecord(null);
    setSheetOpen(true);
  };

  const handleEdit = (record: Odeme) => {
    setEditingRecord(record);
    setSheetOpen(true);
  };

  const handleSheetClose = () => {
    setSheetOpen(false);
    setEditingRecord(null);
  };

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ödemeler</h1>
          <p className="text-sm text-muted-foreground">
            Ödeme kayıtları, takip ve analiz
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <a
              href={`/api/muhasebe/odemeler/pdf${turu || durum || cinsi ? `?${new URLSearchParams(Object.entries({ turu, durum, cinsi }).filter(([, v]) => v)).toString()}` : ""}`}
              download
            >
              <FileDown className="mr-1.5 h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </a>
          </Button>
          <Button onClick={handleNewRecord} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Yeni Ödeme
          </Button>
        </div>
      </div>

      <OdemelerKpiCards data={kpiData} />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="liste">Liste</TabsTrigger>
          <TabsTrigger value="ozet">Özet</TabsTrigger>
        </TabsList>

        <TabsContent value="liste" className="mt-4 space-y-4">
          <OdemelerToolbar
            search={search}
            turu={turu}
            durum={durum}
            cinsi={cinsi}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
          <OdemelerDataTable
            data={listData}
            totalCount={totalCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onEdit={handleEdit}
          />
        </TabsContent>

        <TabsContent value="ozet" className="mt-4 space-y-4">
          <OdemelerTrendChart data={trendData} />
        </TabsContent>
      </Tabs>

      <OdemeFormSheet
        open={sheetOpen}
        onOpenChange={handleSheetClose}
        editingRecord={editingRecord}
      />
    </div>
  );
}
