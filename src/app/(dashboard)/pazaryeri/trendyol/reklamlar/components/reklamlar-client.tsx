"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Upload, Trash2, CalendarDays, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { UploadDialog } from "./upload-dialog";
import { SkuSelect } from "./sku-select";
import { deleteAdSnapshot } from "../actions";

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
  urun_id: string;
  urun_adi: string;
  sku: string;
}

interface SnapshotDate {
  date: string;
  uploaded_by: string;
  created_at: string;
}

interface Props {
  weeklyData: Record<string, unknown>[];
  periods: string[];
  selectedPeriod: string | null;
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ReklamlarClient({
  weeklyData,
  periods,
  selectedPeriod,
  skuMap,
  products,
  snapshotDates,
}: Props) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const rows = weeklyData as unknown as WeeklyRow[];

  const currentSnapshot = snapshotDates.find((s) => s.date === selectedPeriod);

  // Totals
  const totalSpent = rows.reduce((s, r) => s + Number(r.spent), 0);
  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_revenue), 0);
  const totalSales = rows.reduce((s, r) => s + Number(r.total_sales), 0);
  const totalClicks = rows.reduce((s, r) => s + Number(r.clicks), 0);
  const avgRoas = totalSpent > 0 ? totalRevenue / totalSpent : 0;

  const handlePeriodChange = useCallback(
    (val: string) => {
      router.push(`/pazaryeri/trendyol/reklamlar?hafta=${val}`);
    },
    [router]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedPeriod) return;
    if (!confirm(`${formatDate(selectedPeriod)} tarihli snapshot silinecek. Emin misiniz?`)) return;
    setDeleting(true);
    const result = await deleteAdSnapshot(selectedPeriod);
    setDeleting(false);
    if (result.success) {
      toast.success("Snapshot silindi");
      router.refresh();
    } else {
      toast.error(result.error || "Silme hatası");
    }
  }, [selectedPeriod, router]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">Reklamlar</h1>
          <p className="text-sm text-muted-foreground">
            Trendyol ürün reklam performansı
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedPeriod && rows.length > 0 && (
            <Link href={`/pazaryeri/trendyol/reklamlar/dashboard?hafta=${selectedPeriod}`}>
              <Button variant="outline" size="sm">
                <BarChart3 className="mr-1.5 h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          )}
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" />
            Rapor Yükle
          </Button>
        </div>
      </div>

      {/* Period selector + info */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {periods.length > 0 ? (
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
          ) : (
            <span className="text-sm text-muted-foreground">
              Henüz rapor yüklenmedi
            </span>
          )}
          {selectedPeriod && rows.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    <span>{rows[0]?.days_in_period || 0} gün</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {formatDate(rows[0]?.period_start)} → {formatDate(rows[0]?.period_end)}
                  </p>
                  {currentSnapshot && (
                    <p className="text-xs opacity-70">
                      Yükleyen: {currentSnapshot.uploaded_by}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedPeriod && rows.length > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <span>
                Harcama: <strong>{formatCurrency(totalSpent)}</strong>
              </span>
              <span>
                Ciro: <strong>{formatCurrency(totalRevenue)}</strong>
              </span>
              <span>
                ROAS:{" "}
                <strong className={avgRoas >= 10 ? "text-emerald-600" : "text-red-500"}>
                  {avgRoas.toFixed(2)}x
                </strong>
              </span>
            </div>
          )}
          {selectedPeriod && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {rows.length > 0 ? (
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
                {rows.map((row) => (
                  <TableRow key={row.ad_name}>
                    <TableCell className="font-medium">{row.ad_name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(Number(row.spent))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(Number(row.total_revenue))}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          Number(row.roas) >= 10
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {Number(row.roas).toFixed(2)}x
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatNumber(Number(row.total_sales))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatNumber(Number(row.clicks))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatNumber(Number(row.impressions))}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatPercent(Number(row.ctr))}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatPercent(Number(row.cvr))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {Number(row.cpa) > 0 ? formatCurrency(Number(row.cpa)) : "-"}
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
                  <TableCell>TOPLAM ({rows.length} reklam)</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totalSpent)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(totalRevenue)}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        avgRoas >= 10
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {avgRoas.toFixed(2)}x
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(totalSales)}</TableCell>
                  <TableCell className="text-right font-mono">{formatNumber(totalClicks)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(rows.reduce((s, r) => s + Number(r.impressions), 0))}
                  </TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16">
          <Upload className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {periods.length === 0
              ? "Henüz reklam raporu yüklenmedi"
              : "Bu dönem için veri yok"}
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
