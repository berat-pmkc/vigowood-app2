import { createClient } from "@/lib/supabase/server";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { ProductsDataTable } from "./components/products-data-table";
import type { Database, ProductCategory } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

const BUILD_VERSION = "V7-PINPOINT";

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

export default async function UrunlerPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "25"))
    ? Number(params.pageSize)
    : 25;
  const search = params.search?.trim() || "";
  const kategori = params.kategori || "";
  const aktif = params.aktif || "";
  const sortBy = params.sortBy || "sku";
  const sortOrder = params.sortOrder === "desc" ? false : true;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const validSortColumns: (keyof Product)[] = [
    "sku", "urun_adi", "kategori", "aktif_mi", "stok_aktif",
    "gunluk_satis", "aylik_uretim",
  ];
  const sortColumn = validSortColumns.includes(sortBy as keyof Product)
    ? sortBy
    : "sku";

  // ========= PINPOINT TESTS: isolate exact cause =========
  const debug: Record<string, string> = {};
  const mkClient = () => createJsClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // T1: Single chain + select("sku") + limit(3) — KNOWN WORKING from V6
  try {
    const r = await mkClient().from("products").select("sku", { count: "exact" }).order("sku").limit(3);
    debug["T1-chain-sku-limit"] = `data:${r.data?.length ?? "null"} count:${r.count}`;
  } catch (e) { debug["T1"] = `ERR:${e}`; }

  // T2: Single chain + select("*") + limit(25)
  try {
    const r = await mkClient().from("products").select("*", { count: "exact" }).order("sku").limit(25);
    debug["T2-chain-star-limit"] = `data:${r.data?.length ?? "null"} count:${r.count}`;
  } catch (e) { debug["T2"] = `ERR:${e}`; }

  // T3: Single chain + select("*") + range(0,24)
  try {
    const r = await mkClient().from("products").select("*", { count: "exact" }).order("sku").range(0, 24);
    debug["T3-chain-star-range"] = `data:${r.data?.length ?? "null"} count:${r.count}`;
  } catch (e) { debug["T3"] = `ERR:${e}`; }

  // T4: Broken chain + select("*") + range(0,24) — NO filters
  try {
    const q = mkClient().from("products").select("*", { count: "exact" });
    const r = await q.order("sku", { ascending: true }).range(0, 24);
    debug["T4-broken-star-range"] = `data:${r.data?.length ?? "null"} count:${r.count}`;
  } catch (e) { debug["T4"] = `ERR:${e}`; }

  // T5: Broken chain + select("sku") + range(0,24) — NO filters
  try {
    const q = mkClient().from("products").select("sku", { count: "exact" });
    const r = await q.order("sku", { ascending: true }).range(0, 24);
    debug["T5-broken-sku-range"] = `data:${r.data?.length ?? "null"} count:${r.count}`;
  } catch (e) { debug["T5"] = `ERR:${e}`; }

  // T6: Single chain + select("*") + range(0,24) + ascending variable
  try {
    const r = await mkClient().from("products").select("*", { count: "exact" }).order(sortColumn, { ascending: sortOrder }).range(from, to);
    debug["T6-chain-vars"] = `data:${r.data?.length ?? "null"} count:${r.count}`;
  } catch (e) { debug["T6"] = `ERR:${e}`; }

  // ========= ACTUAL DATA QUERY — single chain, no intermediate variable =========
  let products: Product[] = [];
  let totalCount = 0;
  let queryError: string | null = null;

  try {
    let q = mkClient().from("products").select("*", { count: "exact" });
    if (search) q = q.or(`sku.ilike.%${search}%,urun_adi.ilike.%${search}%`);
    if (kategori) q = q.eq("kategori", kategori as ProductCategory);
    if (aktif === "true") q = q.eq("aktif_mi", true);
    else if (aktif === "false") q = q.eq("aktif_mi", false);
    const { data, count, error } = await q.order(sortColumn, { ascending: sortOrder }).range(from, to);

    if (error) {
      queryError = error.message;
    } else {
      products = (data as Product[]) ?? [];
      totalCount = count ?? 0;
    }
  } catch (e) {
    queryError = String(e);
  }

  debug["ACTUAL"] = `products:${products.length} count:${totalCount} err:${queryError ?? "none"}`;

  return (
    <div className="px-4 pb-6 sm:px-6">
      {/* DEBUG PANEL */}
      <div className="mb-4 p-3 rounded border-2 border-blue-400 bg-blue-50 text-xs font-mono space-y-1">
        <p className="font-bold text-blue-800">DEBUG {BUILD_VERSION}</p>
        {Object.entries(debug).map(([key, val]) => {
          const hasData = val.includes("data:") && !val.includes("data:0") && !val.includes("data:null");
          return (
            <p key={key} className={hasData ? "text-green-700" : "text-red-700"}>
              <b>{key}:</b> {val}
            </p>
          );
        })}
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Ürün Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Ürün listesi, arama, filtreleme ve toplu işlemler
        </p>
      </div>

      {queryError ? (
        <div className="p-6">
          <p className="text-destructive">Veri yüklenirken hata oluştu: {queryError}</p>
        </div>
      ) : (
        <ProductsDataTable
          data={products}
          totalCount={totalCount}
          pageIndex={page}
          pageSize={pageSize}
          search={search}
          kategori={kategori}
          aktif={aktif}
          sortBy={sortColumn}
          sortOrder={sortOrder ? "asc" : "desc"}
        />
      )}
    </div>
  );
}
