import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES, PRODUCTION_CANCEL_ROLES } from "@/lib/constants";
import { MontajDashboard } from "./components/montaj-dashboard";
import type { ActiveMontajSession } from "./components/session-card";
import { parseWorkers } from "./utils";

export const metadata: Metadata = { title: "Montaj" };

export default async function MontajPage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  // Parallel: aktif seanslar + tüm aktif ürünler (birbirinden bağımsız)
  const [activeDataRes, activeProductsRes] = await Promise.all([
    supabase
      .from("montaj_sessions")
      .select("session_id, sku, step_id, step_name, seq_no, is_final_step, start_time, durum, operator_name, workers")
      .eq("durum", "montajda")
      .order("start_time", { ascending: true }),
    supabase
      .from("products")
      .select("sku, urun_adi")
      .eq("aktif_mi", true)
      .order("gunluk_satis", { ascending: false }),
  ]);

  const activeData = activeDataRes.data;
  const activeProducts = activeProductsRes.data;

  // Ürün adlarını çek (sadece aktif seanslardaki SKU'lar için)
  const activeSkus = [...new Set((activeData ?? []).map((s) => s.sku).filter(Boolean) as string[])];

  let productMap = new Map<string, string>();
  if (activeSkus.length > 0) {
    // activeProducts zaten yüklendi, ondan build et
    (activeProducts ?? []).forEach((p) => {
      if (activeSkus.includes(p.sku)) {
        productMap.set(p.sku, p.urun_adi ?? "");
      }
    });
  }

  const productOptions = (activeProducts ?? []).map((p) => ({
    sku: p.sku,
    urun_adi: p.urun_adi ?? p.sku,
  }));

  // Enrich active sessions
  const activeSessions: ActiveMontajSession[] = (activeData ?? []).map((s) => ({
    ...s,
    urun_adi: s.sku ? productMap.get(s.sku) ?? undefined : undefined,
    workers: parseWorkers(s.workers),
  }));

  return (
    <div className="pb-20 md:pb-6">
      <MontajDashboard
        activeSessions={activeSessions}
        productOptions={productOptions}
        canCancel={PRODUCTION_CANCEL_ROLES.includes(user.role)}
      />
    </div>
  );
}
