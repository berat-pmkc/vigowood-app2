import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ReklamlarClient } from "./components/reklamlar-client";

export const metadata: Metadata = { title: "Trendyol — Reklamlar" };

interface PageProps {
  searchParams: Promise<{ hafta?: string }>;
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

  // 2. Selected period
  const selectedPeriod = params.hafta && periods.includes(params.hafta)
    ? params.hafta
    : periods[0] || null;

  // 3. Get weekly data for selected period
  let weeklyData: Record<string, unknown>[] = [];
  if (selectedPeriod) {
    const { data } = await supabase
      .from("trendyol_ad_weekly")
      .select("*")
      .eq("period_end", selectedPeriod)
      .order("spent", { ascending: false });
    weeklyData = data || [];
  }

  // 4. Get SKU mappings
  const { data: skuMappings } = await supabase
    .from("trendyol_ad_sku_mappings")
    .select("*");

  const skuMap: Record<string, string[]> = {};
  for (const m of skuMappings || []) {
    skuMap[m.ad_name] = m.product_ids || [];
  }

  // 5. Get active products for SKU selector
  const { data: products } = await supabase
    .from("products")
    .select("urun_id, urun_adi, sku")
    .eq("aktif", true)
    .order("urun_adi");

  // 6. Get snapshot dates for info
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
    <ReklamlarClient
      weeklyData={weeklyData}
      periods={periods}
      selectedPeriod={selectedPeriod}
      skuMap={skuMap}
      products={(products || []) as { urun_id: string; urun_adi: string; sku: string }[]}
      snapshotDates={snapshotDates}
    />
  );
}
