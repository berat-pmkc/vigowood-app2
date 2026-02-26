"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  RotateCcw,
  Percent,
  Minus,
  DollarSign,
  Wallet,
  CreditCard,
  FileText,
  AlertCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { SyncStatus } from "../../components/sync-status";
import type { TrendyolSettlement } from "@/lib/trendyol/types";
import type { OtherFinancialRow } from "@/lib/trendyol/queries";
import { formatTRY } from "@/lib/trendyol/helpers";

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
  otherFinancials: OtherFinancialRow[];
  otherFinCount: number;
}

// Turkish transaction type labels for OtherFinancials
const OTHER_FIN_TYPE_LABELS: Record<string, string> = {
  "Tahsilat Fişi": "Tahsilat Fişi",
  "Ödeme": "Ödeme",
  "Komisyon Faturası": "Komisyon Faturası",
  "Platform Hizmet Bedeli": "Platform Hizmet Bedeli",
  "AZ-Platform Hizmet Bedeli": "AZ-Platform Hizmet Bedeli",
  "Reklam Bedeli": "Reklam Bedeli",
  "Kargo Fatura": "Kargo Fatura",
  "Kusurlu Ürün Faturası": "Kusurlu Ürün Faturası",
  "Uluslararası Hizmet Bedeli": "Uluslararası Hizmet Bedeli",
  "Yurtdışı Operasyon İade Bedeli": "Yurtdışı Operasyon İade",
  // API enum names
  "CashAdvance": "Nakit Avans",
  "WireTransfer": "Havale",
  "IncomingTransfer": "Gelen Transfer",
  "PaymentOrder": "Ödeme Emri",
  "DeductionInvoices": "Kesinti Faturası",
  "ReturnInvoice": "İade Faturası",
  "CommissionAgreementInvoice": "Komisyon Sözleşme Faturası",
  "FinancialItem": "Finansal İşlem",
  "Stoppage": "Stopaj",
};

// Color mapping for types
const OTHER_FIN_TYPE_COLORS: Record<string, string> = {
  "Tahsilat Fişi": "bg-emerald-100 text-emerald-800",
  "Ödeme": "bg-blue-100 text-blue-800",
  "Komisyon Faturası": "bg-amber-100 text-amber-800",
  "Platform Hizmet Bedeli": "bg-purple-100 text-purple-800",
  "AZ-Platform Hizmet Bedeli": "bg-purple-100 text-purple-800",
  "Reklam Bedeli": "bg-orange-100 text-orange-800",
  "Kargo Fatura": "bg-indigo-100 text-indigo-800",
  "Kusurlu Ürün Faturası": "bg-red-100 text-red-800",
  "Uluslararası Hizmet Bedeli": "bg-cyan-100 text-cyan-800",
  "Yurtdışı Operasyon İade Bedeli": "bg-teal-100 text-teal-800",
};

function getTypeColor(type: string): string {
  return OTHER_FIN_TYPE_COLORS[type] || "bg-gray-100 text-gray-800";
}

function getTypeLabel(type: string): string {
  return OTHER_FIN_TYPE_LABELS[type] || type;
}

/** Format timestamp (ms string) to readable date */
function formatTimestamp(ts: string | null): string {
  if (!ts) return "-";
  // If it's a numeric timestamp string
  const num = parseInt(ts, 10);
  if (!isNaN(num) && num > 1000000000000) {
    return new Date(num).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  // If it's an ISO string
  if (ts.includes("-") || ts.includes("T")) {
    return new Date(ts).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return ts;
}

type TabType = "settlements" | "otherfinancials";

export function FinansClient({
  settlements,
  summary,
  monthlyData,
  startDate,
  endDate,
  lastSyncAt,
  otherFinancials,
  otherFinCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>(
    otherFinancials.length > 0 && settlements.length === 0
      ? "otherfinancials"
      : "settlements"
  );

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

  // Settlement KPIs
  const commissionRate =
    summary.totalSales > 0
      ? ((summary.totalCommission / summary.totalSales) * 100).toFixed(1)
      : "0";

  // OtherFinancials aggregation
  const ofSummary = {
    totalCredit: 0,
    totalDebt: 0,
    byType: new Map<string, { credit: number; debt: number; count: number }>(),
  };

  for (const item of otherFinancials) {
    ofSummary.totalCredit += Number(item.credit) || 0;
    ofSummary.totalDebt += Number(item.debt) || 0;

    const existing = ofSummary.byType.get(item.transaction_type) || { credit: 0, debt: 0, count: 0 };
    existing.credit += Number(item.credit) || 0;
    existing.debt += Number(item.debt) || 0;
    existing.count += 1;
    ofSummary.byType.set(item.transaction_type, existing);
  }

  const ofNet = ofSummary.totalCredit - ofSummary.totalDebt;
  const ofByTypeArr = Array.from(ofSummary.byType.entries())
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => (b.credit + b.debt) - (a.credit + a.debt));

  // Recent transactions (last 20)
  const recentSettlements = settlements
    .filter((s) => s.transactionType === "Sale" || s.transactionType === "Return")
    .slice(0, 20);

  const hasSettlements = settlements.length > 0;
  const hasOtherFin = otherFinancials.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">Finans</h1>
          <p className="text-sm text-muted-foreground">
            Trendyol finans verileri — mahsuplaşma ve ödemeler
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
        </CardContent>
      </Card>

      {/* Tab Switcher */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab("settlements")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
            activeTab === "settlements"
              ? "bg-white border border-b-white text-vw-dark shadow-sm -mb-[1px]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Mahsuplaşma
          {hasSettlements && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {settlements.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("otherfinancials")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
            activeTab === "otherfinancials"
              ? "bg-white border border-b-white text-vw-dark shadow-sm -mb-[1px]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Ödemeler & İşlemler
          {hasOtherFin && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {otherFinCount}
            </Badge>
          )}
        </button>
      </div>

      {/* ─── Tab: Settlements (Mahsuplaşma) ─── */}
      {activeTab === "settlements" && (
        <>
          {!hasSettlements ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">Mahsuplaşma verisi bulunamadı</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Trendyol Settlements API şu anda veri döndürmüyor. Ödemeler & İşlemler sekmesini kontrol edin.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
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
                                {s.transactionDate ? new Date(s.transactionDate).toLocaleDateString("tr-TR") : "-"}
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
            </>
          )}
        </>
      )}

      {/* ─── Tab: Other Financials (Ödemeler & İşlemler) ─── */}
      {activeTab === "otherfinancials" && (
        <>
          {!hasOtherFin ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground font-medium">Finansal işlem verisi bulunamadı</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Henüz senkronize edilmiş veri yok. Manuel senkronizasyon yapın.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* OtherFinancials KPI Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Toplam Alacak</CardTitle>
                    <Wallet className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-emerald-600">
                      {formatTRY(ofSummary.totalCredit)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Toplam Borç</CardTitle>
                    <CreditCard className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-red-600">
                      {formatTRY(ofSummary.totalDebt)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Tutar</CardTitle>
                    <DollarSign className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-xl font-bold ${ofNet >= 0 ? "text-blue-600" : "text-red-600"}`}>
                      {formatTRY(ofNet)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">İşlem Sayısı</CardTitle>
                    <FileText className="h-4 w-4 text-gray-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold text-gray-700">{otherFinCount}</div>
                    <p className="text-xs text-muted-foreground">{ofByTypeArr.length} farklı tür</p>
                  </CardContent>
                </Card>
              </div>

              {/* Type Breakdown Table */}
              <Card>
                <CardHeader>
                  <CardTitle>İşlem Türü Dağılımı</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>İşlem Türü</TableHead>
                          <TableHead className="text-center">Adet</TableHead>
                          <TableHead className="text-right">Alacak</TableHead>
                          <TableHead className="text-right">Borç</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ofByTypeArr.map((item) => (
                          <TableRow key={item.type}>
                            <TableCell>
                              <Badge className={`${getTypeColor(item.type)} hover:opacity-80`}>
                                {getTypeLabel(item.type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{item.count}</TableCell>
                            <TableCell className="text-right text-emerald-600">
                              {item.credit > 0 ? formatTRY(item.credit) : "-"}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {item.debt > 0 ? formatTRY(item.debt) : "-"}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              item.credit - item.debt >= 0 ? "text-blue-600" : "text-red-600"
                            }`}>
                              {formatTRY(item.credit - item.debt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* All Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle>Son İşlemler ({Math.min(otherFinancials.length, 50)} / {otherFinCount})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Tür</TableHead>
                          <TableHead>Açıklama</TableHead>
                          <TableHead className="text-right">Alacak</TableHead>
                          <TableHead className="text-right">Borç</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {otherFinancials.slice(0, 50).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {formatTimestamp(item.transaction_date)}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getTypeColor(item.transaction_type)} hover:opacity-80 text-xs`}>
                                {getTypeLabel(item.transaction_type)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm max-w-[300px] truncate" title={item.description || ""}>
                              {item.description || "-"}
                            </TableCell>
                            <TableCell className="text-right text-emerald-600 font-medium">
                              {Number(item.credit) > 0 ? formatTRY(Number(item.credit)) : "-"}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-medium">
                              {Number(item.debt) > 0 ? formatTRY(Number(item.debt)) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {otherFinancials.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                              İşlem bulunamadı.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
