import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLastSyncInfo, getActiveClaimsCount } from "@/lib/trendyol/queries";
import { quickSyncRecentOrders } from "@/lib/trendyol/sync";
import { TrendyolDashboard } from "./components/trendyol-dashboard";

export const metadata: Metadata = { title: "Trendyol — Dashboard" };

interface PageProps {
  searchParams: Promise<{ ay?: string }>;
}

// Turkey is UTC+3
const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Convert ms timestamp to Turkey date key: YYYY-MM-DD */
function tsToTRDateKey(ts: number): string {
  const d = new Date(ts + TURKEY_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Get current year-month in Turkey: YYYY-MM */
function currentMonthKeyTR(): string {
  const d = new Date(Date.now() + TURKEY_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Get today's date key in Turkey */
function todayKeyTR(): string {
  const d = new Date(Date.now() + TURKEY_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Get date key N days ago in Turkey */
function daysAgoKeyTR(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000 + TURKEY_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Get start of month in UTC ms (for DB query) */
function monthStartMs(year: number, month: number): number {
  // 1st day of month, 00:00:00 Turkey time
  return Date.UTC(year, month - 1, 1) - TURKEY_OFFSET_MS;
}

/** Get end of month in UTC ms (for DB query) */
function monthEndMs(year: number, month: number): number {
  // Last day of month, 23:59:59.999 Turkey time
  return Date.UTC(year, month, 1) - TURKEY_OFFSET_MS - 1;
}

interface OrderRow {
  id: number;
  order_date: number;
  status: string;
  total_price: number;
}

interface OrderLineRow {
  order_id: number;
  barcode: string | null;
  product_name: string;
  quantity: number;
  amount: number;
}

export default async function TrendyolDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as SupabaseClient<any>;

  // ─── Month selection ────────────────────────────────
  const currentMonth = currentMonthKeyTR();
  const selectedMonth = params.ay && /^\d{4}-\d{2}$/.test(params.ay) ? params.ay : currentMonth;
  const isCurrentMonth = selectedMonth === currentMonth;

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const startMs = monthStartMs(selYear, selMonth);
  const endMs = isCurrentMonth ? Date.now() : monthEndMs(selYear, selMonth);

  // ─── On-demand sync: fetch latest orders from Trendyol API ───
  // Runs only if last sync was >5 min ago. Fast (1-3 sec, last 2 days only).
  if (isCurrentMonth) {
    await quickSyncRecentOrders();
  }

  // ─── Parallel data fetches ──────────────────────────
  // 1. All orders in selected month (paginated to avoid truncation)
  const allOrders: OrderRow[] = [];
  const PAGE_SIZE = 1000; // Supabase max rows per request
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from("trendyol_orders")
      .select("id, order_date, status, total_price")
      .gte("order_date", startMs)
      .lte("order_date", endMs)
      .order("order_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const rows = (data || []) as OrderRow[];
    allOrders.push(...rows);
    hasMore = rows.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  // 2. Order lines for all fetched orders (for product aggregation)
  const orderIds = allOrders.map((o) => o.id);
  let allLines: OrderLineRow[] = [];
  if (orderIds.length > 0) {
    // Batch query in chunks of 500
    for (let i = 0; i < orderIds.length; i += 500) {
      const chunk = orderIds.slice(i, i + 500);
      const { data } = await supabase
        .from("trendyol_order_lines")
        .select("order_id, barcode, product_name, quantity, amount")
        .in("order_id", chunk);
      allLines.push(...((data || []) as OrderLineRow[]));
    }
  }

  // 3. Products count + questions count + claims count + last sync
  const [productsResult, questionsResult, syncInfo, activeClaimsCount] = await Promise.all([
    supabase
      .from("trendyol_products")
      .select("id, quantity", { count: "exact" }),
    supabase
      .from("trendyol_questions")
      .select("id", { count: "exact" })
      .eq("status", "WAITING_FOR_ANSWER"),
    getLastSyncInfo(),
    getActiveClaimsCount(),
  ]);

  const totalProducts = productsResult.count || 0;
  const productRows = (productsResult.data || []) as { id: string; quantity: number }[];
  const outOfStockCount = productRows.filter((p) => p.quantity === 0).length;
  const pendingQuestions = questionsResult.count || 0;
  const lastSyncAt = syncInfo.lastSuccessAt;
  const lastSyncError = syncInfo.lastErrorMsg;

  // ─── Turkey-aware date keys ──────────────────────────
  const todayKey = todayKeyTR();
  const weekAgoKey = daysAgoKeyTR(7);

  // ─── Revenue-eligible orders (exclude Cancelled, Returned, UnSupplied) ───
  const EXCLUDED_STATUSES = new Set(["Cancelled", "Returned", "UnSupplied"]);
  const activeOrders = allOrders.filter((o) => !EXCLUDED_STATUSES.has(o.status));

  // ─── KPIs ───────────────────────────────────────────
  const todayActiveOrders = activeOrders.filter((o) => tsToTRDateKey(o.order_date) === todayKey);
  const todayCiro = todayActiveOrders.reduce((s, o) => s + o.total_price, 0);
  const todayOrderCount = todayActiveOrders.length;

  const weekActiveOrders = activeOrders.filter((o) => tsToTRDateKey(o.order_date) >= weekAgoKey);
  const weekCiro = weekActiveOrders.reduce((s, o) => s + o.total_price, 0);
  const weekOrderCount = weekActiveOrders.length;

  const monthCiro = activeOrders.reduce((s, o) => s + o.total_price, 0);

  const kpi = {
    todayOrderCount,
    todayCiro,
    weekOrderCount,
    weekCiro,
    monthOrderCount: activeOrders.length,
    monthCiro,
    totalOrderCount: allOrders.length,
    pendingCount: allOrders.filter(
      (o) => o.status === "Created" || o.status === "Picking" || o.status === "Invoiced"
    ).length,
    cancelledCount: allOrders.filter(
      (o) => o.status === "Cancelled" || o.status === "Returned" || o.status === "UnSupplied"
    ).length,
    totalProducts,
    outOfStockCount,
    pendingQuestions,
    activeClaimsCount,
  };

  // ─── Monthly trend (day by day) ─────────────────────
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const trendMap = new Map<string, { date: string; orders: number; ciro: number }>();

  const nowTR = new Date(Date.now() + TURKEY_OFFSET_MS);
  const maxDay = isCurrentMonth ? nowTR.getUTCDate() : daysInMonth;

  for (let day = 1; day <= maxDay; day++) {
    const key = `${selYear}-${String(selMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayLabel = `${String(day).padStart(2, "0")}.${String(selMonth).padStart(2, "0")}`;
    trendMap.set(key, { date: dayLabel, orders: 0, ciro: 0 });
  }
  for (const order of activeOrders) {
    const key = tsToTRDateKey(order.order_date);
    const entry = trendMap.get(key);
    if (entry) {
      entry.orders++;
      entry.ciro += order.total_price;
    }
  }
  const trendData = Array.from(trendMap.values());

  // ─── Order status distribution ──────────────────────
  const statusDistribution: Record<string, number> = {};
  for (const order of allOrders) {
    statusDistribution[order.status] = (statusDistribution[order.status] || 0) + 1;
  }

  // ─── Top selling products (barcode aggregation) ─────
  // Build a map from orderId to order for fast lookup
  const orderMap = new Map(allOrders.map((o) => [o.id, o]));
  // Only include lines from active (non-cancelled/returned) orders
  const activeOrderIds = new Set(activeOrders.map((o) => o.id));
  const activeLines = allLines.filter((l) => activeOrderIds.has(l.order_id));
  const barcodeMap = new Map<string, { barcode: string; name: string; quantity: number; revenue: number }>();

  for (const line of activeLines) {
    const barcode = line.barcode || "N/A";
    const existing = barcodeMap.get(barcode) || { barcode, name: line.product_name, quantity: 0, revenue: 0 };
    existing.quantity += line.quantity;
    existing.revenue += line.amount;
    barcodeMap.set(barcode, existing);
  }

  const topProducts = Array.from(barcodeMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ─── Barcode daily data for filterable chart ────────
  const allDailyMap = new Map<string, { orders: number; revenue: number }>();
  const barcodeDailyMap = new Map<string, Map<string, { orders: number; revenue: number }>>();

  for (const line of activeLines) {
    const order = orderMap.get(line.order_id);
    if (!order) continue;
    const dayKey = tsToTRDateKey(order.order_date);

    // All aggregate
    const allExisting = allDailyMap.get(dayKey) || { orders: 0, revenue: 0 };
    allExisting.orders += line.quantity;
    allExisting.revenue += line.amount;
    allDailyMap.set(dayKey, allExisting);

    // Per-barcode
    const barcode = line.barcode || "N/A";
    if (!barcodeDailyMap.has(barcode)) barcodeDailyMap.set(barcode, new Map());
    const dayMap = barcodeDailyMap.get(barcode)!;
    const existing = dayMap.get(dayKey) || { orders: 0, revenue: 0 };
    existing.orders += line.quantity;
    existing.revenue += line.amount;
    dayMap.set(dayKey, existing);
  }

  // Convert to serializable format
  const barcodeDailyData: Record<string, { date: string; orders: number; revenue: number }[]> = {};

  function buildDayEntries(dataMap: Map<string, { orders: number; revenue: number }>) {
    const entries: { date: string; orders: number; revenue: number }[] = [];
    for (let day = 1; day <= maxDay; day++) {
      const key = `${selYear}-${String(selMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayLabel = `${String(day).padStart(2, "0")}.${String(selMonth).padStart(2, "0")}`;
      const data = dataMap.get(key) || { orders: 0, revenue: 0 };
      entries.push({ date: dayLabel, ...data });
    }
    return entries;
  }

  barcodeDailyData["TÜMÜ"] = buildDayEntries(allDailyMap);

  for (const [barcode, dayMap] of barcodeDailyMap) {
    barcodeDailyData[barcode] = buildDayEntries(dayMap);
  }

  const availableBarcodes = [
    { barcode: "TÜMÜ", name: "Tüm Ürünler (Toplam)" },
    ...Array.from(barcodeMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((s) => ({ barcode: s.barcode, name: s.name })),
  ];

  // ─── Available months (last 12 months) ──────────────
  const months: { value: string; label: string }[] = [];
  const AY_LABELS = [
    "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  const nowYear = nowTR.getUTCFullYear();
  const nowMonthNum = nowTR.getUTCMonth() + 1;

  for (let i = 0; i < 12; i++) {
    let m = nowMonthNum - i;
    let y = nowYear;
    if (m <= 0) { m += 12; y--; }
    const val = `${y}-${String(m).padStart(2, "0")}`;
    months.push({ value: val, label: `${AY_LABELS[m]} ${y}` });
  }

  return (
    <TrendyolDashboard
      kpi={kpi}
      trendData={trendData}
      statusDistribution={statusDistribution}
      topProducts={topProducts}
      barcodeDailyData={barcodeDailyData}
      availableBarcodes={availableBarcodes}
      selectedMonth={selectedMonth}
      months={months}
      isCurrentMonth={isCurrentMonth}
      lastSyncAt={lastSyncAt}
      lastSyncError={lastSyncError}
    />
  );
}
