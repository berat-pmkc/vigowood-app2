import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { GrafikClient } from "./grafik-client";
import type { DailyChartData } from "../components/trend-chart";
import { HAZIR_ELEMAN_TURLERI } from "@/lib/constants";

export const metadata: Metadata = { title: "Hazır Eleman Stok Hareketleri Grafiği" };

interface PageProps {
  searchParams: Promise<{ tur?: string }>;
}

export default async function HazirElemanGrafikPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tur = params.tur?.trim() || "";
  const validTur = (HAZIR_ELEMAN_TURLERI as readonly string[]).includes(tur) ? tur : "";

  const supabase = await createClient();

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  // If tur is selected, get part_ids for that tur
  let turPartIds: string[] | null = null;
  if (validTur) {
    const { data: turParts } = await supabase
      .from("all_parts")
      .select("part_id")
      .eq("tur", validTur);
    turPartIds = (turParts || []).map((p) => p.part_id);
  }

  // Fetch ALL movements in last 30 days (paginated)
  const allMovements: { tarih: string; qty: number }[] = [];
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let q = supabase
      .from("hazir_eleman_akis")
      .select("tarih, qty")
      .gte("tarih", thirtyDaysAgoStr)
      .order("tarih", { ascending: true });

    if (turPartIds && turPartIds.length > 0) {
      q = q.in("part_id", turPartIds);
    } else if (turPartIds && turPartIds.length === 0) {
      // No parts for this tur — skip fetch
      break;
    }

    const { data } = await q.range(offset, offset + PAGE_SIZE - 1);

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
      <GrafikClient chartData={chartData} tur={validTur} />
    </div>
  );
}
