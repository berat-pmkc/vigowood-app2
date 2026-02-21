import { createClient } from "@/lib/supabase/server";
import { createClient as createJsClient } from "@supabase/supabase-js";
import { ProductsDataTable } from "./components/products-data-table";
import type { Database, ProductCategory } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

const BUILD_VERSION = "V6-20260221-1500";

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

  // ========= DEBUG: Test 3 different approaches =========
  const debug: Record<string, string> = {};

  // Approach A: createAdminClient (service_role key, bypasses RLS, uses @supabase/supabase-js directly)
  try {
    const adminClient = createJsClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const r = await adminClient.from("products").select("sku", { count: "exact" }).order("sku").limit(3);
    debug["A-admin"] = `data:${r.data?.length ?? "null"} count:${r.count} err:${r.error?.message ?? "none"} first:${r.data?.[0]?.sku ?? "EMPTY"}`;
  } catch (e) {
    debug["A-admin"] = `EXCEPTION: ${e}`;
  }

  // Approach B: createServerClient (from server.ts, uses @supabase/ssr + rawFetch)
  try {
    const supabase = await createClient();
    const r = await supabase.from("products").select("sku", { count: "exact" }).order("sku").limit(3);
    debug["B-ssr"] = `data:${r.data?.length ?? "null"} count:${r.count} err:${r.error?.message ?? "none"} first:${r.data?.[0]?.sku ?? "EMPTY"}`;
  } catch (e) {
    debug["B-ssr"] = `EXCEPTION: ${e}`;
  }

  // Approach C: Raw fetch to PostgREST API
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/products?select=sku&order=sku.asc&limit=3`;
    const res = await fetch(url, {
      headers: {
        "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY!,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      cache: "no-store",
    });
    const body = await res.text();
    debug["C-rawfetch"] = `status:${res.status} bodyLen:${body.length} body:${body.slice(0, 120)}`;
  } catch (e) {
    debug["C-rawfetch"] = `EXCEPTION: ${e}`;
  }

  // ========= ACTUAL DATA QUERY (using admin client for reliability) =========
  let products: Product[] = [];
  let totalCount = 0;
  let queryError: string | null = null;

  try {
    const adminClient = createJsClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const q = adminClient.from("products").select("*", { count: "exact" });
    if (search) q.or(`sku.ilike.%${search}%,urun_adi.ilike.%${search}%`);
    if (kategori) q.eq("kategori", kategori as ProductCategory);
    if (aktif === "true") q.eq("aktif_mi", true);
    else if (aktif === "false") q.eq("aktif_mi", false);
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

  debug["D-actual"] = `products:${products.length} count:${totalCount} err:${queryError ?? "none"}`;

  return (
    <div className="px-4 pb-6 sm:px-6">
      {/* DEBUG PANEL — will be removed after fix confirmed */}
      <div className="mb-4 p-3 rounded border-2 border-blue-400 bg-blue-50 text-xs font-mono space-y-1">
        <p className="font-bold text-blue-800">DEBUG {BUILD_VERSION}</p>
        {Object.entries(debug).map(([key, val]) => (
          <p key={key}><b>{key}:</b> {val}</p>
        ))}
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
