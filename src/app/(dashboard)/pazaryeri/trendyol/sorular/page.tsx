import type { Metadata } from "next";
import { getQuestionsFromDB, getOverallLastSyncAt } from "@/lib/trendyol/queries";
import type { TrendyolQuestionStatus } from "@/lib/trendyol/types";
import { SorularClient } from "./components/sorular-client";

export const metadata: Metadata = { title: "Trendyol — Müşteri Soruları" };

interface PageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function TrendyolSorularPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lastSyncAt = await getOverallLastSyncAt();
  const page = parseInt(params.page || "0", 10);

  const result = await getQuestionsFromDB({
    page,
    size: 50,
    status: (params.status as TrendyolQuestionStatus | "all") || "all",
  });

  return (
    <SorularClient
      questions={result.content}
      totalElements={result.totalElements}
      currentPage={page}
      currentStatus={(params.status as TrendyolQuestionStatus) || "all"}
      lastSyncAt={lastSyncAt}
    />
  );
}
