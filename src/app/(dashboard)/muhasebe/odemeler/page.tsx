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
    calMonth?: string;
  }>;
}

export const metadata: Metadata = { title: "Ödemeler | VigoWood" };

export default async function OdemelerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const validTabs = ["takvim", "liste", "ozet"] as const;
  const activeTab = validTabs.includes(params.tab as typeof validTabs[number])
    ? (params.tab as string)
    : "takvim";

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

  // ---------- CALENDAR PARAMS ----------
  const now = new Date();
  let calYear = now.getFullYear();
  let calMonth = now.getMonth(); // 0-indexed
  if (params.calMonth) {
    const [y, m] = params.calMonth.split("-").map(Number);
    if (y && m >= 1 && m <= 12) {
      calYear = y;
      calMonth = m - 1;
    }
  }
  const calMonthStart = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
  const calMonthEnd = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(new Date(calYear, calMonth + 1, 0).getDate()).padStart(2, "0")}`;

  // ---------- DATES ----------
  const today = new Date();

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

  // ---------- 2. Calendar data (tüm ay, pagination yok) ----------
  const calendarQuery = supabase
    .from("odemeler")
    .select("*")
    .gte("tarih", calMonthStart)
    .lte("tarih", calMonthEnd)
    .order("tarih");

  // ---------- 3. All odemeler (KPI hesaplama için, hafif kolonlar) ----------
  const allOdemelerQuery = supabase
    .from("odemeler")
    .select("id, tutar, cinsi, tarih, turu, odeme_durum");

  // ---------- 4. Trend (son 12 ay) ----------
  const twelveMonthsAgo = new Date(today);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split("T")[0];

  const trendQuery = supabase
    .from("odemeler")
    .select("tarih, tutar, odeme_durum, cinsi, turu")
    .gte("tarih", twelveMonthsAgoStr)
    .order("tarih");

  // Execute all in parallel
  const [
    listResult,
    calendarResult,
    allOdemelerResult,
    trendResult,
  ] = await Promise.all([
    listQuery,
    calendarQuery,
    allOdemelerQuery,
    trendQuery,
  ]);

  // ---------- PROCESS TREND ----------
  const trendMap = new Map<string, { tamamlanan: number; bekleyen: number }>();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendMap.set(key, { tamamlanan: 0, bekleyen: 0 });
  }

  (trendResult.data ?? []).forEach(
    (r: { tarih: string | null; tutar: number; odeme_durum: string | null; cinsi: string | null; turu: string | null }) => {
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

  // ---------- PROCESS SUMMARY (with turu) ----------
  const summaryData = (trendResult.data ?? []).map(
    (r: { tarih: string | null; tutar: number; odeme_durum: string | null; cinsi: string | null; turu: string | null }) => ({
      tarih: r.tarih,
      tutar: Number(r.tutar) || 0,
      odeme_durum: r.odeme_durum,
      cinsi: r.cinsi,
      turu: r.turu,
    })
  );

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
        trendData={trendData}
        summaryData={summaryData}
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
        calendarData={(calendarResult.data ?? []) as Odeme[]}
        calYear={calYear}
        calMonth={calMonth}
        allOdemeler={(allOdemelerResult.data ?? []) as {
          id: string;
          tutar: number;
          cinsi: string | null;
          tarih: string | null;
          turu: string | null;
          odeme_durum: string | null;
        }[]}
      />
    </div>
  );
}
