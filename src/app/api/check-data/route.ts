import { NextResponse } from "next/server";
import { getOrders, getAllOrders, isUsingMockData } from "@/lib/ikas/client";
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

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const isMock = isUsingMockData();
    const curMonth = currentMonthKey();
    const todayKey = todayKeyTR();
    const [selYear, selMonth] = curMonth.split("-").map(Number);

    // Parallel: today count, week count, all month orders
    const [todayResult, weekResult, allMonthOrders] = await Promise.all([
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
        startDate: monthStartISO(selYear, selMonth),
        endDate: endOfTodayISO(),
        sort: "orderedAt:desc",
      }),
    ]);

    // Date distribution using Turkey timezone
    const dateMap = new Map<string, number>();
    for (const order of allMonthOrders) {
      const key = orderDateKeyTR(order.orderedAt);
      dateMap.set(key, (dateMap.get(key) || 0) + 1);
    }

    // Today's orders from month data
    const todayFromMonth = allMonthOrders.filter(
      (o) => orderDateKeyTR(o.orderedAt) === todayKey
    );
    const todayCiro = todayFromMonth.reduce((s, o) => s + o.totalFinalPrice, 0);
    const monthCiro = allMonthOrders.reduce((s, o) => s + o.totalFinalPrice, 0);

    // SKU count
    const skuSet = new Set<string>();
    for (const order of allMonthOrders) {
      for (const line of order.orderLineItems) {
        skuSet.add(line.variant.sku || "N/A");
      }
    }

    return NextResponse.json({
      isMock,
      currentMonth: curMonth,
      todayKey,
      todayApiCount: todayResult.count,
      todayFromMonthData: todayFromMonth.length,
      todayCiro: Math.round(todayCiro),
      weekApiCount: weekResult.count,
      monthOrderCount: allMonthOrders.length,
      monthCiro: Math.round(monthCiro),
      uniqueDates: dateMap.size,
      uniqueSkus: skuSet.size,
      dateDistribution: Object.fromEntries([...dateMap].sort()),
      dateRange: {
        startOfToday: startOfTodayISO(),
        endOfToday: endOfTodayISO(),
        monthStart: monthStartISO(selYear, selMonth),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
