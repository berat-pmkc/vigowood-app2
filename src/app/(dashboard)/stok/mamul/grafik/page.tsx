import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { GrafikClient } from "./grafik-client";
import type { DailyChartData } from "../components/trend-chart";

export const metadata: Metadata = { title: "Stok Hareketleri Grafiği" };

export default async function GrafikPage() {
  const supabase = await createClient();

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  const { data: chartResult } = await supabase
    .from("stock_movements")
    .select("tarih, qty")
    .gte("tarih", thirtyDaysAgoStr)
    .order("tarih", { ascending: true })
    .limit(5000);

  // Aggregate by day
  const dailyMap = new Map<string, { giris: number; cikis: number }>();
  for (let i = 0; i <= 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { giris: 0, cikis: 0 });
  }
  (chartResult || []).forEach((m: { tarih: string | null; qty: number }) => {
    if (!m.tarih) return;
    const day = m.tarih.split("T")[0];
    const existing = dailyMap.get(day);
    if (existing) {
      if (m.qty > 0) {
        existing.giris += m.qty;
      } else {
        existing.cikis += Math.abs(m.qty);
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

  return (
    <div className="px-4 sm:px-6">
      <GrafikClient chartData={chartData} />
    </div>
  );
}
