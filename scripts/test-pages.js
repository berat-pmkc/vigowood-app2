/**
 * Trendyol Pages Data Verification Script
 * Simulates what each Trendyol page server component does.
 * Uses Supabase service role key to bypass RLS.
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { console.error("ERROR: Missing env vars"); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// -- Helpers (mirrors src/lib/trendyol/helpers.ts) --

const TR_TO_EN_TYPE = {
  "Satış": "Sale",
  "İade": "Return",
  "İndirim": "Discount",
  "İndirimİptal": "DiscountCancel",
  "Kupon": "Coupon",
  "KuponİIptal": "CouponCancel",
  "KomisyonArtı": "CommissionPositive",
  "KomisyonEksi": "CommissionNegative",
  "TYİndirim": "TYDiscount",
  "TYİndirimİptal": "TYDiscountCancel",
  "SatıcıGelirArtı": "SellerRevenuePositive",
  "SatıcıGelirEksi": "SellerRevenueNegative",
};

function tsToISO(ts) {
  if (!ts) return "";
  if (ts.includes("-") || ts.includes("T")) return ts;
  const n = parseInt(ts, 10);
  if (isNaN(n)) return ts;
  return new Date(n).toISOString();
}

function daysAgoTimestamp(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfTodayTimestamp() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function formatTRY(amount) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2 }).format(amount);
}

function formatDate(ts) {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return day + "." + month + "." + year + " " + hours + ":" + minutes;
}

function aggregateSettlements(settlements) {
  let totalSales = 0, totalReturns = 0, totalCommission = 0, totalDiscount = 0, totalSellerRevenue = 0;
  for (const s of settlements) {
    const credit = s.credit || 0;
    const debt = s.debt || 0;
    switch (s.transactionType) {
      case "Sale":
        totalSales += credit;
        if (s.commissionAmount) totalCommission += s.commissionAmount;
        if (s.sellerRevenue) totalSellerRevenue += s.sellerRevenue;
        break;
      case "Return": totalReturns += debt; break;
      case "CommissionNegative": case "CommissionPositive": totalCommission += debt - credit; break;
      case "Discount": case "TYDiscount": totalDiscount += debt; break;
    }
  }
  const netAmount = totalSellerRevenue > 0 ? totalSellerRevenue - totalReturns : totalSales - totalReturns - totalCommission - totalDiscount;
  return { totalSales, totalReturns, totalCommission, totalDiscount, netAmount };
}

function sep(title) { console.log(String.fromCharCode(10) + "=".repeat(70)); console.log("  " + title); console.log("=".repeat(70)); }
function subsep(title) { console.log(String.fromCharCode(10) + "  --- " + title + " ---"); }

// -- Test Functions --

async function testTableExistence() {
  sep("TABLE EXISTENCE CHECK");
  const tables = ["trendyol_orders","trendyol_order_lines","trendyol_products","trendyol_questions","trendyol_settlements","trendyol_sync_log"];
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) console.log("  [" + table + "] ERROR: " + error.message);
    else console.log("  [" + table + "] OK - " + count + " rows");
  }
}

async function testSyncLog() {
  sep("SYNC STATUS (trendyol_sync_log)");
  const entities = ["orders", "products", "questions", "settlements"];
  for (const entity of entities) {
    const { data, error } = await supabase.from("trendyol_sync_log")
      .select("entity_type, status, completed_at, records_synced, error_message")
      .eq("entity_type", entity).order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (error) { console.log("  [" + entity + "] ERROR: " + error.message); continue; }
    if (!data) { console.log("  [" + entity + "] Never synced"); continue; }
    const ago = data.completed_at ? Math.round((Date.now() - new Date(data.completed_at).getTime()) / 60000) + " min ago" : "N/A";
    console.log("  [" + entity + "] Status: " + data.status + " | Records: " + data.records_synced + " | Last: " + ago);
    if (data.error_message) console.log("           Error: " + data.error_message);
  }
}

async function testOrders() {
  sep("PAGE: /pazaryeri/trendyol/siparisler");
  const startDate = daysAgoTimestamp(30);
  const endDate = endOfTodayTimestamp();
  const { data: orderRows, count, error } = await supabase.from("trendyol_orders")
    .select("*", { count: "exact" }).gte("order_date", startDate).lte("order_date", endDate)
    .order("order_date", { ascending: false }).range(0, 49);
  if (error) { console.log("  ERROR: " + error.message); return; }
  console.log("  Total orders (last 30 days): " + count);
  console.log("  Fetched page 0: " + (orderRows || []).length + " rows");
  if (!orderRows || orderRows.length === 0) { console.log("  WARNING: No orders found. Page shows empty state."); return; }

  const statusCounts = {};
  for (const o of orderRows) { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; }
  subsep("Status Distribution (page 0)");
  for (const [status, cnt] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) { console.log("    " + status + ": " + cnt); }

  const sample = orderRows[0];
  subsep("Latest Order Sample");
  console.log("    Order#: " + sample.order_number);
  console.log("    Status: " + sample.status);
  console.log("    Date: " + formatDate(sample.order_date));
  console.log("    Customer: " + (sample.customer_first_name || "") + " " + (sample.customer_last_name || ""));
  console.log("    Gross: " + formatTRY(sample.gross_amount) + " | Total: " + formatTRY(sample.total_price));

  const { data: lines } = await supabase.from("trendyol_order_lines").select("*").eq("order_id", sample.id);
  console.log("    Lines: " + (lines || []).length);
  if (lines && lines.length > 0) { const l = lines[0]; console.log("      [0] " + l.product_name + " | Qty: " + l.quantity + " | " + formatTRY(l.amount)); }

  const oldest = orderRows[orderRows.length - 1];
  console.log(String.fromCharCode(10) + "  Date range: " + formatDate(oldest.order_date) + " - " + formatDate(sample.order_date));
}

async function testProducts() {
  sep("PAGE: /pazaryeri/trendyol/urunler");
  const { data, count, error } = await supabase.from("trendyol_products")
    .select("*", { count: "exact" }).order("last_update_date", { ascending: false, nullsFirst: false }).range(0, 49);
  if (error) { console.log("  ERROR: " + error.message); return; }
  console.log("  Total products: " + count);
  console.log("  Fetched page 0: " + (data || []).length + " rows");
  if (!data || data.length === 0) { console.log("  WARNING: No products found. Page shows empty state."); return; }

  let approved = 0, onSale = 0, noStock = 0, archived = 0, rejected = 0;
  for (const p of data) { if (p.approved) approved++; if (p.on_sale) onSale++; if (p.quantity === 0) noStock++; if (p.archived) archived++; if (p.rejected) rejected++; }
  subsep("Product Stats (page 0)");
  console.log("    Approved: " + approved + " | On Sale: " + onSale + " | No Stock: " + noStock);
  console.log("    Archived: " + archived + " | Rejected: " + rejected);

  const prices = data.map(p => p.sale_price).filter(p => p > 0);
  if (prices.length > 0) console.log("    Price range: " + formatTRY(Math.min(...prices)) + " - " + formatTRY(Math.max(...prices)));

  const sample = data[0];
  subsep("Latest Updated Product Sample");
  console.log("    ID: " + sample.id);
  console.log("    Title: " + (sample.title || "").substring(0, 80) + "...");
  console.log("    Barcode: " + sample.barcode);
  console.log("    Stock: " + sample.quantity + " | List: " + formatTRY(sample.list_price) + " | Sale: " + formatTRY(sample.sale_price));
  console.log("    Approved: " + sample.approved + " | On Sale: " + sample.on_sale);
  console.log("    Images: " + (sample.images || []).length);
}

async function testQuestions() {
  sep("PAGE: /pazaryeri/trendyol/sorular");
  const { data, count, error } = await supabase.from("trendyol_questions")
    .select("*", { count: "exact" }).order("creation_date", { ascending: false }).range(0, 49);
  if (error) { console.log("  ERROR: " + error.message); return; }
  console.log("  Total questions: " + count);
  console.log("  Fetched page 0: " + (data || []).length + " rows");
  if (!data || data.length === 0) { console.log("  WARNING: No questions found. Page shows empty state."); return; }

  const statusCounts = {};
  for (const q of data) { statusCounts[q.status] = (statusCounts[q.status] || 0) + 1; }
  subsep("Status Distribution (page 0)");
  for (const [status, cnt] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) { console.log("    " + status + ": " + cnt); }

  const sample = data[0];
  subsep("Latest Question Sample");
  console.log("    ID: " + sample.id);
  console.log("    Status: " + sample.status);
  console.log("    Date: " + formatDate(sample.creation_date));
  console.log("    Text: " + (sample.text || "").substring(0, 100));
  console.log("    Product: " + (sample.product_name || "N/A").substring(0, 60));
  console.log("    Has Answer: " + (!!sample.answer_text));
}

async function testSettlements() {
  sep("PAGE: /pazaryeri/trendyol/finans");
  const startDate = daysAgoTimestamp(30);
  const endDate = endOfTodayTimestamp();
  const { data, count, error } = await supabase.from("trendyol_settlements")
    .select("*", { count: "exact" }).gte("transaction_date", String(startDate)).lte("transaction_date", String(endDate))
    .order("transaction_date", { ascending: false }).range(0, 499);
  if (error) { console.log("  ERROR: " + error.message); return; }
  console.log("  Total settlements (last 30 days): " + count);
  console.log("  Fetched: " + (data || []).length + " rows");
  if (!data || data.length === 0) { console.log("  WARNING: No settlements found. Page shows empty state."); return; }

  const mapped = data.map(row => {
    const enType = TR_TO_EN_TYPE[row.transaction_type] || row.transaction_type;
    return { id: row.id, transactionDate: tsToISO(row.transaction_date), transactionType: enType,
      debt: row.debt, credit: row.credit, commissionAmount: row.commission_amount,
      sellerRevenue: row.seller_revenue, orderNumber: row.order_number, barcode: row.barcode,
      receiptId: row.receipt_id, paymentDate: tsToISO(row.payment_date) };
  });

  const typeCounts = {};
  for (const s of mapped) { typeCounts[s.transactionType] = (typeCounts[s.transactionType] || 0) + 1; }
  subsep("Transaction Type Distribution (after TR->EN mapping)");
  for (const [type, cnt] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) { console.log("    " + type + ": " + cnt); }

  const knownTypes = ["Sale","Return","Discount","DiscountCancel","Coupon","CouponCancel","CommissionPositive","CommissionNegative","TYDiscount","TYDiscountCancel","SellerRevenuePositive","SellerRevenueNegative","ProvisionPositive","ProvisionNegative","ManualRefund","ManualRefundCancel","TYCoupon","TYCouponCancel"];
  const unmapped = Object.keys(typeCounts).filter(t => !knownTypes.includes(t));
  if (unmapped.length > 0) { console.log(String.fromCharCode(10) + "  WARNING: Unmapped transaction types: " + unmapped.join(", ")); }

  const summary = aggregateSettlements(mapped);
  subsep("Aggregated Summary (as shown on Finans page)");
  console.log("    Total Sales:      " + formatTRY(summary.totalSales));
  console.log("    Total Returns:    " + formatTRY(summary.totalReturns));
  console.log("    Total Commission: " + formatTRY(summary.totalCommission));
  console.log("    Total Discount:   " + formatTRY(summary.totalDiscount));
  console.log("    Net Amount:       " + formatTRY(summary.netAmount));

  const monthlyMap = new Map();
  for (const s of mapped) { const month = s.transactionDate.substring(0, 7); if (!monthlyMap.has(month)) monthlyMap.set(month, []); monthlyMap.get(month).push(s); }
  const monthlyData = Array.from(monthlyMap.entries()).map(([month, items]) => ({ month, ...aggregateSettlements(items) })).sort((a, b) => a.month.localeCompare(b.month));
  subsep("Monthly Breakdown (chart data)");
  for (const m of monthlyData) { console.log("    " + m.month + ": Sales=" + formatTRY(m.totalSales) + " | Returns=" + formatTRY(m.totalReturns) + " | Net=" + formatTRY(m.netAmount)); }

  const sample = mapped[0];
  subsep("Latest Settlement Sample");
  console.log("    ID: " + sample.id);
  console.log("    Type: " + sample.transactionType);
  console.log("    Date: " + sample.transactionDate);
  console.log("    Credit: " + formatTRY(sample.credit || 0) + " | Debt: " + formatTRY(sample.debt || 0));
  console.log("    Order#: " + (sample.orderNumber || "N/A"));

  subsep("Date Conversion Validation");
  let isoOk = 0, isoBad = 0;
  for (const s of mapped) {
    if (s.transactionDate && /^\d{4}-\d{2}-\d{2}T/.test(s.transactionDate)) isoOk++;
    else if (s.transactionDate) isoBad++;
  }
  console.log("    Valid ISO dates: " + isoOk + " | Invalid: " + isoBad);
  if (isoBad > 0) { const bad = mapped.find(s => s.transactionDate && !/^\d{4}-\d{2}-\d{2}T/.test(s.transactionDate)); if (bad) console.log("    Bad date sample: " + bad.transactionDate); }
}

// -- Main --
async function main() {
  console.log("=".repeat(70));
  console.log("  TRENDYOL PAGES DATA VERIFICATION");
  console.log("  Supabase: " + SUPABASE_URL);
  console.log("  Time: " + new Date().toISOString());
  console.log("=".repeat(70));
  const start = Date.now();
  await testTableExistence();
  await testSyncLog();
  await testOrders();
  await testProducts();
  await testQuestions();
  await testSettlements();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  sep("SUMMARY");
  console.log("  All checks completed in " + elapsed + "s");
  console.log("  WARNING = page shows empty state (valid, just no synced data).");
  console.log("  ERROR = page will likely fail to render.");
  console.log("");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
