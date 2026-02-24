import type { Metadata } from "next";
import { getOrders, getProducts, getCustomers, isUsingMockData } from "@/lib/ikas/client";
import { daysAgoISO, endOfTodayISO, startOfTodayISO } from "@/lib/ikas/helpers";
import { VigowoodDashboard } from "./components/vigowood-dashboard";

export const metadata: Metadata = { title: "vigowood.com — Dashboard" };

export default async function VigowoodDashboardPage() {
  const isMock = isUsingMockData();

  // ─── Parallel data fetches ──────────────────────────
  // Fetch today/week/month separately for accurate counts
  const [todayResult, weekResult, monthResult, products, customers] = await Promise.all([
    getOrders({
      startDate: startOfTodayISO(),
      endDate: endOfTodayISO(),
      limit: 200,
      sort: "orderedAt:desc",
    }),
    getOrders({
      startDate: daysAgoISO(7),
      endDate: endOfTodayISO(),
      limit: 200,
      sort: "orderedAt:desc",
    }),
    getOrders({
      startDate: daysAgoISO(30),
      endDate: endOfTodayISO(),
      limit: 200,
      sort: "orderedAt:desc",
    }),
    getProducts({ limit: 200 }),
    getCustomers({ limit: 1, sort: "lastOrderDate:desc" }),
  ]);

  // Use API count for totals (more accurate than data.length when limit < total)
  const todayData = todayResult.data;
  const weekData = weekResult.data;
  const monthData = monthResult.data;

  // ─── KPIs ───────────────────────────────────────────
  const kpi = {
    todayOrderCount: todayResult.count,
    todayCiro: todayData.reduce((s, o) => s + o.totalFinalPrice, 0),
    weekOrderCount: weekResult.count,
    weekCiro: weekData.reduce((s, o) => s + o.totalFinalPrice, 0),
    pendingCount: monthData.filter(
      (o) => o.orderPackageStatus === "UNFULFILLED" || o.orderPackageStatus === "FULFILLED"
    ).length,
    cancelledCount: monthData.filter(
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

  // ─── 30-day trend ───────────────────────────────────
  const trendMap = new Map<string, { date: string; orders: number; ciro: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().split("T")[0];
    const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendMap.set(key, { date: dayLabel, orders: 0, ciro: 0 });
  }
  for (const order of monthData) {
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
  for (const order of monthData) {
    const status = order.orderPackageStatus;
    statusDistribution[status] = (statusDistribution[status] || 0) + 1;
  }

  // ─── Top selling products (SKU aggregation) ─────────
  const skuMap = new Map<string, { sku: string; name: string; quantity: number; revenue: number }>();
  for (const order of monthData) {
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
  const skuDailyMap = new Map<string, Map<string, { orders: number; revenue: number }>>();
  for (const order of monthData) {
    const dayKey = new Date(order.orderedAt).toISOString().split("T")[0];
    for (const line of order.orderLineItems) {
      const sku = line.variant.sku || "N/A";
      if (!skuDailyMap.has(sku)) skuDailyMap.set(sku, new Map());
      const dayMap = skuDailyMap.get(sku)!;
      const existing = dayMap.get(dayKey) || { orders: 0, revenue: 0 };
      existing.orders += line.quantity;
      existing.revenue += line.finalPrice * line.quantity;
      dayMap.set(dayKey, existing);
    }
  }

  // Convert to serializable format
  const skuDailyData: Record<string, { date: string; orders: number; revenue: number }[]> = {};
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

  const availableSkus = Array.from(skuMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .map((s) => ({ sku: s.sku, name: s.name }));

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
