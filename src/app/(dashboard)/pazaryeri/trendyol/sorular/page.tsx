import type { Metadata } from "next";
import { getQuestions, isUsingMockData } from "@/lib/trendyol";
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
  const isMock = isUsingMockData();
  const page = parseInt(params.page || "0", 10);

  const questionParams: Record<string, unknown> = {
    page,
    size: 50,
    orderByField: "CreatedDate",
    orderByDirection: "DESC",
  };

  if (params.status && params.status !== "all") {
    questionParams.status = params.status;
  }

  const result = await getQuestions(questionParams as Parameters<typeof getQuestions>[0]);

  return (
    <SorularClient
      questions={result.content}
      totalElements={result.totalElements}
      currentPage={page}
      currentStatus={(params.status as TrendyolQuestionStatus) || "all"}
      isMock={isMock}
    />
  );
}
