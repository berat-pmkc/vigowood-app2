import { createClient } from "@/lib/supabase/server";
import { SablonDataTable } from "./components/sablon-data-table";
import type { PaletSablonRow } from "./actions";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    country_code?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function PaletSablonlariPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "25"))
    ? Number(params.pageSize || "25")
    : 25;
  const search = params.search?.trim() || "";
  const countryCode = params.country_code || "";
  const sortBy = params.sortBy || "sku";
  const sortOrder = params.sortOrder === "desc" ? false : true;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("sevkiyat_palet_sablon")
    .select("*", { count: "exact" });

  if (search) {
    query = query.or(`sku.ilike.%${search}%,urun_adi.ilike.%${search}%`);
  }

  if (countryCode) {
    query = query.eq("country_code", countryCode);
  }

  const validSortColumns = ["sku", "urun_adi", "country_code", "palet_boyut", "koli_adedi", "palette_koli", "koli_agirlik"];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "sku";
  query = query.order(sortColumn, { ascending: sortOrder });
  query = query.range(from, to);

  const { data: sablonlar, count, error } = await query;

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Veri yüklenirken hata oluştu: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Palet Şablonları</h1>
        <p className="text-sm text-muted-foreground">
          Ürün-ülke bazlı palet konfigürasyonları (sevkiyat planlamasında otomatik doldurma)
        </p>
      </div>
      <SablonDataTable
        data={(sablonlar as PaletSablonRow[]) ?? []}
        totalCount={count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        countryCode={countryCode}
        sortBy={sortColumn}
        sortOrder={sortOrder ? "asc" : "desc"}
      />
    </div>
  );
}
