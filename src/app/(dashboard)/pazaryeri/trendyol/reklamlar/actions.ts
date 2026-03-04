"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedAdRow } from "./parsers";

// ─── Auth Guard ──────────────────────────────────────────────
async function requireMarketplaceAccess() {
  const user = await getCurrentUser();
  if (
    !user ||
    !MARKETPLACE_ACCESS_ROLES.includes(
      user.role as (typeof MARKETPLACE_ACCESS_ROLES)[number]
    )
  ) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── Save Snapshot + Compute Delta ──────────────────────────
type ActionResult =
  | { success: true; snapshotCount: number; weeklyCount: number }
  | { success: false; error: string };

export async function saveAdSnapshot(
  snapshotDate: string,
  rows: ParsedAdRow[]
): Promise<ActionResult> {
  try {
    const user = await requireMarketplaceAccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as SupabaseClient<any>;

    // 1. Upsert snapshots
    const snapshotRows = rows.map((r) => ({
      snapshot_date: snapshotDate,
      ad_name: r.ad_name,
      status: r.status,
      start_date: r.start_date,
      end_date: r.end_date,
      product_count: r.product_count,
      content_ids: r.content_ids,
      total_budget: r.total_budget,
      daily_budget: r.daily_budget,
      remaining_budget: r.remaining_budget,
      spent: r.spent,
      cpc_bid: r.cpc_bid,
      actual_cpc: r.actual_cpc,
      clicks: r.clicks,
      impressions: r.impressions,
      direct_sales: r.direct_sales,
      indirect_sales: r.indirect_sales,
      total_sales: r.total_sales,
      direct_revenue: r.direct_revenue,
      indirect_revenue: r.indirect_revenue,
      total_revenue: r.total_revenue,
      cumulative_roas: r.cumulative_roas,
      uploaded_by: user.full_name || user.email,
    }));

    const { error: snapError } = await supabase
      .from("trendyol_ad_snapshots")
      .upsert(snapshotRows, { onConflict: "snapshot_date,ad_name" });

    if (snapError) throw new Error(`Snapshot kayıt hatası: ${snapError.message}`);

    // 2. Find previous snapshot date
    const { data: prevSnapshots } = await supabase
      .from("trendyol_ad_snapshots")
      .select("snapshot_date")
      .lt("snapshot_date", snapshotDate)
      .order("snapshot_date", { ascending: false })
      .limit(1);

    const prevDate = prevSnapshots?.[0]?.snapshot_date;

    // 3. Compute delta and upsert weekly data
    let weeklyCount = 0;

    if (prevDate) {
      const { data: prevRows } = await supabase
        .from("trendyol_ad_snapshots")
        .select("*")
        .eq("snapshot_date", prevDate);

      const prevMap = new Map<string, Record<string, number>>();
      for (const pr of prevRows || []) {
        prevMap.set(pr.ad_name, {
          spent: Number(pr.spent) || 0,
          clicks: Number(pr.clicks) || 0,
          impressions: Number(pr.impressions) || 0,
          direct_sales: Number(pr.direct_sales) || 0,
          indirect_sales: Number(pr.indirect_sales) || 0,
          total_sales: Number(pr.total_sales) || 0,
          direct_revenue: Number(pr.direct_revenue) || 0,
          indirect_revenue: Number(pr.indirect_revenue) || 0,
          total_revenue: Number(pr.total_revenue) || 0,
        });
      }

      const daysInPeriod = Math.max(
        1,
        Math.round(
          (new Date(snapshotDate).getTime() - new Date(prevDate).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      const weeklyRows = rows.map((r) => {
        const prev = prevMap.get(r.ad_name);
        const dSpent = prev ? r.spent - prev.spent : r.spent;
        const dClicks = prev ? r.clicks - prev.clicks : r.clicks;
        const dImpressions = prev ? r.impressions - prev.impressions : r.impressions;
        const dDirectSales = prev ? r.direct_sales - prev.direct_sales : r.direct_sales;
        const dIndirectSales = prev ? r.indirect_sales - prev.indirect_sales : r.indirect_sales;
        const dTotalSales = prev ? r.total_sales - prev.total_sales : r.total_sales;
        const dDirectRevenue = prev ? r.direct_revenue - prev.direct_revenue : r.direct_revenue;
        const dIndirectRevenue = prev ? r.indirect_revenue - prev.indirect_revenue : r.indirect_revenue;
        const dTotalRevenue = prev ? r.total_revenue - prev.total_revenue : r.total_revenue;

        const roas = dSpent > 0 ? Math.round((dTotalRevenue / dSpent) * 100) / 100 : 0;
        const ctr = dImpressions > 0 ? Math.round((dClicks / dImpressions) * 10000) / 100 : 0;
        const cvr = dClicks > 0 ? Math.round((dTotalSales / dClicks) * 10000) / 100 : 0;
        const cpa = dTotalSales > 0 ? Math.round((dSpent / dTotalSales) * 100) / 100 : 0;

        return {
          ad_name: r.ad_name,
          period_start: prevDate,
          period_end: snapshotDate,
          days_in_period: daysInPeriod,
          spent: Math.max(0, dSpent),
          clicks: Math.max(0, dClicks),
          impressions: Math.max(0, dImpressions),
          direct_sales: Math.max(0, dDirectSales),
          indirect_sales: Math.max(0, dIndirectSales),
          total_sales: Math.max(0, dTotalSales),
          direct_revenue: Math.max(0, dDirectRevenue),
          indirect_revenue: Math.max(0, dIndirectRevenue),
          total_revenue: Math.max(0, dTotalRevenue),
          roas,
          ctr,
          cvr,
          cpa,
          actual_cpc: r.actual_cpc,
        };
      });

      const { error: weeklyError } = await supabase
        .from("trendyol_ad_weekly")
        .upsert(weeklyRows, { onConflict: "period_end,ad_name" });

      if (weeklyError) throw new Error(`Haftalık veri hatası: ${weeklyError.message}`);
      weeklyCount = weeklyRows.length;
    } else {
      // First snapshot — cumulative values become the delta
      const weeklyRows = rows.map((r) => {
        const roas = r.spent > 0 ? Math.round((r.total_revenue / r.spent) * 100) / 100 : 0;
        const ctr = r.impressions > 0 ? Math.round((r.clicks / r.impressions) * 10000) / 100 : 0;
        const cvr = r.clicks > 0 ? Math.round((r.total_sales / r.clicks) * 10000) / 100 : 0;
        const cpa = r.total_sales > 0 ? Math.round((r.spent / r.total_sales) * 100) / 100 : 0;

        let periodStart = snapshotDate;
        if (r.start_date && r.start_date !== "-") {
          const dateMatch = r.start_date.match(/^(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) periodStart = dateMatch[1];
        }

        const daysInPeriod = Math.max(
          1,
          Math.round(
            (new Date(snapshotDate).getTime() - new Date(periodStart).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );

        return {
          ad_name: r.ad_name,
          period_start: periodStart,
          period_end: snapshotDate,
          days_in_period: daysInPeriod,
          spent: r.spent,
          clicks: r.clicks,
          impressions: r.impressions,
          direct_sales: r.direct_sales,
          indirect_sales: r.indirect_sales,
          total_sales: r.total_sales,
          direct_revenue: r.direct_revenue,
          indirect_revenue: r.indirect_revenue,
          total_revenue: r.total_revenue,
          roas,
          ctr,
          cvr,
          cpa,
          actual_cpc: r.actual_cpc,
        };
      });

      const { error: weeklyError } = await supabase
        .from("trendyol_ad_weekly")
        .upsert(weeklyRows, { onConflict: "period_end,ad_name" });

      if (weeklyError) throw new Error(`Haftalık veri hatası: ${weeklyError.message}`);
      weeklyCount = weeklyRows.length;
    }

    return { success: true, snapshotCount: rows.length, weeklyCount };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Update SKU Mapping ─────────────────────────────────────
export async function updateAdSkuMapping(
  adName: string,
  productIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireMarketplaceAccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as SupabaseClient<any>;

    const { error } = await supabase.from("trendyol_ad_sku_mappings").upsert(
      {
        ad_name: adName,
        product_ids: productIds.slice(0, 2),
        updated_by: user.full_name || user.email,
      },
      { onConflict: "ad_name" }
    );

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Delete Snapshot ─────────────────────────────────────────
export async function deleteAdSnapshot(
  snapshotDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireMarketplaceAccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as SupabaseClient<any>;

    await supabase.from("trendyol_ad_weekly").delete().eq("period_end", snapshotDate);

    const { error } = await supabase
      .from("trendyol_ad_snapshots")
      .delete()
      .eq("snapshot_date", snapshotDate);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
