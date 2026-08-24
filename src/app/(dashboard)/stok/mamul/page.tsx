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
    depo?: string;
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
  // "" = tüm depolar (ana depo)
  const seciliDepo = params.depo?.trim() || "";

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

  /**
   * Sıralama artık SAYFADA yapılıyor, veritabanında değil.
   *
   * Sebep: ekrandaki "Stok" değeri seçili deponun bakiyesi (urun_depo_stok
   * / urun_toplam_stok görünümünden), ama products.stok_aktif toplam bakiye.
   * DB'de stok_aktif'e göre sıralarsak, belirli bir depo seçiliyken görünen
   * sayılarla sıra tutmuyordu (ör. Yurtdışı deposunda 800 adetlik ürün en
   * altta kalabiliyordu). Aktif ürün sayısı az (~144) olduğu için tümü
   * çekilip bakiyeye göre sıralanıp dilimleniyor; her depoda doğru çalışır.
   */
  const stokSortColumn = ["sku", "gunluk_satis", "stok_aktif"].includes(stokSortBy)
    ? stokSortBy
    : "gunluk_satis";

  // 2. Movements query with filters
  let movementsQuery = supabase
    .from("stock_movements")
    .select("*", { count: "exact" });

  if (seciliDepo) {
    movementsQuery = movementsQuery.eq("depo_id", seciliDepo);
  }
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
  let todayMovementsQuery = supabase
    .from("stock_movements")
    .select("qty")
    .gte("tarih", todayStr);
  if (seciliDepo) todayMovementsQuery = todayMovementsQuery.eq("depo_id", seciliDepo);

  // 5. Depo listesi
  const depolarQuery = supabase
    .from("depolar")
    .select("depo_id, ad")
    .eq("aktif", true)
    .order("sira");

  /**
   * 6. Bakiyeler görünümden geliyor, products.stok_aktif'ten değil.
   * Görünüm hareketlerin toplamı olduğu için ekrandaki sayı ile hareket
   * listesi hep birbirini tutar; ayrı tutulan bir bakiye kolonunda bu
   * garanti yok (yarı mamülde tam bu yüzden eksiye düşmüştü).
   */
  const stokKaynagiQuery = seciliDepo
    ? supabase.from("urun_depo_stok").select("sku, miktar").eq("depo_id", seciliDepo)
    : supabase.from("urun_toplam_stok").select("sku, miktar");

  // Execute all in parallel
  const [
    productsResult,
    movementsResult,
    kpiResult,
    todayResult,
    depolarResult,
    stokKaynagiResult,
  ] = await Promise.all([
    productsQuery,
    movementsQuery,
    kpiQuery,
    todayMovementsQuery,
    depolarQuery,
    stokKaynagiQuery,
  ]);

  const depolar = (depolarResult.data ?? []) as { depo_id: string; ad: string }[];
  const stokHaritasi = new Map<string, number>(
    ((stokKaynagiResult.data ?? []) as { sku: string | null; miktar: number | null }[])
      .filter((r): r is { sku: string; miktar: number | null } => !!r.sku)
      .map((r) => [r.sku, Number(r.miktar ?? 0)]),
  );

  // ---------- PROCESS KPI DATA ----------
  const allActiveProducts = (kpiResult.data || []) as { sku: string; stok_aktif: number; mamul_stok_kritik: number }[];
  const depoStogu = (sku: string) => stokHaritasi.get(sku) ?? 0;
  const totalStock = allActiveProducts.reduce((sum, p) => sum + depoStogu(p.sku), 0);
  const criticalCount = allActiveProducts.filter(
    (p) => p.mamul_stok_kritik > 0 && depoStogu(p.sku) < p.mamul_stok_kritik
  ).length;

  const todayMovements = (todayResult.data || []) as { qty: number }[];
  const todayMovementCount = todayMovements.length;
  const todayProduction = todayMovements
    .filter((m) => m.qty > 0)
    .reduce((sum, m) => sum + m.qty, 0);

  // ---------- SORT (depo bakiyesine göre) + PAGINATE (sayfada) ----------
  const tumUrunler = (productsResult.data || []) as Product[];
  const balans = (p: Product) => stokHaritasi.get(p.sku) ?? 0;
  const yon = stokSortOrder === "asc" ? 1 : -1;
  const siraliUrunler = [...tumUrunler].sort((a, b) => {
    if (stokSortColumn === "sku") return yon * a.sku.localeCompare(b.sku, "tr");
    if (stokSortColumn === "gunluk_satis") {
      return yon * ((a.gunluk_satis ?? 0) - (b.gunluk_satis ?? 0));
    }
    const fark = balans(a) - balans(b);
    return fark !== 0 ? yon * fark : a.sku.localeCompare(b.sku, "tr");
  });
  const stokTotalCount = siraliUrunler.length;
  const sayfaUrunleri = siraliUrunler.slice(
    stokPage * stokPageSize,
    stokPage * stokPageSize + stokPageSize,
  );

  // ---------- FETCH LAST MOVEMENT DATES FOR CURRENT PAGE SKUs ONLY ----------
  const pageSkus = sayfaUrunleri.map((p) => p.sku);
  const lastMovementMap = new Map<string, string>();
  if (pageSkus.length > 0) {
    let lastMovQuery = supabase
      .from("stock_movements")
      .select("sku, tarih")
      .in("sku", pageSkus)
      .order("tarih", { ascending: false });
    if (seciliDepo) lastMovQuery = lastMovQuery.eq("depo_id", seciliDepo);
    const { data: lastMovements } = await lastMovQuery;

    ((lastMovements || []) as { sku: string | null; tarih: string | null }[]).forEach((m) => {
      if (m.sku && m.tarih && !lastMovementMap.has(m.sku)) {
        lastMovementMap.set(m.sku, m.tarih);
      }
    });
  }

  // ---------- ENRICH PRODUCTS WITH LAST MOVEMENT DATE ----------
  const products = sayfaUrunleri.map((p): StokProduct => ({
    ...p,
    // Seçili depodaki (veya tüm depolardaki) miktar
    stok_aktif: stokHaritasi.get(p.sku) ?? 0,
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
        depolar={depolar}
        seciliDepo={seciliDepo}
        kpiData={{
          totalStock,
          criticalCount,
          todayMovements: todayMovementCount,
          todayProduction,
        }}
        stokData={products}
        stokTotalCount={stokTotalCount}
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
