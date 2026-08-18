import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES, URETIM_ANALIZ_ROLES } from "@/lib/constants";
import { PaketlemeDashboard } from "./components/paketleme-dashboard";
import type { ActiveSession } from "./components/session-card";
import type { CompletedSession } from "./components/completed-sessions";

export const metadata: Metadata = { title: "Paketleme" };

export default async function PaketlemePage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  // Devam eden seanslar
  const { data: activeData } = await supabase
    .from("pack_events")
    .select("session_id, sku, start_time, durum, operator_name")
    .eq("durum", "paketlemede")
    .order("start_time", { ascending: true });

  // Son 62 gün tamamlanan seanslar (geçen ay filtresi için yeterli)
  const sixtyTwoDaysAgo = new Date();
  sixtyTwoDaysAgo.setDate(sixtyTwoDaysAgo.getDate() - 62);

  const { data: completedData } = await supabase
    .from("pack_events")
    .select("session_id, sku, qty, start_time, end_time, durum, worker_count, workers, birim_paketleme_dk")
    .eq("durum", "tamamlandi")
    .gte("end_time", sixtyTwoDaysAgo.toISOString())
    .order("end_time", { ascending: false })
    .limit(500);

  // Ürün adlarını çek
  const allSessions = [...(activeData ?? []), ...(completedData ?? [])];
  const skus = [...new Set(allSessions.map((s) => s.sku).filter(Boolean) as string[])];

  let productMap = new Map<string, string>();
  if (skus.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("sku, urun_adi")
      .in("sku", skus);

    productMap = new Map(
      (products ?? []).map((p) => [p.sku, p.urun_adi ?? ""])
    );
  }

  // Aktif ürünler (trend seçici için)
  const { data: activeProducts } = await supabase
    .from("products")
    .select("sku, urun_adi")
    .eq("aktif_mi", true)
    .order("gunluk_satis", { ascending: false });

  const productOptions = (activeProducts ?? []).map((p) => ({
    sku: p.sku,
    urun_adi: p.urun_adi ?? p.sku,
  }));

  // Enrich sessions
  const activeSessions: ActiveSession[] = (activeData ?? []).map((s) => ({
    ...s,
    urun_adi: s.sku ? productMap.get(s.sku) ?? undefined : undefined,
  }));

  const completedSessions: CompletedSession[] = (completedData ?? []).map((s) => ({
    ...s,
    workers: s.workers as Array<{ id: string; name: string }> | null,
    urun_adi: s.sku ? productMap.get(s.sku) ?? undefined : undefined,
  }));

  return (
    <div className="pb-20 md:pb-6">
      <PaketlemeDashboard
        analizGorebilir={URETIM_ANALIZ_ROLES.includes(user.role)}
        activeSessions={activeSessions}
        completedSessions={completedSessions}
        productOptions={productOptions}
      />
    </div>
  );
}
