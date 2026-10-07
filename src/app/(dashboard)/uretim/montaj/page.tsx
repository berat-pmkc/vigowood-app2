import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES, PRODUCTION_CANCEL_ROLES, URETIM_ANALIZ_ROLES } from "@/lib/constants";
import { MontajDashboard } from "./components/montaj-dashboard";
import type { ActiveMontajSession } from "./components/session-card";
import { parseWorkers } from "./utils";
import { talimatDb } from "@/lib/talimat/db";

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
      .select("session_id, sku, step_id, step_name, seq_no, is_final_step, start_time, durum, operator_name, workers, duraklama_dk, duraklatma_baslangic, yardimci_sayisi, talimat_satir_id")
      .eq("durum", "montajda")
      .order("start_time", { ascending: true }),
    supabase
      .from("products")
      .select("sku, urun_adi")
      .eq("aktif_mi", true)
      .order("gunluk_satis", { ascending: false }),
  ]);

  // 145/130 migration kolonları henüz database types'ta yok
  type AktifSatir = Omit<ActiveMontajSession, "urun_adi" | "workers" | "not_text"> & {
    workers: unknown;
    talimat_satir_id: string | null;
  };
  const activeData = activeDataRes.data as unknown as AktifSatir[] | null;
  const activeProducts = activeProductsRes.data;

  // Talimattan başlatılan seanslarda talep açıklaması (not) açık seans kartında gösterilir
  const notMap = new Map<string, string>();
  const satirIdleri = [...new Set((activeData ?? []).map((s) => s.talimat_satir_id).filter(Boolean) as string[])];
  if (satirIdleri.length > 0) {
    const sb = await talimatDb();
    const { data: satirlar } = await sb.from("talimat_satirlar").select("satir_id, not_text").in("satir_id", satirIdleri);
    for (const r of satirlar ?? []) {
      if (r.not_text && String(r.not_text).trim()) notMap.set(r.satir_id as string, String(r.not_text));
    }
  }

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
    not_text: s.talimat_satir_id ? notMap.get(s.talimat_satir_id) ?? null : null,
  }));

  return (
    <div className="pb-20 md:pb-6">
      <MontajDashboard
        activeSessions={activeSessions}
        productOptions={productOptions}
        canCancel={PRODUCTION_CANCEL_ROLES.includes(user.role)}
        analizGorebilir={URETIM_ANALIZ_ROLES.includes(user.role)}
      />
    </div>
  );
}
