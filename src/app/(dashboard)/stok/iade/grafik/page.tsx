import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { GrafikClient } from "./grafik-client";
import type { DailyIadeChartData } from "../components/trend-chart";

export const metadata: Metadata = { title: "İade Hareketleri Grafiği" };

export default async function IadeGrafikPage() {
  const supabase = await createClient();

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  // Fetch ALL iade records in last 30 days (paginated)
  const allRecords: { tarih: string; qty: number; durum: string | null }[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from("iade_giris")
      .select("tarih, qty, durum")
      .gte("tarih", thirtyDaysAgoStr)
      .order("tarih", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    const rows = (data || []) as { tarih: string; qty: number; durum: string | null }[];
    allRecords.push(...rows);
    hasMore = rows.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  // Aggregate by day
  const dailyMap = new Map<string, { kullanilabilir: number; kullanilamaz: number }>();
  for (let i = 0; i <= 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { kullanilabilir: 0, kullanilamaz: 0 });
  }
  allRecords.forEach((r) => {
    if (!r.tarih) return;
    const day = r.tarih.split("T")[0];
    const existing = dailyMap.get(day);
    if (existing) {
      if (r.durum === "Kullanilabilir") {
        existing.kullanilabilir += r.qty;
      } else {
        existing.kullanilamaz += r.qty;
      }
    }
  });

  const chartData: DailyIadeChartData[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, kullanilabilir: vals.kullanilabilir, kullanilamaz: vals.kullanilamaz }));

  return (
    <div className="px-4 sm:px-6">
      <GrafikClient chartData={chartData} />
    </div>
  );
}
