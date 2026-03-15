import type { Metadata } from "next";
import { getOrders, getAllOrders, getProducts, getCustomers, isUsingMockData } from "@/lib/ikas/client";
import {
  startOfTodayISO,
  endOfTodayISO,
  daysAgoISO,
  monthStartISO,
  monthEndISO,
  currentMonthKey,
  todayKeyTR,
  orderDateKeyTR,
} from "@/lib/ikas/helpers";
import { VigowoodDashboard } from "./components/vigowood-dashboard";

export const metadata: Metadata = { title: "vigowood.com — Dashboard" };

interface PageProps {
  searchParams: Promise<{ ay?: string }>;
}

export default async function VigowoodDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isMock = isUsingMockData();

  try {
  // ─── Month selection ────────────────────────────────
  const currentMonth = currentMonthKey(); // e.g. "2026-02"
  const selectedMonth = params.ay && /^\d{4}-\d{2}$/.test(params.ay) ? params.ay : currentMonth;
  const isCurrentMonth = selectedMonth === currentMonth;

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const monthStart = monthStartISO(selYear, selMonth);
  const monthEnd = isCurrentMonth ? endOfTodayISO() : monthEndISO(selYear, selMonth);

  // ─── Parallel data fetches ──────────────────────────
  const fetchPromises: [
    ReturnType<typeof getOrders>,
    ReturnType<typeof getOrders>,
    ReturnType<typeof getAllOrders>,
    ReturnType<typeof getProducts>,
    ReturnType<typeof getCustomers>,
  ] = [
    // Today count (always current day)
    getOrders({
      startDate: startOfTodayISO(),
      endDate: endOfTodayISO(),
      limit: 1,
      sort: "orderedAt:desc",
    }),
    // Week count (always current week)
    getOrders({
      startDate: daysAgoISO(7),
      endDate: endOfTodayISO(),
      limit: 1,
      sort: "orderedAt:desc",
    }),
    // Selected month orders (all pages)
    getAllOrders({
      startDate: monthStart,
      endDate: monthEnd,
      sort: "orderedAt:desc",
    }),
    getProducts({ limit: 200 }),
    getCustomers({ limit: 1, sort: "lastOrderDate:desc" }),
  ];

  const [todayResult, weekResult, allMonthOrders, products, customers] = await Promise.all(fetchPromises);

  // ─── Turkey-aware date keys ──────────────────────────
  const todayKey = todayKeyTR();
  const weekAgoKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const parts = todayKeyTR(); // reuse format
    // recalculate for 7 days ago
    const TURKEY_OFFSET_MS = 3 * 60 * 60 * 1000;
    const t = new Date(Date.now() - 7 * 86_400_000 + TURKEY_OFFSET_MS);
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
  })();

  // ─── KPIs ───────────────────────────────────────────
  const todayCiro = allMonthOrders
    .filter((o) => orderDateKeyTR(o.orderedAt) === todayKey)
    .reduce((s, o) => s + o.totalFinalPrice, 0);

  const weekCiro = allMonthOrders
    .filter((o) => orderDateKeyTR(o.orderedAt) >= weekAgoKey)
    .reduce((s, o) => s + o.totalFinalPrice, 0);

  const monthCiro = allMonthOrders.reduce((s, o) => s + o.totalFinalPrice, 0);

  const kpi = {
    todayOrderCount: todayResult.count,
    todayCiro,
    weekOrderCount: weekResult.count,
    weekCiro,
    monthOrderCount: allMonthOrders.length,
    monthCiro,
    pendingCount: allMonthOrders.filter(
      (o) => o.orderPackageStatus === "UNFULFILLED" || o.orderPackageStatus === "FULFILLED"
    ).length,
    cancelledCount: allMonthOrders.filter(
      (o) =>
        o.status === "CANCELLED" ||
        o.status === "REFUNDED" ||
        o.orderPackageStatus === "CANCELLED" ||
        o.orderPackageStatus === "REFUNDED"
    ).length,
    totalProducts: products.count,
    outOfStockCount: products.data.filter((p) => p.totalStock === 0).length,
    totalCustomers: customers.count,
  };

  // ─── Monthly trend (day by day for selected month) ──
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const trendMap = new Map<string, { date: string; orders: number; ciro: number }>();

  const maxDay = isCurrentMonth
    ? new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCDate() // Turkey today
    : daysInMonth;

  for (let day = 1; day <= maxDay; day++) {
    const key = `${selYear}-${String(selMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayLabel = `${String(day).padStart(2, "0")}.${String(selMonth).padStart(2, "0")}`;
    trendMap.set(key, { date: dayLabel, orders: 0, ciro: 0 });
  }
  for (const order of allMonthOrders) {
    const key = orderDateKeyTR(order.orderedAt);
    const entry = trendMap.get(key);
    if (entry) {
      entry.orders++;
      entry.ciro += order.totalFinalPrice;
    }
  }
  const trendData = Array.from(trendMap.values());

  // ─── Order status distribution ──────────────────────
  const statusDistribution: Record<string, number> = {};
  for (const order of allMonthOrders) {
    const status = order.orderPackageStatus;
    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
  }

  // ─── Top selling products (SKU aggregation) ─────────
  const skuMap = new Map<string, { sku: string; name: string; quantity: number; revenue: number }>();
  for (const order of allMonthOrders) {
    for (const line of order.orderLineItems) {
      const sku = line.variant.sku || "N/A";
      const existing = skuMap.get(sku) || { sku, name: line.variant.name, quantity: 0, revenue: 0 };
      existing.quantity += line.quantity;
      existing.revenue += line.finalPrice * line.quantity;
      skuMap.set(sku, existing);
    }
  }
  const topProducts = Array.from(skuMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ─── SKU daily data for filterable chart ─────────────
  const allDailyMap = new Map<string, { orders: number; revenue: number }>();
  const skuDailyMap = new Map<string, Map<string, { orders: number; revenue: number }>>();

  for (const order of allMonthOrders) {
    const dayKey = orderDateKeyTR(order.orderedAt);

    const allExisting = allDailyMap.get(dayKey) || { orders: 0, revenue: 0 };
    for (const line of order.orderLineItems) {
      allExisting.orders += line.quantity;
      allExisting.revenue += line.finalPrice * line.quantity;

      const sku = line.variant.sku || "N/A";
      if (!skuDailyMap.has(sku)) skuDailyMap.set(sku, new Map());
      const dayMap = skuDailyMap.get(sku)!;
      const existing = dayMap.get(dayKey) || { orders: 0, revenue: 0 };
      existing.orders += line.quantity;
      existing.revenue += line.finalPrice * line.quantity;
      dayMap.set(dayKey, existing);
    }
    allDailyMap.set(dayKey, allExisting);
  }

  // Convert to serializable format
  const skuDailyData: Record<string, { date: string; orders: number; revenue: number }[]> = {};

  // Helper to build day entries for the selected month
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

  skuDailyData["TÜMÜ"] = buildDayEntries(allDailyMap);

  for (const [sku, dayMap] of skuDailyMap) {
    skuDailyData[sku] = buildDayEntries(dayMap);
  }

  const availableSkus = [
    { sku: "TÜMÜ", name: "Tüm Ürünler (Toplam)" },
    ...Array.from(skuMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((s) => ({ sku: s.sku, name: s.name })),
  ];

  // ─── Available months (last 12 months) ──────────────
  const months: { value: string; label: string }[] = [];
  const AY_LABELS = [
    "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  ];
  const { year: nowYear, month: nowMonth } = (() => {
    const t = new Date(Date.now() + 3 * 60 * 60 * 1000);
    return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1 };
  })();
  for (let i = 0; i < 12; i++) {
    let m = nowMonth - i;
    let y = nowYear;
    if (m <= 0) { m += 12; y--; }
    const val = `${y}-${String(m).padStart(2, "0")}`;
    months.push({ value: val, label: `${AY_LABELS[m]} ${y}` });
  }

  return (
    <VigowoodDashboard
      kpi={kpi}
      trendData={trendData}
      statusDistribution={statusDistribution}
      topProducts={topProducts}
      skuDailyData={skuDailyData}
      availableSkus={availableSkus}
      isMock={isMock}
      selectedMonth={selectedMonth}
      months={months}
      isCurrentMonth={isCurrentMonth}
    />
  );
  } catch (error) {
    console.error("[vigowood-com/dashboard] API hatası:", error);
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-vw-dark">vigowood.com Dashboard</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
          <p className="text-sm font-medium text-destructive">İkas API Bağlantı Hatası</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "İkas API'ye bağlanılamadı. Lütfen daha sonra tekrar deneyin."}
          </p>
        </div>
      </div>
    );
  }
}
