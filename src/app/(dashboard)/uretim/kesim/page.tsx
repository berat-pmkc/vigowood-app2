import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES, KESIM_MAKINE_IDS } from "@/lib/constants";
import { KesimDashboard } from "./components/kesim-dashboard";
import type { CutBatchRow, MdfStokItem, MachineStatusEntry, MachineCounts } from "./types";

export const metadata: Metadata = { title: "Kesim" };

function getDateRange(filter: string) {
  const now = new Date();

  switch (filter) {
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split("T")[0];
      return { start: `${yStr}T00:00:00.000Z`, end: `${yStr}T23:59:59.999Z` };
    }
    case "week": {
      const monday = new Date(now);
      const dayOfWeek = monday.getDay() || 7;
      monday.setDate(monday.getDate() - dayOfWeek + 1);
      return {
        start: `${monday.toISOString().split("T")[0]}T00:00:00.000Z`,
        end: now.toISOString(),
      };
    }
    case "month": {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: `${firstOfMonth.toISOString().split("T")[0]}T00:00:00.000Z`,
        end: now.toISOString(),
      };
    }
    default: {
      // "today"
      const todayStr = now.toISOString().split("T")[0];
      return { start: `${todayStr}T00:00:00.000Z`, end: `${todayStr}T23:59:59.999Z` };
    }
  }
}

export default async function KesimPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFilter?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const params = await searchParams;
  const dateFilter = params.dateFilter || "today";
  const { start: rangeStart, end: rangeEnd } = getDateRange(dateFilter);

  const supabase = await createClient();

  // Today range for KPI (always today regardless of filter)
  const todayStr = new Date().toISOString().split("T")[0];
  const todayStart = `${todayStr}T00:00:00.000Z`;
  const todayEnd = `${todayStr}T23:59:59.999Z`;

  // 7 gün öncesi (stok tahmini hesabı için)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();

  // Parallel fetches
  const [
    activeBatchesRes,
    completedBatchesRes,
    makinelerRes,
    mdfStokRes,
    machineStatusResults,
    last7DaysCutsRes,
    todayBatchesRes,
  ] = await Promise.all([
    // Aktif kesimler (kesiliyor durumunda)
    supabase
      .from("cut_batches")
      .select("*")
      .eq("durum", "kesiliyor")
      .order("baslama_zamani", { ascending: false }),
    // Filtered completed batches (date range)
    supabase
      .from("cut_batches")
      .select("*")
      .eq("durum", "tamamlandi")
      .gte("bitis_zamani", rangeStart)
      .lte("bitis_zamani", rangeEnd)
      .order("bitis_zamani", { ascending: false }),
    // Makineler
    supabase
      .from("kesim_makinesi")
      .select("makine_id, tipi, bolum, aktif")
      .eq("bolum", "Kesim")
      .eq("aktif", true)
      .order("makine_id"),
    // MDF stok (mdf_tipi not null olan parçalar)
    supabase
      .from("all_parts")
      .select("part_id, part_adi, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok")
      .not("mdf_tipi", "is", null)
      .order("part_adi"),
    // Makine durumları (her makine için son kayıt)
    Promise.all(
      KESIM_MAKINE_IDS.map(async (makineId) => {
        const { data } = await supabase
          .from("makine_durum_log")
          .select("makine_id, durum, neden, created_at")
          .eq("makine_id", makineId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && data.length > 0) return data[0] as MachineStatusEntry;
        return { makine_id: makineId, durum: "aktif" as const, neden: null, created_at: new Date().toISOString() };
      })
    ),
    // Son 7 gün tamamlanan kesimler (günlük ortalama MDF tüketimi için)
    supabase
      .from("cut_batches")
      .select("adet, plaka_id")
      .eq("durum", "tamamlandi")
      .gte("bitis_zamani", sevenDaysAgoStr)
      .not("plaka_id", "is", null),
    // Bugün tamamlanan (KPI için, tarih filtresinden bağımsız)
    supabase
      .from("cut_batches")
      .select("cut_id, makine_id, adet")
      .eq("durum", "tamamlandi")
      .gte("bitis_zamani", todayStart)
      .lte("bitis_zamani", todayEnd),
  ]);

  const activeBatches = (activeBatchesRes.data ?? []) as CutBatchRow[];
  const completedBatches = (completedBatchesRes.data ?? []) as CutBatchRow[];
  const allBatches = [...activeBatches, ...completedBatches];

  // Enrich: plaka adları, ürün adları, operatör adları
  const plakaIds = [...new Set(allBatches.map((b) => b.plaka_id).filter(Boolean) as string[])];
  const skus = [...new Set(allBatches.map((b) => b.sku).filter(Boolean) as string[])];
  const operatorIds = [...new Set(allBatches.map((b) => b.operator_id).filter(Boolean) as string[])];

  const [plakaResult, productResult, operatorResult] = await Promise.all([
    plakaIds.length > 0
      ? supabase.from("plakalar").select("plaka_id, plaka_adi").in("plaka_id", plakaIds)
      : { data: [] },
    skus.length > 0
      ? supabase.from("products").select("sku, urun_adi").in("sku", skus)
      : { data: [] },
    operatorIds.length > 0
      ? supabase.from("users").select("user_id, full_name").in("user_id", operatorIds)
      : { data: [] },
  ]);

  const plakaMap = new Map(
    (plakaResult.data ?? []).map((p) => [p.plaka_id, p.plaka_adi])
  );
  const productMap = new Map(
    (productResult.data ?? []).map((p) => [p.sku, p.urun_adi])
  );
  const operatorMap = new Map(
    (operatorResult.data ?? []).map((u) => [u.user_id, u.full_name])
  );

  const enrich = (b: CutBatchRow): CutBatchRow => ({
    ...b,
    plaka_adi: b.plaka_id ? plakaMap.get(b.plaka_id) ?? undefined : undefined,
    urun_adi: b.sku ? productMap.get(b.sku) ?? undefined : undefined,
    operator_adi: b.operator_id ? operatorMap.get(b.operator_id) ?? undefined : undefined,
  });

  const enrichedActive = activeBatches.map(enrich);
  const enrichedCompleted = completedBatches.map(enrich);

  // MDF stok verileri
  const mdfStok = (mdfStokRes.data ?? []) as MdfStokItem[];

  // Bugünkü KPI'lar
  const todayBatches = todayBatchesRes.data ?? [];
  const todayTotalBatch = todayBatches.length;
  const todayTotalAdet = todayBatches.reduce((sum, b) => sum + (b.adet ?? 0), 0);

  // Makine bazlı bugünkü kesim sayısı
  const machineCounts: MachineCounts = {};
  for (const b of todayBatches) {
    if (b.makine_id) {
      machineCounts[b.makine_id] = (machineCounts[b.makine_id] ?? 0) + 1;
    }
  }

  // Stok tahmini: 7 günlük toplam MDF tüketim / 7 = günlük ortalama
  const last7DaysCuts = last7DaysCutsRes.data ?? [];
  const totalMdfConsumed7Days = last7DaysCuts.reduce((sum, c) => sum + (c.adet ?? 0), 0);
  const dailyAvgConsumption = totalMdfConsumed7Days / 7;

  // En kritik MDF: en az güne sahip olan
  let stokTahminiGun: number | null = null;
  if (dailyAvgConsumption > 0 && mdfStok.length > 0) {
    const gunler = mdfStok.map((m) => m.hazir_eleman_aktif_stok / dailyAvgConsumption);
    stokTahminiGun = Math.floor(Math.min(...gunler));
  }

  return (
    <div className="pb-20 md:pb-6">
      <KesimDashboard
        activeCuts={enrichedActive}
        completedCuts={enrichedCompleted}
        todayTotalAdet={todayTotalAdet}
        todayTotalBatch={todayTotalBatch}
        dateFilter={dateFilter}
        makineler={(makinelerRes.data ?? []) as { makine_id: string; tipi: string; bolum: string; aktif: boolean }[]}
        machineCounts={machineCounts}
        mdfStok={mdfStok}
        machineStatus={machineStatusResults}
        stokTahminiGun={stokTahminiGun}
        dailyAvgConsumption={dailyAvgConsumption}
      />
    </div>
  );
}
