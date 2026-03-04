"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarDays,
  DollarSign,
  BarChart3,
  ShoppingCart,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Lazy load charts
const RoasComparisonChart = dynamic(() => import("./roas-comparison-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const SpendRevenueChart = dynamic(() => import("./spend-revenue-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const TrendChart = dynamic(() => import("./trend-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const CtrDistributionChart = dynamic(() => import("./ctr-distribution-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

function ChartSkeleton() {
  return <div className="h-[300px] animate-pulse rounded-lg bg-muted/50" />;
}

interface WeeklyRow {
  ad_name: string;
  period_start: string;
  period_end: string;
  days_in_period: number;
  spent: number;
  clicks: number;
  impressions: number;
  total_sales: number;
  total_revenue: number;
  roas: number;
  ctr: number;
  cvr: number;
  cpa: number;
  actual_cpc: number;
}

interface TrendPoint {
  period: string;
  spent: number;
  revenue: number;
  sales: number;
  clicks: number;
  impressions: number;
}

interface Props {
  currentData: Record<string, unknown>[];
  prevData: Record<string, unknown>[];
  periods: string[];
  selectedPeriod: string | null;
  prevPeriod: string | null;
  trendData: TrendPoint[];
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function formatNumber(val: number): string {
  return new Intl.NumberFormat("tr-TR").format(val);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const isUp = pct > 0;
  const isFlat = Math.abs(pct) < 0.5;

  if (isFlat) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> %0
      </span>
    );
  }

  return (
    <span
      className={`flex items-center gap-0.5 text-xs ${
        isUp ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      %{Math.abs(pct).toFixed(1)}
    </span>
  );
}

export function DashboardClient({
  currentData,
  prevData,
  periods,
  selectedPeriod,
  prevPeriod,
  trendData,
}: Props) {
  const router = useRouter();
  const rows = currentData as unknown as WeeklyRow[];
  const prevRows = prevData as unknown as WeeklyRow[];

  // Current totals
  const totalSpent = rows.reduce((s, r) => s + Number(r.spent), 0);
  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_revenue), 0);
  const totalSales = rows.reduce((s, r) => s + Number(r.total_sales), 0);
  const avgRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;

  // Previous totals
  const prevTotalSpent = prevRows.reduce((s, r) => s + Number(r.spent), 0);
  const prevTotalRevenue = prevRows.reduce((s, r) => s + Number(r.total_revenue), 0);
  const prevTotalSales = prevRows.reduce((s, r) => s + Number(r.total_sales), 0);
  const prevAvgRoas = prevTotalSpent > 0 ? prevTotalRevenue / prevTotalSpent : 0;

  const handlePeriodChange = useCallback(
    (val: string) => {
      router.push(`/pazaryeri/trendyol/reklamlar/dashboard?hafta=${val}`);
    },
    [router]
  );

  // Build chart data for comparison
  const prevMap = new Map(prevRows.map((r) => [r.ad_name, r]));
  const roasChartData = rows.map((r) => ({
    name: r.ad_name,
    current: Number(r.roas),
    previous: Number(prevMap.get(r.ad_name)?.roas || 0),
  }));

  const spendRevenueData = rows.map((r) => ({
    name: r.ad_name,
    harcama: Number(r.spent),
    ciro: Number(r.total_revenue),
  }));

  const ctrData = rows.map((r) => ({
    name: r.ad_name,
    ctr: Number(r.ctr),
    cvr: Number(r.cvr),
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/pazaryeri/trendyol/reklamlar?hafta=${selectedPeriod || ""}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-vw-dark">Reklam Dashboard</h1>
            <p className="text-sm text-muted-foreground">Detaylı performans analizi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {periods.length > 0 && (
            <Select value={selectedPeriod || ""} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Hafta seçin" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((p) => (
                  <SelectItem key={p} value={p}>
                    {formatDate(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16">
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Bu dönem için veri yok</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Toplam Harcama
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(totalSpent)}</div>
                <ChangeIndicator current={totalSpent} previous={prevTotalSpent} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Toplam Ciro
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatCurrency(totalRevenue)}</div>
                <ChangeIndicator current={totalRevenue} previous={prevTotalRevenue} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ortalama ROAS
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-xl font-bold ${
                    avgRoas >= 10 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {avgRoas.toFixed(2)}x
                </div>
                <ChangeIndicator current={avgRoas} previous={prevAvgRoas} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Toplam Satış
                </CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{formatNumber(totalSales)}</div>
                <ChangeIndicator current={totalSales} previous={prevTotalSales} />
              </CardContent>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* ROAS Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  ROAS Karşılaştırma
                  {prevPeriod && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (bu hafta vs önceki)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RoasComparisonChart data={roasChartData} hasPrev={!!prevPeriod} />
              </CardContent>
            </Card>

            {/* Spend vs Revenue */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Harcama / Ciro</CardTitle>
              </CardHeader>
              <CardContent>
                <SpendRevenueChart data={spendRevenueData} />
              </CardContent>
            </Card>

            {/* Trend over all weeks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Haftalık Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart data={trendData} />
              </CardContent>
            </Card>

            {/* CTR Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">CTR & CVR Dağılımı</CardTitle>
              </CardHeader>
              <CardContent>
                <CtrDistributionChart data={ctrData} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
