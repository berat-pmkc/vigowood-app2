import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AnalizDashboard } from "./components/analiz-dashboard";
import { urunMaliyetleriHesapla } from "@/lib/maliyet";
import type { KarlilikRow, KarlilikKpi } from "./components/karlilik-tab";
import { MONTH_LABELS } from "./components/overview-trend-chart";
import type { PeriodType, TabType } from "./actions";
import type { OverviewKpiData } from "./components/overview-kpi-cards";
import type { DailyOverviewData } from "./components/overview-production-chart";
import type { MonthlyTrendData } from "./components/overview-trend-chart";
import type { ProductionKpiData } from "./components/production-kpi-cards";
import type { DailyProductionData } from "./components/production-daily-chart";
import type { EfficiencyData } from "./components/production-efficiency";
import type { SalesKpiData } from "./components/sales-kpi-cards";
import type { ChannelSalesData } from "./components/sales-channel-chart";
import type { TopProductRow } from "./components/sales-top-products";
import type { StockKpiData } from "./components/stock-kpi-cards";
import type { StockMovementData } from "./components/stock-movement-chart";
import type { CriticalStockRow } from "./components/stock-critical-table";
import { isExportChannel } from "@/lib/constants";

// ─── Period Helper (Europe/Istanbul, UTC+3) ─────────────────────
const TR_TZ = "Europe/Istanbul";
/** TR yerel tarihini YYYY-MM-DD verir (sunucu UTC olsa bile). */
function trBugun(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TR_TZ });
}
/** YYYY-MM-DD stringine gün ekler/çıkarır (TZ-güvenli). */
function tarihKaydir(gunStr: string, delta: number): string {
  const [y, m, d] = gunStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().split("T")[0];
}
function getPeriodDates(period: PeriodType): {
  start: string | null;
  end: string | null;
} {
  const todayStr = trBugun();
  const [y, m, d] = todayStr.split("-").map(Number);
  switch (period) {
    case "today":
      return { start: todayStr, end: todayStr };
    case "week": {
      const base = new Date(Date.UTC(y, m - 1, d));
      const dow = base.getUTCDay(); // 0=Pazar
      const pazartesiyeKadar = dow === 0 ? 6 : dow - 1;
      return { start: tarihKaydir(todayStr, -pazartesiyeKadar), end: todayStr };
    }
    case "month":
      return { start: `${y}-${String(m).padStart(2, "0")}-01`, end: todayStr };
    case "all":
      return { start: null, end: null };
  }
}

// ─── 30 day helper ──────────────────────────────────────────────
function getLast30DaysMap<T>(init: () => T): Map<string, T> {
  const map = new Map<string, T>();
  const todayStr = trBugun();
  for (let i = 30; i >= 0; i--) {
    map.set(tarihKaydir(todayStr, -i), init());
  }
  return map;
}

// ─── Page ───────────────────────────────────────────────────────
interface PageProps {
  searchParams: Promise<{ tab?: string; period?: string }>;
}

export const metadata: Metadata = { title: "Analiz" };

// Analiz dashboard — 30 saniye cache (sık güncellenen ama hızlı olmalı)
export const revalidate = 30;

export default async function AnalizPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = (params.period || "month") as PeriodType;
  const tab = (params.tab || "genel") as TabType;

  const supabase = await createClient();
  const { start, end } = getPeriodDates(period);

  const todayStr = trBugun();
  const thirtyDaysAgoStr = tarihKaydir(todayStr, -30);

  // 12 ay öncesi (aylık trend için) — TR tabanlı
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const twelveMonthsAgoStr = new Date(Date.UTC(ty, tm - 1 - 12, td))
    .toISOString()
    .split("T")[0];

  // ─── 14 Parallel Queries ───────────────────────────────────────
  const [
    // 1. Pack events today (overview KPI)
    packTodayResult,
    // 2. Satis satirlari (period) — for sales KPI + channel + top products
    satisResult,
    // 3. Products (active) — for stock KPIs
    productsResult,
    // 4. Sevkiyat (pending) — for overview KPI
    sevkiyatResult,
    // 5. Pack events (last 30 days) — for overview + production daily chart
    packLast30Result,
    // 6. Cut batches (period, tamamlandi) — for production KPI
    cutBatchesPeriodResult,
    // 7. Clean (period, tamamlandi) — for production KPI
    cleanPeriodResult,
    // 8. Montaj batches (period, tamamlandi) — for production KPI
    montajPeriodResult,
    // 9. All parts — for stock KPIs (yarı mamül + hazır eleman)
    allPartsResult,
    // 10. Stock movements (last 30 days) — for stock chart
    stockMovLast30Result,
    // 11. Products (critical stock) — for stock table
    criticalStockResult,
    // 12. Satis satirlari (last 12 months) — for monthly trend
    satisMonthlyResult,
    // 13. Cut batches (last 30 days) — for production daily chart
    cutBatchesLast30Result,
    // 14. Montaj batches (last 30 days) — for production daily chart
    montajLast30Result,
  ] = await Promise.all([
    // 1 — pack today
    supabase
      .from("pack_events")
      .select("qty")
      .eq("durum", "tamamlandi")
      .gte("tarih", todayStr)
      .lte("tarih", todayStr),

    // 2 — satis period
    (() => {
      let q = supabase
        .from("satis_satirlari")
        .select(
          "sku, miktar, toplam_tutar, satis_kanali, fatura_no, tarih, is_hizmet",
        );
      if (start) q = q.gte("tarih", start);
      if (end) q = q.lte("tarih", end);
      return q;
    })(),

    // 3 — products active
    supabase
      .from("products")
      .select("sku, urun_adi, stok_aktif, mamul_stok_kritik, aktif_mi")
      .eq("aktif_mi", true),

    // 4 — sevkiyat pending
    supabase
      .from("sevkiyat")
      .select("sevkiyat_id")
      .in("durum", ["bekliyor", "hazirlaniyor"]),

    // 5 — pack last 30 days
    supabase
      .from("pack_events")
      .select("tarih, qty, start_time, end_time")
      .eq("durum", "tamamlandi")
      .gte("tarih", thirtyDaysAgoStr),

    // 6 — cut batches period
    (() => {
      let q = supabase
        .from("cut_batches")
        .select("cut_id, adet, tarih, baslama_zamani, bitis_zamani")
        .eq("durum", "tamamlandi");
      if (start) q = q.gte("tarih", start);
      if (end) q = q.lte("tarih", end);
      return q;
    })(),

    // 7 — clean period
    (() => {
      let q = supabase
        .from("clean")
        .select("cutline_id, start_time, end_time")
        .eq("status", "tamamlandi");
      if (start) q = q.gte("start_time", start);
      if (end) q = q.lte("start_time", `${end}T23:59:59`);
      return q;
    })(),

    // 8 — montaj period (montaj_sessions)
    (() => {
      let q = supabase
        .from("montaj_sessions")
        .select("session_id, qty, start_time, end_time, net_sure_dk")
        .eq("durum", "tamamlandi");
      if (start) q = q.gte("created_at", start);
      if (end) q = q.lte("created_at", `${end}T23:59:59`);
      return q;
    })(),

    // 9 — all_parts
    supabase
      .from("all_parts")
      .select(
        "part_id, part_type, yari_mamul_stok, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok",
      ),

    // 10 — stock movements last 30 days (limit to prevent huge payloads)
    supabase
      .from("stock_movements")
      .select("tarih, qty")
      .gte("tarih", thirtyDaysAgoStr)
      .limit(5000),

    // 11 — critical stock products
    supabase
      .from("products")
      .select("sku, urun_adi, stok_aktif, mamul_stok_kritik")
      .eq("aktif_mi", true)
      .not("mamul_stok_kritik", "is", null)
      .order("stok_aktif", { ascending: true })
      .limit(100),

    // 12 — satis last 12 months (monthly trend)
    supabase
      .from("satis_satirlari")
      .select("tarih, toplam_tutar")
      .gte("tarih", twelveMonthsAgoStr),

    // 13 — cut batches last 30 days
    supabase
      .from("cut_batches")
      .select("tarih, adet")
      .eq("durum", "tamamlandi")
      .gte("tarih", thirtyDaysAgoStr),

    // 14 — montaj last 30 days (montaj_sessions)
    supabase
      .from("montaj_sessions")
      .select("created_at, qty")
      .eq("durum", "tamamlandi")
      .gte("created_at", thirtyDaysAgoStr),
  ]);

  // ─── Data Processing ──────────────────────────────────────────

  // ── Overview KPI ──
  const packTodayRows = (packTodayResult.data || []) as { qty: number }[];
  const gunlukUretim = packTodayRows.reduce(
    (s, r) => s + (Number(r.qty) || 0),
    0,
  );

  const satisRows = (satisResult.data || []) as {
    sku: string | null;
    miktar: number;
    toplam_tutar: number;
    satis_kanali: string | null;
    fatura_no: string | null;
    tarih: string | null;
    is_hizmet: boolean;
  }[];
  const donemSatis = satisRows.reduce(
    (s, r) => s + (r.toplam_tutar || 0),
    0,
  );

  const productsRows = (productsResult.data || []) as {
    sku: string;
    urun_adi: string | null;
    stok_aktif: number;
    mamul_stok_kritik: number | null;
    aktif_mi: boolean;
  }[];
  const mamulStok = productsRows.reduce(
    (s, r) => s + (r.stok_aktif || 0),
    0,
  );

  const bekleyenSevkiyat = (sevkiyatResult.data || []).length;

  const overviewKpi: OverviewKpiData = {
    gunlukUretim,
    donemSatis,
    mamulStok,
    bekleyenSevkiyat,
  };

  // ── Overview Daily Chart (production + sales, last 30 days) ──
  const dailyOverviewMap = getLast30DaysMap(() => ({
    uretim: 0,
    satis: 0,
  }));

  const packLast30Rows = (packLast30Result.data || []) as {
    tarih: string | null;
    qty: number;
    start_time: string | null;
    end_time: string | null;
  }[];
  for (const r of packLast30Rows) {
    if (!r.tarih) continue;
    const day = String(r.tarih).split("T")[0];
    const existing = dailyOverviewMap.get(day);
    if (existing) existing.uretim += Number(r.qty) || 0;
  }

  // Satis daily from monthly result (last 12 months includes last 30 days)
  const satisMonthlyRows = (satisMonthlyResult.data || []) as {
    tarih: string | null;
    toplam_tutar: number;
  }[];
  for (const r of satisMonthlyRows) {
    if (!r.tarih) continue;
    const day = r.tarih.split("T")[0];
    const existing = dailyOverviewMap.get(day);
    if (existing) existing.satis += r.toplam_tutar || 0;
  }

  const overviewDaily: DailyOverviewData[] = Array.from(
    dailyOverviewMap.entries(),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      uretim: v.uretim,
      satis: Math.round(v.satis),
    }));

  // ── Overview Monthly Trend ──
  const monthlyMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(ty, tm - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthlyMap.set(key, 0);
  }

  for (const r of satisMonthlyRows) {
    if (!r.tarih) continue;
    const key = r.tarih.substring(0, 7); // "YYYY-MM"
    const existing = monthlyMap.get(key);
    if (existing !== undefined) {
      monthlyMap.set(key, existing + (r.toplam_tutar || 0));
    }
  }

  const overviewMonthly: MonthlyTrendData[] = Array.from(
    monthlyMap.entries(),
  ).map(([key, ciro]) => ({
    month: MONTH_LABELS[parseInt(key.split("-")[1]) - 1],
    ciro: Math.round(ciro),
  }));

  // ── Production KPI ──
  const cutBatchesPeriod = (cutBatchesPeriodResult.data || []) as {
    cut_id: string;
    adet: number;
    tarih: string | null;
    baslama_zamani: string | null;
    bitis_zamani: string | null;
  }[];
  const cleanPeriod = (cleanPeriodResult.data || []) as {
    cutline_id: string;
    start_time: string | null;
    end_time: string | null;
  }[];
  const montajPeriod = (montajPeriodResult.data || []) as {
    session_id: string;
    qty: number;
    start_time: string | null;
    end_time: string | null;
    net_sure_dk: number | null;
  }[];
  const packPeriodQty = packLast30Rows
    .filter((r) => {
      if (!start) return true;
      if (!r.tarih) return false;
      const day = String(r.tarih).split("T")[0];
      return day >= start && (!end || day <= end);
    })
    .reduce((s, r) => s + (Number(r.qty) || 0), 0);

  const productionKpi: ProductionKpiData = {
    kesimCount: cutBatchesPeriod.length,
    temizlikCount: cleanPeriod.length,
    montajCount: montajPeriod.length,
    paketlemeAdet: packPeriodQty,
  };

  // ── Production Daily Chart (stacked, last 30 days) ──
  const prodDailyMap = getLast30DaysMap(() => ({
    kesim: 0,
    temizlik: 0,
    montaj: 0,
    paketleme: 0,
  }));

  // Kesim
  const cutLast30 = (cutBatchesLast30Result.data || []) as {
    tarih: string | null;
    adet: number;
  }[];
  for (const r of cutLast30) {
    if (!r.tarih) continue;
    const day = String(r.tarih).split("T")[0];
    const existing = prodDailyMap.get(day);
    if (existing) existing.kesim += Number(r.adet) || 0;
  }

  // Temizlik — use cleanPeriod data filtered for last 30 days
  for (const r of cleanPeriod) {
    if (!r.start_time) continue;
    const day = r.start_time.split("T")[0];
    const existing = prodDailyMap.get(day);
    if (existing) existing.temizlik += 1;
  }

  // Montaj (montaj_sessions)
  const montajLast30 = (montajLast30Result.data || []) as {
    created_at: string | null;
    qty: number;
  }[];
  for (const r of montajLast30) {
    if (!r.created_at) continue;
    const day = r.created_at.split("T")[0];
    const existing = prodDailyMap.get(day);
    if (existing) existing.montaj += Number(r.qty) || 0;
  }

  // Paketleme
  for (const r of packLast30Rows) {
    if (!r.tarih) continue;
    const day = String(r.tarih).split("T")[0];
    const existing = prodDailyMap.get(day);
    if (existing) existing.paketleme += Number(r.qty) || 0;
  }

  const productionDaily: DailyProductionData[] = Array.from(
    prodDailyMap.entries(),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // ── Production Efficiency ──
  // Medyan süre (dk). net süre varsa onu kullan; uç kayıtları (≤1 / >240 dk) ele.
  function medyanSure(
    items: { dk?: number | null; start: string | null; end: string | null }[],
  ): number {
    const xs: number[] = [];
    for (const item of items) {
      let dk = item.dk != null && item.dk > 0 ? item.dk : NaN;
      if (isNaN(dk)) {
        if (!item.start || !item.end) continue;
        const s = new Date(item.start).getTime();
        const e = new Date(item.end).getTime();
        if (isNaN(s) || isNaN(e) || e <= s) continue;
        dk = (e - s) / 60000;
      }
      if (dk <= 1 || dk > 240) continue;
      xs.push(dk);
    }
    if (xs.length === 0) return 0;
    xs.sort((a, b) => a - b);
    const o = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[o] : (xs[o - 1] + xs[o]) / 2;
  }

  const productionEfficiency: EfficiencyData[] = [
    {
      istasyon: "Kesim",
      ortSureDk: medyanSure(
        cutBatchesPeriod.map((r) => ({
          start: r.baslama_zamani,
          end: r.bitis_zamani,
        })),
      ),
    },
    {
      istasyon: "Temizlik",
      ortSureDk: medyanSure(
        cleanPeriod.map((r) => ({
          start: r.start_time,
          end: r.end_time,
        })),
      ),
    },
    {
      istasyon: "Montaj",
      ortSureDk: medyanSure(
        montajPeriod.map((r) => ({
          dk: r.net_sure_dk,
          start: r.start_time,
          end: r.end_time,
        })),
      ),
    },
    {
      istasyon: "Paketleme",
      ortSureDk: medyanSure(
        packLast30Rows
          .filter((r) => {
            if (!start) return true;
            if (!r.tarih) return false;
            const day = String(r.tarih).split("T")[0];
            return day >= start && (!end || day <= end);
          })
          .map((r) => ({ start: r.start_time, end: r.end_time })),
      ),
    },
  ].filter((e) => e.ortSureDk > 0);

  // ── Sales KPI ──
  const toplamCiro = satisRows.reduce(
    (s, r) => s + (r.toplam_tutar || 0),
    0,
  );
  const uniqueFaturalar = new Set(
    satisRows.map((r) => r.fatura_no).filter(Boolean),
  );
  const trSatis = satisRows
    .filter(
      (r) => !r.satis_kanali || !isExportChannel(r.satis_kanali),
    )
    .reduce((s, r) => s + (r.toplam_tutar || 0), 0);
  const ihracatSatis = satisRows
    .filter(
      (r) => r.satis_kanali && isExportChannel(r.satis_kanali),
    )
    .reduce((s, r) => s + (r.toplam_tutar || 0), 0);

  const salesKpi: SalesKpiData = {
    toplamCiro,
    siparisSayisi: uniqueFaturalar.size,
    trSatis,
    ihracatSatis,
  };

  // ── Sales Channel Chart ──
  const channelMap = new Map<string, number>();
  for (const r of satisRows) {
    const kanal = r.satis_kanali || "Diğer";
    channelMap.set(kanal, (channelMap.get(kanal) || 0) + (r.toplam_tutar || 0));
  }
  const salesChannel: ChannelSalesData[] = Array.from(channelMap.entries())
    .map(([kanal, tutar]) => ({ kanal, tutar: Math.round(tutar) }))
    .sort((a, b) => b.tutar - a.tutar);

  // ── Sales Top Products ──
  const skuMap = new Map<string, { adet: number; tutar: number }>();
  for (const r of satisRows) {
    if (!r.sku || r.is_hizmet) continue;
    const existing = skuMap.get(r.sku) || { adet: 0, tutar: 0 };
    existing.adet += r.miktar || 0;
    existing.tutar += r.toplam_tutar || 0;
    skuMap.set(r.sku, existing);
  }

  const productNameMap = new Map<string, string>();
  for (const p of productsRows) {
    productNameMap.set(p.sku, p.urun_adi || "");
  }

  const salesTopProducts: TopProductRow[] = Array.from(skuMap.entries())
    .map(([sku, v]) => ({
      sku,
      urunAdi: productNameMap.get(sku) || "",
      toplamAdet: v.adet,
      toplamTutar: v.tutar,
    }))
    .sort((a, b) => b.toplamAdet - a.toplamAdet)
    .slice(0, 10);

  // ── Kârlılık (sadece sekme seçiliyse hesapla — maliyet motoru ağır) ──
  let karlilikKpi: KarlilikKpi = { ciro: 0, maliyet: 0, kar: 0, marj: 0, eksikSayi: 0 };
  let karlilikRows: KarlilikRow[] = [];
  if (tab === "karlilik" && skuMap.size > 0) {
    const maliyetHarita = await urunMaliyetleriHesapla([...skuMap.keys()]);
    let cSum = 0;
    let mSum = 0;
    let eksikSayi = 0;
    for (const [sku, v] of skuMap) {
      const mal = maliyetHarita.get(sku);
      const eksik = !mal || mal.eksikFiyatliParca.length > 0 || mal.iscilikEksikAdim > 0;
      const birimMaliyet = mal ? mal.birimMaliyet : null;
      const toplamMaliyet = birimMaliyet != null ? birimMaliyet * v.adet : 0;
      const kar = v.tutar - toplamMaliyet;
      const marj = v.tutar > 0 ? (kar / v.tutar) * 100 : 0;
      cSum += v.tutar;
      if (birimMaliyet != null) mSum += toplamMaliyet;
      if (eksik) eksikSayi++;
      karlilikRows.push({
        sku,
        urunAdi: productNameMap.get(sku) || "",
        adet: v.adet,
        ciro: v.tutar,
        birimMaliyet,
        toplamMaliyet,
        kar,
        marj,
        eksik,
      });
    }
    karlilikRows.sort((a, b) => b.kar - a.kar);
    const karSum = cSum - mSum;
    karlilikKpi = {
      ciro: cSum,
      maliyet: mSum,
      kar: karSum,
      marj: cSum > 0 ? (karSum / cSum) * 100 : 0,
      eksikSayi,
    };
  }

  // ── Stock KPI ──
  const kritikUrun = productsRows.filter(
    (p) =>
      p.mamul_stok_kritik != null &&
      (p.stok_aktif || 0) < p.mamul_stok_kritik,
  ).length;

  const allParts = (allPartsResult.data || []) as {
    part_id: string;
    part_type: string;
    yari_mamul_stok: number | null;
    hazir_eleman_aktif_stok: number | null;
    hazir_eleman_kritik_stok: number | null;
  }[];
  const yariMamulCesit = allParts.filter(
    (p) => p.part_type === "YARIMAMUL" && (p.yari_mamul_stok || 0) > 0,
  ).length;
  const kritikHazirEleman = allParts.filter(
    (p) =>
      p.part_type !== "YARIMAMUL" &&
      p.hazir_eleman_kritik_stok != null &&
      p.hazir_eleman_kritik_stok > 0 &&
      (p.hazir_eleman_aktif_stok || 0) < p.hazir_eleman_kritik_stok,
  ).length;

  const stockKpi: StockKpiData = {
    mamulStok,
    kritikUrun,
    yariMamulCesit,
    kritikHazirEleman,
  };

  // ── Stock Movement Chart ──
  const stockMovMap = getLast30DaysMap(() => ({ giris: 0, cikis: 0 }));
  const stockMovRows = (stockMovLast30Result.data || []) as {
    tarih: string | null;
    qty: number;
  }[];
  for (const r of stockMovRows) {
    if (!r.tarih) continue;
    const day = r.tarih.split("T")[0];
    const existing = stockMovMap.get(day);
    if (existing) {
      if (Number(r.qty) > 0) {
        existing.giris += Number(r.qty);
      } else {
        existing.cikis += Math.abs(Number(r.qty));
      }
    }
  }

  const stockMovement: StockMovementData[] = Array.from(
    stockMovMap.entries(),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, giris: v.giris, cikis: v.cikis }));

  // ── Stock Critical Table ──
  const criticalRows = (criticalStockResult.data || []) as {
    sku: string;
    urun_adi: string | null;
    stok_aktif: number;
    mamul_stok_kritik: number | null;
  }[];
  const stockCritical: CriticalStockRow[] = criticalRows
    .filter(
      (r) =>
        r.mamul_stok_kritik != null &&
        (r.stok_aktif || 0) < r.mamul_stok_kritik,
    )
    .map((r) => ({
      sku: r.sku,
      urunAdi: r.urun_adi || "",
      mevcut: r.stok_aktif || 0,
      kritikEsik: r.mamul_stok_kritik || 0,
    }))
    .sort((a, b) => a.mevcut - a.kritikEsik - (b.mevcut - b.kritikEsik))
    .slice(0, 15);

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="px-4 pb-6 sm:px-6">
      <AnalizDashboard
        period={period}
        tab={tab}
        overviewKpi={overviewKpi}
        overviewDaily={overviewDaily}
        overviewMonthly={overviewMonthly}
        productionKpi={productionKpi}
        productionDaily={productionDaily}
        productionEfficiency={productionEfficiency}
        salesKpi={salesKpi}
        salesChannel={salesChannel}
        salesTopProducts={salesTopProducts}
        stockKpi={stockKpi}
        stockMovement={stockMovement}
        stockCritical={stockCritical}
        karlilikKpi={karlilikKpi}
        karlilikRows={karlilikRows}
      />
    </div>
  );
}
