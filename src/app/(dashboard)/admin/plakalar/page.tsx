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
    makine?: string;
    sku?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export const metadata: Metadata = { title: "Plaka Yonetimi" };

export default async function PlakalarPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "25"))
    ? Number(params.pageSize || "25")
    : 25;
  const search = params.search?.trim() || "";
  const makine = params.makine || "";
  const sku = params.sku || "";
  const sortBy = params.sortBy || "plakalar_id";
  const sortOrder = params.sortOrder === "desc" ? false : true;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("plakalar")
    .select("*", { count: "exact" });

  // Search filter
  if (search) {
    query = query.or(
      `plakalar_id.ilike.%${search}%,plaka_id.ilike.%${search}%,plaka_adi.ilike.%${search}%,sku.ilike.%${search}%`
    );
  }

  // Machine filter
  if (makine) {
    query = query.eq("makine_id", makine);
  }

  // SKU filter
  if (sku) {
    query = query.eq("sku", sku);
  }

  // Sorting
  const validSortColumns: (keyof Plaka)[] = [
    "plakalar_id",
    "plaka_id",
    "plaka_adi",
    "tipi",
    "renk",
    "makine_id",
    "std_kesim_suresi_dk",
    "sku",
  ];
  const sortColumn = validSortColumns.includes(sortBy as keyof Plaka)
    ? sortBy
    : "plakalar_id";
  query = query.order(sortColumn, { ascending: sortOrder });

  // Pagination
  query = query.range(from, to);

  const { data: plakalar, count, error } = await query;

  // Also fetch distinct SKUs for filter dropdown
  const { data: skuList } = await supabase
    .from("plakalar")
    .select("sku")
    .not("sku", "is", null)
    .order("sku");

  const uniqueSkus = [
    ...new Set((skuList ?? []).map((r) => r.sku).filter(Boolean)),
  ] as string[];

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
          Plaka listesi, makine filtresi, kesim süresi ve plaka parçaları
          yönetimi
        </p>
      </div>
      <PlakalarDataTable
        data={(plakalar as Plaka[]) ?? []}
        totalCount={count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        makine={makine}
        sku={sku}
        sortBy={sortColumn}
        sortOrder={sortOrder ? "asc" : "desc"}
        skuOptions={uniqueSkus}
      />
    </div>
  );
}
