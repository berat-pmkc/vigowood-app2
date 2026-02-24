import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { getOrdersFromDB, getProductsFromDB, getOverallLastSyncAt } from "@/lib/trendyol/queries";
import { daysAgoTimestamp, endOfTodayTimestamp } from "@/lib/trendyol/helpers";
import { getOrders as getIkasOrders, getProducts as getIkasProducts, isUsingMockData as isIkasMock } from "@/lib/ikas";
import { daysAgoISO, endOfTodayISO, startOfTodayISO } from "@/lib/ikas/helpers";
import { GenelDashboard } from "./components/genel-dashboard";

export const metadata: Metadata = { title: "Pazaryeri — Genel Bakış" };

export default async function PazaryeriGenelPage() {
  const user = await getCurrentUser();
  if (!user || !MARKETPLACE_ACCESS_ROLES.includes(user.role as typeof MARKETPLACE_ACCESS_ROLES[number])) {
    redirect("/");
  }

  const lastSyncAt = await getOverallLastSyncAt();

  // Fetch Trendyol + İkas data in parallel
  const todayEnd = endOfTodayTimestamp();
  const sevenDaysAgo = daysAgoTimestamp(7);
  const todayStart = daysAgoTimestamp(0);

  const [trendyolOrdersAll, trendyolOrdersToday, trendyolProducts, ikasOrdersAll, ikasOrdersToday, ikasProducts] =
    await Promise.all([
      getOrdersFromDB({ startDate: sevenDaysAgo, endDate: todayEnd, size: 200 }),
      getOrdersFromDB({ startDate: todayStart, endDate: todayEnd, size: 200 }),
      getProductsFromDB({ approved: true, size: 200 }),
      getIkasOrders({ startDate: daysAgoISO(7), endDate: endOfTodayISO(), limit: 200 }),
      getIkasOrders({ startDate: startOfTodayISO(), endDate: endOfTodayISO(), limit: 200 }),
      getIkasProducts({ limit: 200 }),
    ]);

  // ─── Trendyol KPIs ──────────────────────────────────────
  const tAll = trendyolOrdersAll.content;
  const tToday = trendyolOrdersToday.content;

  const trendyolKpi = {
    todayOrderCount: tToday.length,
    pendingCount: tAll.filter((o) => o.status === "Created" || o.status === "Picking").length,
    todayCiro: tToday.reduce((sum, o) => sum + o.totalPrice, 0),
    returnCount: tAll.filter((o) => o.status === "Returned" || o.status === "Cancelled").length,
    totalProducts: trendyolProducts.totalElements,
    outOfStockCount: trendyolProducts.content.filter((p) => p.quantity === 0).length,
  };

  // ─── İkas KPIs ───────────────────────────────────────────
  const iAll = ikasOrdersAll.data;
  const iToday = ikasOrdersToday.data;

  const ikasKpi = {
    todayOrderCount: iToday.length,
    pendingCount: iAll.filter((o) => o.orderPackageStatus === "UNFULFILLED" || o.orderPackageStatus === "FULFILLED").length,
    todayCiro: iToday.reduce((sum, o) => sum + o.totalFinalPrice, 0),
    returnCount: iAll.filter((o) => o.status === "CANCELLED" || o.status === "REFUNDED").length,
    totalProducts: ikasProducts.count,
    outOfStockCount: ikasProducts.data.filter((p) => p.totalStock === 0).length,
  };

  // ─── Combined KPIs ──────────────────────────────────────
  const kpi = {
    todayOrderCount: trendyolKpi.todayOrderCount + ikasKpi.todayOrderCount,
    pendingCount: trendyolKpi.pendingCount + ikasKpi.pendingCount,
    todayCiro: trendyolKpi.todayCiro + ikasKpi.todayCiro,
    returnCount: trendyolKpi.returnCount + ikasKpi.returnCount,
    totalProducts: trendyolKpi.totalProducts + ikasKpi.totalProducts,
    outOfStockCount: trendyolKpi.outOfStockCount + ikasKpi.outOfStockCount,
  };

  // ─── 7-day trend data (combined) ────────────────────────
  const trendMap = new Map<string, { date: string; orders: number; ciro: number; trendyolOrders: number; trendyolCiro: number; ikasOrders: number; ikasCiro: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().split("T")[0];
    const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendMap.set(key, { date: dayLabel, orders: 0, ciro: 0, trendyolOrders: 0, trendyolCiro: 0, ikasOrders: 0, ikasCiro: 0 });
  }

  for (const order of tAll) {
    const d = new Date(order.orderDate).toISOString().split("T")[0];
    const entry = trendMap.get(d);
    if (entry) {
      entry.orders++;
      entry.ciro += order.totalPrice;
      entry.trendyolOrders++;
      entry.trendyolCiro += order.totalPrice;
    }
  }

  for (const order of iAll) {
    const d = new Date(order.orderedAt).toISOString().split("T")[0];
    const entry = trendMap.get(d);
    if (entry) {
      entry.orders++;
      entry.ciro += order.totalFinalPrice;
      entry.ikasOrders++;
      entry.ikasCiro += order.totalFinalPrice;
    }
  }

  const trendData = Array.from(trendMap.values());

  return (
    <GenelDashboard
      kpi={kpi}
      trendyolKpi={trendyolKpi}
      ikasKpi={ikasKpi}
      trendData={trendData}
      lastSyncAt={lastSyncAt}
      ikasMock={isIkasMock()}
    />
  );
}
