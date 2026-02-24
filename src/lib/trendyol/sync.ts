/**
 * Trendyol Sync Layer — Server-only
 * Cron endpoint'leri tarafından çağrılır.
 * API'den veri çeker, Supabase'e upsert eder.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TrendyolOrder,
  TrendyolOrderLine,
  TrendyolProduct,
  TrendyolQuestion,
  TrendyolSettlement,
} from "./types";
import {
  getOrders,
  getProducts,
  getQuestions,
  getSettlements,
  isUsingMockData,
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
    commission: line.commission || null,
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
  if (isUsingMockData()) {
    return { synced: 0, error: "Mock mode active — skipping sync" };
  }

  const logId = await createSyncLog(supabase, "orders");
  let totalSynced = 0;

  try {
    // Get last sync time, default to 30 days ago
    const lastSync = await getLastSyncTime(supabase, "orders");
    const startDate = lastSync || daysAgoTimestamp(30);
    const endDate = endOfTodayTimestamp();

    let page = 0;
    let hasMore = true;
    let requestCount = 0;

    while (hasMore) {
      // Rate limit: pause every 40 requests
      if (requestCount > 0 && requestCount % 40 === 0) {
        await sleep(10_000);
      }

      const result = await getOrders({
        startDate,
        endDate,
        page,
        size: 200,
        orderByField: "PackageLastModifiedDate",
        orderByDirection: "DESC",
      });
      requestCount++;

      if (result.content.length === 0) break;

      // Upsert orders
      const orderRows = result.content.map(mapOrderToRow);
      const { error: orderErr } = await supabase
        .from("trendyol_orders")
        .upsert(orderRows, { onConflict: "id" });

      if (orderErr) throw new Error(`Order upsert failed: ${orderErr.message}`);

      // Upsert order lines — delete existing first, then insert
      for (const order of result.content) {
        if (order.lines.length === 0) continue;

        // Delete existing lines for this order
        await supabase
          .from("trendyol_order_lines")
          .delete()
          .eq("order_id", order.shipmentPackageId);

        // Insert new lines
        const lineRows = order.lines.map((l) =>
          mapOrderLineToRow(l, order.shipmentPackageId)
        );
        const { error: lineErr } = await supabase
          .from("trendyol_order_lines")
          .insert(lineRows);

        if (lineErr) {
          console.warn(`[Trendyol Sync] Order line insert failed for ${order.shipmentPackageId}: ${lineErr.message}`);
        }
      }

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

export async function syncProducts(
  supabase: SupabaseClient
): Promise<{ synced: number; error?: string }> {
  if (isUsingMockData()) {
    return { synced: 0, error: "Mock mode active — skipping sync" };
  }

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
  if (isUsingMockData()) {
    return { synced: 0, error: "Mock mode active — skipping sync" };
  }

  const logId = await createSyncLog(supabase, "questions");
  let totalSynced = 0;

  try {
    // Last 30 days of questions
    const startDate = daysAgoTimestamp(30);
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
  if (isUsingMockData()) {
    return { synced: 0, error: "Mock mode active — skipping sync" };
  }

  const logId = await createSyncLog(supabase, "settlements");
  let totalSynced = 0;

  try {
    // Trendyol finance API: max 15-day range per request
    // Sync last 30 days in 15-day chunks
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86_400_000;

    const allTypes = "Sale,Return,Discount,DiscountCancel,Coupon,CouponCancel,CommissionPositive,CommissionNegative,TYDiscount,TYDiscountCancel,SellerRevenuePositive,SellerRevenueNegative";

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
          transactionType: allTypes,
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
