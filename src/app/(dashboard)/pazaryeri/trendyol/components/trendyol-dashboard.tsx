"use client";

import { useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingCart,
  TrendingUp,
  Calendar,
  Clock,
  Package,
  MessageSquareText,
  CalendarDays,
} from "lucide-react";
import { formatTRY } from "@/lib/trendyol/helpers";
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";

const TrendyolTrendChart = dynamic(() => import("./trendyol-trend-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton height={320} />,
});
const TrendyolStatusChart = dynamic(() => import("./trendyol-status-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton height={300} />,
});
const TrendyolBarcodeChart = dynamic(() => import("./trendyol-barcode-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton height={300} />,
});

interface KpiData {
  todayOrderCount: number;
  todayCiro: number;
  weekOrderCount: number;
  weekCiro: number;
  monthOrderCount: number;
  monthCiro: number;
  pendingCount: number;
  cancelledCount: number;
  totalProducts: number;
  outOfStockCount: number;
  pendingQuestions: number;
}

interface TopProduct {
  barcode: string;
  name: string;
  quantity: number;
  revenue: number;
}

interface BarcodeOption {
  barcode: string;
  name: string;
}

interface DayEntry {
  date: string;
  orders: number;
  revenue: number;
}

interface MonthOption {
  value: string;
  label: string;
}

interface Props {
  kpi: KpiData;
  trendData: { date: string; orders: number; ciro: number }[];
  statusDistribution: Record<string, number>;
  topProducts: TopProduct[];
  barcodeDailyData: Record<string, DayEntry[]>;
  availableBarcodes: BarcodeOption[];
  selectedMonth: string;
  months: MonthOption[];
  isCurrentMonth: boolean;
  lastSyncAt: string | null;
}

export function TrendyolDashboard({
  kpi,
  trendData,
  statusDistribution,
  topProducts,
  barcodeDailyData,
  availableBarcodes,
  selectedMonth,
  months,
  isCurrentMonth,
  lastSyncAt,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const selectedMonthLabel = months.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  function handleMonthChange(value: string) {
    const params = new URLSearchParams();
    const currentMonth = months[0]?.value;
    if (value !== currentMonth) {
      params.set("ay", value);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  const syncLabel = lastSyncAt
    ? `Son sync: ${new Date(lastSyncAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
    : "Henüz senkronize edilmedi";

  return (
    <div className="space-y-4">
      {/* Header with month selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-vw-dark">Trendyol Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              {selectedMonthLabel} verileri — {syncLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={handleMonthChange}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards — 4 cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Aylık Ciro
            </CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-orange-700">{formatTRY(kpi.monthCiro)}</div>
            <p className="text-xs text-muted-foreground">{kpi.monthOrderCount} sipariş</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Bu Hafta
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatTRY(kpi.weekCiro)}</div>
            <p className="text-xs text-muted-foreground">{kpi.weekOrderCount} sipariş</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Bugün
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{formatTRY(kpi.todayCiro)}</div>
            <p className="text-xs text-muted-foreground">{kpi.todayOrderCount} sipariş</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Bekleyen / İptal
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-amber-600">{kpi.pendingCount}</span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-lg font-bold text-red-500">{kpi.cancelledCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">bekleyen / iptal-iade</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Trend + Status Distribution */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Sipariş ve Ciro Trendi — {selectedMonthLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendyolTrendChart data={trendData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Sipariş Durum Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendyolStatusChart data={statusDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Barcode Filter Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Ürün Bazlı Satış Analizi — {selectedMonthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrendyolBarcodeChart
            barcodeDailyData={barcodeDailyData}
            availableBarcodes={availableBarcodes}
          />
        </CardContent>
      </Card>

      {/* Top Selling Products — compact table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              En Çok Satan Ürünler — {selectedMonthLabel}
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span><Package className="inline h-3 w-3 mr-0.5" />{kpi.totalProducts} ürün</span>
              {kpi.outOfStockCount > 0 && (
                <span className="text-red-500">{kpi.outOfStockCount} stoksuz</span>
              )}
              {kpi.pendingQuestions > 0 && (
                <span className="text-amber-600">
                  <MessageSquareText className="inline h-3 w-3 mr-0.5" />
                  {kpi.pendingQuestions} bekleyen soru
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-4">#</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Adet</TableHead>
                <TableHead className="text-right pr-4">Ciro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                    Veri bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                topProducts.map((p, i) => {
                  const skuStyle = getSkuBadgeStyle(p.barcode);
                  return (
                    <TableRow key={p.barcode}>
                      <TableCell className="pl-4 font-medium text-muted-foreground text-xs w-10">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs border w-fit"
                            style={skuStyle}
                          >
                            {p.barcode}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] lg:max-w-[400px]">
                            {p.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {p.quantity}
                      </TableCell>
                      <TableCell className="text-right pr-4 font-medium text-orange-700 tabular-nums">
                        {formatTRY(p.revenue)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
