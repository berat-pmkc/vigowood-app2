import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";
import { IadeClient } from "./components/iade-client";
import type { IadeRecord } from "./components/iade-data-table";
import type { DailyIadeChartData } from "./components/trend-chart";
import type { Database } from "@/lib/supabase/types";

type IadeRow = Database["public"]["Tables"]["iade_giris"]["Row"];

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    durum?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export const metadata: Metadata = { title: "Iade" };

export default async function IadeGirisPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  // Check stock access for add button
  const user = await getCurrentUser();
  const canAddIade = !!user && STOCK_ACCESS_ROLES.includes(user.role);

  // ---------- TABLE PARAMS ----------
  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "25"))
    ? Number(params.pageSize || "25")
    : 25;
  const search = params.search?.trim() || "";
  const durum = params.durum || "";
  const sortBy = params.sortBy || "tarih";
  const sortOrder = params.sortOrder === "asc" ? "asc" as const : "desc" as const;

  // ---------- FETCH ALL DATA IN PARALLEL ----------
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  // 1. İade records with filters
  let iadeQuery = supabase
    .from("iade_giris")
    .select("*", { count: "exact" });

  if (search) {
    iadeQuery = iadeQuery.or(`sku.ilike.%${search}%,iade_id.ilike.%${search}%`);
  }
  if (durum && ["Kullanilabilir", "Kullanilamaz"].includes(durum)) {
    iadeQuery = iadeQuery.eq("durum", durum);
  }

  const validSortColumns = ["tarih", "sku", "qty", "durum"];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "tarih";
  iadeQuery = iadeQuery
    .order(sortColumn, { ascending: sortOrder === "asc" })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  // 2. KPI: Total counts and sums
  const kpiAllQuery = supabase
    .from("iade_giris")
    .select("qty, durum");

  // 3. Today's returns
  const todayQuery = supabase
    .from("iade_giris")
    .select("iade_id")
    .gte("tarih", todayStr);

  // 4. Chart data: last 30 days
  const chartQuery = supabase
    .from("iade_giris")
    .select("tarih, qty, durum")
    .gte("tarih", thirtyDaysAgoStr)
    .order("tarih", { ascending: true });

  // Execute all in parallel
  const [
    iadeResult,
    kpiResult,
    todayResult,
    chartResult,
  ] = await Promise.all([
    iadeQuery,
    kpiAllQuery,
    todayQuery,
    chartQuery,
  ]);

  // ---------- PROCESS KPI DATA ----------
  const allIade = (kpiResult.data || []) as { qty: number; durum: string | null }[];
  const totalCount = allIade.length;
  const kullanilabilirQty = allIade
    .filter((r) => r.durum === "Kullanilabilir")
    .reduce((sum, r) => sum + r.qty, 0);
  const kullanilamazQty = allIade
    .filter((r) => r.durum === "Kullanilamaz")
    .reduce((sum, r) => sum + r.qty, 0);
  const todayCount = (todayResult.data || []).length;

  // ---------- PROCESS CHART DATA ----------
  const dailyMap = new Map<string, { kullanilabilir: number; kullanilamaz: number }>();
  for (let i = 0; i <= 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { kullanilabilir: 0, kullanilamaz: 0 });
  }
  (chartResult.data || []).forEach((m: { tarih: string | null; qty: number; durum: string | null }) => {
    if (!m.tarih) return;
    const day = m.tarih.split("T")[0];
    const existing = dailyMap.get(day);
    if (existing) {
      if (m.durum === "Kullanilabilir") {
        existing.kullanilabilir += m.qty;
      } else {
        existing.kullanilamaz += m.qty;
      }
    }
  });
  const chartData: DailyIadeChartData[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      kullanilabilir: vals.kullanilabilir,
      kullanilamaz: vals.kullanilamaz,
    }));

  // ---------- ENRICH IADE RECORDS WITH PRODUCT NAMES ----------
  const iadeRows = (iadeResult.data || []) as IadeRow[];
  const skuSet = new Set<string>();
  iadeRows.forEach((r) => {
    if (r.sku) skuSet.add(r.sku);
  });

  let skuNameMap = new Map<string, string>();
  if (skuSet.size > 0) {
    const { data: skuNames } = await supabase
      .from("products")
      .select("sku, urun_adi")
      .in("sku", Array.from(skuSet));
    (skuNames || []).forEach((p: { sku: string; urun_adi: string | null }) => {
      if (p.urun_adi) skuNameMap.set(p.sku, p.urun_adi);
    });
  }

  const iadeData: IadeRecord[] = iadeRows.map((r) => ({
    iade_id: r.iade_id,
    tarih: r.tarih,
    sku: r.sku,
    urun_adi: r.sku ? (skuNameMap.get(r.sku) || null) : null,
    qty: r.qty,
    durum: r.durum,
    iade_nedeni: r.iade_nedeni,
    musteri_bilgisi: r.musteri_bilgisi,
    operator: r.operator,
    created_at: r.created_at,
  }));

  // ---------- ERROR HANDLING ----------
  if (iadeResult.error) {
    return (
      <div className="p-6">
        <p className="text-destructive">Veri yüklenirken hata oluştu: {iadeResult.error.message}</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6">
      <IadeClient
        canAddIade={canAddIade}
        kpiData={{
          totalCount,
          kullanilabilirQty,
          kullanilamazQty,
          todayCount,
        }}
        chartData={chartData}
        iadeData={iadeData}
        iadeTotalCount={iadeResult.count ?? 0}
        iadePageIndex={page}
        iadePageSize={pageSize}
        iadeSearch={search}
        iadeDurum={durum}
        iadeSortBy={sortColumn}
        iadeSortOrder={sortOrder}
      />
    </div>
  );
}
