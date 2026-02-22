import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { getShipmentSettings } from "@/lib/shipment-settings";
import { FiyatlarDataTable } from "./components/fiyatlar-data-table";
import type { FiyatRow } from "./actions";

export const metadata: Metadata = { title: "Sevkiyat Fiyatları" };

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

export default async function SevkiyatFiyatlarPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const settings = await getShipmentSettings();
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "100"))
    ? Number(params.pageSize || "100")
    : 100;
  const search = params.search?.trim() || "";
  const countryCode = params.country_code || "";
  const sortBy = params.sortBy || "sku";
  const sortOrder = params.sortOrder === "desc" ? false : true;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  // Fetch fiyatlar
  let query = supabase
    .from("sevkiyat_fiyatlar")
    .select("*", { count: "exact" });

  if (search) {
    query = query.or(`sku.ilike.%${search}%,urun_adi_en.ilike.%${search}%,gtip.ilike.%${search}%`);
  }

  if (countryCode) {
    query = query.eq("country_code", countryCode);
  }

  const validSortColumns = ["sku", "urun_adi_en", "country_code", "birim_fiyat", "kategori", "gtip"];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "sku";
  query = query.order(sortColumn, { ascending: sortOrder });
  query = query.range(from, to);

  // Fetch products for combobox
  const [fiyatlarResult, productsResult] = await Promise.all([
    query,
    supabase
      .from("products")
      .select("sku, urun_adi")
      .eq("aktif_mi", true)
      .order("sku", { ascending: true }),
  ]);

  const { data: fiyatlar, count, error } = fiyatlarResult;
  const products = (productsResult.data ?? []).map((p) => ({
    sku: p.sku,
    urun_adi: p.urun_adi,
  }));

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
        <h1 className="text-2xl font-bold tracking-tight">Sevkiyat Fiyatları</h1>
        <p className="text-sm text-muted-foreground">
          Ülke bazlı ürün fiyatları, GTIP ve proforma bilgileri
        </p>
      </div>
      <FiyatlarDataTable
        data={(fiyatlar as FiyatRow[]) ?? []}
        totalCount={count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        countryCode={countryCode}
        sortBy={sortColumn}
        sortOrder={sortOrder ? "asc" : "desc"}
        products={products}
        ulkeler={settings.ulkeler}
      />
    </div>
  );
}
