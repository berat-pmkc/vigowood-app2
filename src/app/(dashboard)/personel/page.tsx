import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PersonelClient } from "./components/personel-client";
import type { Database } from "@/lib/supabase/types";

type AttendanceRow = Database["public"]["Tables"]["attendance"]["Row"];

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    pageSize?: string;
    search?: string;
    department?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}

export const metadata: Metadata = { title: "Personel" };

export default async function PersonelPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const activeTab = params.tab === "ozet" ? "ozet" : "liste";

  // ---------- TABLE PARAMS ----------
  const page = Math.max(0, Number(params.page || "0"));
  const pageSize = [25, 50, 100].includes(Number(params.pageSize || "25"))
    ? Number(params.pageSize || "25")
    : 25;
  const search = params.search?.trim() || "";
  const department = params.department || "";
  const dateFrom = params.dateFrom || "";
  const dateTo = params.dateTo || "";
  const sortBy = params.sortBy || "tarih";
  const sortOrder = params.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);

  // ---------- TODAY ----------
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  // ---------- 1. Attendance list (paginated + filtered + sorted) ----------
  let listQuery = supabase
    .from("attendance")
    .select("*", { count: "exact" });

  if (search) {
    listQuery = listQuery.ilike("employee", `%${search}%`);
  }
  if (department) {
    listQuery = listQuery.eq("department", department);
  }
  if (dateFrom) {
    listQuery = listQuery.gte("tarih", dateFrom);
  }
  if (dateTo) {
    listQuery = listQuery.lte("tarih", dateTo);
  }

  const validSortColumns = ["tarih", "employee", "department", "start_time", "end_time"];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "tarih";
  listQuery = listQuery
    .order(sortColumn, { ascending: sortOrder === "asc" })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  // ---------- 2. Today total count ----------
  const todayCountQuery = supabase
    .from("attendance")
    .select("att_id", { count: "exact", head: true })
    .eq("tarih", todayStr);

  // ---------- 3. Today avg working hours ----------
  const todayRecordsQuery = supabase
    .from("attendance")
    .select("start_time, end_time")
    .eq("tarih", todayStr);

  // ---------- 4. Department distribution (today) ----------
  const deptDistQuery = supabase
    .from("attendance")
    .select("department")
    .eq("tarih", todayStr);

  // ---------- 5. Last 30 days daily trend ----------
  const trendQuery = supabase
    .from("attendance")
    .select("tarih")
    .gte("tarih", thirtyDaysAgoStr)
    .lte("tarih", todayStr);

  // ---------- 6. Late arrivals (start_time > 08:30 today) ----------
  const lateQuery = supabase
    .from("attendance")
    .select("att_id", { count: "exact", head: true })
    .eq("tarih", todayStr)
    .gt("start_time", "08:30");

  // Execute all in parallel
  const [
    listResult,
    todayCountResult,
    todayRecordsResult,
    deptDistResult,
    trendResult,
    lateResult,
  ] = await Promise.all([
    listQuery,
    todayCountQuery,
    todayRecordsQuery,
    deptDistQuery,
    trendQuery,
    lateQuery,
  ]);

  // ---------- PROCESS KPI ----------
  const todayTotal = todayCountResult.count ?? 0;
  const lateCount = lateResult.count ?? 0;

  // Avg working hours
  const todayRecords = (todayRecordsResult.data ?? []) as {
    start_time: string | null;
    end_time: string | null;
  }[];
  let avgHours = 0;
  if (todayRecords.length > 0) {
    let totalMinutes = 0;
    let validCount = 0;
    todayRecords.forEach((r) => {
      if (r.start_time && r.end_time) {
        const [sh, sm] = r.start_time.split(":").map(Number);
        const [eh, em] = r.end_time.split(":").map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        if (endMin > startMin) {
          totalMinutes += endMin - startMin;
          validCount++;
        }
      }
    });
    if (validCount > 0) {
      avgHours = Math.round((totalMinutes / validCount / 60) * 10) / 10;
    }
  }

  // Active departments today
  const deptSet = new Set<string>();
  (deptDistResult.data ?? []).forEach((r: { department: string | null }) => {
    if (r.department) deptSet.add(r.department);
  });
  const activeDeptCount = deptSet.size;

  // Department distribution counts
  const deptCounts: Record<string, number> = {};
  (deptDistResult.data ?? []).forEach((r: { department: string | null }) => {
    if (r.department) {
      deptCounts[r.department] = (deptCounts[r.department] || 0) + 1;
    }
  });

  // ---------- PROCESS TREND ----------
  const dailyMap = new Map<string, number>();
  // Fill all 30 days
  for (let i = 0; i <= 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    dailyMap.set(d.toISOString().split("T")[0], 0);
  }
  (trendResult.data ?? []).forEach((r: { tarih: string }) => {
    const day = r.tarih.split("T")[0];
    const existing = dailyMap.get(day);
    if (existing !== undefined) {
      dailyMap.set(day, existing + 1);
    }
  });
  const trendData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

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
      <PersonelClient
        activeTab={activeTab}
        kpiData={{
          todayTotal,
          avgHours,
          activeDeptCount,
          lateCount,
        }}
        deptDistribution={deptCounts}
        trendData={trendData}
        listData={(listResult.data ?? []) as AttendanceRow[]}
        totalCount={listResult.count ?? 0}
        pageIndex={page}
        pageSize={pageSize}
        search={search}
        department={department}
        dateFrom={dateFrom}
        dateTo={dateTo}
        sortBy={sortColumn}
        sortOrder={sortOrder}
      />
    </div>
  );
}
