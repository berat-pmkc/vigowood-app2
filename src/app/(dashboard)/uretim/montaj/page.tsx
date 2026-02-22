import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { MontajDashboard } from "./components/montaj-dashboard";
import type { ActiveMontajSession } from "./components/session-card";
import type { CompletedMontajSession } from "./components/completed-sessions-sheet";

export const metadata: Metadata = { title: "Montaj" };

export default async function MontajPage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  // Devam eden seanslar
  const { data: activeData } = await supabase
    .from("montaj_sessions")
    .select("session_id, sku, step_id, step_name, seq_no, is_final_step, start_time, durum, operator_name")
    .eq("durum", "montajda")
    .order("start_time", { ascending: true });

  // Son 30 gün tamamlanan seanslar
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: completedData } = await supabase
    .from("montaj_sessions")
    .select("session_id, sku, step_name, seq_no, is_final_step, qty, start_time, end_time, durum, worker_count, workers, birim_montaj_dk")
    .eq("durum", "tamamlandi")
    .gte("end_time", thirtyDaysAgo.toISOString())
    .order("end_time", { ascending: false })
    .limit(50);

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

  // Aktif ürünler (chart seçicileri için)
  const { data: activeProducts } = await supabase
    .from("products")
    .select("sku, urun_adi")
    .eq("aktif_mi", true)
    .order("urun_adi");

  const productOptions = (activeProducts ?? []).map((p) => ({
    sku: p.sku,
    urun_adi: p.urun_adi ?? p.sku,
  }));

  // Enrich sessions
  const activeSessions: ActiveMontajSession[] = (activeData ?? []).map((s) => ({
    ...s,
    urun_adi: s.sku ? productMap.get(s.sku) ?? undefined : undefined,
  }));

  const completedSessions: CompletedMontajSession[] = (completedData ?? []).map((s) => ({
    ...s,
    workers: s.workers as Array<{ id: string; name: string }> | null,
    birim_montaj_dk: s.birim_montaj_dk ? Number(s.birim_montaj_dk) : null,
    qty: Number(s.qty) || 0,
    urun_adi: s.sku ? productMap.get(s.sku) ?? undefined : undefined,
  }));

  return (
    <div className="pb-20 md:pb-6">
      <MontajDashboard
        activeSessions={activeSessions}
        completedSessions={completedSessions}
        productOptions={productOptions}
      />
    </div>
  );
}
