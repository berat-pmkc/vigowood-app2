import type { Metadata } from "next";
import { getCustomersFromDB, getSegmentCounts } from "./actions";
import type { CustomerSortField } from "@/lib/ikas/helpers";
import { MusterilerClient } from "./components/musteriler-client";

export const metadata: Metadata = { title: "vigowood.com — Müşteriler" };

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sort?: string;
    dir?: string;
    segment?: string;
  }>;
}

export default async function VigowoodMusterilerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const sortField = (params.sort as CustomerSortField) || "lastOrderDate";
  const sortDir = params.dir === "asc" ? "asc" : "desc";
  const segment = params.segment || "all";

  try {
    const [result, segmentCounts] = await Promise.all([
      getCustomersFromDB({
        page,
        pageSize: 50,
        search: params.search || undefined,
        sort: sortField,
        dir: sortDir,
        segment,
      }),
      getSegmentCounts(),
    ]);

    return (
      <MusterilerClient
        customers={result.customers}
        totalCount={result.totalCount}
        hasNext={result.hasNext}
        currentPage={page}
        currentSearch={params.search || ""}
        currentSort={sortField}
        currentDir={sortDir}
        currentSegment={segment}
        segmentCounts={segmentCounts}
        dbEmpty={result.totalCount === 0 && !params.search}
      />
    );
  } catch (error) {
    console.error("[vigowood-com/musteriler] DB hatası:", error);
    return (
      <MusterilerClient
        customers={[]}
        totalCount={0}
        hasNext={false}
        currentPage={page}
        currentSearch={params.search || ""}
        currentSort={sortField}
        currentDir={sortDir}
        currentSegment={segment}
        segmentCounts={{}}
        apiError={error instanceof Error ? error.message : "Veritabanı bağlantı hatası"}
      />
    );
  }
}
