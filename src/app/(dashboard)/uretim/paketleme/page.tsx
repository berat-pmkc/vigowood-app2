import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { PaketlemeList } from "./components/paketleme-list";
import type { PackSessionRow } from "./components/paketleme-card";

interface PageProps {
  searchParams: Promise<{ durum?: string }>;
}

export default async function PaketlemePage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const params = await searchParams;
  const selectedStatus = params.durum || "all";

  const supabase = await createClient();

  // Son 30 gün veya aktif olanlar
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: allSessions } = await supabase
    .from("pack_events")
    .select("session_id, email, tarih, sku, personel, start_time, end_time, qty, not_text, status, durum, operator_id, operator_name, created_at")
    .or(`durum.neq.tamamlandi,created_at.gte.${thirtyDaysAgo.toISOString()}`)
    .order("created_at", { ascending: false });

  const sessions = (allSessions ?? []) as PackSessionRow[];

  // Durum sayaçları
  const counts: Record<string, number> = { bekliyor: 0, paketlemede: 0, tamamlandi: 0 };
  sessions.forEach((s) => {
    if (counts[s.durum] !== undefined) counts[s.durum]++;
  });

  // Durum filtrele
  const filtered = selectedStatus === "all"
    ? sessions
    : sessions.filter((s) => s.durum === selectedStatus);

  // Enrich: ürün adları
  const skus = [...new Set(filtered.map((s) => s.sku).filter(Boolean) as string[])];

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

  const enriched: PackSessionRow[] = filtered.map((s) => ({
    ...s,
    urun_adi: s.sku ? productMap.get(s.sku) ?? undefined : undefined,
  }));

  // Günlük özet — bugünün seansları
  const today = new Date().toISOString().split("T")[0];
  const todaySessions = sessions.filter((s) => {
    const d = s.tarih ? s.tarih.split("T")[0] : s.created_at.split("T")[0];
    return d === today;
  });

  const todayCompleted = todaySessions.filter((s) => s.durum === "tamamlandi");
  const todayInProgress = todaySessions.filter((s) => s.durum === "paketlemede");
  const todayTotal = todayCompleted.reduce((acc, s) => acc + s.qty, 0);
  const todayInProgressQty = todayInProgress.reduce((acc, s) => acc + s.qty, 0);

  // Ürün bazlı bugünkü tamamlanan
  const productQtyMap = new Map<string, { sku: string; urun_adi: string; qty: number }>();
  todayCompleted.forEach((s) => {
    if (!s.sku) return;
    const existing = productQtyMap.get(s.sku);
    if (existing) {
      existing.qty += s.qty;
    } else {
      productQtyMap.set(s.sku, {
        sku: s.sku,
        urun_adi: productMap.get(s.sku) ?? s.sku,
        qty: s.qty,
      });
    }
  });

  const todayProducts = [...productQtyMap.values()].sort((a, b) => b.qty - a.qty);

  return (
    <div className="pb-20 md:pb-6">
      <PaketlemeList
        sessions={enriched}
        counts={counts}
        selectedStatus={selectedStatus}
        todaySummary={{
          todayTotal,
          todayCompleted: todayCompleted.length,
          todayInProgress: todayInProgress.length,
          todayProducts,
        }}
      />
    </div>
  );
}
