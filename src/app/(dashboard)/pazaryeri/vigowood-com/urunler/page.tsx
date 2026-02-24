import type { Metadata } from "next";
import { getProducts, isUsingMockData } from "@/lib/ikas";
import { UrunlerClient } from "./components/urunler-client";

export const metadata: Metadata = { title: "vigowood.com — Ürünler" };

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    filter?: string;
  }>;
}

export default async function VigowoodUrunlerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isMock = isUsingMockData();
  const page = parseInt(params.page || "1", 10);

  const result = await getProducts({
    page,
    limit: 50,
    search: params.search || undefined,
  });

  // Client-side filter for stock status
  let products = result.data;
  if (params.filter === "active") {
    products = products.filter((p) => p.variants.some((v) => v.isActive) && p.totalStock > 0);
  } else if (params.filter === "outofstock") {
    products = products.filter((p) => p.totalStock === 0);
  }

  return (
    <UrunlerClient
      products={products}
      totalCount={result.count}
      hasNext={result.hasNext}
      currentPage={page}
      currentSearch={params.search || ""}
      currentFilter={params.filter || "all"}
      isMock={isMock}
    />
  );
}
