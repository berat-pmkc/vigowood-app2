import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { MamulStokClient } from "./components/mamul-stok-client";
import type { StokProduct } from "./components/stok-data-table";
import type { StokMovement } from "./components/hareketler-data-table";
import type { Database, ProductCategory } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    // Stok table params
    page?: string;
    pageSize?: string;
    search?: string;
    kategori?: string;
    sortBy?: string;
    sortOrder?: string;
    // Movements table params
    mPage?: string;
    mPageSize?: string;
    mSearch?: string;
    mSource?: string;
    mSortBy?: string;
    mSortOrder?: string;
  }>;
}

export const metadata: Metadata = { title: "Ürün Stok" };

export default async function MamulStokPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const activeTab = params.tab === "hareketler" ? "hareketler" : "ozet";

  // ---------- STOK TABLE PARAMS ----------
  const stokPage = Math.max(0, Number(params.page || "0"));
  const stokPageSize = [25, 50, 100].includes(Number(params.pageSize || "100"))
    ? Number(params.pageSize || "100")
    : 100;
  const stokSearch = params.search?.trim() || "";
  const stokKategori = params.kategori || "";
  const stokSortBy = params.sortBy || "gunluk_satis";
  const stokSortOrder = params.sortOrder === "asc" ? "asc" as const : "desc" as const;

  // ---------- MOVEMENTS TABLE PARAMS ----------
  const mPage = Math.max(0, Number(params.mPage || "0"));
  const mPageSize = [25, 50, 100].includes(Number(params.mPageSize || "100"))
    ? Number(params.mPageSize || "100")
    : 100;
  const mSearch = params.mSearch?.trim() || "";
  const mSource = params.mSource || "";
  const mSortBy = params.mSortBy || "tarih";
  const mSortOrder = params.mSortOrder === "asc" ? "asc" as const : "desc" as const;

  // ---------- FETCH DATA IN PARALLEL ----------
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // 1. Products query with filters
  let productsQuery = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("aktif_mi", true);

  if (stokSearch) {
    productsQuery = productsQuery.or(`sku.ilike.%${stokSearch}%,urun_adi.ilike.%${stokSearch}%`);
  }
  if (stokKategori) {
    productsQuery = productsQuery.eq("kategori", stokKategori as ProductCategory);
  }

  const validStokSortColumns: (keyof Product)[] = [
    "sku", "urun_adi", "kategori", "stok_aktif", "mamul_stok_kritik", "gunluk_satis",
  ];
  const stokSortColumn = validStokSortColumns.includes(stokSortBy as keyof Product)
    ? stokSortBy
    : "gunluk_satis";
  productsQuery = productsQuery
    .order(stokSortColumn, { ascending: stokSortOrder === "asc" })
    .range(stokPage * stokPageSize, stokPage * stokPageSize + stokPageSize - 1);

  // 2. Movements query with filters
  let movementsQuery = supabase
    .from("stock_movements")
    .select("*", { count: "exact" });

  if (mSearch) {
    movementsQuery = movementsQuery.or(`sku.ilike.%${mSearch}%,source_row_id.ilike.%${mSearch}%`);
  }
  if (mSource) {
    movementsQuery = movementsQuery.eq("source", mSource);
  }

  const validMSortColumns = ["tarih", "sku", "qty", "source"];
  const mSortColumn = validMSortColumns.includes(mSortBy) ? mSortBy : "tarih";
  movementsQuery = movementsQuery
    .order(mSortColumn, { ascending: mSortOrder === "asc" })
    .range(mPage * mPageSize, mPage * mPageSize + mPageSize - 1);

  // 3. KPI: All active products for totals
  const kpiQuery = supabase
    .from("products")
    .select("sku, stok_aktif, mamul_stok_kritik")
    .eq("aktif_mi", true);

  // 4. Today's movements
  const todayMovementsQuery = supabase
    .from("stock_movements")
    .select("qty")
    .gte("tarih", todayStr);

  // Execute all in parallel
  const [
    productsResult,
    movementsResult,
    kpiResult,
    todayResult,
  ] = await Promise.all([
    productsQuery,
    movementsQuery,
    kpiQuery,
    todayMovementsQuery,
  ]);

  // ---------- PROCESS KPI DATA ----------
  const allActiveProducts = (kpiResult.data || []) as { sku: string; stok_aktif: number; mamul_stok_kritik: number }[];
  const totalStock = allActiveProducts.reduce((sum, p) => sum + (p.stok_aktif || 0), 0);
  const criticalCount = allActiveProducts.filter(
    (p) => p.mamul_stok_kritik > 0 && p.stok_aktif < p.mamul_stok_kritik
  ).length;

  const todayMovements = (todayResult.data || []) as { qty: number }[];
  const todayMovementCount = todayMovements.length;
  const todayProduction = todayMovements
    .filter((m) => m.qty > 0)
    .reduce((sum, m) => sum + m.qty, 0);

  // ---------- FETCH LAST MOVEMENT DATES FOR CURRENT PAGE SKUs ONLY ----------
  const pageSkus = ((productsResult.data || []) as Product[]).map((p) => p.sku);
  const lastMovementMap = new Map<string, string>();
  if (pageSkus.length > 0) {
    const { data: lastMovements } = await supabase
      .from("stock_movements")
      .select("sku, tarih")
      .in("sku", pageSkus)
      .order("tarih", { ascending: false });

    ((lastMovements || []) as { sku: string | null; tarih: string | null }[]).forEach((m) => {
      if (m.sku && m.tarih && !lastMovementMap.has(m.sku)) {
        lastMovementMap.set(m.sku, m.tarih);
      }
    });
  }

  // ---------- ENRICH PRODUCTS WITH LAST MOVEMENT DATE ----------
  const products = ((productsResult.data || []) as Product[]).map((p): StokProduct => ({
    ...p,
    son_hareket_tarihi: lastMovementMap.get(p.sku) || null,
  }));

  // ---------- ENRICH MOVEMENTS WITH PRODUCT NAMES ----------
  const movementSkus = new Set<string>();
  ((movementsResult.data || []) as { sku: string | null }[]).forEach((m) => {
    if (m.sku) movementSkus.add(m.sku);
  });

  const skuNameMap = new Map<string, string>();
  if (movementSkus.size > 0) {
    const { data: skuNames } = await supabase
      .from("products")
      .select("sku, urun_adi")
      .in("sku", Array.from(movementSkus));
    (skuNames || []).forEach((p: { sku: string; urun_adi: string | null }) => {
      if (p.urun_adi) skuNameMap.set(p.sku, p.urun_adi);
    });
  }

  type StockMovementRow = Database["public"]["Tables"]["stock_movements"]["Row"];
  const movements: StokMovement[] = ((movementsResult.data || []) as StockMovementRow[]).map((m) => ({
    id: m.id,
    mov_id: m.mov_id,
    tarih: m.tarih,
    sku: m.sku,
    urun_adi: m.sku ? (skuNameMap.get(m.sku) || null) : null,
    qty: m.qty,
    source: m.source,
    source_row_id: m.source_row_id,
    batch_id: m.batch_id,
    created_at: m.created_at,
  }));

  // ---------- ERROR HANDLING ----------
  if (productsResult.error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Veri yüklenirken hata oluştu: {productsResult.error.message}</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6">
      <MamulStokClient
        activeTab={activeTab}
        kpiData={{
          totalStock,
          criticalCount,
          todayMovements: todayMovementCount,
          todayProduction,
        }}
        stokData={products}
        stokTotalCount={productsResult.count ?? 0}
        stokPageIndex={stokPage}
        stokPageSize={stokPageSize}
        stokSearch={stokSearch}
        stokKategori={stokKategori}
        stokSortBy={stokSortColumn}
        stokSortOrder={stokSortOrder}
        movementsData={movements}
        movementsTotalCount={movementsResult.count ?? 0}
        movementsPageIndex={mPage}
        movementsPageSize={mPageSize}
        movementsSearch={mSearch}
        movementsSource={mSource}
        movementsSortBy={mSortColumn}
        movementsSortOrder={mSortOrder}
      />
    </div>
  );
}
