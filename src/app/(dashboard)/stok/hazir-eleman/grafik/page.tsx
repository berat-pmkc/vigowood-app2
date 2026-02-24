import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { GrafikClient } from "./grafik-client";
import type { DailyChartData } from "../components/trend-chart";

export const metadata: Metadata = { title: "Hazır Eleman Stok Hareketleri Grafiği" };

export default async function HazirElemanGrafikPage() {
  const supabase = await createClient();

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  // Fetch ALL movements in last 30 days (paginated)
  const allMovements: { tarih: string; qty: number }[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from("hazir_eleman_akis")
      .select("tarih, qty")
      .gte("tarih", thirtyDaysAgoStr)
      .order("tarih", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    const rows = (data || []) as { tarih: string; qty: number }[];
    allMovements.push(...rows);
    hasMore = rows.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  // Aggregate by day
  const dailyMap = new Map<string, number>();
  for (let i = 0; i <= 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, 0);
  }
  allMovements.forEach((m) => {
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

  return (
    <div className="px-4 sm:px-6">
      <GrafikClient chartData={chartData} />
    </div>
  );
}
