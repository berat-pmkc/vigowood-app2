/**
 * Trendyol Sync Layer — Server-only
 * Cron endpoint'leri tarafından çağrılır.
 * API'den veri çeker, Supabase'e upsert eder.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import type {
  TrendyolOrder,
  TrendyolOrderLine,
  TrendyolProduct,
  TrendyolQuestion,
  TrendyolSettlement,
  TrendyolOtherFinancial,
  TrendyolClaim,
} from "./types";
import {
  getOrders,
  getProducts,
  getQuestions,
  getSettlements,
  getOtherFinancials,
  getClaims,
} from "./client";
import { daysAgoTimestamp, endOfTodayTimestamp } from "./helpers";

// ─── Helpers ──────────────────────────────────────────────

/** Wait for rate limit cooldown */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Get last successful sync time for a given entity type */
export async function getLastSyncTime(
  supabase: SupabaseClient,
  entityType: string
): Promise<number | null> {
  const { data } = await supabase
    .from("trendyol_sync_log")
    .select("completed_at")
    .eq("entity_type", entityType)
    .eq("status", "success")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.completed_at) {
    return new Date(data.completed_at).getTime();
  }
  return null;
}

/** Create a sync log entry and return its ID */
async function createSyncLog(
  supabase: SupabaseClient,
  entityType: string
): Promise<string> {
  const { data } = await supabase
    .from("trendyol_sync_log")
    .insert({ entity_type: entityType, status: "running" })
    .select("id")
    .single();
  return data!.id;
}

/** Complete a sync log entry */
async function completeSyncLog(
  supabase: SupabaseClient,
  logId: string,
  recordsSynced: number,
  error?: string
) {
  await supabase
    .from("trendyol_sync_log")
    .update({
      status: error ? "error" : "success",
      completed_at: new Date().toISOString(),
      records_synced: recordsSynced,
      error_message: error || null,
    })
    .eq("id", logId);
}

// ─── Order Mapper ─────────────────────────────────────────

function mapOrderToRow(order: TrendyolOrder) {
  return {
    id: order.shipmentPackageId,
    order_number: order.orderNumber,
    customer_id: order.customerId,
    customer_first_name: order.customerFirstName,
    customer_last_name: order.customerLastName,
    customer_email: order.customerEmail || null,
    gross_amount: order.grossAmount,
    total_discount: order.totalDiscount,
    total_price: order.totalPrice,
    status: order.status,
    shipment_address: order.shipmentAddress,
    invoice_address: order.invoiceAddress,
    cargo_tracking_number: order.cargoTrackingNumber || null,
    cargo_tracking_link: order.cargoTrackingLink || null,
    cargo_provider_name: order.cargoProviderName || null,
    cargo_sender_number: order.cargoSenderNumber || null,
    delivery_type: order.deliveryType || null,
    order_date: order.orderDate,
    last_modified_date: order.lastModifiedDate,
    package_histories: order.packageHistories || null,
    raw_data: {
      commercial: order.commercial,
      fastDelivery: order.fastDelivery,
      invoiceLink: order.invoiceLink,
      estimatedDeliveryStartDate: order.estimatedDeliveryStartDate,
      estimatedDeliveryEndDate: order.estimatedDeliveryEndDate,
      deliveryAddressType: order.deliveryAddressType,
    },
  };
}

function mapOrderLineToRow(line: TrendyolOrderLine, orderId: number) {
  return {
    id: line.id,
    order_id: orderId,
    line_id: line.lineId || null,
    quantity: line.quantity,
    merchant_sku: line.merchantSku,
    sku: line.sku || null,
    stock_code: line.stockCode || null,
    product_name: line.productName,
    barcode: line.barcode,
    amount: line.amount,
    discount: line.discount,
    currency_code: line.currencyCode,
    vat_base_amount: line.vatBaseAmount,
    vat_rate: line.vatRate || null,
    price: line.price,
    status_name: line.orderLineItemStatusName,
    // commission: rate (0-1) veya percentage (0-100) — API'den gelen değer
    commission: line.commission ?? null,
    // commission_amount: Trendyol'un hesapladığı gerçek komisyon tutarı (varsa)
    commission_amount: line.commissionAmount ?? null,
    product_size: line.productSize || null,
    product_color: line.productColor || null,
    image_url: line.imageUrl || null,
  };
}

// ─── Product Mapper ───────────────────────────────────────

function mapProductToRow(product: TrendyolProduct) {
  return {
    id: product.id,
    barcode: product.barcode,
    title: product.title,
    description: product.description || null,
    product_main_id: product.productMainId || null,
    brand: product.brand || null,
    brand_id: product.brandId || null,
    category_name: product.categoryName || null,
    category_id: product.categoryId || null,
    quantity: product.quantity,
    stock_code: product.stockCode || null,
    dimensional_weight: product.dimensionalWeight || null,
    list_price: product.listPrice,
    sale_price: product.salePrice,
    vat_rate: product.vatRate || null,
    images: product.images || null,
    attributes: product.attributes || null,
    approved: product.approved ?? false,
    archived: product.archived ?? false,
    on_sale: (product.onSale ?? product.onsale) ?? false,
    locked: product.locked ?? false,
    rejected: product.rejected ?? false,
    blacklisted: product.blacklisted ?? false,
    create_date_time: product.createDateTime || null,
    last_update_date: product.lastUpdateDate || null,
  };
}

// ─── Question Mapper ──────────────────────────────────────

function mapQuestionToRow(q: TrendyolQuestion) {
  return {
    id: q.id,
    text: q.text,
    status: q.status,
    creation_date: q.creationDate,
    customer_id: q.customerId,
    user_name: q.userName || null,
    product_name: q.productName || null,
    product_main_id: q.productMainId || null,
    image_url: q.imageUrl || null,
    public: q.public ?? true,
    answer_text: q.answer?.text || null,
    answer_date: q.answer?.creationDate || null,
    rejected_answer_text: q.rejectedAnswer?.text || null,
    rejected_answer_reason: q.rejectedAnswer?.reason || null,
    web_url: q.webUrl || null,
  };
}

// ─── Settlement Mapper ────────────────────────────────────

function mapSettlementToRow(s: TrendyolSettlement) {
  return {
    id: s.id,
    transaction_date: s.transactionDate,
    transaction_type: s.transactionType,
    debt: s.debt ?? 0,
    credit: s.credit ?? 0,
    receipt_id: s.receiptId || null,
    barcode: s.barcode || null,
    payment_order_id: s.paymentOrderId || null,
    payment_date: s.paymentDate || null,
    commission_rate: s.commissionRate || null,
    commission_amount: s.commissionAmount || null,
    seller_revenue: s.sellerRevenue || null,
    order_number: s.orderNumber || null,
    affiliate: s.affiliate || null,
    shipment_package_id: s.shipmentPackageId || null,
  };
}

// ─── Sync Functions ───────────────────────────────────────

export async function syncOrders(
  supabase: SupabaseClient
): Promise<{ synced: number; error?: string }> {
  const logId = await createSyncLog(supabase, "orders");
  let totalSynced = 0;

  try {
    const now = Date.now();
    const WEEK_MS = 7 * 86_400_000;
    const DAY_MS = 86_400_000;
    const lastSync = await getLastSyncTime(supabase, "orders");
    // 7 günlük threshold: son sync 7 günden yeniyse incremental (son 2 gün).
    const isIncremental = lastSync && (now - lastSync < 7 * 24 * 60 * 60 * 1000);

    // dateQueryType stratejisi:
    // - Incremental (son 2 gün): LAST_MODIFIED_DATE — durum değişikliklerini (teslim, iptal, iade) yakalar
    // - Full sweep (90 gün): CREATED_DATE — sipariş oluşturma tarihine göre, panel sayımıyla eşleşir
    const dateQueryType = isIncremental ? "LAST_MODIFIED_DATE" : "CREATED_DATE";

    const chunks: { start: number; end: number }[] = [];

    if (isIncremental) {
      // Recent sync exists — only fetch orders modified in last 2 days
      chunks.push({ start: now - 2 * DAY_MS, end: now });
    } else {
      // No recent sync — full 90-day sweep in weekly chunks
      const TOTAL_WEEKS = 13;
      for (let w = 0; w < TOTAL_WEEKS; w++) {
        chunks.push({
          start: now - (w + 1) * WEEK_MS,
          end: now - w * WEEK_MS,
        });
      }
    }

    let requestCount = 0;

    for (const chunk of chunks) {
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        // Rate limit: pause every 40 requests
        if (requestCount > 0 && requestCount % 40 === 0) {
          await sleep(10_000);
        }

        const result = await getOrders({
          startDate: chunk.start,
          endDate: chunk.end,
          page,
          size: 200,
          orderByField: "PackageLastModifiedDate",
          orderByDirection: "DESC",
          dateQueryType,
        });
        requestCount++;

        if (result.content.length === 0) break;

        // Upsert orders in bulk
        const orderRows = result.content.map(mapOrderToRow);
        const { error: orderErr } = await supabase
          .from("trendyol_orders")
          .upsert(orderRows, { onConflict: "id" });

        if (orderErr) throw new Error(`Order upsert failed: ${orderErr.message}`);

        // Bulk upsert order lines — collect all lines, then batch upsert
        const allLineRows: ReturnType<typeof mapOrderLineToRow>[] = [];
        for (const order of result.content) {
          if (order.lines.length === 0) continue;
          for (const l of order.lines) {
            allLineRows.push(mapOrderLineToRow(l, order.shipmentPackageId));
          }
        }
        // Upsert in batches of 500
        for (let i = 0; i < allLineRows.length; i += 500) {
          const batch = allLineRows.slice(i, i + 500);
          const { error: lineErr } = await supabase
            .from("trendyol_order_lines")
            .upsert(batch, { onConflict: "id" });

          if (lineErr) {
            console.warn(`[Trendyol Sync] Order lines upsert failed: ${lineErr.message}`);
          }
        }

        totalSynced += result.content.length;
        page++;
        hasMore = page < result.totalPages;
      }
    }

    await completeSyncLog(supabase, logId, totalSynced);
    return { synced: totalSynced };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await completeSyncLog(supabase, logId, totalSynced, msg);
    return { synced: totalSynced, error: msg };
  }
}

export async function syncProducts(
  supabase: SupabaseClient
): Promise<{ synced: number; error?: string }> {
  const logId = await createSyncLog(supabase, "products");
  let totalSynced = 0;

  try {
    let page = 0;
    let hasMore = true;
    let requestCount = 0;

    while (hasMore) {
      if (requestCount > 0 && requestCount % 40 === 0) {
        await sleep(10_000);
      }

      const result = await getProducts({ page, size: 200 });
      requestCount++;

      if (result.content.length === 0) break;

      const rows = result.content.map(mapProductToRow);
      const { error: err } = await supabase
        .from("trendyol_products")
        .upsert(rows, { onConflict: "id" });

      if (err) throw new Error(`Product upsert failed: ${err.message}`);

      totalSynced += result.content.length;
      page++;
      hasMore = page < result.totalPages;
    }

    await completeSyncLog(supabase, logId, totalSynced);
    return { synced: totalSynced };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await completeSyncLog(supabase, logId, totalSynced, msg);
    return { synced: totalSynced, error: msg };
  }
}

export async function syncQuestions(
  supabase: SupabaseClient
): Promise<{ synced: number; error?: string }> {
  const logId = await createSyncLog(supabase, "questions");
  let totalSynced = 0;

  try {
    // Incremental: if synced within 24h, only last 2 days. Otherwise 30 days.
    const lastSync = await getLastSyncTime(supabase, "questions");
    const isIncremental = lastSync && (Date.now() - lastSync < 24 * 60 * 60 * 1000);
    const startDate = isIncremental ? daysAgoTimestamp(2) : daysAgoTimestamp(30);
    const endDate = endOfTodayTimestamp();

    let page = 0;
    let hasMore = true;
    let requestCount = 0;

    while (hasMore) {
      if (requestCount > 0 && requestCount % 40 === 0) {
        await sleep(10_000);
      }

      const result = await getQuestions({
        startDate,
        endDate,
        page,
        size: 200,
        orderByField: "CreatedDate",
        orderByDirection: "DESC",
      });
      requestCount++;

      if (result.content.length === 0) break;

      const rows = result.content.map(mapQuestionToRow);
      const { error: err } = await supabase
        .from("trendyol_questions")
        .upsert(rows, { onConflict: "id" });

      if (err) throw new Error(`Question upsert failed: ${err.message}`);

      totalSynced += result.content.length;
      page++;
      hasMore = page < result.totalPages;
    }

    await completeSyncLog(supabase, logId, totalSynced);
    return { synced: totalSynced };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await completeSyncLog(supabase, logId, totalSynced, msg);
    return { synced: totalSynced, error: msg };
  }
}

export async function syncSettlements(
  supabase: SupabaseClient
): Promise<{ synced: number; error?: string }> {
  const logId = await createSyncLog(supabase, "settlements");
  let totalSynced = 0;

  try {
    // Trendyol finance API: max 15-day range per request
    // Sync last 30 days in 15-day chunks
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86_400_000;

    // 2 chunks of 15 days
    const chunks = [
      { start: thirtyDaysAgo, end: thirtyDaysAgo + 15 * 86_400_000 },
      { start: thirtyDaysAgo + 15 * 86_400_000, end: now },
    ];

    let requestCount = 0;

    for (const chunk of chunks) {
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        if (requestCount > 0 && requestCount % 40 === 0) {
          await sleep(10_000);
        }

        const result = await getSettlements({
          startDate: chunk.start,
          endDate: chunk.end,
          page,
          size: 500,
        });
        requestCount++;

        if (result.content.length === 0) break;

        const rows = result.content.map(mapSettlementToRow);
        const { error: err } = await supabase
          .from("trendyol_settlements")
          .upsert(rows, { onConflict: "id" });

        if (err) throw new Error(`Settlement upsert failed: ${err.message}`);

        totalSynced += result.content.length;
        page++;
        hasMore = page < result.totalPages;
      }
    }

    await completeSyncLog(supabase, logId, totalSynced);
    return { synced: totalSynced };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await completeSyncLog(supabase, logId, totalSynced, msg);
    return { synced: totalSynced, error: msg };
  }
}

// ─── Other Financials (Ödemeler, Komisyon, Platform Bedeli) ──

function mapOtherFinancialToRow(s: TrendyolOtherFinancial) {
  return {
    id: String(s.id),
    transaction_date: s.transactionDate ? String(s.transactionDate) : null,
    transaction_type: s.transactionType,
    debt: s.debt ?? 0,
    credit: s.credit ?? 0,
    description: s.description || null,
  };
}

export async function syncOtherFinancials(
  supabase: SupabaseClient
): Promise<{ synced: number; error?: string }> {
  const logId = await createSyncLog(supabase, "otherfinancials");
  let totalSynced = 0;

  try {
    // Trendyol otherfinancials API: max 15-day range per request
    // Sync last 30 days in three ~10-day chunks (safely under limit)
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86_400_000;
    const DAY = 86_400_000;

    const chunks = [
      { start: thirtyDaysAgo, end: thirtyDaysAgo + 10 * DAY },
      { start: thirtyDaysAgo + 10 * DAY, end: thirtyDaysAgo + 20 * DAY },
      { start: thirtyDaysAgo + 20 * DAY, end: now },
    ];

    let requestCount = 0;

    for (const chunk of chunks) {
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        if (requestCount > 0 && requestCount % 40 === 0) {
          await sleep(10_000);
        }

        const result = await getOtherFinancials({
          startDate: chunk.start,
          endDate: chunk.end,
          page,
          size: 500,
        });
        requestCount++;

        if (result.content.length === 0) break;

        const rows = result.content.map(mapOtherFinancialToRow);
        const { error: err } = await supabase
          .from("trendyol_other_financials")
          .upsert(rows, { onConflict: "id" });

        if (err) throw new Error(`OtherFinancials upsert failed: ${err.message}`);

        totalSynced += result.content.length;
        page++;
        hasMore = page < result.totalPages;
      }
    }

    await completeSyncLog(supabase, logId, totalSynced);
    return { synced: totalSynced };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await completeSyncLog(supabase, logId, totalSynced, msg);
    return { synced: totalSynced, error: msg };
  }
}

// ─── Claims Mapper ────────────────────────────────────────

/** Claim item'larından en temsili durumu türetir */
function deriveClaimStatus(c: TrendyolClaim): string {
  // Önce claim seviyesinde status kontrol et
  if (c.status) return c.status;

  // Yoksa item'lardan türet (claimItemStatus veya status alanı)
  const items = c.items || [];
  if (items.length === 0) return "Created";

  // Öncelik sırası: en kritik durum kazanır
  const PRIORITY: string[] = [
    "WaitingInAction",
    "WaitingFraudCheck",
    "InAnalysis",
    "Unresolved",
    "Created",
    "Accepted",
    "Rejected",
    "Cancelled",
  ];

  const statuses = items
    .map((it) => it.claimItemStatus || it.status || "")
    .filter(Boolean);

  if (statuses.length === 0) return "Created";

  for (const p of PRIORITY) {
    if (statuses.includes(p)) return p;
  }
  return statuses[0];
}

function mapClaimToRow(c: TrendyolClaim) {
  return {
    id: c.id,
    order_number: c.orderNumber,
    status: deriveClaimStatus(c),
    claim_date: c.claimDate,
    shipment_package_id: c.shipmentPackageId ?? null,
    cargo_tracking_number: c.cargoTrackingNumber ?? null,
    items: c.items || [],
  };
}

// ─── Claims Sync ──────────────────────────────────────────

export async function syncClaims(
  supabase: SupabaseClient
): Promise<{ synced: number; error?: string }> {
  const logId = await createSyncLog(supabase, "claims");
  let totalSynced = 0;

  try {
    const now = Date.now();
    const DAY_MS = 86_400_000;
    const lastSync = await getLastSyncTime(supabase, "claims");
    // Incremental: son sync 7 günden yeniyse sadece son 7 günü çek
    const isIncremental = lastSync && (now - lastSync < 7 * 24 * 60 * 60 * 1000);

    const chunks: { start: number; end: number }[] = [];

    if (isIncremental) {
      // Son 7 gün — durum değişikliklerini (Accepted, Rejected, Cancelled) yakalar
      chunks.push({ start: now - 7 * DAY_MS, end: now });
    } else {
      // Full sweep: 90 gün, 30'ar günlük parçalar
      const CHUNKS = 3;
      const CHUNK_MS = 30 * DAY_MS;
      for (let i = 0; i < CHUNKS; i++) {
        chunks.push({
          start: now - (i + 1) * CHUNK_MS,
          end: now - i * CHUNK_MS,
        });
      }
    }

    let requestCount = 0;

    for (const chunk of chunks) {
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        if (requestCount > 0 && requestCount % 40 === 0) {
          await sleep(10_000);
        }

        const result = await getClaims({
          startDate: chunk.start,
          endDate: chunk.end,
          page,
          size: 200,
        });
        requestCount++;

        // Debug: ilk sayfada ilk claim'in yapısını logla
        if (page === 0 && result.content.length > 0) {
          const sample = result.content[0];
          console.log("[Trendyol Claims] API sample:", JSON.stringify(sample, null, 2));
        }

        if (result.content.length === 0) break;

        const rows = result.content.map(mapClaimToRow);
        const { error: err } = await supabase
          .from("trendyol_claims")
          .upsert(rows, { onConflict: "id" });

        if (err) throw new Error(`Claims upsert failed: ${err.message}`);

        totalSynced += result.content.length;
        page++;
        hasMore = page < result.totalPages;
      }
    }

    await completeSyncLog(supabase, logId, totalSynced);
    return { synced: totalSynced };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await completeSyncLog(supabase, logId, totalSynced, msg);
    return { synced: totalSynced, error: msg };
  }
}

// ─── On-Demand Quick Sync ────────────────────────────────
// Dashboard sayfası açıldığında çağrılır.
// Son 5 dk içinde sync yapılmışsa tekrar yapmaz (rate limit koruması).
// Sadece son 2 günü tarar — hızlı (1-3 sn).

export async function quickSyncRecentOrders(): Promise<void> {
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Skip if synced within last 5 minutes
  const lastSync = await getLastSyncTime(adminSupabase, "orders");
  if (lastSync && Date.now() - lastSync < 5 * 60 * 1000) {
    return; // Already fresh
  }

  const now = Date.now();
  const DAY_MS = 86_400_000;
  const logId = await createSyncLog(adminSupabase, "orders");
  let totalSynced = 0;

  try {
    // Only fetch last 2 days
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await getOrders({
        startDate: now - 2 * DAY_MS,
        endDate: now,
        page,
        size: 200,
        orderByField: "PackageLastModifiedDate",
        orderByDirection: "DESC",
      });

      if (result.content.length === 0) break;

      // Upsert orders
      const orderRows = result.content.map(mapOrderToRow);
      await adminSupabase
        .from("trendyol_orders")
        .upsert(orderRows, { onConflict: "id" });

      // Upsert order lines
      const allLineRows: ReturnType<typeof mapOrderLineToRow>[] = [];
      for (const order of result.content) {
        for (const l of order.lines) {
          allLineRows.push(mapOrderLineToRow(l, order.shipmentPackageId));
        }
      }
      for (let i = 0; i < allLineRows.length; i += 500) {
        const batch = allLineRows.slice(i, i + 500);
        await adminSupabase
          .from("trendyol_order_lines")
          .upsert(batch, { onConflict: "id" });
      }

      totalSynced += result.content.length;
      page++;
      hasMore = page < result.totalPages;
    }

    await completeSyncLog(adminSupabase, logId, totalSynced);
  } catch (e) {
    // Hata mesajını sync_log'a kaydet — UI'da görünür hale getir
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Trendyol QuickSync]", msg);
    try {
      await completeSyncLog(adminSupabase, logId, totalSynced, msg);
    } catch {
      // DB write de başarısız — yapacak bir şey yok
    }
  }
}
