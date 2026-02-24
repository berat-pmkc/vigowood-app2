"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  RotateCcw,
  Percent,
  Minus,
} from "lucide-react";
import dynamic from "next/dynamic";
import { SyncStatus } from "../../components/sync-status";
import type { TrendyolSettlement } from "@/lib/trendyol/types";
import { formatTRY, formatTrendyolDateShort } from "@/lib/trendyol/helpers";

const FinansChart = dynamic(() => import("./finans-chart"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] animate-pulse rounded-md bg-muted" />
  ),
});

interface Summary {
  totalSales: number;
  totalReturns: number;
  totalCommission: number;
  totalDiscount: number;
  netAmount: number;
}

interface MonthlyData {
  month: string;
  totalSales: number;
  totalReturns: number;
  totalCommission: number;
  totalDiscount: number;
  netAmount: number;
}

interface Props {
  settlements: TrendyolSettlement[];
  summary: Summary;
  monthlyData: MonthlyData[];
  startDate: string;
  endDate: string;
  lastSyncAt: string | null;
}

export function FinansClient({
  settlements,
  summary,
  monthlyData,
  startDate,
  endDate,
  lastSyncAt,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`/pazaryeri/trendyol/finans?${params.toString()}`);
  }

  const commissionRate =
    summary.totalSales > 0
      ? ((summary.totalCommission / summary.totalSales) * 100).toFixed(1)
      : "0";

  // Recent transactions (last 20)
  const recentSettlements = settlements
    .filter((s) => s.transactionType === "Sale" || s.transactionType === "Return")
    .slice(0, 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">Finans</h1>
          <p className="text-sm text-muted-foreground">
            Trendyol satış ve komisyon verileri
          </p>
        </div>
        <SyncStatus lastSyncAt={lastSyncAt} entityType="settlements" />
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
          <span className="text-sm font-medium">Tarih Aralığı:</span>
          <Input
            type="date"
            className="w-[150px]"
            value={startDate}
            onChange={(e) => updateParams({ startDate: e.target.value })}
          />
          <span className="text-sm text-muted-foreground">—</span>
          <Input
            type="date"
            className="w-[150px]"
            value={endDate}
            onChange={(e) => updateParams({ endDate: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            (Trendyol maks. 15 günlük aralık destekler)
          </p>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Satış</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-600">{formatTRY(summary.totalSales)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">İade/İptal</CardTitle>
            <RotateCcw className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">{formatTRY(summary.totalReturns)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Komisyon</CardTitle>
            <Percent className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-600">{formatTRY(summary.totalCommission)}</div>
            <p className="text-xs text-muted-foreground">Ort. %{commissionRate}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">İndirimler</CardTitle>
            <Minus className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-600">{formatTRY(summary.totalDiscount)}</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Ödeme</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-600">{formatTRY(summary.netAmount)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Satış / Komisyon / Net Ödeme Grafiği</CardTitle>
          </CardHeader>
          <CardContent>
            <FinansChart data={monthlyData} />
          </CardContent>
        </Card>
      )}

      {/* Monthly Summary Table */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aylık Özet</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dönem</TableHead>
                    <TableHead className="text-right">Satış</TableHead>
                    <TableHead className="text-right">İade</TableHead>
                    <TableHead className="text-right">Komisyon</TableHead>
                    <TableHead className="text-right">İndirim</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell className="font-medium">{m.month}</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatTRY(m.totalSales)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatTRY(m.totalReturns)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        {formatTRY(m.totalCommission)}
                      </TableCell>
                      <TableCell className="text-right text-purple-600">
                        {formatTRY(m.totalDiscount)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        {formatTRY(m.netAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Son İşlemler</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Sipariş No</TableHead>
                  <TableHead>Barkod</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead className="text-right">Komisyon</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSettlements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      İşlem bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentSettlements.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">
                        {s.transactionDate}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            s.transactionType === "Sale"
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                              : "bg-red-100 text-red-800 hover:bg-red-100"
                          }
                        >
                          {s.transactionType === "Sale" ? "Satış" : "İade"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.orderNumber || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.barcode || "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatTRY(s.credit || s.debt || 0)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-amber-600">
                        {s.commissionAmount ? formatTRY(s.commissionAmount) : "-"}
                        {s.commissionRate ? ` (%${s.commissionRate})` : ""}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        {s.sellerRevenue ? formatTRY(s.sellerRevenue) : "-"}
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
