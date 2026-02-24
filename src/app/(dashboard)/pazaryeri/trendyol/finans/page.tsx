import type { Metadata } from "next";
import { getSettlementsFromDB, getOverallLastSyncAt } from "@/lib/trendyol/queries";
import { daysAgoTimestamp, endOfTodayTimestamp, aggregateSettlements } from "@/lib/trendyol/helpers";
import type { TrendyolSettlement } from "@/lib/trendyol/types";
import { FinansClient } from "./components/finans-client";

export const metadata: Metadata = { title: "Trendyol — Finans" };

interface PageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function TrendyolFinansPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lastSyncAt = await getOverallLastSyncAt();

  // Default: last 30 days
  let startDate = daysAgoTimestamp(30);
  let endDate = endOfTodayTimestamp();

  if (params.startDate) {
    startDate = new Date(params.startDate).getTime();
  }
  if (params.endDate) {
    const ed = new Date(params.endDate);
    ed.setHours(23, 59, 59, 999);
    endDate = ed.getTime();
  }

  const result = await getSettlementsFromDB({
    startDate,
    endDate,
    size: 500,
  });

  const settlements = result.content;
  const summary = aggregateSettlements(settlements);

  // Monthly aggregation
  const monthlyMap = new Map<string, TrendyolSettlement[]>();
  for (const s of settlements) {
    const month = s.transactionDate.substring(0, 7); // YYYY-MM
    if (!monthlyMap.has(month)) monthlyMap.set(month, []);
    monthlyMap.get(month)!.push(s);
  }

  const monthlyData = Array.from(monthlyMap.entries())
    .map(([month, items]) => {
      const agg = aggregateSettlements(items);
      return { month, ...agg };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  return (
    <FinansClient
      settlements={settlements}
      summary={summary}
      monthlyData={monthlyData}
      startDate={params.startDate || ""}
      endDate={params.endDate || ""}
      lastSyncAt={lastSyncAt}
    />
  );
}
