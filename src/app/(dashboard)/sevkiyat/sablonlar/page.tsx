import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { getShipmentSettings } from "@/lib/shipment-settings";
import { SablonDataTable } from "./components/sablon-data-table";
import type { PaletSablonRow } from "./actions";

export const metadata: Metadata = { title: "Palet Sablonlari" };

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    palet_boyut?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export default async function SevkiyatSablonlarPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "100"))
    ? Number(params.pageSize || "100")
    : 100;
  const search = params.search?.trim() || "";
  const paletBoyut = params.palet_boyut || "";
  const sortBy = params.sortBy || "sku";
  const sortOrder = params.sortOrder === "desc" ? false : true;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("sevkiyat_palet_sablon")
    .select("*", { count: "exact" });

  if (search) {
    query = query.ilike("sku", `%${search}%`);
  }

  if (paletBoyut) {
    query = query.eq("palet_boyut", paletBoyut);
  }

  const validSortColumns = ["sku", "palet_boyut", "koli_adedi", "palette_koli", "koli_agirlik"];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "sku";
  query = query.order(sortColumn, { ascending: sortOrder });
  query = query.range(from, to);

  const [{ data: sablonlar, count, error }, settings] = await Promise.all([
    query,
    getShipmentSettings(),
  ]);

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
          Palet boyutuna göre ürün konfigürasyonları
        </p>
      </div>
      <SablonDataTable
        data={(sablonlar as PaletSablonRow[]) ?? []}
        totalCount={count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        paletBoyut={paletBoyut}
        sortBy={sortColumn}
        sortOrder={sortOrder ? "asc" : "desc"}
        paletBoyutlari={settings.paletAyarlari.boyutlar}
      />
    </div>
  );
}
