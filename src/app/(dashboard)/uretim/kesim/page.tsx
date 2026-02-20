import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { KesimList } from "./components/kesim-list";
import type { CutBatchRow } from "./components/kesim-card";

interface PageProps {
  searchParams: Promise<{ tarih?: string; durum?: string }>;
}

export default async function KesimPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const params = await searchParams;

  // Default: bugünün tarihi
  const today = new Date().toISOString().split("T")[0];
  const selectedDate = params.tarih || today;
  const selectedStatus = params.durum || "all";

  const supabase = await createClient();

  // Günün başlangıç/bitiş
  const dayStart = `${selectedDate}T00:00:00.000Z`;
  const dayEnd = `${selectedDate}T23:59:59.999Z`;

  // Tüm kesimler (günlük)
  let query = supabase
    .from("cut_batches")
    .select("*")
    .gte("tarih", dayStart)
    .lte("tarih", dayEnd)
    .order("created_at", { ascending: false });

  const { data: allBatches } = await query;
  const batches = (allBatches ?? []) as CutBatchRow[];

  // Durum sayaçları
  const counts: Record<string, number> = {
    bekliyor: 0,
    kesiliyor: 0,
    tamamlandi: 0,
  };
  batches.forEach((b) => {
    if (counts[b.durum] !== undefined) counts[b.durum]++;
  });

  // Durum filtrele
  const filtered = selectedStatus === "all"
    ? batches
    : batches.filter((b) => b.durum === selectedStatus);

  // Plaka adları ve ürün adları enrich
  const plakaIds = [...new Set(filtered.map((b) => b.plaka_id).filter(Boolean) as string[])];
  const skus = [...new Set(filtered.map((b) => b.sku).filter(Boolean) as string[])];
  const operatorIds = [...new Set(filtered.map((b) => b.operator_id).filter(Boolean) as string[])];

  // Parallel lookups
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

  const enriched: CutBatchRow[] = filtered.map((b) => ({
    ...b,
    plaka_adi: b.plaka_id ? plakaMap.get(b.plaka_id) ?? undefined : undefined,
    urun_adi: b.sku ? productMap.get(b.sku) ?? undefined : undefined,
    operator_adi: b.operator_id ? operatorMap.get(b.operator_id) ?? undefined : undefined,
  }));

  return (
    <div className="pb-20 md:pb-6">
      <KesimList
        batches={enriched}
        counts={counts}
        selectedDate={selectedDate}
        selectedStatus={selectedStatus}
      />
    </div>
  );
}
