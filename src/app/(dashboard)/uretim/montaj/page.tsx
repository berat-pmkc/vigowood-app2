import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { MontajList } from "./components/montaj-list";
import type { MontajBatchRow } from "./components/montaj-card";

interface PageProps {
  searchParams: Promise<{ durum?: string }>;
}

export default async function MontajPage({ searchParams }: PageProps) {
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

  const { data: allBatches } = await supabase
    .from("montaj_batches")
    .select("montaj_id, sku, adet, durum, current_step_no, total_steps, operator_id, operator_name, email, baslama_zamani, bitis_zamani, notes, created_at")
    .or(`durum.neq.tamamlandi,created_at.gte.${thirtyDaysAgo.toISOString()}`)
    .order("created_at", { ascending: false });

  const batches = (allBatches ?? []) as MontajBatchRow[];

  // Durum sayaçları
  const counts: Record<string, number> = { bekliyor: 0, montajda: 0, tamamlandi: 0 };
  batches.forEach((b) => {
    if (counts[b.durum] !== undefined) counts[b.durum]++;
  });

  // Durum filtrele
  const filtered = selectedStatus === "all"
    ? batches
    : batches.filter((b) => b.durum === selectedStatus);

  // Enrich: ürün adları
  const skus = [...new Set(filtered.map((b) => b.sku).filter(Boolean))];

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

  const enriched: MontajBatchRow[] = filtered.map((b) => ({
    ...b,
    urun_adi: productMap.get(b.sku) ?? undefined,
  }));

  return (
    <div className="pb-20 md:pb-6">
      <MontajList
        batches={enriched}
        counts={counts}
        selectedStatus={selectedStatus}
      />
    </div>
  );
}
