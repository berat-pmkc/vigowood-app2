import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES, KESIM_MAKINE_IDS, URETIM_ANALIZ_ROLES } from "@/lib/constants";
import { KesimDashboard } from "./components/kesim-dashboard";
import { getKesimTalepleri } from "./actions";
import type { CutBatchRow, MdfStokItem, MachineStatusEntry, MachineCounts } from "./types";
import { donemAraligi } from "@/lib/donem";

export const metadata: Metadata = { title: "Kesim" };

/**
 * Dönem kodunu tarih aralığına çevirir.
 *
 * Yeni kodlar (montaj ekranıyla ortak): "bugun", "dun", "2026_08.3"
 * (ayın 3. haftası), "2026_08" (ayın tamamı).
 *
 * Eski kodlar (yesterday/week/month/last_month ve "2026-08") hâlâ
 * destekleniyor: tabletlerde ve yer imlerinde eski bağlantılar var,
 * onlar bozulmasın.
 */
function getDateRange(filter: string) {
  const now = new Date();

  const yeni = donemAraligi(filter);
  if (yeni) {
    return { start: yeni.bas.toISOString(), end: yeni.bit.toISOString() };
  }

  // ── Geriye dönük uyumluluk ────────────────────────────────
  const eskiAy = filter.match(/^(\d{4})-(\d{2})$/);
  if (eskiAy) {
    const bas = new Date(Number(eskiAy[1]), Number(eskiAy[2]) - 1, 1);
    const bit = new Date(Number(eskiAy[1]), Number(eskiAy[2]), 1);
    return { start: bas.toISOString(), end: bit.toISOString() };
  }

  const gunBasi = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  switch (filter) {
    case "yesterday": {
      const bas = gunBasi(now);
      bas.setDate(bas.getDate() - 1);
      const bit = new Date(bas);
      bit.setDate(bit.getDate() + 1);
      return { start: bas.toISOString(), end: bit.toISOString() };
    }
    case "week": {
      const bas = gunBasi(now);
      bas.setDate(bas.getDate() - ((bas.getDay() + 6) % 7));
      return { start: bas.toISOString(), end: now.toISOString() };
    }
    case "month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        end: now.toISOString(),
      };
    case "last_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(),
        end: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      };
    default: {
      const bas = gunBasi(now);
      const bit = new Date(bas);
      bit.setDate(bit.getDate() + 1);
      return { start: bas.toISOString(), end: bit.toISOString() };
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
  const dateFilter = params.dateFilter || "bugun";
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

  // ▼▼▼ MINI ANALIZ — 30 gün öncesi (filtreden bağımsız grafikler) ▼▼▼
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();
  // ▲▲▲ MINI ANALIZ ▲▲▲

  // Parallel fetches
  const [
    allBatchesRes,
    mdfStokRes,
    machineStatusResults,
    last7DaysCutsRes,
    todayBatchesRes,
    last30Res, // ← MINI ANALIZ
  ] = await Promise.all([
    // Tarih aralığındaki tüm batch'ler
    supabase
      .from("cut_batches")
      .select("*")
      .gte("tarih", rangeStart)
      .lte("tarih", rangeEnd)
      .order("tarih", { ascending: false }),
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
    // ▼▼▼ MINI ANALIZ — son 30 gün (filtreden bağımsız) ▼▼▼
    supabase
      .from("cut_batches")
      .select("tarih, adet, makine_id, sku")
      .eq("durum", "tamamlandi")
      .gte("tarih", thirtyDaysAgoStr)
      .not("plaka_id", "is", null),
    // ▲▲▲ MINI ANALIZ ▲▲▲
  ]);

  const allBatches = (allBatchesRes.data ?? []) as CutBatchRow[];

  // Enrich: plaka adları, ürün adları, operatör adları
  const plakaIds = [...new Set(allBatches.map((b) => b.plaka_id).filter(Boolean) as string[])];
  const skus = [...new Set(allBatches.map((b) => b.sku).filter(Boolean) as string[])];
  const operatorIds = [...new Set(allBatches.map((b) => b.operator_id).filter(Boolean) as string[])];

  const [plakaResult, productResult, operatorResult] = await Promise.all([
    plakaIds.length > 0
      ? supabase.from("plakalar").select("plaka_id, plaka_adi, kesim_sureleri").in("plaka_id", plakaIds)
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
  // Makine bazlı kesim süresi: { "MAK-1": 70, "MAK-2": 60, ... } dakika/plaka
  const sureMap = new Map(
    (plakaResult.data ?? []).map((p) => [
      p.plaka_id,
      (p as { kesim_sureleri?: Record<string, number | null> | null }).kesim_sureleri ?? null,
    ])
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
    kesim_suresi_dk:
      b.plaka_id && b.makine_id
        ? (sureMap.get(b.plaka_id)?.[b.makine_id] ?? null)
        : null,
  });

  const enrichedRecords = allBatches.map(enrich);

  // MDF stok verileri
  const mdfStok = (mdfStokRes.data ?? []) as MdfStokItem[];

  // Bugünkü KPI'lar
  const todayBatches = todayBatchesRes.data ?? [];
  const todayTotalBatch = todayBatches.reduce((sum, b) => sum + (b.adet ?? 1), 0);

  // Makine bazlı bugünkü kesim sayısı
  const machineCounts: MachineCounts = {};
  for (const b of todayBatches) {
    if (b.makine_id) {
      machineCounts[b.makine_id] = (machineCounts[b.makine_id] ?? 0) + (b.adet ?? 1);
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

  // ▼▼▼ MINI ANALIZ — son 30 gün grafik verileri (filtreden bağımsız) ▼▼▼
  const AY_KISA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const last30 = (last30Res.data ?? []) as { tarih: string | null; adet: number | null; makine_id: string | null; sku: string | null }[];

  // Günlük trend (son 14 gün, boş günler 0)
  const gunMap = new Map<string, number>();
  for (const c of last30) {
    if (!c.tarih) continue;
    const key = new Date(c.tarih).toISOString().split("T")[0];
    gunMap.set(key, (gunMap.get(key) ?? 0) + (c.adet ?? 0));
  }
  const gunlukTrend: { gun: string; plaka: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    gunlukTrend.push({ gun: `${d.getDate()} ${AY_KISA[d.getMonth()]}`, plaka: gunMap.get(key) ?? 0 });
  }

  // Makine dağılımı (30 gün)
  const makMap = new Map<string, number>();
  for (const c of last30) {
    if (c.makine_id) makMap.set(c.makine_id, (makMap.get(c.makine_id) ?? 0) + (c.adet ?? 0));
  }
  const makineDagilim = ["MAK-1", "MAK-2", "MAK-3"].map((m) => ({ makine: m, plaka: makMap.get(m) ?? 0 }));

  // En çok kesilen projeler (30 gün, top 6)
  const skuMap = new Map<string, number>();
  for (const c of last30) {
    if (c.sku) skuMap.set(c.sku, (skuMap.get(c.sku) ?? 0) + (c.adet ?? 0));
  }
  const topProjeler = [...skuMap.entries()]
    .map(([ad, plaka]) => ({ ad, plaka }))
    .sort((a, b) => b.plaka - a.plaka)
    .slice(0, 6);

  const toplam30 = last30.reduce((s, c) => s + (c.adet ?? 0), 0);
  const miniAnaliz = { gunlukTrend, makineDagilim, topProjeler, toplam30 };
  // ▲▲▲ MINI ANALIZ ▲▲▲

  // Bekleyen kesim talepleri — kesimhane ekrana girer girmez görsün
  const acikTalepler = await getKesimTalepleri(true);

  return (
    <div className="pb-20 md:pb-6">
      <KesimDashboard
        analizGorebilir={URETIM_ANALIZ_ROLES.includes(user.role)}
        acikTalepler={acikTalepler}
        records={enrichedRecords}
        todayTotalBatch={todayTotalBatch}
        dateFilter={dateFilter}
        machineCounts={machineCounts}
        mdfStok={mdfStok}
        machineStatus={machineStatusResults}
        stokTahminiGun={stokTahminiGun}
        dailyAvgConsumption={dailyAvgConsumption}
        miniAnaliz={miniAnaliz}
      />
    </div>
  );
}
