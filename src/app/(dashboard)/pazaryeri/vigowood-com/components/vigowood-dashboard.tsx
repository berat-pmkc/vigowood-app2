"use client";

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
  ShoppingCart,
  TrendingUp,
  Clock,
  RotateCcw,
  Package,
  AlertTriangle,
  Users,
} from "lucide-react";
import { formatTRY } from "@/lib/ikas/helpers";
import { IkasSyncButton } from "./ikas-sync-button";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";

// Dynamic chart imports (ssr: false)
const VigowoodTrendChart = dynamic(() => import("./vigowood-trend-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton height={320} />,
});
const StatusDistributionChart = dynamic(() => import("./status-distribution-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton height={300} />,
});
const SkuFilterChart = dynamic(() => import("./sku-filter-chart"), {
  ssr: false,
  loading: () => <ChartSkeleton height={300} />,
});

interface KpiData {
  todayOrderCount: number;
  todayCiro: number;
  weekOrderCount: number;
  weekCiro: number;
  pendingCount: number;
  cancelledCount: number;
  totalProducts: number;
  outOfStockCount: number;
  totalCustomers: number;
}

interface TopProduct {
  sku: string;
  name: string;
  quantity: number;
  revenue: number;
}

interface SkuOption {
  sku: string;
  name: string;
}

interface DayEntry {
  date: string;
  orders: number;
  revenue: number;
}

interface Props {
  kpi: KpiData;
  trendData: { date: string; orders: number; ciro: number }[];
  statusDistribution: Record<string, number>;
  topProducts: TopProduct[];
  skuDailyData: Record<string, DayEntry[]>;
  availableSkus: SkuOption[];
  isMock: boolean;
}

export function VigowoodDashboard({
  kpi,
  trendData,
  statusDistribution,
  topProducts,
  skuDailyData,
  availableSkus,
  isMock,
}: Props) {
  const kpiCards = [
    {
      title: "Bugünkü Sipariş",
      value: kpi.todayOrderCount,
      subtitle: formatTRY(kpi.todayCiro),
      icon: ShoppingCart,
      color: "text-emerald-600",
    },
    {
      title: "Haftalık Sipariş",
      value: kpi.weekOrderCount,
      subtitle: formatTRY(kpi.weekCiro),
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      title: "Bekleyen",
      value: kpi.pendingCount,
      subtitle: "Hazırlanmayı bekliyor",
      icon: Clock,
      color: "text-amber-600",
    },
    {
      title: "İptal/İade",
      value: kpi.cancelledCount,
      subtitle: "Son 30 gün",
      icon: RotateCcw,
      color: "text-red-500",
    },
    {
      title: "Toplam Ürün",
      value: kpi.totalProducts,
      subtitle: `${kpi.outOfStockCount} stok tükenen`,
      icon: Package,
      color: "text-indigo-600",
    },
    {
      title: "Müşteriler",
      value: kpi.totalCustomers.toLocaleString("tr-TR"),
      subtitle: "Toplam kayıtlı",
      icon: Users,
      color: "text-violet-600",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">vigowood.com Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Son 30 gün verilerine dayalı {isMock && "(demo veri)"}
          </p>
        </div>
        <IkasSyncButton isMock={isMock} />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1: Trend + Status Distribution */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              30 Günlük Sipariş ve Ciro Trendi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VigowoodTrendChart data={trendData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Sipariş Durum Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistributionChart data={statusDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* SKU Filter Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            SKU Bazlı Satış Analizi (Son 30 Gün)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SkuFilterChart
            skuDailyData={skuDailyData}
            availableSkus={availableSkus}
          />
        </CardContent>
      </Card>

      {/* Top Selling Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            En Çok Satan Ürünler (Son 30 Gün)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Ürün Adı</TableHead>
                  <TableHead className="text-right">Adet</TableHead>
                  <TableHead className="text-right">Ciro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                      Veri bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  topProducts.map((p, i) => (
                    <TableRow key={p.sku}>
                      <TableCell className="font-medium text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {p.sku}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm">
                        {p.name}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {p.quantity}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-700">
                        {formatTRY(p.revenue)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
