import { createClient } from "@/lib/supabase/server";
import { SatisDashboard } from "./components/satis-dashboard";
import type { SatisKpiData } from "./components/kpi-cards";
import type { DailySalesData } from "./components/satis-chart";
import type { SkuSalesRow } from "./components/satis-table";
import { isExportChannel } from "@/lib/constants";
import { getPeriodDates, type PeriodType } from "./actions";

interface PageProps {
  searchParams: Promise<{ period?: string; kanal?: string }>;
}

export default async function SatisPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = (params.period || "month") as PeriodType;
  const kanal = params.kanal || "all";

  const supabase = await createClient();
  const { start, end } = getPeriodDates(period);

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
    const isExport = r.satis_kanali ? isExportChannel(r.satis_kanali) : false;
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
      />
    </div>
  );
}
