import type { Metadata } from "next";
import { getOrdersFromDB, getOverallLastSyncAt } from "@/lib/trendyol/queries";
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
  const lastSyncAt = await getOverallLastSyncAt();

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

  const result = await getOrdersFromDB({
    startDate,
    endDate,
    page,
    size: 50,
    status: status || "all",
    search: search || undefined,
  });

  return (
    <SiparislerClient
      orders={result.content}
      totalElements={result.totalElements}
      currentPage={page}
      currentStatus={status || "all"}
      currentSearch={search}
      startDate={params.startDate || ""}
      endDate={params.endDate || ""}
      lastSyncAt={lastSyncAt}
    />
  );
}
