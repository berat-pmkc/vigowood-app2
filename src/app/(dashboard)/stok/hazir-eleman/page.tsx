import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";
import { HazirElemanClient } from "./components/hazir-eleman-client";
import type { HazirElemanStok } from "./components/parca-stok-data-table";
import type { HazirElemanHareket } from "./components/hareketler-data-table";
import type { DailyChartData } from "./components/trend-chart";
import type { Database } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];
type HakisRow = Database["public"]["Tables"]["hazir_eleman_akis"]["Row"];

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    pageSize?: string;
    search?: string;
    partType?: string;
    sortBy?: string;
    sortOrder?: string;
    mPage?: string;
    mPageSize?: string;
    mSearch?: string;
    mSortBy?: string;
    mSortOrder?: string;
  }>;
}

export const metadata: Metadata = { title: "Hazir Eleman Stok" };

export default async function HazirElemanPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  // Check stock access for add button
  const user = await getCurrentUser();
  const canAddStock = !!user && STOCK_ACCESS_ROLES.includes(user.role);

  const activeTab = params.tab === "hareketler" ? "hareketler" : "ozet";

  // ---------- STOK TABLE PARAMS ----------
  const stokPage = Math.max(0, Number(params.page || "0"));
  const stokPageSize = [25, 50, 100].includes(Number(params.pageSize || "100"))
    ? Number(params.pageSize || "100")
    : 100;
  const stokSearch = params.search?.trim() || "";
  const stokPartType = params.partType || "";
  const stokSortBy = params.sortBy || "part_id";
  const stokSortOrder = params.sortOrder === "desc" ? "desc" as const : "asc" as const;

  // ---------- MOVEMENTS TABLE PARAMS ----------
  const mPage = Math.max(0, Number(params.mPage || "0"));
  const mPageSize = [25, 50, 100].includes(Number(params.mPageSize || "100"))
    ? Number(params.mPageSize || "100")
    : 100;
  const mSearch = params.mSearch?.trim() || "";
  const mSortBy = params.mSortBy || "tarih";
  const mSortOrder = params.mSortOrder === "asc" ? "asc" as const : "desc" as const;

  // ---------- FETCH ALL DATA IN PARALLEL ----------
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  // 1. Parts query (HAZIR + KUTU + KARTON) with filters
  let partsQuery = supabase
    .from("all_parts")
    .select("*", { count: "exact" })
    .in("part_type", ["HAZIR", "KUTU", "KARTON"]);

  if (stokSearch) {
    partsQuery = partsQuery.or(`part_id.ilike.%${stokSearch}%,part_adi.ilike.%${stokSearch}%`);
  }
  if (stokPartType && ["HAZIR", "KUTU", "KARTON"].includes(stokPartType)) {
    partsQuery = partsQuery.eq("part_type", stokPartType as "HAZIR" | "KUTU" | "KARTON");
  }

  const validStokSortColumns: (keyof AllPart)[] = [
    "part_id", "part_adi", "part_type", "hazir_eleman_aktif_stok", "hazir_eleman_kritik_stok",
  ];
  const stokSortColumn = validStokSortColumns.includes(stokSortBy as keyof AllPart)
    ? stokSortBy
    : "part_id";
  partsQuery = partsQuery
    .order(stokSortColumn, { ascending: stokSortOrder === "asc" })
    .range(stokPage * stokPageSize, stokPage * stokPageSize + stokPageSize - 1);

  // 2. Movements query with filters
  let movementsQuery = supabase
    .from("hazir_eleman_akis")
    .select("*", { count: "exact" });

  if (mSearch) {
    movementsQuery = movementsQuery.or(`part_id.ilike.%${mSearch}%,hakis_id.ilike.%${mSearch}%`);
  }

  const validMSortColumns = ["tarih", "part_id", "qty"];
  const mSortColumn = validMSortColumns.includes(mSortBy) ? mSortBy : "tarih";
  movementsQuery = movementsQuery
    .order(mSortColumn, { ascending: mSortOrder === "asc" })
    .range(mPage * mPageSize, mPage * mPageSize + mPageSize - 1);

  // 3. KPI: All HAZIR/KUTU/KARTON parts for totals
  const kpiQuery = supabase
    .from("all_parts")
    .select("part_id, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok")
    .in("part_type", ["HAZIR", "KUTU", "KARTON"]);

  // 4. Today's movements
  const todayMovementsQuery = supabase
    .from("hazir_eleman_akis")
    .select("qty")
    .gte("tarih", todayStr);

  // 5. Chart data: last 30 days movements
  const chartQuery = supabase
    .from("hazir_eleman_akis")
    .select("tarih, qty")
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
  const allParts = (kpiResult.data || []) as { part_id: string; hazir_eleman_aktif_stok: number; hazir_eleman_kritik_stok: number }[];
  const totalPartCount = allParts.length;
  const criticalCount = allParts.filter(
    (p) => p.hazir_eleman_kritik_stok > 0 && p.hazir_eleman_aktif_stok < p.hazir_eleman_kritik_stok
  ).length;

  const todayMovements = (todayResult.data || []) as { qty: number }[];
  const todayMovementCount = todayMovements.length;
  const todayIn = todayMovements.reduce((sum, m) => sum + m.qty, 0);

  // ---------- PROCESS CHART DATA ----------
  const dailyMap = new Map<string, number>();
  for (let i = 0; i <= 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, 0);
  }
  (chartResult.data || []).forEach((m: { tarih: string; qty: number }) => {
    if (!m.tarih) return;
    const day = m.tarih.split("T")[0];
    const existing = dailyMap.get(day);
    if (existing !== undefined) {
      dailyMap.set(day, existing + m.qty);
    }
  });
  const chartData: DailyChartData[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, giris]) => ({ date, giris }));

  // ---------- FETCH LAST MOVEMENT DATES FOR CURRENT PAGE PARTS ----------
  const partsList = (partsResult.data || []) as AllPart[];
  const partIds = partsList.map((p) => p.part_id);

  let lastMovementMap = new Map<string, string>();
  if (partIds.length > 0) {
    const { data: lastMovements } = await supabase
      .from("hazir_eleman_akis")
      .select("part_id, tarih")
      .in("part_id", partIds)
      .order("tarih", { ascending: false });

    ((lastMovements || []) as { part_id: string | null; tarih: string }[]).forEach((m) => {
      if (m.part_id && m.tarih && !lastMovementMap.has(m.part_id)) {
        lastMovementMap.set(m.part_id, m.tarih);
      }
    });
  }

  // ---------- ENRICH PARTS ----------
  const parts: HazirElemanStok[] = partsList.map((p) => ({
    part_id: p.part_id,
    part_adi: p.part_adi,
    part_type: p.part_type,
    hazir_eleman_aktif_stok: p.hazir_eleman_aktif_stok,
    hazir_eleman_kritik_stok: p.hazir_eleman_kritik_stok,
    son_hareket_tarihi: lastMovementMap.get(p.part_id) || null,
  }));

  // ---------- ENRICH MOVEMENTS WITH PART NAMES ----------
  const movementPartIds = new Set<string>();
  ((movementsResult.data || []) as { part_id: string | null }[]).forEach((m) => {
    if (m.part_id) movementPartIds.add(m.part_id);
  });

  let partNameMap = new Map<string, string>();
  if (movementPartIds.size > 0) {
    const { data: partNames } = await supabase
      .from("all_parts")
      .select("part_id, part_adi")
      .in("part_id", Array.from(movementPartIds));
    (partNames || []).forEach((p: { part_id: string; part_adi: string }) => {
      partNameMap.set(p.part_id, p.part_adi);
    });
  }

  const movements: HazirElemanHareket[] = ((movementsResult.data || []) as HakisRow[]).map((m) => ({
    hakis_id: m.hakis_id,
    tarih: m.tarih,
    part_id: m.part_id,
    part_adi: m.part_id ? (partNameMap.get(m.part_id) || null) : null,
    qty: m.qty,
    operator: m.operator,
    not_text: m.not_text,
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
      <HazirElemanClient
        activeTab={activeTab}
        canAddStock={canAddStock}
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
        stokPartType={stokPartType}
        stokSortBy={stokSortColumn}
        stokSortOrder={stokSortOrder}
        movementsData={movements}
        movementsTotalCount={movementsResult.count ?? 0}
        movementsPageIndex={mPage}
        movementsPageSize={mPageSize}
        movementsSearch={mSearch}
        movementsSortBy={mSortColumn}
        movementsSortOrder={mSortOrder}
      />
    </div>
  );
}
