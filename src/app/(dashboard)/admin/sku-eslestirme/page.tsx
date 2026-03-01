import type { Metadata } from "next";
import { getSkuMappingStats } from "./actions";
import { SkuEslestirmeClient } from "./components/sku-eslestirme-client";

export const metadata: Metadata = { title: "SKU Eşleştirme | Admin" };
export const revalidate = 60;

export default async function SkuEslestirmePage() {
  const stats = await getSkuMappingStats();

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">SKU Eşleştirme</h1>
        <p className="text-sm text-muted-foreground">
          Farklı satış kanallarındaki ürün kodlarını master SKU ile eşleştirin
        </p>
      </div>
      <SkuEslestirmeClient stats={stats} />
    </div>
  );
}
