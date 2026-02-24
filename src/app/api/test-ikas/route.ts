import { NextResponse } from "next/server";
import { getOrders, getProducts, getCustomers, isUsingMockData } from "@/lib/ikas";
import { daysAgoISO, endOfTodayISO, startOfTodayISO } from "@/lib/ikas/helpers";

export async function GET() {
  try {
    const isMock = isUsingMockData();

    const [orders, todayOrders, products, customers] = await Promise.all([
      getOrders({ startDate: daysAgoISO(7), endDate: endOfTodayISO(), limit: 5 }),
      getOrders({ startDate: startOfTodayISO(), endDate: endOfTodayISO(), limit: 5 }),
      getProducts({ limit: 5 }),
      getCustomers({ limit: 5, sort: "orderCount:desc" }),
    ]);

    return NextResponse.json({
      isMock,
      orders: { count: orders.count, sample: orders.data.map(o => ({ no: o.orderNumber, date: new Date(o.orderedAt).toISOString(), total: o.totalFinalPrice, status: o.status, pkg: o.orderPackageStatus, customer: `${o.customer.firstName} ${o.customer.lastName}` })) },
      todayOrders: { count: todayOrders.count },
      products: { count: products.count, sample: products.data.map(p => ({ name: p.name, stock: p.totalStock, sku: p.variants[0]?.sku })) },
      customers: { count: customers.count, sample: customers.data.map(c => ({ name: `${c.firstName} ${c.lastName}`, orders: c.orderCount, total: c.totalOrderPrice })) },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
