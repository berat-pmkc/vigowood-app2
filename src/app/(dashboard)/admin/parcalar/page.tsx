import { createClient } from "@/lib/supabase/server";
import { PartsDataTable } from "./components/parts-data-table";
import type { Database, PartType } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    tip?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function ParcalarPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "25"))
    ? Number(params.pageSize)
    : 25;
  const search = params.search?.trim() || "";
  const tip = params.tip || "";
  const sortBy = params.sortBy || "part_id";
  const sortOrder = params.sortOrder === "desc" ? false : true;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("all_parts")
    .select("*", { count: "exact" });

  // Search filter
  if (search) {
    query = query.or(`part_id.ilike.%${search}%,part_adi.ilike.%${search}%`);
  }

  // Part type filter
  if (tip) {
    query = query.eq("part_type", tip as PartType);
  }

  // Sorting
  const validSortColumns: (keyof AllPart)[] = [
    "part_id",
    "part_adi",
    "part_type",
    "hazir_eleman_aktif_stok",
    "hazir_eleman_kritik_stok",
    "yari_mamul_stok",
  ];
  const sortColumn = validSortColumns.includes(sortBy as keyof AllPart)
    ? sortBy
    : "part_id";
  query = query.order(sortColumn, { ascending: sortOrder });

  // Pagination
  query = query.range(from, to);

  const { data: parts, count, error } = await query;

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
        <h1 className="text-2xl font-bold tracking-tight">Parça Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Parça listesi, tip filtresi, kritik stok takibi ve düzenleme
        </p>
      </div>
      <PartsDataTable
        data={(parts as AllPart[]) ?? []}
        totalCount={count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        tip={tip}
        sortBy={sortColumn}
        sortOrder={sortOrder ? "asc" : "desc"}
      />
    </div>
  );
}
