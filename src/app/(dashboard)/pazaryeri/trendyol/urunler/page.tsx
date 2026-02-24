import type { Metadata } from "next";
import { getProducts, isUsingMockData } from "@/lib/trendyol";
import type { TrendyolProductParams } from "@/lib/trendyol/types";
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
  const isMock = isUsingMockData();
  const page = parseInt(params.page || "0", 10);

  const productParams: TrendyolProductParams = {
    page,
    size: 50,
  };

  if (params.approved === "true") productParams.approved = true;
  if (params.approved === "false") productParams.approved = false;
  if (params.onSale === "true") productParams.onSale = true;
  if (params.onSale === "false") productParams.onSale = false;

  const result = await getProducts(productParams);

  // Client-side search filter
  let products = result.content;
  if (params.search) {
    const q = params.search.toLowerCase();
    products = products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        (p.stockCode && p.stockCode.toLowerCase().includes(q))
    );
  }

  return (
    <UrunlerClient
      products={products}
      totalElements={result.totalElements}
      currentPage={page}
      currentSearch={params.search || ""}
      currentApproved={params.approved || "all"}
      currentOnSale={params.onSale || "all"}
      isMock={isMock}
    />
  );
}
