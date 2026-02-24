import type { Metadata } from "next";
import { getProductsFromDB, getOverallLastSyncAt } from "@/lib/trendyol/queries";
import { UrunlerClient } from "./components/urunler-client";

export const metadata: Metadata = { title: "Trendyol — Ürünler" };

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    approved?: string;
    onSale?: string;
  }>;
}

export default async function TrendyolUrunlerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const lastSyncAt = await getOverallLastSyncAt();
  const page = parseInt(params.page || "0", 10);

  const result = await getProductsFromDB({
    page,
    size: 50,
    search: params.search || undefined,
    approved: params.approved === "true" ? true : params.approved === "false" ? false : undefined,
    onSale: params.onSale === "true" ? true : params.onSale === "false" ? false : undefined,
  });

  return (
    <UrunlerClient
      products={result.content}
      totalElements={result.totalElements}
      currentPage={page}
      currentSearch={params.search || ""}
      currentApproved={params.approved || "all"}
      currentOnSale={params.onSale || "all"}
      lastSyncAt={lastSyncAt}
    />
  );
}
