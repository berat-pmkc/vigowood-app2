import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCachedActiveProducts, getCachedAllParts } from "@/lib/cached-queries";
import { BomPageClient } from "./components/bom-page-client";

interface PageProps {
  searchParams: Promise<{
    sku?: string;
  }>;
}

export const metadata: Metadata = { title: "BOM ve Montaj" };

// BOM verisi sık değişmez — 60 saniye cache
export const revalidate = 60;

export default async function BomPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const selectedSku = params.sku || "";

  // Cached reference data (2 min cache, invalidated on product/part changes)
  const [products, allParts] = await Promise.all([
    getCachedActiveProducts(),
    getCachedAllParts(),
  ]);

  // Fetch assembly steps + BOM count if SKU selected (not cached — changes frequently)
  let steps: {
    step_id: string;
    sku: string | null;
    step_name: string | null;
    seq_no: number | null;
    is_final_step: boolean;
    created_at: string;
    bom_count: number;
  }[] = [];

  if (selectedSku) {
    const supabase = await createClient();
    const { data: stepsData } = await supabase
      .from("assembly_steps")
      .select("step_id, sku, step_name, seq_no, is_final_step, created_at")
      .eq("sku", selectedSku)
      .order("seq_no", { ascending: true });

    if (stepsData && stepsData.length > 0) {
      const stepIds = stepsData.map((s) => s.step_id);
      const { data: bomData } = await supabase
        .from("step_bom")
        .select("step_id")
        .in("step_id", stepIds);

      const bomCounts: Record<string, number> = {};
      if (bomData) {
        for (const row of bomData) {
          bomCounts[row.step_id] = (bomCounts[row.step_id] || 0) + 1;
        }
      }

      steps = stepsData.map((s) => ({
        ...s,
        bom_count: bomCounts[s.step_id] || 0,
      }));
    }
  }

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          BOM ve Montaj Yönetimi
        </h1>
        <p className="text-sm text-muted-foreground">
          Ürün bazlı montaj adımları, malzeme listesi (BOM) ve reçete ağacı
          yönetimi
        </p>
      </div>
      <BomPageClient
        products={(products ?? []) as { sku: string; urun_adi: string | null; kategori: string | null }[]}
        steps={steps}
        selectedSku={selectedSku}
        allParts={(allParts ?? []) as { part_id: string; part_adi: string | null; part_type: string | null }[]}
      />
    </div>
  );
}
