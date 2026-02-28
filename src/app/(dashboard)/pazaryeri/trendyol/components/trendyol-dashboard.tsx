"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
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
  RotateCcw,
} from "lucide-react";
import { formatTRY } from "@/lib/trendyol/helpers";
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import { SyncStatus } from "./sync-status";

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
  totalOrderCount: number;
  pendingCount: number;
  cancelledCount: number;
  totalProducts: number;
  outOfStockCount: number;
  pendingQuestions: number;
  activeClaimsCount: number;
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
  lastSyncError?: string | null;
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
  lastSyncError,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const selectedMonthLabel = months.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  // Auto-refresh every 5 minutes (server component re-fetch)
  const refreshData = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!isCurrentMonth) return; // Only auto-refresh for current month
    const interval = setInterval(refreshData, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [isCurrentMonth, refreshData]);

  function handleMonthChange(value: string) {
    const params = new URLSearchParams();
    const currentMonth = months[0]?.value;
    if (value !== currentMonth) {
      params.set("ay", value);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  // ─── Top Products Date Filter ─────────────────────
  const [topFilter, setTopFilter] = useState<"ay" | "bugun" | "dun" | "bu_hafta" | "gecen_hafta" | "custom">("ay");
  const [customDate, setCustomDate] = useState("");

  const filteredTopProducts = useMemo(() => {
    if (topFilter === "ay") return topProducts;

    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const trMs = utcMs + 3 * 60 * 60 * 1000;
    const tr = new Date(trMs);
    const today = new Date(tr.getFullYear(), tr.getMonth(), tr.getDate());

    let startDate: Date;
    let endDate: Date;

    switch (topFilter) {
      case "bugun":
        startDate = endDate = today;
        break;
      case "dun": {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        startDate = endDate = y;
        break;
      }
      case "bu_hafta": {
        const dow = today.getDay();
        startDate = new Date(today);
        startDate.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
        endDate = today;
        break;
      }
      case "gecen_hafta": {
        const dow = today.getDay();
        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
        endDate = new Date(thisMonday);
        endDate.setDate(thisMonday.getDate() - 1);
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 6);
        break;
      }
      case "custom": {
        if (!customDate) return topProducts;
        const d = new Date(customDate + "T00:00:00");
        startDate = endDate = d;
        break;
      }
      default:
        return topProducts;
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    const nameMap = new Map(availableBarcodes.map((b) => [b.barcode, b.name]));
    const agg = new Map<string, { barcode: string; name: string; quantity: number; revenue: number }>();

    for (const [barcode, entries] of Object.entries(barcodeDailyData)) {
      if (barcode === "TÜMÜ") continue;
      for (const entry of entries) {
        const [day] = entry.date.split(".").map(Number);
        const entryDate = new Date(year, month - 1, day);
        if (entryDate >= startDate && entryDate <= endDate) {
          const existing = agg.get(barcode) || {
            barcode,
            name: nameMap.get(barcode) || barcode,
            quantity: 0,
            revenue: 0,
          };
          existing.quantity += entry.orders;
          existing.revenue += entry.revenue;
          agg.set(barcode, existing);
        }
      }
    }

    return Array.from(agg.values())
      .filter((item) => item.quantity > 0 || item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [topFilter, customDate, barcodeDailyData, availableBarcodes, selectedMonth, topProducts]);

  const topFilterLabel =
    topFilter === "ay" ? selectedMonthLabel
    : topFilter === "bugun" ? "Bugün"
    : topFilter === "dun" ? "Dün"
    : topFilter === "bu_hafta" ? "Bu Hafta"
    : topFilter === "gecen_hafta" ? "Geçen Hafta"
    : topFilter === "custom" && customDate
      ? new Date(customDate + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
      : selectedMonthLabel;

  const [selYr, selMo] = selectedMonth.split("-").map(Number);
  const monthMinDate = `${selectedMonth}-01`;
  const monthMaxDate = `${selectedMonth}-${String(new Date(selYr, selMo, 0).getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      {/* Header with month selector + sync */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-vw-dark">Trendyol Dashboard</h1>
            <p className="text-xs text-muted-foreground">
              {selectedMonthLabel} verileri
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SyncStatus lastSyncAt={lastSyncAt} lastSyncError={lastSyncError} />
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
            <p className="text-xs text-muted-foreground">
              {kpi.monthOrderCount} sipariş
              {kpi.cancelledCount > 0 && (
                <span className="text-red-400 ml-1">({kpi.cancelledCount} iptal/iade hariç)</span>
              )}
            </p>
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
              Bekleyen / İptal / İade
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-amber-600">{kpi.pendingCount}</span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-lg font-bold text-red-500">{kpi.cancelledCount}</span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-lg font-bold text-rose-600">{kpi.activeClaimsCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">bekleyen / iptal / aktif iade talebi</p>
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

      {/* Top Selling Products — compact table with date filters */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              En Çok Satan Ürünler — {topFilterLabel}
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
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {([
              { value: "ay", label: "Tüm Ay" },
              { value: "bugun", label: "Bugün" },
              { value: "dun", label: "Dün" },
              { value: "bu_hafta", label: "Bu Hafta" },
              { value: "gecen_hafta", label: "Geçen Hafta" },
            ] as const).map((f) => (
              <button
                key={f.value}
                onClick={() => { setTopFilter(f.value); setCustomDate(""); }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  topFilter === f.value
                    ? "bg-vw-dark text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
            <input
              type="date"
              value={customDate}
              min={monthMinDate}
              max={monthMaxDate}
              onChange={(e) => {
                setCustomDate(e.target.value);
                if (e.target.value) setTopFilter("custom");
              }}
              className={`h-7 px-2 rounded-full text-xs border transition-colors cursor-pointer ${
                topFilter === "custom"
                  ? "bg-vw-dark text-white border-vw-dark [color-scheme:dark]"
                  : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
              }`}
            />
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
              {filteredTopProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                    Bu dönemde veri bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTopProducts.map((p, i) => {
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
            {filteredTopProducts.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/50">
                  <td className="pl-4 py-2 text-xs font-bold" colSpan={2}>
                    Toplam
                  </td>
                  <td className="py-2 text-right font-bold tabular-nums text-sm">
                    {filteredTopProducts.reduce((s, p) => s + p.quantity, 0)}
                  </td>
                  <td className="py-2 pr-4 text-right font-bold text-orange-700 tabular-nums text-sm">
                    {formatTRY(filteredTopProducts.reduce((s, p) => s + p.revenue, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
