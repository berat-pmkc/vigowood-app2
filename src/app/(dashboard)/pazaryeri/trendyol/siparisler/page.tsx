import type { Metadata } from "next";
import { getOrders, isUsingMockData } from "@/lib/trendyol";
import { daysAgoTimestamp, endOfTodayTimestamp } from "@/lib/trendyol/helpers";
import type { TrendyolOrderStatus } from "@/lib/trendyol/types";
import { SiparislerClient } from "./components/siparisler-client";

export const metadata: Metadata = { title: "Trendyol — Siparişler" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function TrendyolSiparislerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isMock = isUsingMockData();

  const status = params.status as TrendyolOrderStatus | "all" | undefined;
  const search = params.search || "";
  const page = parseInt(params.page || "0", 10);

  // Date range — default last 14 days
  let startDate = daysAgoTimestamp(14);
  let endDate = endOfTodayTimestamp();

  if (params.startDate) {
    startDate = new Date(params.startDate).getTime();
  }
  if (params.endDate) {
    const ed = new Date(params.endDate);
    ed.setHours(23, 59, 59, 999);
    endDate = ed.getTime();
  }

  const orderParams: Record<string, unknown> = {
    startDate,
    endDate,
    page,
    size: 50,
    orderByField: "PackageLastModifiedDate",
    orderByDirection: "DESC",
  };

  if (status && status !== "all") {
    // "İptal/İade" tab - client side filters both
    if (status === "Cancelled") {
      // Fetch all and filter client-side for Cancelled+Returned
    } else {
      (orderParams as Record<string, unknown>).status = status;
    }
  }

  const result = await getOrders(orderParams as Parameters<typeof getOrders>[0]);

  // Client-side filter for search and cancelled/returned combo
  let orders = result.content;

  if (status === "Cancelled") {
    // Also include Returned
    const allOrders = await getOrders({
      startDate,
      endDate,
      size: 200,
    } as Parameters<typeof getOrders>[0]);
    orders = allOrders.content.filter(
      (o) => o.status === "Cancelled" || o.status === "Returned" || o.status === "UnSupplied"
    );
  }

  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(
      (o) =>
        o.orderNumber.includes(q) ||
        `${o.customerFirstName} ${o.customerLastName}`.toLowerCase().includes(q) ||
        o.lines.some((l) => l.productName.toLowerCase().includes(q))
    );
  }

  return (
    <SiparislerClient
      orders={orders}
      totalElements={result.totalElements}
      currentPage={page}
      currentStatus={status || "all"}
      currentSearch={search}
      startDate={params.startDate || ""}
      endDate={params.endDate || ""}
      isMock={isMock}
    />
  );
}
