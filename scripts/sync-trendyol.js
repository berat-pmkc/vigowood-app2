/**
 * One-time Trendyol sync script
 * Usage: node scripts/sync-trendyol.js
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const sid = process.env.TRENDYOL_SELLER_ID;
const auth =
  "Basic " +
  Buffer.from(
    process.env.TRENDYOL_API_KEY + ":" + process.env.TRENDYOL_API_SECRET
  ).toString("base64");
const hdr = {
  Authorization: auth,
  "User-Agent": sid + " - SelfIntegration",
  "Content-Type": "application/json",
};
const BASE = "https://apigw.trendyol.com/integration";

async function syncProducts() {
  console.log("--- PRODUCTS SYNC ---");
  let page = 0,
    total = 0,
    hasMore = true;
  while (hasMore) {
    const r = await fetch(
      `${BASE}/product/sellers/${sid}/products?page=${page}&size=200`,
      { headers: hdr }
    );
    const d = await r.json();
    if (d.content == null || d.content.length === 0) break;
    const rows = d.content.map((p) => ({
      id: p.id,
      barcode: p.barcode,
      title: p.title,
      description: p.description || null,
      product_main_id: p.productMainId || null,
      brand: p.brand || null,
      brand_id: p.brandId || null,
      category_name: p.categoryName || null,
      category_id: p.categoryId || null,
      quantity: p.quantity,
      stock_code: p.stockCode || null,
      dimensional_weight: p.dimensionalWeight || null,
      list_price: p.listPrice,
      sale_price: p.salePrice,
      vat_rate: p.vatRate || null,
      images: p.images || null,
      attributes: p.attributes || null,
      approved: p.approved || false,
      archived: p.archived || false,
      on_sale: (p.onSale || p.onsale) || false,
      locked: p.locked || false,
      rejected: p.rejected || false,
      blacklisted: p.blacklisted || false,
      create_date_time: p.createDateTime || null,
      last_update_date: p.lastUpdateDate || null,
    }));
    const { error } = await sb
      .from("trendyol_products")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.error("Product upsert err:", error.message);
      break;
    }
    total += d.content.length;
    page++;
    hasMore = page < d.totalPages;
  }
  console.log("Products synced:", total);
  return total;
}

async function syncOrders() {
  console.log("--- ORDERS SYNC ---");
  const startDate = Date.now() - 30 * 86400000;
  const endDate = Date.now() + 86400000;
  let page = 0,
    total = 0,
    hasMore = true;
  while (hasMore) {
    const r = await fetch(
      `${BASE}/order/sellers/${sid}/orders?startDate=${startDate}&endDate=${endDate}&page=${page}&size=200&orderByField=PackageLastModifiedDate&orderByDirection=DESC`,
      { headers: hdr }
    );
    const d = await r.json();
    if (d.content == null || d.content.length === 0) break;
    const rows = d.content.map((o) => ({
      id: o.shipmentPackageId,
      order_number: o.orderNumber,
      customer_id: o.customerId,
      customer_first_name: o.customerFirstName,
      customer_last_name: o.customerLastName,
      customer_email: o.customerEmail || null,
      gross_amount: o.grossAmount,
      total_discount: o.totalDiscount,
      total_price: o.totalPrice,
      status: o.status,
      shipment_address: o.shipmentAddress,
      invoice_address: o.invoiceAddress,
      cargo_tracking_number: o.cargoTrackingNumber || null,
      cargo_tracking_link: o.cargoTrackingLink || null,
      cargo_provider_name: o.cargoProviderName || null,
      cargo_sender_number: o.cargoSenderNumber || null,
      delivery_type: o.deliveryType || null,
      order_date: o.orderDate,
      last_modified_date: o.lastModifiedDate,
      package_histories: o.packageHistories || null,
      raw_data: {
        commercial: o.commercial,
        fastDelivery: o.fastDelivery,
      },
    }));
    const { error } = await sb
      .from("trendyol_orders")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.error("Order upsert err:", error.message);
      break;
    }
    // Order lines
    for (const o of d.content) {
      if (o.lines == null || o.lines.length === 0) continue;
      await sb
        .from("trendyol_order_lines")
        .delete()
        .eq("order_id", o.shipmentPackageId);
      const lr = o.lines.map((l) => ({
        id: l.id,
        order_id: o.shipmentPackageId,
        line_id: l.lineId || null,
        quantity: l.quantity,
        merchant_sku: l.merchantSku,
        sku: l.sku || null,
        stock_code: l.stockCode || null,
        product_name: l.productName,
        barcode: l.barcode,
        amount: l.amount,
        discount: l.discount,
        currency_code: l.currencyCode,
        vat_base_amount: l.vatBaseAmount,
        vat_rate: l.vatRate || null,
        price: l.price,
        status_name: l.orderLineItemStatusName,
        commission: l.commission || null,
        product_size: l.productSize || null,
        product_color: l.productColor || null,
        image_url: l.imageUrl || null,
      }));
      const { error: lineErr } = await sb
        .from("trendyol_order_lines")
        .insert(lr);
      if (lineErr) {
        console.warn(
          `  Line insert warn (${o.shipmentPackageId}):`,
          lineErr.message
        );
      }
    }
    total += d.content.length;
    console.log(`  Page ${page}: ${d.content.length} orders`);
    page++;
    hasMore = page < d.totalPages;
  }
  console.log("Orders synced:", total);
  return total;
}

async function syncQuestions() {
  console.log("--- QUESTIONS SYNC ---");
  const startDate = Date.now() - 30 * 86400000;
  const endDate = Date.now() + 86400000;
  let page = 0,
    total = 0,
    hasMore = true;
  while (hasMore) {
    const r = await fetch(
      `${BASE}/qna/sellers/${sid}/questions/filter?supplierId=${sid}&startDate=${startDate}&endDate=${endDate}&page=${page}&size=200`,
      { headers: hdr }
    );
    const d = await r.json();
    if (d.content == null || d.content.length === 0) break;
    const rows = d.content.map((q) => ({
      id: q.id,
      text: q.text,
      status: q.status,
      creation_date: q.creationDate,
      customer_id: q.customerId,
      user_name: q.userName || null,
      product_name: q.productName || null,
      product_main_id: q.productMainId || null,
      image_url: q.imageUrl || null,
      public: q.public != null ? q.public : true,
      answer_text: q.answer ? q.answer.text : null,
      answer_date: q.answer ? q.answer.creationDate : null,
      rejected_answer_text: q.rejectedAnswer ? q.rejectedAnswer.text : null,
      rejected_answer_reason: q.rejectedAnswer
        ? q.rejectedAnswer.reason
        : null,
      web_url: q.webUrl || null,
    }));
    const { error } = await sb
      .from("trendyol_questions")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.error("Question upsert err:", error.message);
      break;
    }
    total += d.content.length;
    page++;
    hasMore = page < d.totalPages;
  }
  console.log("Questions synced:", total);
  return total;
}

async function syncSettlements() {
  console.log("--- SETTLEMENTS SYNC ---");
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86400000;
  const chunks = [
    { start: thirtyDaysAgo, end: thirtyDaysAgo + 15 * 86400000 },
    { start: thirtyDaysAgo + 15 * 86400000, end: now },
  ];
  let total = 0;
  for (const chunk of chunks) {
    let page = 0,
      hasMore = true;
    while (hasMore) {
      const r = await fetch(
        `${BASE}/finance/che/sellers/${sid}/settlements?supplierId=${sid}&transactionType=Sale&startDate=${chunk.start}&endDate=${chunk.end}&page=${page}&size=500`,
        { headers: hdr }
      );
      const d = await r.json();
      if (d.content == null || d.content.length === 0) break;
      const rows = d.content.map((s) => ({
        id: s.id,
        transaction_date: s.transactionDate,
        transaction_type: s.transactionType,
        debt: s.debt || 0,
        credit: s.credit || 0,
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
      }));
      const { error } = await sb
        .from("trendyol_settlements")
        .upsert(rows, { onConflict: "id" });
      if (error) {
        console.error("Settlement upsert err:", error.message);
        break;
      }
      total += d.content.length;
      console.log(`  Chunk page ${page}: ${d.content.length} settlements`);
      page++;
      hasMore = page < d.totalPages;
    }
  }
  console.log("Settlements synced:", total);
  return total;
}

async function run() {
  const p = await syncProducts();
  const o = await syncOrders();
  const q = await syncQuestions();
  const s = await syncSettlements();

  // Write sync log
  await sb.from("trendyol_sync_log").insert([
    {
      entity_type: "products",
      status: "success",
      records_synced: p,
      completed_at: new Date().toISOString(),
    },
    {
      entity_type: "orders",
      status: "success",
      records_synced: o,
      completed_at: new Date().toISOString(),
    },
    {
      entity_type: "questions",
      status: "success",
      records_synced: q,
      completed_at: new Date().toISOString(),
    },
    {
      entity_type: "settlements",
      status: "success",
      records_synced: s,
      completed_at: new Date().toISOString(),
    },
  ]);

  console.log("\n=== SYNC TAMAMLANDI ===");
  console.log(
    `Products: ${p} | Orders: ${o} | Questions: ${q} | Settlements: ${s}`
  );
}

run().catch((e) => console.error("FATAL:", e.message));
