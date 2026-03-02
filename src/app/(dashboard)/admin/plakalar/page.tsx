import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PlakalarDataTable } from "./components/plakalar-data-table";
import type { Database } from "@/lib/supabase/types";

type Plaka = Database["public"]["Tables"]["plakalar"]["Row"];

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    sku?: string;
    sortBy?: string;
    sortOrder?: string;
    view?: string;
    plaka?: string;
  }>;
}

export const metadata: Metadata = { title: "Plaka Yonetimi" };

// Admin verisi sık değişmez — 60 saniye cache
export const revalidate = 60;

export default async function PlakalarPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "100"))
    ? Number(params.pageSize || "100")
    : 100;
  const search = params.search?.trim() || "";
  const sku = params.sku || "";
  const sortBy = params.sortBy || "plakalar_id";
  const sortOrder = params.sortOrder === "desc" ? false : true;
  const view = params.view || "liste";
  const selectedPlaka = params.plaka || "";

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("plakalar")
    .select("*", { count: "exact" })
    .eq("plaka_kategori", "MDF");

  // Search filter (sku is now TEXT[], exclude from ilike search)
  if (search) {
    query = query.or(
      `plakalar_id.ilike.%${search}%,plaka_id.ilike.%${search}%,plaka_adi.ilike.%${search}%`
    );
  }

  // SKU filter (array contains)
  if (sku) {
    query = query.contains("sku", [sku]);
  }

  // Sorting
  const validSortColumns: (keyof Plaka)[] = [
    "plakalar_id",
    "plaka_id",
    "plaka_adi",
    "tipi",
    "renk",
    "sku",
  ];
  const sortColumn = validSortColumns.includes(sortBy as keyof Plaka)
    ? sortBy
    : "plakalar_id";
  query = query.order(sortColumn, { ascending: sortOrder });

  // Pagination
  query = query.range(from, to);

  // Execute main query + SKU dropdown in parallel
  const [mainResult, skuResult] = await Promise.all([
    query,
    supabase.rpc("get_distinct_plaka_skus", { p_kategori: "MDF" }),
  ]);

  const { data: plakalar, count, error } = mainResult;
  const uniqueSkus = ((skuResult.data ?? []) as { sku: string }[]).map((r) => r.sku);

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          Veri yüklenirken hata oluştu: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Plaka Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Plaka listesi, kesim süreleri ve plaka parçaları yönetimi
        </p>
      </div>
      <PlakalarDataTable
        data={(plakalar as Plaka[]) ?? []}
        totalCount={count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        sku={sku}
        sortBy={sortColumn}
        sortOrder={sortOrder ? "asc" : "desc"}
        skuOptions={uniqueSkus}
        initialView={view as "liste" | "parcalar"}
        initialPlaka={selectedPlaka}
      />
    </div>
  );
}
