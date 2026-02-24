import type { Metadata } from "next";
import { getCachedPartsPage } from "@/lib/cached-queries";
import { PartsDataTable } from "./components/parts-data-table";
import type { Database } from "@/lib/supabase/types";

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

export const metadata: Metadata = { title: "Parca Yonetimi" };

// Admin verisi sık değişmez — 60 saniye cache
export const revalidate = 60;

export default async function ParcalarPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "100"))
    ? Number(params.pageSize || "100")
    : 100;
  const search = params.search?.trim() || "";
  const tip = params.tip || "";
  const sortBy = params.sortBy || "part_id";
  const sortOrder = params.sortOrder === "desc" ? false : true;

  const from = page * pageSize;
  const to = from + pageSize - 1;

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

  const { data: parts, count } = await getCachedPartsPage({
    search,
    tip,
    sortColumn,
    sortOrder,
    from,
    to,
  });

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
