import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { TemizlikList } from "./components/temizlik-list";
import type { TemizlikBatchRow } from "./components/temizlik-card";
import type { CleanStatus } from "@/lib/constants";

export const metadata: Metadata = { title: "Temizlik" };

interface PageProps {
  searchParams: Promise<{ durum?: string }>;
}

export default async function TemizlikPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    redirect("/");
  }

  const params = await searchParams;
  const selectedStatus = params.durum || "all";

  const supabase = await createClient();

  // 1. Tamamlanmis cut_batches (son 30 gun — temizlik bekleyenler icin)
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
        <TemizlikList batches={[]} counts={{ bekliyor: 0, temizleniyor: 0, tamamlandi: 0 }} selectedStatus={selectedStatus} />
      </div>
    );
  }

  const cutIds = batches.map((b) => b.cut_id);

  // 2. Bu batch'lerin cut_lines'lari
  const { data: allLines } = await supabase
    .from("cut_lines")
    .select("cut_line_id, cut_id, part_id, adet")
    .in("cut_id", cutIds);

  const lines = (allLines ?? []) as Array<{
    cut_line_id: string;
    cut_id: string;
    part_id: string | null;
    adet: number;
  }>;

  // 3. Bu cut_lines icin clean kayitlari
  const cutLineIds = lines.map((l) => l.cut_line_id);

  const { data: cleanRecords } = cutLineIds.length > 0
    ? await supabase
        .from("clean")
        .select("cutline_id, clean_batch_id, start_time, end_time, status, operator_id, operator_name")
        .in("cutline_id", cutLineIds)
    : { data: [] };

  const cleans = (cleanRecords ?? []) as Array<{
    cutline_id: string;
    clean_batch_id: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
    operator_id: string | null;
    operator_name: string | null;
  }>;

  // cut_line_id → clean record map
  const cleanMap = new Map(cleans.map((c) => [c.cutline_id, c]));

  // cut_id → cut_lines map
  const linesByBatch = new Map<string, typeof lines>();
  for (const line of lines) {
    const arr = linesByBatch.get(line.cut_id) ?? [];
    arr.push(line);
    linesByBatch.set(line.cut_id, arr);
  }

  // 4. Her batch icin temizlik durumunu hesapla
  const temizlikBatches: TemizlikBatchRow[] = batches
    .map((batch) => {
      const batchLines = linesByBatch.get(batch.cut_id) ?? [];
      if (batchLines.length === 0) return null;

      const lineCleans = batchLines.map((l) => cleanMap.get(l.cut_line_id));
      const allHaveClean = lineCleans.every((c) => c !== undefined);
      const allTamamlandi = allHaveClean && lineCleans.every((c) => c!.status === "tamamlandi");
      const anyTemizleniyor = lineCleans.some((c) => c?.status === "temizleniyor");

      let cleanStatus: CleanStatus;
      if (allTamamlandi) {
        cleanStatus = "tamamlandi";
      } else if (anyTemizleniyor) {
        cleanStatus = "temizleniyor";
      } else {
        cleanStatus = "bekliyor";
      }

      // Ilk clean record'dan zaman bilgisi (hepsi ayni batch)
      const firstClean = lineCleans.find((c) => c !== undefined);

      return {
        cut_id: batch.cut_id,
        tarih: batch.tarih,
        sku: batch.sku,
        plaka_id: batch.plaka_id,
        makine_id: batch.makine_id,
        adet: batch.adet,
        kesim_operator_id: batch.operator_id,
        clean_status: cleanStatus,
        clean_batch_id: firstClean?.clean_batch_id ?? null,
        start_time: firstClean?.start_time ?? null,
        end_time: firstClean?.end_time ?? null,
        operator_id: firstClean?.operator_id ?? null,
        operator_name: firstClean?.operator_name ?? null,
        line_count: batchLines.length,
      } satisfies TemizlikBatchRow;
    })
    .filter((b): b is TemizlikBatchRow => b !== null);

  // 5. Durum sayaclari
  const counts: Record<string, number> = { bekliyor: 0, temizleniyor: 0, tamamlandi: 0 };
  temizlikBatches.forEach((b) => {
    if (counts[b.clean_status] !== undefined) counts[b.clean_status]++;
  });

  // 6. Durum filtrele
  const filtered =
    selectedStatus === "all"
      ? temizlikBatches
      : temizlikBatches.filter((b) => b.clean_status === selectedStatus);

  // 7. Enrich: plaka adlari, urun adlari, operator adlari
  const plakaIds = [...new Set(filtered.map((b) => b.plaka_id).filter(Boolean) as string[])];
  const skus = [...new Set(filtered.map((b) => b.sku).filter(Boolean) as string[])];
  const operatorIds = [...new Set(filtered.map((b) => b.kesim_operator_id).filter(Boolean) as string[])];

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

  const enriched: TemizlikBatchRow[] = filtered.map((b) => ({
    ...b,
    plaka_adi: b.plaka_id ? plakaMap.get(b.plaka_id) ?? undefined : undefined,
    urun_adi: b.sku ? productMap.get(b.sku) ?? undefined : undefined,
    kesim_operator_adi: b.kesim_operator_id ? operatorMap.get(b.kesim_operator_id) ?? undefined : undefined,
  }));

  return (
    <div className="pb-20 md:pb-6">
      <TemizlikList
        batches={enriched}
        counts={counts}
        selectedStatus={selectedStatus}
      />
    </div>
  );
}
