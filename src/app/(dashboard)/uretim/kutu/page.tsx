import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { KutuDashboard } from "./components/kutu-dashboard";

export const metadata: Metadata = { title: "Kutu-Koli" };

export interface KutuSessionEnriched {
  session_id: string;
  email: string | null;
  tarih: string | null;
  part_id: string | null;
  part_adi: string | null;
  part_type: string | null;
  qty: number;
  not_text: string | null;
  durum: string;
  operator_id: string | null;
  operator_name: string | null;
  start_time: string | null;
  bitis_zamani: string | null;
  created_at: string;
  plaka_id: string | null;
  sku: string | null;
  // Enriched
  plaka_adi?: string;
  urun_adi?: string;
}

export default async function KutuKoliPage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];
  const dayStart = `${today}T00:00:00.000Z`;
  const dayEnd = `${today}T23:59:59.999Z`;

  // Parallel: aktif oturumlar + bugünün tamamlananları + kritik stok
  const [activeRes, completedRes, kritikRes] = await Promise.all([
    supabase
      .from("kutu_uretim")
      .select("*")
      .eq("durum", "uretimde")
      .order("start_time", { ascending: false }),
    supabase
      .from("kutu_uretim")
      .select("*")
      .eq("durum", "tamamlandi")
      .gte("bitis_zamani", dayStart)
      .lte("bitis_zamani", dayEnd)
      .order("bitis_zamani", { ascending: false }),
    supabase
      .from("all_parts")
      .select("part_id, part_adi, part_type, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok")
      .in("part_type", ["KUTU", "KARTON"])
      .order("part_adi"),
  ]);

  const activeSessions = (activeRes.data ?? []) as KutuSessionEnriched[];
  const completedSessions = (completedRes.data ?? []) as KutuSessionEnriched[];
  const allSessions = [...activeSessions, ...completedSessions];

  // Enrich: plaka adları, ürün adları
  const plakaIds = [...new Set(allSessions.map((s) => s.plaka_id).filter(Boolean) as string[])];
  const skus = [...new Set(allSessions.map((s) => s.sku).filter(Boolean) as string[])];

  const [plakaResult, productResult] = await Promise.all([
    plakaIds.length > 0
      ? supabase.from("plakalar").select("plaka_id, plaka_adi").in("plaka_id", plakaIds)
      : { data: [] },
    skus.length > 0
      ? supabase.from("products").select("sku, urun_adi").in("sku", skus)
      : { data: [] },
  ]);

  const plakaMap = new Map(
    (plakaResult.data ?? []).map((p) => [p.plaka_id, p.plaka_adi])
  );
  const productMap = new Map(
    (productResult.data ?? []).map((p) => [p.sku, p.urun_adi])
  );

  const enrich = (s: KutuSessionEnriched): KutuSessionEnriched => ({
    ...s,
    plaka_adi: s.plaka_id ? plakaMap.get(s.plaka_id) ?? undefined : undefined,
    urun_adi: s.sku ? productMap.get(s.sku) ?? undefined : undefined,
  });

  const enrichedActive = activeSessions.map(enrich);
  const enrichedCompleted = completedSessions.map(enrich);

  // KPI
  const todayTotalAdet = completedSessions.reduce((sum, s) => sum + s.qty, 0);
  const todayTotalBatch = completedSessions.length;

  // Kritik stok parçaları
  const kritikStokItems = (kritikRes.data ?? []).map((p) => ({
    part_id: p.part_id as string,
    part_adi: p.part_adi as string,
    part_type: p.part_type as string,
    stok: (p.hazir_eleman_aktif_stok as number) ?? 0,
    kritik: (p.hazir_eleman_kritik_stok as number) ?? 0,
  }));

  const kritikCount = kritikStokItems.filter((p) => p.stok < p.kritik).length;

  return (
    <div className="pb-20 md:pb-6">
      <KutuDashboard
        activeSessions={enrichedActive}
        completedSessions={enrichedCompleted}
        todayTotalAdet={todayTotalAdet}
        todayTotalBatch={todayTotalBatch}
        kritikStokCount={kritikCount}
      />
    </div>
  );
}
