import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { YariMamulStokClient } from "./components/yari-mamul-stok-client";
import type { ParcaStok } from "./components/parca-stok-data-table";
import type { YariMamulHareket } from "./components/hareketler-data-table";
import type { DailyChartData } from "./components/trend-chart";
import type { Database } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];
type YmsRow = Database["public"]["Tables"]["yari_mamul_stok"]["Row"];

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    // Stock table params
    page?: string;
    pageSize?: string;
    search?: string;
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

export const metadata: Metadata = { title: "Yari Mamul Stok" };

export default async function YariMamulStokPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const activeTab = params.tab === "hareketler" ? "hareketler" : "ozet";

  // ---------- STOK TABLE PARAMS ----------
  const stokPage = Math.max(0, Number(params.page || "0"));
  const stokPageSize = [25, 50, 100].includes(Number(params.pageSize || "100"))
    ? Number(params.pageSize || "100")
    : 100;
  const stokSearch = params.search?.trim() || "";
  const stokSortBy = params.sortBy || "part_id";
  const stokSortOrder = params.sortOrder === "desc" ? "desc" as const : "asc" as const;

  // ---------- MOVEMENTS TABLE PARAMS ----------
  const mPage = Math.max(0, Number(params.mPage || "0"));
  const mPageSize = [25, 50, 100].includes(Number(params.mPageSize || "100"))
    ? Number(params.mPageSize || "100")
    : 100;
  const mSearch = params.mSearch?.trim() || "";
  const mSource = params.mSource || "";
  const mSortBy = params.mSortBy || "tarih";
  const mSortOrder = params.mSortOrder === "asc" ? "asc" as const : "desc" as const;

  // ---------- FETCH ALL DATA IN PARALLEL ----------
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  // 1. Parts query (YARIMAMUL only) with filters
  let partsQuery = supabase
    .from("all_parts")
    .select("*", { count: "exact" })
    .eq("part_type", "YARIMAMUL");

  if (stokSearch) {
    partsQuery = partsQuery.or(`part_id.ilike.%${stokSearch}%,part_adi.ilike.%${stokSearch}%`);
  }

  const validStokSortColumns: (keyof AllPart)[] = [
    "part_id", "part_adi", "yari_mamul_stok", "hazir_eleman_kritik_stok",
  ];
  const stokSortColumn = validStokSortColumns.includes(stokSortBy as keyof AllPart)
    ? stokSortBy
    : "part_id";
  partsQuery = partsQuery
    .order(stokSortColumn, { ascending: stokSortOrder === "asc" })
    .range(stokPage * stokPageSize, stokPage * stokPageSize + stokPageSize - 1);

  // 2. Movements query with filters
  let movementsQuery = supabase
    .from("yari_mamul_stok")
    .select("*", { count: "exact" });

  if (mSearch) {
    movementsQuery = movementsQuery.or(`part_id.ilike.%${mSearch}%,source_id.ilike.%${mSearch}%`);
  }
  if (mSource) {
    movementsQuery = movementsQuery.eq("source", mSource);
  }

  const validMSortColumns = ["tarih", "part_id", "qty", "source"];
  const mSortColumn = validMSortColumns.includes(mSortBy) ? mSortBy : "tarih";
  movementsQuery = movementsQuery
    .order(mSortColumn, { ascending: mSortOrder === "asc" })
    .range(mPage * mPageSize, mPage * mPageSize + mPageSize - 1);

  // 3. KPI: All YARIMAMUL parts for totals
  const kpiQuery = supabase
    .from("all_parts")
    .select("part_id, yari_mamul_stok, hazir_eleman_kritik_stok")
    .eq("part_type", "YARIMAMUL");

  // 4. Today's movements
  const todayMovementsQuery = supabase
    .from("yari_mamul_stok")
    .select("qty, direction")
    .gte("tarih", todayStr);

  // 5. Chart data: last 30 days movements
  const chartQuery = supabase
    .from("yari_mamul_stok")
    .select("tarih, qty, direction")
    .gte("tarih", thirtyDaysAgoStr)
    .order("tarih", { ascending: true });

  // Execute all in parallel
  const [
    partsResult,
    movementsResult,
    kpiResult,
    todayResult,
    chartResult,
  ] = await Promise.all([
    partsQuery,
    movementsQuery,
    kpiQuery,
    todayMovementsQuery,
    chartQuery,
  ]);

  // ---------- PROCESS KPI DATA ----------
  const allYMParts = (kpiResult.data || []) as { part_id: string; yari_mamul_stok: number; hazir_eleman_kritik_stok: number }[];
  const totalPartCount = allYMParts.length;
  const criticalCount = allYMParts.filter(
    (p) => p.hazir_eleman_kritik_stok > 0 && p.yari_mamul_stok < p.hazir_eleman_kritik_stok
  ).length;

  const todayMovements = (todayResult.data || []) as { qty: number; direction: string | null }[];
  const todayMovementCount = todayMovements.length;
  const todayIn = todayMovements
    .filter((m) => m.direction === "IN")
    .reduce((sum, m) => sum + m.qty, 0);

  // ---------- PROCESS CHART DATA ----------
  const dailyMap = new Map<string, { giris: number; cikis: number }>();
  // Fill all 30 days
  for (let i = 0; i <= 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { giris: 0, cikis: 0 });
  }
  (chartResult.data || []).forEach((m: { tarih: string | null; qty: number; direction: string | null }) => {
    if (!m.tarih) return;
    const day = m.tarih.split("T")[0];
    const existing = dailyMap.get(day);
    if (existing) {
      if (m.direction === "IN") {
        existing.giris += m.qty;
      } else {
        existing.cikis += m.qty;
      }
    }
  });
  const chartData: DailyChartData[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      giris: vals.giris,
      cikis: vals.cikis,
    }));

  // ---------- FETCH LAST MOVEMENT DATES FOR CURRENT PAGE PARTS ----------
  const partsList = (partsResult.data || []) as AllPart[];
  const partIds = partsList.map((p) => p.part_id);

  let lastMovementMap = new Map<string, string>();
  if (partIds.length > 0) {
    const { data: lastMovements } = await supabase
      .from("yari_mamul_stok")
      .select("part_id, tarih")
      .in("part_id", partIds)
      .order("tarih", { ascending: false });

    ((lastMovements || []) as { part_id: string | null; tarih: string | null }[]).forEach((m) => {
      if (m.part_id && m.tarih && !lastMovementMap.has(m.part_id)) {
        lastMovementMap.set(m.part_id, m.tarih);
      }
    });
  }

  // ---------- ENRICH PARTS WITH LAST MOVEMENT DATE ----------
  const parts: ParcaStok[] = partsList.map((p) => ({
    part_id: p.part_id,
    part_adi: p.part_adi,
    yari_mamul_stok: p.yari_mamul_stok,
    hazir_eleman_kritik_stok: p.hazir_eleman_kritik_stok,
    son_hareket_tarihi: lastMovementMap.get(p.part_id) || null,
  }));

  // ---------- BUILD MOVEMENTS ----------
  const movements: YariMamulHareket[] = ((movementsResult.data || []) as YmsRow[]).map((m) => ({
    yms_id: m.yms_id,
    tarih: m.tarih,
    part_id: m.part_id,
    part_adi: m.part_adi,
    sku: m.sku,
    qty: m.qty,
    direction: m.direction,
    source: m.source,
    source_id: m.source_id,
    operator: m.operator,
    created_at: m.created_at,
  }));

  // ---------- ERROR HANDLING ----------
  if (partsResult.error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Veri yüklenirken hata oluştu: {partsResult.error.message}</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6">
      <YariMamulStokClient
        activeTab={activeTab}
        kpiData={{
          totalPartCount,
          criticalCount,
          todayIn,
          todayMovements: todayMovementCount,
        }}
        chartData={chartData}
        stokData={parts}
        stokTotalCount={partsResult.count ?? 0}
        stokPageIndex={stokPage}
        stokPageSize={stokPageSize}
        stokSearch={stokSearch}
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
