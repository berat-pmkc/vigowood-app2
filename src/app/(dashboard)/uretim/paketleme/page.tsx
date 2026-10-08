import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES, URETIM_ANALIZ_ROLES } from "@/lib/constants";
import { PaketlemeDashboard } from "./components/paketleme-dashboard";
import type { ActiveSession } from "./components/session-card";
import type { CompletedSession } from "./components/completed-sessions";
import { talimatDb } from "@/lib/talimat/db";
import { getHatlar } from "@/lib/talimat/queries";

export const metadata: Metadata = { title: "Paketleme" };

export default async function PaketlemePage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();
  const hatlar = await getHatlar().catch(() => []);

  // Devam eden seanslar
  const { data: activeRaw } = await supabase
    .from("pack_events")
    .select("session_id, sku, start_time, durum, operator_name, duraklama_dk, duraklatma_baslangic, workers, yardimci_sayisi, talimat_satir_id, hat_id")
    .eq("durum", "paketlemede")
    .order("start_time", { ascending: true });
  // Yeni kolonlar (yardimci_sayisi, talimat_satir_id) henüz database types'ta yok
  const activeData = activeRaw as unknown as Array<{
    session_id: string; sku: string | null; start_time: string | null; durum: string;
    operator_name: string | null; duraklama_dk: number | null; duraklatma_baslangic: string | null;
    workers: unknown; yardimci_sayisi: number | null; talimat_satir_id: string | null; hat_id: string | null;
  }> | null;

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
  // Talimattan başlatılan seanslarda talep açıklaması (not) açık seans kartında gösterilir
  const aktifHam = activeData ?? [];
  const notMap = new Map<string, string>();
  const satirIdleri = [...new Set(aktifHam.map((s) => s.talimat_satir_id).filter(Boolean) as string[])];
  if (satirIdleri.length > 0) {
    const sb = await talimatDb();
    const { data: satirlar } = await sb.from("talimat_satirlar").select("satir_id, not_text").in("satir_id", satirIdleri);
    for (const r of satirlar ?? []) {
      if (r.not_text && String(r.not_text).trim()) notMap.set(r.satir_id as string, String(r.not_text));
    }
  }

  const activeSessions: ActiveSession[] = aktifHam.map((s) => ({
    ...s,
    workers: Array.isArray(s.workers) ? (s.workers as Array<{ id: string; name: string }>) : null,
    urun_adi: s.sku ? productMap.get(s.sku) ?? undefined : undefined,
    not_text: s.talimat_satir_id ? notMap.get(s.talimat_satir_id) ?? null : null,
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
        hatlar={hatlar}
      />
    </div>
  );
}
