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

  // Tüm dönemi sayfalayarak çek. PostgREST varsayılanı 1000 satır; tek
  // sorgu bir ayın (ör. 4975 satır) tamamını getirmiyordu, bu yüzden
  // KPI'lar ve grafik gerçeğin altında kalıyordu.
  type SatisSatir = {
    sku: string | null; miktar: number; toplam_tutar: number;
    satis_kanali: string | null; fatura_no: string | null;
    tarih: string | null; is_hizmet: boolean;
  };
  const satirlar: SatisSatir[] = [];
  const SAYFA = 1000;
  for (let off = 0; ; off += SAYFA) {
    let q = supabase
      .from("satis_satirlari")
      .select("sku, miktar, toplam_tutar, satis_kanali, fatura_no, tarih, is_hizmet")
      .order("tarih", { ascending: true })
      .range(off, off + SAYFA - 1);
    if (start) q = q.gte("tarih", start);
    if (end) q = q.lte("tarih", end);
    if (kanal !== "all") q = q.eq("satis_kanali", kanal);
    const { data: rows } = await q;
    const batch = (rows || []) as SatisSatir[];
    satirlar.push(...batch);
    if (batch.length < SAYFA) break;
    if (off > 100000) break; // güvenlik
  }

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

  // ── SEVKİYAT (ihracat) analizi — satış faturalarından ayrı fiziksel çıkışlar
  const { data: sevkHeaderlar } = await supabase
    .from("sevkiyat")
    .select("sevkiyat_id, ulke, country_code, durum");
  const { data: sevkItemler } = await supabase
    .from("sevkiyat_items")
    .select("sevkiyat_id, sku, qty, palet_sayisi, agirlik");

  const sevkBaslik = new Map<string, { ulke: string; country: string; durum: string }>(
    (sevkHeaderlar ?? []).map((h) => [h.sevkiyat_id, {
      ulke: h.ulke ?? h.country_code ?? "?", country: h.country_code ?? "?", durum: h.durum ?? "",
    }]),
  );

  const ulkeAgg = new Map<string, { ulke: string; sevkiyat: Set<string>; adet: number; palet: number; kg: number }>();
  const urunAgg = new Map<string, { adet: number; ulkeler: Map<string, number> }>();
  for (const it of (sevkItemler ?? []) as { sevkiyat_id: string; sku: string | null; qty: number; palet_sayisi: number | null; agirlik: number | null }[]) {
    const b = sevkBaslik.get(it.sevkiyat_id);
    if (!b) continue;
    const u = ulkeAgg.get(b.country) ?? { ulke: b.ulke, sevkiyat: new Set<string>(), adet: 0, palet: 0, kg: 0 };
    u.sevkiyat.add(it.sevkiyat_id);
    u.adet += it.qty ?? 0;
    u.palet += it.palet_sayisi ?? 0;
    u.kg += Number(it.agirlik ?? 0);
    ulkeAgg.set(b.country, u);
    if (it.sku) {
      const p = urunAgg.get(it.sku) ?? { adet: 0, ulkeler: new Map<string, number>() };
      p.adet += it.qty ?? 0;
      p.ulkeler.set(b.country, (p.ulkeler.get(b.country) ?? 0) + (it.qty ?? 0));
      urunAgg.set(it.sku, p);
    }
  }

  const sevkiyatUlkeler = [...ulkeAgg.entries()].map(([country, v]) => ({
    country, ulke: v.ulke, sevkiyatSayisi: v.sevkiyat.size,
    adet: Math.round(v.adet), palet: Math.round(v.palet), kg: Math.round(v.kg),
  })).sort((a, b) => b.adet - a.adet);

  const sevkiyatUrunler = [...urunAgg.entries()].map(([sku, v]) => ({
    sku, adet: Math.round(v.adet),
    ulkeDagilim: [...v.ulkeler.entries()].map(([c, q]) => `${c}:${q}`).join(" · "),
  })).sort((a, b) => b.adet - a.adet).slice(0, 30);

  const sevkiyatToplam = {
    sevkiyat: sevkBaslik.size,
    adet: sevkiyatUlkeler.reduce((t, u) => t + u.adet, 0),
    palet: sevkiyatUlkeler.reduce((t, u) => t + u.palet, 0),
    kg: sevkiyatUlkeler.reduce((t, u) => t + u.kg, 0),
  };

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
        sevkiyatUlkeler={sevkiyatUlkeler}
        sevkiyatUrunler={sevkiyatUrunler}
        sevkiyatToplam={sevkiyatToplam}
      />
    </div>
  );
}
