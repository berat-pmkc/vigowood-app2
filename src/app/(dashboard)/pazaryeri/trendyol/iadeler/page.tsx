import type { Metadata } from "next";
import { getClaimsFromDB, getOverallLastSyncAt } from "@/lib/trendyol/queries";
import { daysAgoTimestamp, endOfTodayTimestamp } from "@/lib/trendyol/helpers";
import type { TrendyolClaimStatus } from "@/lib/trendyol/types";
import { IadelerClient } from "./components/iadeler-client";

export const metadata: Metadata = { title: "Trendyol — İade Talepleri" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function TrendyolIadelerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lastSyncAt = await getOverallLastSyncAt();

  const status = params.status as TrendyolClaimStatus | "all" | "active" | undefined;
  const search = params.search || "";
  const page = parseInt(params.page || "0", 10);

  // Date range — default last 90 days
  let startDate = daysAgoTimestamp(90);
  let endDate = endOfTodayTimestamp();

  if (params.startDate) {
    startDate = new Date(params.startDate).getTime();
  }
  if (params.endDate) {
    const ed = new Date(params.endDate);
    ed.setHours(23, 59, 59, 999);
    endDate = ed.getTime();
  }

  // "active" filtresi: işlem bekleyen (Accepted=tamamlandı, Rejected, Cancelled hariç)
  const INACTIVE_STATUSES: TrendyolClaimStatus[] = ["Accepted", "Rejected", "Cancelled"];
  const activeStatuses: TrendyolClaimStatus[] = [
    "Created", "WaitingInAction", "WaitingFraudCheck", "Accepted", "Unresolved", "InAnalysis"
  ];

  let dbStatus: TrendyolClaimStatus | "all" = "all";
  if (status && status !== "all" && status !== "active") {
    dbStatus = status;
  }

  const result = await getClaimsFromDB({
    startDate,
    endDate,
    page,
    size: 50,
    status: dbStatus,
    search: search || undefined,
  });

  // Client-side "active" filtresi uygula
  let claims = result.content;
  if (status === "active") {
    claims = claims.filter((c) => !INACTIVE_STATUSES.includes(c.status as TrendyolClaimStatus));
  }

  return (
    <IadelerClient
      claims={claims}
      totalElements={status === "active" ? claims.length : result.totalElements}
      currentPage={page}
      currentStatus={status || "all"}
      currentSearch={search}
      startDate={params.startDate || ""}
      endDate={params.endDate || ""}
      lastSyncAt={lastSyncAt}
    />
  );
}
