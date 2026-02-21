import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
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
  const sortOrder = params.sortOrder === "desc" ? false : true; // ascending = true

  const from = page * pageSize;
  const to = from + pageSize - 1;

  // ===== DIAGNOSTIC TESTS =====
  const diagnostics: Record<string, unknown> = {};

  // Test 0: Raw fetch to Supabase REST API (bypass Supabase client)
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const authCookie = allCookies.find(c => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
    let accessToken = "";
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value);
        accessToken = parsed?.access_token || parsed?.[0] || "";
      } catch {
        // cookie might be base64 encoded or chunked
        accessToken = "PARSE_FAILED";
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const rawRes = await fetch(
      `${supabaseUrl}/rest/v1/products?select=sku,urun_adi&order=sku.asc&limit=3`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken || anonKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    const rawData = await rawRes.json();
    diagnostics.test0_rawFetch = {
      status: rawRes.status,
      dataLength: Array.isArray(rawData) ? rawData.length : "NOT_ARRAY",
      data: Array.isArray(rawData) ? rawData.slice(0, 2) : rawData,
      hasAuthCookie: !!authCookie,
      cookieNames: allCookies.map(c => c.name),
      tokenPreview: accessToken ? accessToken.slice(0, 20) + "..." : "NONE",
    };
  } catch (e) {
    diagnostics.test0_rawFetch = { error: String(e) };
  }

  const supabase = await createClient();

  // Test 1: Simple select with limit (no count, no range)
  const { data: t1, error: t1e } = await supabase
    .from("products")
    .select("sku")
    .limit(3);
  diagnostics.test1_simpleLimitSelect = {
    length: t1?.length ?? "NULL",
    error: t1e?.message ?? null,
    data: t1,
  };

  // Test 2: select("*") with limit (no count, no range)
  const { data: t2, error: t2e } = await supabase
    .from("products")
    .select("*")
    .limit(3);
  diagnostics.test2_starLimitSelect = {
    length: t2?.length ?? "NULL",
    error: t2e?.message ?? null,
    firstSku: t2?.[0] ? (t2[0] as Record<string, unknown>).sku : "EMPTY",
  };

  // Test 3: select("*") with count + range (exact same as original query)
  const { data: t3, count: t3c, error: t3e } = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .order("sku", { ascending: true })
    .range(0, 24);
  diagnostics.test3_starCountRange = {
    length: t3?.length ?? "NULL",
    count: t3c,
    error: t3e?.message ?? null,
    firstSku: t3?.[0] ? (t3[0] as Record<string, unknown>).sku : "EMPTY",
  };

  // Test 4: select specific columns with count + range
  const { data: t4, count: t4c, error: t4e } = await supabase
    .from("products")
    .select("sku, urun_adi, kategori, aktif_mi", { count: "exact" })
    .order("sku", { ascending: true })
    .range(0, 24);
  diagnostics.test4_specificCountRange = {
    length: t4?.length ?? "NULL",
    count: t4c,
    error: t4e?.message ?? null,
    data: t4?.slice(0, 2),
  };

  // ===== ORIGINAL QUERY =====
  let query = supabase
    .from("products")
    .select("*", { count: "exact" });

  if (search) {
    query = query.or(`sku.ilike.%${search}%,urun_adi.ilike.%${search}%`);
  }

  if (kategori) {
    query = query.eq("kategori", kategori as ProductCategory);
  }

  if (aktif === "true") {
    query = query.eq("aktif_mi", true);
  } else if (aktif === "false") {
    query = query.eq("aktif_mi", false);
  }

  const validSortColumns: (keyof Product)[] = [
    "sku", "urun_adi", "kategori", "aktif_mi", "stok_aktif",
    "gunluk_satis", "aylik_uretim",
  ];
  const sortColumn = validSortColumns.includes(sortBy as keyof Product)
    ? sortBy
    : "sku";
  query = query.order(sortColumn, { ascending: sortOrder });
  query = query.range(from, to);

  const { data: products, count, error } = await query;

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Veri yüklenirken hata oluştu: {error.message}</p>
        <pre className="mt-4 text-xs">{JSON.stringify(diagnostics, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 sm:px-6">
      {/* COMPREHENSIVE DIAGNOSTIC */}
      <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-xs font-mono overflow-auto max-h-96">
        <p><strong>DIAGNOSTIC RESULTS:</strong></p>
        <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
        <hr className="my-2" />
        <p><strong>ORIGINAL QUERY:</strong></p>
        <p>products length: {products?.length ?? "NULL"} | count: {count ?? "NULL"}</p>
      </div>

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
