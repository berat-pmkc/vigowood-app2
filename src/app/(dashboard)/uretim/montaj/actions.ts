"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { montajBatchCreateSchema } from "@/lib/validations";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

async function requireProductionAccess() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── READ ACTIONS ───────────────────────────────────────────────

/** Montaj adımı olan aktif ürünleri getir */
export async function getActiveProductsWithSteps() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    // Aktif ürünleri çek
    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("sku, urun_adi, kategori")
      .eq("aktif_mi", true)
      .order("urun_adi");

    if (pErr) return { success: false as const, error: pErr.message };
    if (!products || products.length === 0) return { success: true as const, data: [] };

    // assembly_steps olan sku'ları bul
    const skus = products.map((p) => p.sku);
    const { data: steps } = await supabase
      .from("assembly_steps")
      .select("sku")
      .in("sku", skus);

    const skusWithSteps = new Set((steps ?? []).map((s) => s.sku));

    const filtered = products.filter((p) => skusWithSteps.has(p.sku));
    return { success: true as const, data: filtered };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Bir ürünün montaj verilerini getir (adımlar + BOM + stok) */
export async function getProductAssemblyData(sku: string, adet: number = 1) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    // 1. Assembly steps
    const { data: steps, error: stepsErr } = await supabase
      .from("assembly_steps")
      .select("step_id, sku, step_name, seq_no, is_final_step")
      .eq("sku", sku)
      .order("seq_no", { ascending: true });

    if (stepsErr) return { success: false as const, error: stepsErr.message };
    if (!steps || steps.length === 0) {
      return { success: true as const, data: { steps: [], bomItems: [], stockMap: {} } };
    }

    // 2. Step BOM items
    const stepIds = steps.map((s) => s.step_id);
    const { data: bomData } = await supabase
      .from("step_bom")
      .select("step_bom_id, step_id, part_id, qty_per, kodu")
      .in("step_id", stepIds);

    const bomItems = bomData ?? [];

    // 3. Part bilgileri (ASM olmayan)
    const regularPartIds = [...new Set(bomItems.filter((b) => !b.part_id.startsWith("ASM-")).map((b) => b.part_id))];
    const asmPartIds = [...new Set(bomItems.filter((b) => b.part_id.startsWith("ASM-")).map((b) => b.part_id))];

    const partInfoMap = new Map<string, { name: string; type: string | null }>();

    if (regularPartIds.length > 0) {
      const { data: parts } = await supabase
        .from("all_parts")
        .select("part_id, part_adi, part_type")
        .in("part_id", regularPartIds);

      for (const p of parts ?? []) {
        partInfoMap.set(p.part_id, { name: p.part_adi || "—", type: p.part_type });
      }
    }

    // ASM referans isimleri
    if (asmPartIds.length > 0) {
      const { data: asmSteps } = await supabase
        .from("assembly_steps")
        .select("step_id, step_name")
        .in("step_id", asmPartIds);

      for (const s of asmSteps ?? []) {
        partInfoMap.set(s.step_id, { name: s.step_name || s.step_id, type: null });
      }
    }

    // 4. Stok bilgileri — YARIMAMUL parçalar için yari_mamul_stok SUM
    const yarimamulIds = regularPartIds.filter((id) => {
      const info = partInfoMap.get(id);
      return info?.type === "YARIMAMUL";
    });
    const hazirIds = regularPartIds.filter((id) => {
      const info = partInfoMap.get(id);
      return info?.type && info.type !== "YARIMAMUL";
    });

    const stockMap: Record<string, number> = {};

    // YARIMAMUL stok: SUM(qty) where direction='IN' - SUM(qty) where direction='OUT'
    if (yarimamulIds.length > 0) {
      const { data: ymsIn } = await supabase
        .from("yari_mamul_stok")
        .select("part_id, qty")
        .in("part_id", yarimamulIds)
        .eq("direction", "IN");

      const { data: ymsOut } = await supabase
        .from("yari_mamul_stok")
        .select("part_id, qty")
        .in("part_id", yarimamulIds)
        .eq("direction", "OUT");

      const inMap: Record<string, number> = {};
      for (const r of ymsIn ?? []) {
        if (r.part_id) inMap[r.part_id] = (inMap[r.part_id] || 0) + r.qty;
      }
      const outMap: Record<string, number> = {};
      for (const r of ymsOut ?? []) {
        if (r.part_id) outMap[r.part_id] = (outMap[r.part_id] || 0) + r.qty;
      }

      for (const id of yarimamulIds) {
        stockMap[id] = (inMap[id] || 0) - (outMap[id] || 0);
      }
    }

    // HAZIR/KUTU/KARTON stok: all_parts.hazir_eleman_aktif_stok
    if (hazirIds.length > 0) {
      const { data: hazirParts } = await supabase
        .from("all_parts")
        .select("part_id, hazir_eleman_aktif_stok")
        .in("part_id", hazirIds);

      for (const p of hazirParts ?? []) {
        stockMap[p.part_id] = p.hazir_eleman_aktif_stok;
      }
    }

    // Enriched BOM items
    const enrichedBom = bomItems.map((b) => {
      const info = partInfoMap.get(b.part_id);
      const isAsm = b.part_id.startsWith("ASM-");
      return {
        step_bom_id: b.step_bom_id,
        step_id: b.step_id,
        part_id: b.part_id,
        part_name: info?.name || b.part_id,
        part_type: info?.type || null,
        is_asm_reference: isAsm,
        qty_per: b.qty_per,
        qty_needed: b.qty_per * adet,
        stock_available: isAsm ? null : (stockMap[b.part_id] ?? 0),
        is_sufficient: isAsm ? true : (stockMap[b.part_id] ?? 0) >= b.qty_per * adet,
      };
    });

    return {
      success: true as const,
      data: {
        steps: steps.map((s) => ({
          ...s,
          bom_count: bomItems.filter((b) => b.step_id === s.step_id).length,
        })),
        bomItems: enrichedBom,
        stockMap,
      },
    };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── MUTATION ACTIONS ───────────────────────────────────────────

/** Yeni montaj batch oluştur */
export async function createMontajBatch(formData: {
  sku: string;
  adet: number;
  notes: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireProductionAccess();

    const parsed = montajBatchCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Operatör bilgisi
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = authUser?.user_metadata?.selected_operator_id ?? user.user_id;
    const operatorName = authUser?.user_metadata?.selected_operator_name ?? user.full_name;
    const email = authUser?.email ?? user.email;

    // Assembly steps sayısı
    const { data: steps } = await supabase
      .from("assembly_steps")
      .select("step_id")
      .eq("sku", parsed.data.sku);

    const totalSteps = steps?.length ?? 0;
    if (totalSteps === 0) {
      return { success: false, error: "Bu ürünün montaj adımı bulunamadı" };
    }

    // Generate MON-XXXX ID
    const { data: lastBatch } = await supabase
      .from("montaj_batches")
      .select("montaj_id")
      .like("montaj_id", "MON-%")
      .order("montaj_id", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastBatch && lastBatch.length > 0) {
      const match = lastBatch[0].montaj_id.match(/MON-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const montajId = `MON-${String(nextNum).padStart(4, "0")}`;

    // INSERT
    const { error } = await supabase.from("montaj_batches").insert({
      montaj_id: montajId,
      sku: parsed.data.sku,
      adet: parsed.data.adet,
      durum: "bekliyor",
      current_step_no: 0,
      total_steps: totalSteps,
      operator_id: operatorId,
      operator_name: operatorName,
      email: email,
      notes: parsed.data.notes,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/montaj");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Montajı başlat: bekliyor → montajda */
export async function startMontaj(montajId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("montaj_batches")
      .select("durum")
      .eq("montaj_id", montajId)
      .single();

    const batch = data as { durum: string } | null;
    if (!batch) return { success: false, error: "Montaj bulunamadı" };
    if (batch.durum !== "bekliyor") return { success: false, error: "Bu montaj zaten başlatılmış" };

    const { error } = await supabase
      .from("montaj_batches")
      .update({
        durum: "montajda",
        current_step_no: 1,
        baslama_zamani: new Date().toISOString(),
      })
      .eq("montaj_id", montajId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/montaj");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Adım ilerlet: current_step_no++ */
export async function advanceStep(montajId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("montaj_batches")
      .select("durum, current_step_no, total_steps")
      .eq("montaj_id", montajId)
      .single();

    const batch = data as { durum: string; current_step_no: number; total_steps: number } | null;
    if (!batch) return { success: false, error: "Montaj bulunamadı" };
    if (batch.durum !== "montajda") return { success: false, error: "Montaj aktif değil" };
    if (batch.current_step_no >= batch.total_steps) {
      return { success: false, error: "Son adıma ulaşıldı. Montajı tamamlayın." };
    }

    const { error } = await supabase
      .from("montaj_batches")
      .update({ current_step_no: batch.current_step_no + 1 })
      .eq("montaj_id", montajId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/montaj");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Montajı tamamla: montajda → tamamlandi + yari_mamul_stok OUT */
export async function completeMontaj(montajId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    // Batch bilgileri
    const { data } = await supabase
      .from("montaj_batches")
      .select("montaj_id, durum, sku, adet, operator_id")
      .eq("montaj_id", montajId)
      .single();

    const batch = data as {
      montaj_id: string;
      durum: string;
      sku: string;
      adet: number;
      operator_id: string | null;
    } | null;

    if (!batch) return { success: false, error: "Montaj bulunamadı" };
    if (batch.durum !== "montajda") return { success: false, error: "Montaj aktif değil" };

    const now = new Date().toISOString();

    // Update durum
    const { error: updateError } = await supabase
      .from("montaj_batches")
      .update({ durum: "tamamlandi", bitis_zamani: now })
      .eq("montaj_id", montajId);

    if (updateError) return { success: false, error: updateError.message };

    // Idempotency: mevcut kayıt kontrolü
    const { data: existing } = await supabase
      .from("yari_mamul_stok")
      .select("source_id")
      .eq("source_id", montajId)
      .limit(1);

    if (existing && existing.length > 0) {
      // Zaten kayıt var
      revalidatePath("/uretim/montaj");
      return { success: true };
    }

    // Assembly steps + BOM al
    const { data: steps } = await supabase
      .from("assembly_steps")
      .select("step_id")
      .eq("sku", batch.sku);

    const stepIds = (steps ?? []).map((s) => s.step_id);

    if (stepIds.length > 0) {
      const { data: bomItems } = await supabase
        .from("step_bom")
        .select("step_bom_id, step_id, part_id, qty_per")
        .in("step_id", stepIds);

      // Sadece YARIMAMUL parçaları için stok düş (ASM referanslar atla)
      const regularPartIds = [
        ...new Set((bomItems ?? []).filter((b) => !b.part_id.startsWith("ASM-")).map((b) => b.part_id)),
      ];

      // Part type bilgisi al
      let yarimamulParts = new Set<string>();
      if (regularPartIds.length > 0) {
        const { data: parts } = await supabase
          .from("all_parts")
          .select("part_id, part_adi, part_type")
          .in("part_id", regularPartIds);

        const partMap = new Map((parts ?? []).map((p) => [p.part_id, p]));
        yarimamulParts = new Set(
          (parts ?? []).filter((p) => p.part_type === "YARIMAMUL").map((p) => p.part_id)
        );

        // Generate YMS IDs
        const { data: lastYms } = await supabase
          .from("yari_mamul_stok")
          .select("yms_id")
          .like("yms_id", "YMS-%")
          .order("yms_id", { ascending: false })
          .limit(1);

        let ymsNum = 1;
        if (lastYms && lastYms.length > 0) {
          const match = lastYms[0].yms_id.match(/YMS-(\d+)/);
          if (match) ymsNum = parseInt(match[1], 10) + 1;
        }

        // YARIMAMUL parçalar için OUT kayıtları
        const ymsInserts = (bomItems ?? [])
          .filter((b) => yarimamulParts.has(b.part_id))
          .map((b) => {
            const ymsId = `YMS-${String(ymsNum).padStart(6, "0")}`;
            ymsNum++;
            const partInfo = partMap.get(b.part_id);
            return {
              yms_id: ymsId,
              tarih: now,
              part_id: b.part_id,
              part_adi: partInfo?.part_adi ?? null,
              sku: batch.sku,
              qty: b.qty_per * batch.adet,
              direction: "OUT",
              source: "Montaj",
              source_id: montajId,
              operator: batch.operator_id,
            };
          });

        if (ymsInserts.length > 0) {
          const { error: ymsError } = await supabase.from("yari_mamul_stok").insert(ymsInserts);
          if (ymsError) return { success: false, error: ymsError.message };
        }
      }
    }

    revalidatePath("/uretim/montaj");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Montajı iptal et: montajda → bekliyor */
export async function cancelMontaj(montajId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("montaj_batches")
      .select("durum")
      .eq("montaj_id", montajId)
      .single();

    const batch = data as { durum: string } | null;
    if (!batch) return { success: false, error: "Montaj bulunamadı" };
    if (batch.durum !== "montajda") return { success: false, error: "Sadece montajda durumundaki kayıt iptal edilebilir" };

    const { error } = await supabase
      .from("montaj_batches")
      .update({
        durum: "bekliyor",
        current_step_no: 0,
        baslama_zamani: null,
      })
      .eq("montaj_id", montajId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/montaj");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
