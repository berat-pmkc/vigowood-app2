import type { Metadata } from "next";
import { getOrders, isUsingMockData } from "@/lib/ikas";
import { daysAgoISO, endOfTodayISO } from "@/lib/ikas/helpers";
import type { IkasPackageStatus } from "@/lib/ikas/types";
import { SiparislerClient } from "./components/siparisler-client";

export const metadata: Metadata = { title: "vigowood.com — Siparişler" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function VigowoodSiparislerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isMock = isUsingMockData();

  const status = params.status as IkasPackageStatus | "all" | "cancelled" | undefined;
  const search = params.search || "";
  const page = parseInt(params.page || "1", 10);

  // Date range — default last 14 days
  let startDate = daysAgoISO(14);
  let endDate = endOfTodayISO();

  if (params.startDate) {
    startDate = new Date(params.startDate).toISOString();
  }
  if (params.endDate) {
    const ed = new Date(params.endDate);
    ed.setHours(23, 59, 59, 999);
    endDate = ed.toISOString();
  }

  try {
    const orderParams: Parameters<typeof getOrders>[0] = {
      startDate,
      endDate,
      page,
      limit: 50,
      sort: "orderedAt:desc",
      search: search || undefined,
    };

    // Add package status filter (not for "cancelled" group or "all")
    if (status && status !== "all" && status !== "cancelled") {
      orderParams.packageStatus = status as IkasPackageStatus;
    }

    const result = await getOrders(orderParams);
    let orders = result.data;

    // Client-side filter for cancelled/refunded group
    if (status === "cancelled") {
      const allResult = await getOrders({
        startDate,
        endDate,
        page: 1,
        limit: 200,
        sort: "orderedAt:desc",
      });
      orders = allResult.data.filter(
        (o) =>
          o.orderPackageStatus === "CANCELLED" ||
          o.orderPackageStatus === "REFUNDED" ||
          o.orderPackageStatus === "PARTIALLY_CANCELLED" ||
          o.orderPackageStatus === "PARTIALLY_REFUNDED" ||
          o.status === "CANCELLED" ||
          o.status === "REFUNDED"
      );
    }

    return (
      <SiparislerClient
        orders={orders}
        totalCount={result.count}
        hasNext={result.hasNext}
        currentPage={page}
        currentStatus={status || "all"}
        currentSearch={search}
        startDate={params.startDate || ""}
        endDate={params.endDate || ""}
        isMock={isMock}
      />
    );
  } catch (error) {
    console.error("[vigowood-com/siparisler] API hatası:", error);
    return (
      <SiparislerClient
        orders={[]}
        totalCount={0}
        hasNext={false}
        currentPage={page}
        currentStatus={status || "all"}
        currentSearch={search}
        startDate={params.startDate || ""}
        endDate={params.endDate || ""}
        isMock={isMock}
        apiError={error instanceof Error ? error.message : "İkas API bağlantı hatası"}
      />
    );
  }
}
