import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ReklamlarPageClient } from "./components/reklamlar-page-client";
import type { MetricKey } from "./components/filter-bar";

export const metadata: Metadata = { title: "Trendyol — Reklamlar" };

const VALID_METRICS: MetricKey[] = ["spent", "revenue", "roas", "sales", "ctr", "cvr"];

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string; metric?: string }>;
}

export default async function TrendyolReklamlarPage({ searchParams }: PageProps) {
  const params = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as SupabaseClient<any>;

  // 1. Get all available periods (distinct period_end from weekly)
  const { data: periodsRaw } = await supabase
    .from("trendyol_ad_weekly")
    .select("period_end")
    .order("period_end", { ascending: false });

  const periodSet = new Set<string>();
  for (const p of periodsRaw || []) {
    periodSet.add(p.period_end);
  }
  const periods = Array.from(periodSet).sort((a, b) => b.localeCompare(a));
  // sorted ascending for range math
  const sortedAsc = [...periods].sort();

  // 2. Determine date range
  let toPeriod = periods[0] || "";
  let fromPeriod = sortedAsc.length > 3 ? sortedAsc[sortedAsc.length - 4] : sortedAsc[0] || "";

  if (params.from && periods.includes(params.from)) {
    fromPeriod = params.from;
  }
  if (params.to && periods.includes(params.to)) {
    toPeriod = params.to;
  }
  // Ensure from <= to
  if (fromPeriod > toPeriod) {
    fromPeriod = toPeriod;
  }

  // 3. Metric
  const metric: MetricKey = VALID_METRICS.includes(params.metric as MetricKey)
    ? (params.metric as MetricKey)
    : "spent";

  // 4. Get ALL weekly data (small dataset: ~20 ads × ~12 periods ≈ ~240 rows)
  const { data: allWeeklyData } = await supabase
    .from("trendyol_ad_weekly")
    .select("*")
    .order("period_end", { ascending: true });

  // 5. Get SKU mappings
  const { data: skuMappings } = await supabase
    .from("trendyol_ad_sku_mappings")
    .select("*");

  const skuMap: Record<string, string[]> = {};
  for (const m of skuMappings || []) {
    skuMap[m.ad_name] = m.product_ids || [];
  }

  // 6. Get active products for SKU selector
  const { data: products } = await supabase
    .from("products")
    .select("sku, urun_adi")
    .eq("aktif_mi", true)
    .order("urun_adi");

  // 7. Get snapshot dates
  const { data: snapshotsRaw } = await supabase
    .from("trendyol_ad_snapshots")
    .select("snapshot_date, uploaded_by, created_at")
    .order("snapshot_date", { ascending: false });

  const snapshotDatesMap = new Map<string, { uploaded_by: string; created_at: string }>();
  for (const s of snapshotsRaw || []) {
    if (!snapshotDatesMap.has(s.snapshot_date)) {
      snapshotDatesMap.set(s.snapshot_date, {
        uploaded_by: s.uploaded_by || "",
        created_at: s.created_at,
      });
    }
  }
  const snapshotDates = Array.from(snapshotDatesMap.entries()).map(([date, info]) => ({
    date,
    ...info,
  }));

  return (
    <ReklamlarPageClient
      allWeeklyData={allWeeklyData || []}
      periods={periods}
      initialFrom={fromPeriod}
      initialTo={toPeriod}
      initialMetric={metric}
      skuMap={skuMap}
      products={(products || []) as { sku: string; urun_adi: string }[]}
      snapshotDates={snapshotDates}
    />
  );
}
