import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { OdemelerClient } from "./components/odemeler-client";
import type { Odeme, Database } from "@/lib/supabase/types";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    pageSize?: string;
    search?: string;
    turu?: string;
    durum?: string;
    cinsi?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export const metadata: Metadata = { title: "Ödemeler | VigoWood" };

export default async function OdemelerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const activeTab = params.tab === "ozet" ? "ozet" : "liste";

  // ---------- TABLE PARAMS ----------
  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "25"))
    ? Number(params.pageSize || "25")
    : 25;
  const search = params.search?.trim() || "";
  const turu = params.turu || "";
  const durum = params.durum || "";
  const cinsi = params.cinsi || "";
  const dateFrom = params.dateFrom || "";
  const dateTo = params.dateTo || "";
  const sortBy = params.sortBy || "tarih";
  const sortOrder = params.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);

  // ---------- DATES ----------
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const sevenDaysLaterStr = sevenDaysLater.toISOString().split("T")[0];

  const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  // ---------- 1. Ödeme listesi (paginated + filtered + sorted) ----------
  let listQuery = supabase
    .from("odemeler")
    .select("*", { count: "exact" });

  if (search) {
    listQuery = listQuery.ilike("tanimi", `%${search}%`);
  }
  if (turu) {
    listQuery = listQuery.eq("turu", turu as Database["public"]["Enums"]["odeme_turu"]);
  }
  if (durum) {
    listQuery = listQuery.eq("odeme_durum", durum as Database["public"]["Enums"]["odeme_durumu"]);
  }
  if (cinsi) {
    listQuery = listQuery.eq("cinsi", cinsi as Database["public"]["Enums"]["para_birimi"]);
  }
  if (dateFrom) {
    listQuery = listQuery.gte("tarih", dateFrom);
  }
  if (dateTo) {
    listQuery = listQuery.lte("tarih", dateTo);
  }

  const validSortColumns = ["tarih", "tanimi", "turu", "tutar", "cinsi", "odeme_durum"];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "tarih";
  listQuery = listQuery
    .order(sortColumn, { ascending: sortOrder === "asc" })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  // ---------- 2. Bekleyen TL toplamı ----------
  const bekleyenTlQuery = supabase
    .from("odemeler")
    .select("tutar")
    .eq("odeme_durum", "BEKLİYOR")
    .eq("cinsi", "TL");

  // ---------- 3. Bekleyen USD toplamı ----------
  const bekleyenUsdQuery = supabase
    .from("odemeler")
    .select("tutar")
    .eq("odeme_durum", "BEKLİYOR")
    .eq("cinsi", "USD");

  // ---------- 4. Yaklaşan 7 gün ----------
  const yaklasanQuery = supabase
    .from("odemeler")
    .select("id", { count: "exact", head: true })
    .eq("odeme_durum", "BEKLİYOR")
    .gte("tarih", todayStr)
    .lte("tarih", sevenDaysLaterStr);

  // ---------- 5. Bu ay tamamlanan ----------
  const buAyQuery = supabase
    .from("odemeler")
    .select("id", { count: "exact", head: true })
    .eq("odeme_durum", "TAMAMLANDI")
    .gte("tarih", thisMonthStart)
    .lte("tarih", todayStr);

  // ---------- 6. Trend (son 6 ay) ----------
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split("T")[0];

  const trendQuery = supabase
    .from("odemeler")
    .select("tarih, tutar, odeme_durum, cinsi")
    .gte("tarih", sixMonthsAgoStr)
    .order("tarih");

  // Execute all in parallel
  const [
    listResult,
    bekleyenTlResult,
    bekleyenUsdResult,
    yaklasanResult,
    buAyResult,
    trendResult,
  ] = await Promise.all([
    listQuery,
    bekleyenTlQuery,
    bekleyenUsdQuery,
    yaklasanQuery,
    buAyQuery,
    trendQuery,
  ]);

  // ---------- PROCESS KPI ----------
  const bekleyenTl = (bekleyenTlResult.data ?? []).reduce(
    (sum, r) => sum + Number(r.tutar),
    0
  );
  const bekleyenUsd = (bekleyenUsdResult.data ?? []).reduce(
    (sum, r) => sum + Number(r.tutar),
    0
  );
  const yaklasan7Gun = yaklasanResult.count ?? 0;
  const buAyOdenen = buAyResult.count ?? 0;

  // ---------- PROCESS TREND ----------
  const trendMap = new Map<string, { tamamlanan: number; bekleyen: number }>();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendMap.set(key, { tamamlanan: 0, bekleyen: 0 });
  }

  (trendResult.data ?? []).forEach(
    (r: { tarih: string | null; tutar: number; odeme_durum: string | null; cinsi: string | null }) => {
      if (!r.tarih || r.cinsi !== "TL") return;
      const monthKey = r.tarih.substring(0, 7);
      const existing = trendMap.get(monthKey);
      if (!existing) return;
      const amount = Number(r.tutar) || 0;
      if (r.odeme_durum === "TAMAMLANDI") {
        existing.tamamlanan += amount;
      } else {
        existing.bekleyen += amount;
      }
    }
  );

  const trendData = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => {
      const d = new Date(month + "-01");
      return {
        month,
        label: d.toLocaleDateString("tr-TR", { month: "short" }),
        ...v,
      };
    });

  // ---------- ERROR HANDLING ----------
  if (listResult.error) {
    return (
      <div className="p-6">
        <p className="text-destructive">
          Veri yüklenirken hata oluştu: {listResult.error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6">
      <OdemelerClient
        activeTab={activeTab}
        kpiData={{ bekleyenTl, bekleyenUsd, yaklasan7Gun, buAyOdenen }}
        trendData={trendData}
        listData={(listResult.data ?? []) as Odeme[]}
        totalCount={listResult.count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        turu={turu}
        durum={durum}
        cinsi={cinsi}
        dateFrom={dateFrom}
        dateTo={dateTo}
        sortBy={sortColumn}
        sortOrder={sortOrder}
      />
    </div>
  );
}
