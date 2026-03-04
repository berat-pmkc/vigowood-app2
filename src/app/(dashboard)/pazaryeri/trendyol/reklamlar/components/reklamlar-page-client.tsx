"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadDialog } from "./upload-dialog";
import { SkuSelect } from "./sku-select";
import { FilterBar, type MetricKey } from "./filter-bar";
import { KpiCards } from "./kpi-cards";

// Lazy load charts
const AdTrendChart = dynamic(() => import("./ad-trend-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const TrendChart = dynamic(() => import("./trend-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const SpendRevenueChart = dynamic(() => import("./spend-revenue-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
const RoasComparisonChart = dynamic(() => import("./roas-comparison-chart"), {
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
  direct_sales: number;
  indirect_sales: number;
  total_sales: number;
  direct_revenue: number;
  indirect_revenue: number;
  total_revenue: number;
  roas: number;
  ctr: number;
  cvr: number;
  cpa: number;
  actual_cpc: number;
}

interface Product {
  sku: string;
  urun_adi: string;
}

interface SnapshotDate {
  date: string;
  uploaded_by: string;
  created_at: string;
}

interface Props {
  allWeeklyData: Record<string, unknown>[];
  periods: string[];
  initialFrom: string;
  initialTo: string;
  initialMetric: MetricKey;
  skuMap: Record<string, string[]>;
  products: Product[];
  snapshotDates: SnapshotDate[];
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

function formatPercent(val: number): string {
  return `%${val.toFixed(2)}`;
}

export function ReklamlarPageClient({
  allWeeklyData,
  periods,
  initialFrom,
  initialTo,
  initialMetric,
  skuMap,
  products,
  snapshotDates,
}: Props) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedAds, setSelectedAds] = useState<string[]>([]);
  const [metric, setMetric] = useState<MetricKey>(initialMetric);

  const allRows = allWeeklyData as unknown as WeeklyRow[];

  // All unique ad names
  const allAdNames = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => set.add(r.ad_name));
    return Array.from(set).sort();
  }, [allRows]);

  // Filter by date range
  const dateFilteredRows = useMemo(() => {
    return allRows.filter(
      (r) => r.period_end >= initialFrom && r.period_end <= initialTo
    );
  }, [allRows, initialFrom, initialTo]);

  // Filter by selected ads (client-side)
  const filteredRows = useMemo(() => {
    if (selectedAds.length === 0) return dateFilteredRows;
    return dateFilteredRows.filter((r) => selectedAds.includes(r.ad_name));
  }, [dateFilteredRows, selectedAds]);

  // ── KPI calculations ──
  const totalSpent = filteredRows.reduce((s, r) => s + Number(r.spent), 0);
  const totalRevenue = filteredRows.reduce((s, r) => s + Number(r.total_revenue), 0);
  const totalSales = filteredRows.reduce((s, r) => s + Number(r.total_sales), 0);
  const avgRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;

  // Previous equivalent range for ChangeIndicator
  const { prevTotalSpent, prevTotalRevenue, prevTotalSales, prevAvgRoas } = useMemo(() => {
    const sortedPeriods = [...periods].sort();
    const fromIdx = sortedPeriods.indexOf(initialFrom);
    const toIdx = sortedPeriods.indexOf(initialTo);

    if (fromIdx < 0 || toIdx < 0) {
      return { prevTotalSpent: 0, prevTotalRevenue: 0, prevTotalSales: 0, prevAvgRoas: 0 };
    }

    const rangeLen = toIdx - fromIdx + 1;
    const prevFromIdx = fromIdx - rangeLen;
    const prevToIdx = fromIdx - 1;

    if (prevFromIdx < 0 || prevToIdx < 0) {
      return { prevTotalSpent: 0, prevTotalRevenue: 0, prevTotalSales: 0, prevAvgRoas: 0 };
    }

    const prevFrom = sortedPeriods[prevFromIdx];
    const prevTo = sortedPeriods[prevToIdx];

    let prevRows = allRows.filter(
      (r) => r.period_end >= prevFrom && r.period_end <= prevTo
    );
    if (selectedAds.length > 0) {
      prevRows = prevRows.filter((r) => selectedAds.includes(r.ad_name));
    }

    const ps = prevRows.reduce((s, r) => s + Number(r.spent), 0);
    const pr = prevRows.reduce((s, r) => s + Number(r.total_revenue), 0);
    const pSales = prevRows.reduce((s, r) => s + Number(r.total_sales), 0);
    const pRoas = ps > 0 ? pr / ps : 0;
    return { prevTotalSpent: ps, prevTotalRevenue: pr, prevTotalSales: pSales, prevAvgRoas: pRoas };
  }, [allRows, periods, initialFrom, initialTo, selectedAds]);

  // ── Trend chart data (aggregated per period) ──
  const trendData = useMemo(() => {
    const periodsInRange = [...new Set(filteredRows.map((r) => r.period_end))].sort();
    return periodsInRange.map((p) => {
      const periodRows = filteredRows.filter((r) => r.period_end === p);
      return {
        period: p,
        spent: periodRows.reduce((s, r) => s + Number(r.spent), 0),
        revenue: periodRows.reduce((s, r) => s + Number(r.total_revenue), 0),
        sales: periodRows.reduce((s, r) => s + Number(r.total_sales), 0),
        clicks: periodRows.reduce((s, r) => s + Number(r.clicks), 0),
        impressions: periodRows.reduce((s, r) => s + Number(r.impressions), 0),
      };
    });
  }, [filteredRows]);

  // ── Ad-level aggregation for table + charts ──
  const adAggregates = useMemo(() => {
    const map = new Map<
      string,
      {
        ad_name: string;
        spent: number;
        total_revenue: number;
        total_sales: number;
        clicks: number;
        impressions: number;
        periodCount: number;
        sumCtr: number;
        sumCvr: number;
      }
    >();

    for (const row of filteredRows) {
      const existing = map.get(row.ad_name) || {
        ad_name: row.ad_name,
        spent: 0,
        total_revenue: 0,
        total_sales: 0,
        clicks: 0,
        impressions: 0,
        periodCount: 0,
        sumCtr: 0,
        sumCvr: 0,
      };
      existing.spent += Number(row.spent);
      existing.total_revenue += Number(row.total_revenue);
      existing.total_sales += Number(row.total_sales);
      existing.clicks += Number(row.clicks);
      existing.impressions += Number(row.impressions);
      existing.periodCount += 1;
      existing.sumCtr += Number(row.ctr);
      existing.sumCvr += Number(row.cvr);
      map.set(row.ad_name, existing);
    }

    return Array.from(map.values())
      .map((a) => ({
        ad_name: a.ad_name,
        spent: a.spent,
        total_revenue: a.total_revenue,
        roas: a.spent > 0 ? a.total_revenue / a.spent : 0,
        total_sales: a.total_sales,
        clicks: a.clicks,
        impressions: a.impressions,
        ctr: a.periodCount > 0 ? a.sumCtr / a.periodCount : 0,
        cvr: a.periodCount > 0 ? a.sumCvr / a.periodCount : 0,
        cpa: a.total_sales > 0 ? a.spent / a.total_sales : 0,
      }))
      .sort((a, b) => b.spent - a.spent);
  }, [filteredRows]);

  // ── Chart data derivatives ──
  const spendRevenueData = adAggregates.map((a) => ({
    name: a.ad_name,
    harcama: a.spent,
    ciro: a.total_revenue,
  }));

  const roasData = adAggregates.map((a) => ({
    name: a.ad_name,
    roas: a.roas,
  }));

  const ctrData = adAggregates.map((a) => ({
    name: a.ad_name,
    ctr: a.ctr,
    cvr: a.cvr,
  }));

  // Totals for table
  const tableTotalSpent = adAggregates.reduce((s, a) => s + a.spent, 0);
  const tableTotalRevenue = adAggregates.reduce((s, a) => s + a.total_revenue, 0);
  const tableTotalSales = adAggregates.reduce((s, a) => s + a.total_sales, 0);
  const tableTotalClicks = adAggregates.reduce((s, a) => s + a.clicks, 0);
  const tableTotalImpressions = adAggregates.reduce((s, a) => s + a.impressions, 0);
  const tableAvgRoas = tableTotalSpent > 0 ? tableTotalRevenue / tableTotalSpent : 0;

  const hasData = filteredRows.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">Reklamlar</h1>
          <p className="text-sm text-muted-foreground">
            Trendyol reklam performansı — trend analizi
          </p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="mr-1.5 h-4 w-4" />
          Rapor Yükle
        </Button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        periods={periods}
        fromPeriod={initialFrom}
        toPeriod={initialTo}
        allAdNames={allAdNames}
        selectedAds={selectedAds}
        onSelectedAdsChange={setSelectedAds}
        metric={metric}
        onMetricChange={setMetric}
        snapshotDates={snapshotDates}
      />

      {hasData ? (
        <>
          {/* KPI Cards */}
          <KpiCards
            totalSpent={totalSpent}
            totalRevenue={totalRevenue}
            avgRoas={avgRoas}
            totalSales={totalSales}
            prevTotalSpent={prevTotalSpent}
            prevTotalRevenue={prevTotalRevenue}
            prevAvgRoas={prevAvgRoas}
            prevTotalSales={prevTotalSales}
          />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Gidişat Trendi</CardTitle>
              </CardHeader>
              <CardContent>
                <AdTrendChart
                  data={dateFilteredRows}
                  metric={metric}
                  selectedAds={selectedAds}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Haftalık Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart data={trendData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">ROAS Karşılaştırma</CardTitle>
              </CardHeader>
              <CardContent>
                <RoasComparisonChart data={roasData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">CTR & CVR Dağılımı</CardTitle>
              </CardHeader>
              <CardContent>
                <CtrDistributionChart data={ctrData} />
              </CardContent>
            </Card>
          </div>

          {/* Spend/Revenue bar chart */}
          {adAggregates.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Harcama / Ciro (Reklam Bazlı)</CardTitle>
              </CardHeader>
              <CardContent>
                <SpendRevenueChart data={spendRevenueData} />
              </CardContent>
            </Card>
          )}

          {/* Data Table */}
          <div className="rounded-lg border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Reklam</TableHead>
                    <TableHead className="text-right">Harcama</TableHead>
                    <TableHead className="text-right">Ciro</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">Satış</TableHead>
                    <TableHead className="text-right">Tıklanma</TableHead>
                    <TableHead className="text-right">Gösterim</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">CVR</TableHead>
                    <TableHead className="text-right">CPA</TableHead>
                    <TableHead className="min-w-[200px]">SKU Eşleştirme</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adAggregates.map((row) => (
                    <TableRow key={row.ad_name}>
                      <TableCell className="font-medium">{row.ad_name}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(row.spent)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(row.total_revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.roas >= 10
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {row.roas.toFixed(2)}x
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(row.total_sales)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(row.clicks)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatNumber(row.impressions)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPercent(row.ctr)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatPercent(row.cvr)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.cpa > 0 ? formatCurrency(row.cpa) : "-"}
                      </TableCell>
                      <TableCell>
                        <SkuSelect
                          adName={row.ad_name}
                          selectedIds={skuMap[row.ad_name] || []}
                          products={products}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="border-t-2 bg-muted/50 font-semibold">
                    <TableCell>TOPLAM ({adAggregates.length} reklam)</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(tableTotalSpent)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(tableTotalRevenue)}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          tableAvgRoas >= 10
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tableAvgRoas.toFixed(2)}x
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(tableTotalSales)}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(tableTotalClicks)}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(tableTotalImpressions)}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16">
          <Upload className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {periods.length === 0
              ? "Henüz reklam raporu yüklenmedi"
              : "Seçili aralıkta veri yok"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setUploadOpen(true)}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            İlk Raporu Yükle
          </Button>
        </div>
      )}

      {/* Upload Dialog */}
      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
