import type { Metadata } from "next";
import { getCustomers, isUsingMockData } from "@/lib/ikas";
import { MusterilerClient } from "./components/musteriler-client";

export const metadata: Metadata = { title: "vigowood.com — Müşteriler" };

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

export default async function VigowoodMusterilerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isMock = isUsingMockData();
  const page = parseInt(params.page || "1", 10);

  const result = await getCustomers({
    page,
    limit: 50,
    search: params.search || undefined,
    sort: "lastOrderDate:desc",
  });

  return (
    <MusterilerClient
      customers={result.data}
      totalCount={result.count}
      hasNext={result.hasNext}
      currentPage={page}
      currentSearch={params.search || ""}
      isMock={isMock}
    />
  );
}
