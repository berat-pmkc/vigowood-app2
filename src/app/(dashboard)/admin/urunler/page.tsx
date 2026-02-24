import type { Metadata } from "next";
import { getCachedProductsPage } from "@/lib/cached-queries";
import { ProductsDataTable } from "./components/products-data-table";
import type { Database, ProductCategory } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    kategori?: string;
    aktif?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export const metadata: Metadata = { title: "Urun Yonetimi" };

// Admin verisi sık değişmez — 60 saniye cache
export const revalidate = 60;

export default async function UrunlerPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "100"))
    ? Number(params.pageSize || "100")
    : 100;
  const search = params.search?.trim() || "";
  const kategori = params.kategori || "";
  const aktif = params.aktif || "";
  const sortBy = params.sortBy || "gunluk_satis";
  const sortOrder = params.sortOrder === "asc" ? true : false;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const validSortColumns: (keyof Product)[] = [
    "sku", "urun_adi", "kategori", "aktif_mi", "stok_aktif",
    "gunluk_satis", "aylik_uretim",
  ];
  const sortColumn = validSortColumns.includes(sortBy as keyof Product)
    ? sortBy
    : "gunluk_satis";

  const { data: products, count } = await getCachedProductsPage({
    search,
    kategori,
    aktif,
    sortColumn,
    sortOrder,
    from,
    to,
  });

  return (
    <div className="px-4 pb-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Ürün Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Ürün listesi, arama, filtreleme ve toplu işlemler
        </p>
      </div>
      <ProductsDataTable
        data={(products as Product[]) ?? []}
        totalCount={count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        kategori={kategori}
        aktif={aktif}
        sortBy={sortColumn}
        sortOrder={sortOrder ? "asc" : "desc"}
      />
    </div>
  );
}
