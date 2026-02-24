"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Clock,
  TrendingUp,
  RotateCcw,
  Package,
  AlertTriangle,
} from "lucide-react";
import dynamic from "next/dynamic";

const TrendChart = dynamic(() => import("./trend-chart"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] animate-pulse rounded-md bg-muted" />
  ),
});

interface KpiData {
  todayOrderCount: number;
  pendingCount: number;
  todayCiro: number;
  returnCount: number;
  totalProducts: number;
  outOfStockCount: number;
}

interface Props {
  kpi: KpiData;
  trendData: { date: string; orders: number; ciro: number }[];
  isMock: boolean;
}

function formatTRY(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function GenelDashboard({ kpi, trendData, isMock }: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Pazaryeri — Genel Bakış</h1>
          <p className="text-sm text-muted-foreground">
            Tüm pazaryeri kanallarının özet görünümü
          </p>
        </div>
        {isMock && (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
            Demo Veri
          </Badge>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bugünkü Sipariş</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.todayOrderCount}</div>
            <p className="text-xs text-muted-foreground">Bugün gelen sipariş sayısı</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bekleyen Sipariş</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{kpi.pendingCount}</div>
            <p className="text-xs text-muted-foreground">Hazırlanmayı bekleyen</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Günlük Ciro</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatTRY(kpi.todayCiro)}</div>
            <p className="text-xs text-muted-foreground">Bugünkü satış tutarı</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">İptal/İade</CardTitle>
            <RotateCcw className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpi.returnCount}</div>
            <p className="text-xs text-muted-foreground">Son 7 gün</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Ürün</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpi.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Aktif ürün sayısı</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stok Tükenen</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpi.outOfStockCount}</div>
            <p className="text-xs text-muted-foreground">Stoğu sıfır ürün</p>
          </CardContent>
        </Card>
      </div>

      {/* Kanal Kartları */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-vw-dark">Pazaryeri Kanalları</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-orange-100 text-xs font-bold text-orange-700">T</span>
                Trendyol
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm">
                <span className="font-medium">{kpi.todayOrderCount}</span> sipariş bugün
              </p>
              <p className="text-sm">
                <span className="font-medium">{formatTRY(kpi.todayCiro)}</span> ciro
              </p>
              <Badge className="mt-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Bağlı</Badge>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 opacity-60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-purple-100 text-xs font-bold text-purple-700">H</span>
                Hepsiburada
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Yakında eklenecek</p>
              <Badge variant="outline" className="mt-2">Planlandı</Badge>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 opacity-60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-bold text-blue-700">A</span>
                Amazon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Yakında eklenecek</p>
              <Badge variant="outline" className="mt-2">Planlandı</Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Son 7 Gün — Sipariş Trendi</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={trendData} />
        </CardContent>
      </Card>
    </div>
  );
}
