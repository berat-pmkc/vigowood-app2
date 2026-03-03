import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SatisDashboard } from "./components/satis-dashboard";
import type { SatisKpiData } from "./components/kpi-cards";
import type { DailySalesData } from "./components/satis-chart";
import type { SkuSalesRow } from "./components/satis-table";
import { getSalesSettings, isExportChannelFromSettings } from "@/lib/sales-settings";
import type { PeriodType } from "./actions";

function getPeriodDates(
  period: PeriodType,
  customStart?: string,
  customEnd?: string,
): { start: string | null; end: string | null } {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  switch (period) {
    case "today":
      return { start: todayStr, end: todayStr };
    case "week": {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1);
      return { start: startOfWeek.toISOString().split("T")[0], end: todayStr };
    }
    case "month": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfMonth.toISOString().split("T")[0], end: todayStr };
    }
    case "all":
      return { start: null, end: null };
    case "custom":
      return { start: customStart || null, end: customEnd || null };
  }
}

interface PageProps {
  searchParams: Promise<{ period?: string; kanal?: string; start?: string; end?: string }>;
}

export const metadata: Metadata = { title: "Satis" };

export default async function SatisPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const settings = await getSalesSettings();
  const period = (params.period || settings.varsayilanDonem) as PeriodType;
  const kanal = params.kanal || "all";

  const supabase = await createClient();
  const { start, end } = getPeriodDates(period, params.start, params.end);

  // Build base query filter
  let query = supabase
    .from("satis_satirlari")
    .select("sku, miktar, toplam_tutar, satis_kanali, fatura_no, tarih, is_hizmet");

  if (start) query = query.gte("tarih", start);
  if (end) query = query.lte("tarih", end);
  if (kanal !== "all") query = query.eq("satis_kanali", kanal);

  const { data: rows } = await query;
  const satirlar = (rows || []) as {
    sku: string | null;
    miktar: number;
    toplam_tutar: number;
    satis_kanali: string | null;
    fatura_no: string | null;
    tarih: string | null;
    is_hizmet: boolean;
  }[];

  // KPI Calculations
  const toplamTutar = satirlar.reduce((s, r) => s + (r.toplam_tutar || 0), 0);
  const toplamAdet = satirlar
    .filter((r) => !r.is_hizmet)
    .reduce((s, r) => s + (r.miktar || 0), 0);
  const uniqueFaturalar = new Set(satirlar.map((r) => r.fatura_no).filter(Boolean));
  const siparisSayisi = uniqueFaturalar.size;
  const ortalamaSiparis = siparisSayisi > 0 ? toplamTutar / siparisSayisi : 0;

  const kpiData: SatisKpiData = {
    toplamTutar,
    toplamAdet,
    siparisSayisi,
    ortalamaSiparis,
  };

  // SKU Aggregation — TR vs İhracat
  const trMap = new Map<string, { adet: number; tutar: number }>();
  const ihracatMap = new Map<string, { adet: number; tutar: number }>();

  for (const r of satirlar) {
    if (!r.sku || r.is_hizmet) continue;
    const isExport = r.satis_kanali ? isExportChannelFromSettings(r.satis_kanali, settings.kanallari) : false;
    const map = isExport ? ihracatMap : trMap;
    const existing = map.get(r.sku) || { adet: 0, tutar: 0 };
    existing.adet += r.miktar || 0;
    existing.tutar += r.toplam_tutar || 0;
    map.set(r.sku, existing);
  }

  const toSkuRows = (map: Map<string, { adet: number; tutar: number }>): SkuSalesRow[] =>
    Array.from(map.entries())
      .map(([sku, v]) => ({ sku, toplam_adet: v.adet, toplam_tutar: v.tutar }))
      .sort((a, b) => b.toplam_adet - a.toplam_adet);

  const trRows = toSkuRows(trMap);
  const ihracatRows = toSkuRows(ihracatMap);
  const trToplam = trRows.reduce((s, r) => s + r.toplam_tutar, 0);
  const ihracatToplam = ihracatRows.reduce((s, r) => s + r.toplam_tutar, 0);

  // Daily chart data (last 30 days from period)
  const dailyMap = new Map<string, { tutar: number; adet: number }>();
  for (const r of satirlar) {
    if (!r.tarih) continue;
    const existing = dailyMap.get(r.tarih) || { tutar: 0, adet: 0 };
    existing.tutar += r.toplam_tutar || 0;
    if (!r.is_hizmet) existing.adet += r.miktar || 0;
    dailyMap.set(r.tarih, existing);
  }

  const chartData: DailySalesData[] = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, tutar: Math.round(v.tutar), adet: v.adet }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="px-4 pb-6 sm:px-6">
      <SatisDashboard
        period={period}
        kanal={kanal}
        kpiData={kpiData}
        chartData={chartData}
        trRows={trRows}
        ihracatRows={ihracatRows}
        trToplam={trToplam}
        ihracatToplam={ihracatToplam}
        channels={settings.kanallari}
        customStart={params.start}
        customEnd={params.end}
      />
    </div>
  );
}
