"use client";

import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  BarChart3,
  Target,
  ShoppingCart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

interface Props {
  totalSpent: number;
  totalRevenue: number;
  avgRoas: number;
  totalSales: number;
  prevTotalSpent: number;
  prevTotalRevenue: number;
  prevAvgRoas: number;
  prevTotalSales: number;
}

export function KpiCards({
  totalSpent,
  totalRevenue,
  avgRoas,
  totalSales,
  prevTotalSpent,
  prevTotalRevenue,
  prevAvgRoas,
  prevTotalSales,
}: Props) {
  return (
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
            Ort. ROAS
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
  );
}
