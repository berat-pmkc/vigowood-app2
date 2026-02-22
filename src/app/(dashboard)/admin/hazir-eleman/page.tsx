import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { HazirElemanDataTable } from "./components/hazir-eleman-data-table";
import type { Database } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export const metadata: Metadata = { title: "Hazır Eleman Yönetimi" };

export default async function HazirElemanPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "25"))
    ? Number(params.pageSize || "25")
    : 25;
  const search = params.search?.trim() || "";
  const sortBy = params.sortBy || "part_id";
  const sortOrder = params.sortOrder === "desc" ? false : true;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const validSortColumns: (keyof AllPart)[] = [
    "part_id",
    "part_adi",
    "hazir_eleman_aktif_stok",
    "hazir_eleman_kritik_stok",
  ];
  const sortColumn = validSortColumns.includes(sortBy as keyof AllPart)
    ? sortBy
    : "part_id";

  const supabase = await createClient();
  const q = supabase
    .from("all_parts")
    .select("*", { count: "exact" })
    .eq("part_type", "HAZIR");

  if (search) {
    q.or(`part_id.ilike.%${search}%,part_adi.ilike.%${search}%`);
  }

  const { data, count, error } = await q
    .order(sortColumn, { ascending: sortOrder })
    .range(from, to);

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
        <h1 className="text-2xl font-bold tracking-tight">
          Hazır Eleman Yönetimi
        </h1>
        <p className="text-sm text-muted-foreground">
          Menteşe, vida, mıknatıs vb. hazır eleman tanımlama ve yönetimi
        </p>
      </div>
      <HazirElemanDataTable
        data={(data as AllPart[]) ?? []}
        totalCount={count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        sortBy={sortColumn}
        sortOrder={sortOrder ? "asc" : "desc"}
      />
    </div>
  );
}
