import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { TemizlikList } from "./components/temizlik-list";
import type { TemizlikBatchRow } from "./components/temizlik-card";

export const metadata: Metadata = { title: "Temizlik" };

export default async function TemizlikPage() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const supabase = await createClient();

  // Son 30 günün tamamlanmış kesim batch'leri
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: completedBatches } = await supabase
    .from("cut_batches")
    .select("cut_id, tarih, sku, plaka_id, makine_id, adet, operator_id")
    .eq("durum", "tamamlandi")
    .gte("tarih", thirtyDaysAgo.toISOString())
    .order("tarih", { ascending: false });

  const batches = (completedBatches ?? []) as Array<{
    cut_id: string;
    tarih: string;
    sku: string | null;
    plaka_id: string | null;
    makine_id: string | null;
    adet: number;
    operator_id: string | null;
  }>;

  if (batches.length === 0) {
    return (
      <div className="pb-20 md:pb-6">
        <TemizlikList batches={[]} />
      </div>
    );
  }

  const cutIds = batches.map((b) => b.cut_id);

  // Cut lines (parça sayısı için)
  const { data: allLines } = await supabase
    .from("cut_lines")
    .select("cut_line_id, cut_id")
    .in("cut_id", cutIds);

  const lines = (allLines ?? []) as Array<{
    cut_line_id: string;
    cut_id: string;
  }>;

  // cut_id → line count
  const lineCountMap = new Map<string, number>();
  for (const line of lines) {
    lineCountMap.set(line.cut_id, (lineCountMap.get(line.cut_id) ?? 0) + 1);
  }

  // Enrichment: plaka adları, ürün adları, operatör adları
  const plakaIds = [...new Set(batches.map((b) => b.plaka_id).filter(Boolean) as string[])];
  const skus = [...new Set(batches.map((b) => b.sku).filter(Boolean) as string[])];
  const operatorIds = [...new Set(batches.map((b) => b.operator_id).filter(Boolean) as string[])];

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

  const enriched: TemizlikBatchRow[] = batches.map((b) => ({
    cut_id: b.cut_id,
    tarih: b.tarih,
    sku: b.sku,
    plaka_id: b.plaka_id,
    makine_id: b.makine_id,
    adet: b.adet,
    operator_id: b.operator_id,
    line_count: lineCountMap.get(b.cut_id) ?? 0,
    urun_adi: b.sku ? productMap.get(b.sku) ?? undefined : undefined,
    plaka_adi: b.plaka_id ? plakaMap.get(b.plaka_id) ?? undefined : undefined,
    operator_adi: b.operator_id ? operatorMap.get(b.operator_id) ?? undefined : undefined,
  }));

  return (
    <div className="pb-20 md:pb-6">
      <TemizlikList batches={enriched} />
    </div>
  );
}
