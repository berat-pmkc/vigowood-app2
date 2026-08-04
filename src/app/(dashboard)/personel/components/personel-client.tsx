"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DevamsizlikTab } from "./devamsizlik-tab";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { KpiCards } from "./kpi-cards";
import { AttendanceDataTable } from "./attendance-data-table";
import { AttendanceToolbar } from "./attendance-toolbar";
import { AttendanceFormSheet } from "./attendance-form-sheet";
import type { Database } from "@/lib/supabase/types";
import {
  ATTENDANCE_DEPARTMENTS,
  ATTENDANCE_DEPARTMENT_LABELS,
} from "@/lib/constants";

const PersonelCharts = dynamic(
  () => import("./personel-charts").then(mod => ({ default: mod.PersonelCharts })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];

interface KpiData {
  todayTotal: number;
  avgHours: number;
  activeDeptCount: number;
  lateCount: number;
}

interface PersonelClientProps {
  activeTab: string;
  kpiData: KpiData;
  deptDistribution: Record<string, number>;
  trendData: { date: string; count: number }[];
  listData: AttendanceRow[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  department: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export function PersonelClient({
  activeTab,
  kpiData,
  deptDistribution,
  trendData,
  listData,
  totalCount,
  pageIndex,
  pageSize,
  search,
  department,
  dateFrom,
  dateTo,
  sortBy,
  sortOrder,
}: PersonelClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRow | null>(null);

  const handleTabChange = (tab: string) => {
    const params = new URLSearchParams();
    if (tab !== "liste") {
      params.set("tab", tab);
    }
    startTransition(() => {
      router.push(`/personel${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  const handleNewRecord = () => {
    setEditingRecord(null);
    setSheetOpen(true);
  };

  const handleEdit = (record: AttendanceRow) => {
    setEditingRecord(record);
    setSheetOpen(true);
  };

  const handleSheetClose = () => {
    setSheetOpen(false);
    setEditingRecord(null);
  };

  // Department distribution chart data
  const deptChartData = ATTENDANCE_DEPARTMENTS.map((dept) => ({
    name: ATTENDANCE_DEPARTMENT_LABELS[dept],
    value: deptDistribution[dept] || 0,
  })).filter((d) => d.value > 0);

  // Trend chart formatted dates
  const formattedTrend = trendData.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personel & Yoklama</h1>
          <p className="text-sm text-muted-foreground">
            Yoklama kayıtları, mesai takibi ve departman analizi
          </p>
        </div>
        <Button onClick={handleNewRecord} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Yeni Kayıt
        </Button>
      </div>

      <KpiCards data={kpiData} />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="liste">Yoklama Listesi</TabsTrigger>
          <TabsTrigger value="ozet">Özet</TabsTrigger>
          <TabsTrigger value="devamsizlik">Devamsızlık</TabsTrigger>
        </TabsList>

        <TabsContent value="liste" className="mt-4 space-y-4">
          <AttendanceToolbar
            search={search}
            department={department}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
          <AttendanceDataTable
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
          <PersonelCharts trendData={formattedTrend} deptChartData={deptChartData} />
        </TabsContent>

        <TabsContent value="devamsizlik" className="mt-4">
          <DevamsizlikTab />
        </TabsContent>
      </Tabs>

      <AttendanceFormSheet
        open={sheetOpen}
        onOpenChange={handleSheetClose}
        editingRecord={editingRecord}
      />
    </div>
  );
}
