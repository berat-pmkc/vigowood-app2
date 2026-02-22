import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { KesimDashboard } from "./components/kesim-dashboard";
import type { CutBatchRow } from "./components/active-cut-card";

export const metadata: Metadata = { title: "Kesim" };

export default async function KesimPage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  // Parallel fetches: aktif kesimler, bugünün tamamlananları, makineler
  const [activeBatchesRes, completedBatchesRes, makinelerRes] = await Promise.all([
    supabase
      .from("cut_batches")
      .select("*")
      .eq("durum", "kesiliyor")
      .order("baslama_zamani", { ascending: false }),
    supabase
      .from("cut_batches")
      .select("*")
      .eq("durum", "tamamlandi")
      .gte("bitis_zamani", dayStart)
      .lte("bitis_zamani", dayEnd)
      .order("bitis_zamani", { ascending: false }),
    supabase
      .from("kesim_makinesi")
      .select("makine_id, tipi, bolum, aktif")
      .eq("bolum", "Kesim")
      .eq("aktif", true)
      .order("makine_id"),
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

  // Bugünün KPI için toplam adet
  const todayTotalAdet = completedBatches.reduce((sum, b) => sum + b.adet, 0);
  const todayTotalBatch = completedBatches.length;

  return (
    <div className="pb-20 md:pb-6">
      <KesimDashboard
        activeCuts={enrichedActive}
        completedCuts={enrichedCompleted}
        todayTotalAdet={todayTotalAdet}
        todayTotalBatch={todayTotalBatch}
        makineler={(makinelerRes.data ?? []) as { makine_id: string; tipi: string; bolum: string; aktif: boolean }[]}
      />
    </div>
  );
}
