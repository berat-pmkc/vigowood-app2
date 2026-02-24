import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import { getOrders, getProducts, isUsingMockData } from "@/lib/trendyol";
import { daysAgoTimestamp, endOfTodayTimestamp } from "@/lib/trendyol/helpers";
import { GenelDashboard } from "./components/genel-dashboard";

export const metadata: Metadata = { title: "Pazaryeri — Genel Bakış" };

export default async function PazaryeriGenelPage() {
  const user = await getCurrentUser();
  if (!user || !MARKETPLACE_ACCESS_ROLES.includes(user.role as typeof MARKETPLACE_ACCESS_ROLES[number])) {
    redirect("/");
  }

  const isMock = isUsingMockData();

  // Fetch Trendyol data for last 7 days
  const todayEnd = endOfTodayTimestamp();
  const sevenDaysAgo = daysAgoTimestamp(7);
  const todayStart = daysAgoTimestamp(0);

  const [ordersAll, ordersToday, products] = await Promise.all([
    getOrders({ startDate: sevenDaysAgo, endDate: todayEnd, size: 200 }),
    getOrders({ startDate: todayStart, endDate: todayEnd, size: 200 }),
    getProducts({ approved: true, size: 200 }),
  ]);

  // KPI calculations
  const todayOrders = ordersToday.content;
  const allOrders = ordersAll.content;

  const todayOrderCount = todayOrders.length;
  const pendingCount = allOrders.filter(
    (o) => o.status === "Created" || o.status === "Picking"
  ).length;
  const todayCiro = todayOrders.reduce((sum, o) => sum + o.totalPrice, 0);
  const returnCount = allOrders.filter(
    (o) => o.status === "Returned" || o.status === "Cancelled"
  ).length;
  const totalProducts = products.totalElements;
  const outOfStockCount = products.content.filter((p) => p.quantity === 0).length;

  // 7-day trend data
  const trendMap = new Map<string, { date: string; orders: number; ciro: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().split("T")[0];
    const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendMap.set(key, { date: dayLabel, orders: 0, ciro: 0 });
  }

  for (const order of allOrders) {
    const d = new Date(order.orderDate).toISOString().split("T")[0];
    const entry = trendMap.get(d);
    if (entry) {
      entry.orders++;
      entry.ciro += order.totalPrice;
    }
  }

  const trendData = Array.from(trendMap.values());

  return (
    <GenelDashboard
      kpi={{
        todayOrderCount,
        pendingCount,
        todayCiro,
        returnCount,
        totalProducts,
        outOfStockCount,
      }}
      trendData={trendData}
      isMock={isMock}
    />
  );
}
