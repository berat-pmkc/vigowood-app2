import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";
import { SevkiyatList } from "./components/sevkiyat-list";
import type { SevkiyatRow } from "./components/sevkiyat-card";

interface PageProps {
  searchParams: Promise<{ durum?: string; ulke?: string }>;
}

export default async function SevkiyatPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const params = await searchParams;
  const selectedStatus = params.durum || "all";
  const selectedCountry = params.ulke || "all";

  const supabase = await createClient();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  let query = supabase
    .from("sevkiyat")
    .select("*")
    .or(`durum.in.(bekliyor,hazirlaniyor,yolda),created_at.gte.${ninetyDaysAgo.toISOString()}`)
    .order("created_at", { ascending: false });

  if (selectedCountry !== "all") {
    query = query.eq("country_code", selectedCountry);
  }

  const { data: allSevkiyat } = await query;
  const sevkiyatlar = (allSevkiyat ?? []) as SevkiyatRow[];

  const counts: Record<string, number> = { bekliyor: 0, hazirlaniyor: 0, yolda: 0, teslim_edildi: 0, iptal_edildi: 0 };
  sevkiyatlar.forEach((s) => {
    if (counts[s.durum] !== undefined) counts[s.durum]++;
  });

  const filtered = selectedStatus === "all"
    ? sevkiyatlar
    : sevkiyatlar.filter((s) => s.durum === selectedStatus);

  const sevkiyatIds = filtered.map((s) => s.sevkiyat_id);

  type ItemAgg = { count: number; totalQty: number; totalPalet: number; totalKoli: number; totalAgirlik: number; totalHacim: number; totalFiyat: number };
  const itemCountMap = new Map<string, ItemAgg>();

  if (sevkiyatIds.length > 0) {
    const { data: items } = await supabase
      .from("sevkiyat_items")
      .select("sevkiyat_id, qty, palet_sayisi, toplam_koli, agirlik, hacim, toplam_fiyat")
      .in("sevkiyat_id", sevkiyatIds);

    const itemRows = (items ?? []) as {
      sevkiyat_id: string; qty: number;
      palet_sayisi: number | null; toplam_koli: number | null;
      agirlik: number | null; hacim: number | null; toplam_fiyat: number | null;
    }[];

    itemRows.forEach((item) => {
      const existing = itemCountMap.get(item.sevkiyat_id);
      if (existing) {
        existing.count++;
        existing.totalQty += item.qty;
        existing.totalPalet += item.palet_sayisi ?? 0;
        existing.totalKoli += item.toplam_koli ?? 0;
        existing.totalAgirlik += item.agirlik ?? 0;
        existing.totalHacim += item.hacim ?? 0;
        existing.totalFiyat += item.toplam_fiyat ?? 0;
      } else {
        itemCountMap.set(item.sevkiyat_id, {
          count: 1,
          totalQty: item.qty,
          totalPalet: item.palet_sayisi ?? 0,
          totalKoli: item.toplam_koli ?? 0,
          totalAgirlik: item.agirlik ?? 0,
          totalHacim: item.hacim ?? 0,
          totalFiyat: item.toplam_fiyat ?? 0,
        });
      }
    });
  }

  const enriched: SevkiyatRow[] = filtered.map((s) => {
    const agg = itemCountMap.get(s.sevkiyat_id);
    return {
      ...s,
      item_count: agg?.count ?? 0,
      total_qty: agg?.totalQty ?? 0,
      total_palet: agg?.totalPalet ?? 0,
      total_koli: agg?.totalKoli ?? 0,
      total_agirlik: agg?.totalAgirlik ?? 0,
      total_hacim: agg?.totalHacim ?? 0,
      total_fiyat: agg?.totalFiyat ?? 0,
    };
  });

  return (
    <div className="pb-20 md:pb-6">
      <SevkiyatList
        sevkiyatlar={enriched}
        counts={counts}
        selectedStatus={selectedStatus}
        selectedCountry={selectedCountry}
      />
    </div>
  );
}
