import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DashboardClient } from "./components/dashboard-client";

export const metadata: Metadata = { title: "Trendyol — Reklam Dashboard" };

interface PageProps {
  searchParams: Promise<{ hafta?: string }>;
}

export default async function ReklamDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as SupabaseClient<any>;

  // 1. Get all periods
  const { data: periodsRaw } = await supabase
    .from("trendyol_ad_weekly")
    .select("period_end")
    .order("period_end", { ascending: false });

  const periodSet = new Set<string>();
  for (const p of periodsRaw || []) periodSet.add(p.period_end);
  const periods = Array.from(periodSet).sort((a, b) => b.localeCompare(a));

  const selectedPeriod =
    params.hafta && periods.includes(params.hafta) ? params.hafta : periods[0] || null;

  // 2. Get current period data
  let currentData: Record<string, unknown>[] = [];
  if (selectedPeriod) {
    const { data } = await supabase
      .from("trendyol_ad_weekly")
      .select("*")
      .eq("period_end", selectedPeriod)
      .order("spent", { ascending: false });
    currentData = data || [];
  }

  // 3. Get previous period data (for comparison)
  const currentIdx = periods.indexOf(selectedPeriod || "");
  const prevPeriod = currentIdx >= 0 && currentIdx < periods.length - 1 ? periods[currentIdx + 1] : null;

  let prevData: Record<string, unknown>[] = [];
  if (prevPeriod) {
    const { data } = await supabase
      .from("trendyol_ad_weekly")
      .select("*")
      .eq("period_end", prevPeriod)
      .order("spent", { ascending: false });
    prevData = data || [];
  }

  // 4. Get all weekly data for trend chart
  const { data: allWeekly } = await supabase
    .from("trendyol_ad_weekly")
    .select("period_end, spent, total_revenue, total_sales, clicks, impressions, roas, ad_name")
    .order("period_end", { ascending: true });

  // Aggregate per period
  const trendMap = new Map<
    string,
    { period: string; spent: number; revenue: number; sales: number; clicks: number; impressions: number }
  >();
  for (const row of allWeekly || []) {
    const key = row.period_end;
    const existing = trendMap.get(key) || { period: key, spent: 0, revenue: 0, sales: 0, clicks: 0, impressions: 0 };
    existing.spent += Number(row.spent) || 0;
    existing.revenue += Number(row.total_revenue) || 0;
    existing.sales += Number(row.total_sales) || 0;
    existing.clicks += Number(row.clicks) || 0;
    existing.impressions += Number(row.impressions) || 0;
    trendMap.set(key, existing);
  }
  const trendData = Array.from(trendMap.values());

  return (
    <DashboardClient
      currentData={currentData}
      prevData={prevData}
      periods={periods}
      selectedPeriod={selectedPeriod}
      prevPeriod={prevPeriod}
      trendData={trendData}
    />
  );
}
