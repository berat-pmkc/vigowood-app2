import type { Metadata } from "next";
import { getCustomers, enrichCustomersWithOrderStats, isUsingMockData } from "@/lib/ikas";
import { CUSTOMER_SORT_OPTIONS, type CustomerSortField } from "@/lib/ikas/helpers";
import { MusterilerClient } from "./components/musteriler-client";

export const metadata: Metadata = { title: "vigowood.com — Müşteriler" };

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sort?: string;
    dir?: string;
  }>;
}

export default async function VigowoodMusterilerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isMock = isUsingMockData();
  const page = parseInt(params.page || "1", 10);

  const sortField = (params.sort as CustomerSortField) || "lastOrderDate";
  const sortDir = params.dir === "asc" ? "asc" : "desc";

  // Check if API supports this sort field
  const sortOption = CUSTOMER_SORT_OPTIONS.find((o) => o.value === sortField);
  const apiSort = sortOption?.serverSide
    ? `${sortField}:${sortDir}`
    : `lastOrderDate:desc`; // fallback for client-side sort fields

  const result = await getCustomers({
    page,
    limit: 50,
    search: params.search || undefined,
    sort: apiSort,
  });

  // Enrich customers with order stats (API may return null for computed fields)
  let enrichedCustomers = await enrichCustomersWithOrderStats(result.data);

  // Always re-sort after enrichment — enrichment may have updated lastOrderDate,
  // orderCount, totalOrderPrice which can break the original API sort order
  enrichedCustomers = [...enrichedCustomers].sort((a, b) => {
    if (sortField === "firstName") {
      const aName = (a.firstName ?? "").toLowerCase();
      const bName = (b.firstName ?? "").toLowerCase();
      return sortDir === "asc"
        ? aName.localeCompare(bName, "tr")
        : bName.localeCompare(aName, "tr");
    }
    const aVal = (a[sortField as keyof typeof a] as number) ?? 0;
    const bVal = (b[sortField as keyof typeof b] as number) ?? 0;
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  return (
    <MusterilerClient
      customers={enrichedCustomers}
      totalCount={result.count}
      hasNext={result.hasNext}
      currentPage={page}
      currentSearch={params.search || ""}
      currentSort={sortField}
      currentDir={sortDir}
      isMock={isMock}
    />
  );
}
