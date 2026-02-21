"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { KpiCards } from "./kpi-cards";
import { AttendanceDataTable } from "./attendance-data-table";
import { AttendanceToolbar } from "./attendance-toolbar";
import { AttendanceFormSheet } from "./attendance-form-sheet";
import type { Database } from "@/lib/supabase/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ATTENDANCE_DEPARTMENTS,
  ATTENDANCE_DEPARTMENT_LABELS,
  ATTENDANCE_DEPARTMENT_COLORS,
  type AttendanceDepartment,
} from "@/lib/constants";

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

const BAR_COLORS = ["#3368b1", "#70c1aa", "#9333ea", "#f28a19", "#ea580c"];

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
          {/* Trend Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Son 30 Gün Yoklama Trendi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={formattedTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(_, payload) => {
                        if (payload?.[0]?.payload?.date) {
                          return new Date(payload[0].payload.date).toLocaleDateString("tr-TR");
                        }
                        return "";
                      }}
                      formatter={(value) => [value ?? 0, "Kayıt"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#cdbd9d"
                      fill="#cdbd9d"
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Department Distribution */}
          {deptChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Bugün Departman Dağılımı
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        width={120}
                      />
                      <Tooltip formatter={(value) => [value ?? 0, "Kişi"]} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {deptChartData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={BAR_COLORS[index % BAR_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
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
