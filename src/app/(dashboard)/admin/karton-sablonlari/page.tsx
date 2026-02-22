import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { KartonSablonlarDataTable } from "./components/karton-sablonlar-data-table";
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
  }>;
}

export const metadata: Metadata = { title: "Karton Kesim Şablonları" };

export default async function KartonSablonlariPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "50"))
    ? Number(params.pageSize || "50")
    : 50;
  const search = params.search?.trim() || "";
  const sku = params.sku || "";
  const sortBy = params.sortBy || "plakalar_id";
  const sortOrder = params.sortOrder === "desc" ? false : true;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("plakalar")
    .select("*", { count: "exact" })
    .eq("plaka_kategori", "KARTON");

  if (search) {
    query = query.or(
      `plakalar_id.ilike.%${search}%,plaka_id.ilike.%${search}%,plaka_adi.ilike.%${search}%,sku.ilike.%${search}%`
    );
  }

  if (sku) {
    query = query.eq("sku", sku);
  }

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
  query = query.range(from, to);

  const { data: sablonlar, count, error } = await query;

  // Distinct SKUs for filter
  const { data: skuList } = await supabase
    .from("plakalar")
    .select("sku")
    .eq("plaka_kategori", "KARTON")
    .not("sku", "is", null)
    .order("sku");

  const uniqueSkus = [
    ...new Set((skuList ?? []).map((r) => r.sku).filter(Boolean)),
  ] as string[];

  // Get plaka_parts for each (to show output part)
  const plakaIds = ((sablonlar ?? []) as Plaka[]).map((p) => p.plaka_id);
  let partMap = new Map<string, { part_id: string; part_adi: string }>();

  if (plakaIds.length > 0) {
    const { data: pparts } = await supabase
      .from("plaka_parts")
      .select("plaka_id, part_id")
      .in("plaka_id", plakaIds);

    if (pparts && pparts.length > 0) {
      const partIds = pparts.map((p) => p.part_id);
      const { data: parts } = await supabase
        .from("all_parts")
        .select("part_id, part_adi")
        .in("part_id", partIds);

      const partNameMap = new Map(
        (parts ?? []).map((p) => [p.part_id, p.part_adi])
      );

      partMap = new Map(
        pparts.map((pp) => [
          pp.plaka_id,
          {
            part_id: pp.part_id,
            part_adi: partNameMap.get(pp.part_id) || pp.part_id,
          },
        ])
      );
    }
  }

  // Enrich sablonlar with output part info
  const enrichedData = ((sablonlar ?? []) as Plaka[]).map((s) => ({
    ...s,
    output_part_id: partMap.get(s.plaka_id)?.part_id ?? null,
    output_part_adi: partMap.get(s.plaka_id)?.part_adi ?? null,
  }));

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
        <h1 className="text-2xl font-bold tracking-tight">Karton Kesim Şablonları</h1>
        <p className="text-sm text-muted-foreground">
          Karton plaka şablonları — kutu-koli üretim hatları için
        </p>
      </div>
      <KartonSablonlarDataTable
        data={enrichedData}
        totalCount={count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        sku={sku}
        sortBy={sortColumn}
        sortOrder={sortOrder ? "asc" : "desc"}
        skuOptions={uniqueSkus}
      />
    </div>
  );
}
