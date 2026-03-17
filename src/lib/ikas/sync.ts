/**
 * İkas → Supabase Customer Sync
 * Tüm müşterileri İkas API'den çekip ikas_customers tablosuna upsert eder.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCustomers, enrichCustomersWithOrderStats } from "./client";
import { getCustomerSegment } from "./helpers";
import type { IkasCustomer } from "./types";

interface SyncResult {
  synced: number;
  total: number;
  error?: string;
}

/**
 * Tüm İkas müşterilerini sayfa sayfa çekip DB'ye upsert eder.
 * Service role supabase client gerektirir (RLS bypass).
 */
export async function syncCustomers(
  supabase: SupabaseClient,
  options?: { maxPages?: number }
): Promise<SyncResult> {
  const PAGE_SIZE = 200;
  const MAX_PAGES = options?.maxPages ?? 100; // 200 × 100 = 20.000 max
  const BATCH_DELAY_MS = 1000;

  let totalSynced = 0;
  let totalCount = 0;

  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await getCustomers({ page, limit: PAGE_SIZE });

      if (page === 1) totalCount = result.count;

      if (result.data.length === 0) break;

      // Enrich with order stats (API bazen null döner)
      const enriched = await enrichCustomersWithOrderStats(result.data);

      // Upsert batch
      const upserted = await upsertCustomerBatch(supabase, enriched);
      totalSynced += upserted;

      if (!result.hasNext) break;

      // Rate limit saygısı
      if (page < MAX_PAGES) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    return { synced: totalSynced, total: totalCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return { synced: totalSynced, total: totalCount, error: message };
  }
}

/**
 * Tek sayfa müşterileri DB'ye upsert eder.
 */
async function upsertCustomerBatch(
  supabase: SupabaseClient,
  customers: IkasCustomer[]
): Promise<number> {
  if (customers.length === 0) return 0;

  const now = new Date().toISOString();

  const rows = customers.map((c) => {
    const segment = getCustomerSegment(c);
    return {
      ikas_customer_id: c.id,
      email: c.email || null,
      first_name: c.firstName || null,
      last_name: c.lastName || null,
      phone: c.phone || null,
      order_count: c.orderCount ?? 0,
      total_spent: c.totalOrderPrice ?? 0,
      first_order_date: c.firstOrderDate
        ? new Date(c.firstOrderDate).toISOString()
        : null,
      last_order_date: c.lastOrderDate
        ? new Date(c.lastOrderDate).toISOString()
        : null,
      customer_segment: segment.key === "all" ? "yeni" : segment.key,
      accepts_marketing: c.acceptsMarketing ?? false,
      ikas_synced_at: now,
    };
  });

  const { error } = await supabase
    .from("ikas_customers")
    .upsert(rows, { onConflict: "ikas_customer_id" });

  if (error) {
    console.error("[İkas Sync] Upsert hatası:", error.message);
    throw error;
  }

  return rows.length;
}
