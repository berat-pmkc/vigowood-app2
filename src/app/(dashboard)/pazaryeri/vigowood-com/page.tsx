import type { Metadata } from "next";
import { getOrders, getAllOrders, getProducts, getCustomers, isUsingMockData } from "@/lib/ikas/client";
import { daysAgoISO, endOfTodayISO, startOfTodayISO } from "@/lib/ikas/helpers";
import { VigowoodDashboard } from "./components/vigowood-dashboard";

export const metadata: Metadata = { title: "vigowood.com — Dashboard" };

export default async function VigowoodDashboardPage() {
  const isMock = isUsingMockData();

  // ─── Parallel data fetches ──────────────────────────
  // Use getAllOrders for month data (paginates through all pages)
  // Use getOrders for today/week (just need count from API)
  const [todayResult, weekResult, allMonthOrders, products, customers] = await Promise.all([
    getOrders({
      startDate: startOfTodayISO(),
      endDate: endOfTodayISO(),
      limit: 1,
      sort: "orderedAt:desc",
    }),
    getOrders({
      startDate: daysAgoISO(7),
      endDate: endOfTodayISO(),
      limit: 1,
      sort: "orderedAt:desc",
    }),
    getAllOrders({
      startDate: daysAgoISO(30),
      endDate: endOfTodayISO(),
      sort: "orderedAt:desc",
    }),
    getProducts({ limit: 200 }),
    getCustomers({ limit: 1, sort: "lastOrderDate:desc" }),
  ]);

  // ─── KPIs ───────────────────────────────────────────
  const todayCiro = allMonthOrders
    .filter((o) => {
      const d = new Date(o.orderedAt);
      const today = new Date();
      return d.toISOString().split("T")[0] === today.toISOString().split("T")[0];
    })
    .reduce((s, o) => s + o.totalFinalPrice, 0);

  const weekAgo = Date.now() - 7 * 86_400_000;
  const weekCiro = allMonthOrders
    .filter((o) => o.orderedAt >= weekAgo)
    .reduce((s, o) => s + o.totalFinalPrice, 0);

  const kpi = {
    todayOrderCount: todayResult.count,
    todayCiro,
    weekOrderCount: weekResult.count,
    weekCiro,
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
    totalMonthOrders: allMonthOrders.length,
  };

  // ─── 30-day trend ───────────────────────────────────
  const trendMap = new Map<string, { date: string; orders: number; ciro: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().split("T")[0];
    const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendMap.set(key, { date: dayLabel, orders: 0, ciro: 0 });
  }
  for (const order of allMonthOrders) {
    const key = new Date(order.orderedAt).toISOString().split("T")[0];
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
  // Also build "ALL" aggregation for default view
  const allDailyMap = new Map<string, { orders: number; revenue: number }>();
  const skuDailyMap = new Map<string, Map<string, { orders: number; revenue: number }>>();

  for (const order of allMonthOrders) {
    const dayKey = new Date(order.orderedAt).toISOString().split("T")[0];

    // All SKUs aggregation
    const allExisting = allDailyMap.get(dayKey) || { orders: 0, revenue: 0 };
    for (const line of order.orderLineItems) {
      allExisting.orders += line.quantity;
      allExisting.revenue += line.finalPrice * line.quantity;

      // Per-SKU aggregation
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

  // "TÜMÜ" (all) entry
  const allEntries: { date: string; orders: number; revenue: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().split("T")[0];
    const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    const data = allDailyMap.get(key) || { orders: 0, revenue: 0 };
    allEntries.push({ date: dayLabel, ...data });
  }
  skuDailyData["TÜMÜ"] = allEntries;

  // Per-SKU entries
  for (const [sku, dayMap] of skuDailyMap) {
    const entries: { date: string; orders: number; revenue: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = d.toISOString().split("T")[0];
      const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
      const data = dayMap.get(key) || { orders: 0, revenue: 0 };
      entries.push({ date: dayLabel, ...data });
    }
    skuDailyData[sku] = entries;
  }

  const availableSkus = [
    { sku: "TÜMÜ", name: "Tüm Ürünler (Toplam)" },
    ...Array.from(skuMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .map((s) => ({ sku: s.sku, name: s.name })),
  ];

  return (
    <VigowoodDashboard
      kpi={kpi}
      trendData={trendData}
      statusDistribution={statusDistribution}
      topProducts={topProducts}
      skuDailyData={skuDailyData}
      availableSkus={availableSkus}
      isMock={isMock}
    />
  );
}
