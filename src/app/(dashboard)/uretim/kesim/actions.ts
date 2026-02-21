"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cutBatchCreateSchema } from "@/lib/validations";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import type { Database } from "@/lib/supabase/types";

type ActionResult = { success: true } | { success: false; error: string };
type CutBatch = Database["public"]["Tables"]["cut_batches"]["Row"];

async function requireProductionAccess() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

/** Aktif ürünleri getir (SKU selector için) */
export async function getActiveProducts() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select("sku, urun_adi, kategori")
      .eq("aktif_mi", true)
      .order("urun_adi");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Makine + SKU'ya göre plaka listesi */
export async function getPlakalarForKesim(makineId: string, sku?: string) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    let query = supabase
      .from("plakalar")
      .select("plakalar_id, plaka_id, plaka_adi, sku, tipi, renk, kesim_sureleri");

    if (sku) {
      query = query.eq("sku", sku);
    }

    const { data, error } = await query.order("plaka_adi");

    if (error) return { success: false as const, error: error.message };

    // Filter client-side: only plakalar that have a kesim süresi for this makine
    const filtered = (data ?? [])
      .filter((p) => {
        const ks = (p.kesim_sureleri ?? {}) as Record<string, number>;
        return ks[makineId] != null;
      })
      .map((p) => {
        const ks = (p.kesim_sureleri ?? {}) as Record<string, number>;
        return {
          plakalar_id: p.plakalar_id,
          plaka_id: p.plaka_id,
          plaka_adi: p.plaka_adi,
          sku: p.sku,
          tipi: p.tipi,
          renk: p.renk,
          makine_id: makineId,
          std_kesim_suresi_dk: ks[makineId] ?? null,
        };
      });

    return { success: true as const, data: filtered };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Seçilen plakanın parçalarını getir (preview) */
export async function getPlakaParts(plakaId: string) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: parts, error } = await supabase
      .from("plaka_parts")
      .select("ppart_id, plaka_id, part_id, default_qty")
      .eq("plaka_id", plakaId)
      .order("part_id");

    if (error) return { success: false as const, error: error.message };
    if (!parts || parts.length === 0) return { success: true as const, data: [] };

    // Fetch part names
    const partIds = parts.map((p) => p.part_id);
    const { data: allParts } = await supabase
      .from("all_parts")
      .select("part_id, part_adi")
      .in("part_id", partIds);

    const partNameMap = new Map(
      (allParts ?? []).map((p) => [p.part_id, p.part_adi])
    );

    const result = parts.map((p) => ({
      ppart_id: p.ppart_id,
      part_id: p.part_id,
      part_adi: partNameMap.get(p.part_id) || "—",
      default_qty: p.default_qty ?? 0,
    }));

    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Yeni kesim batch + cut_lines oluştur */
export async function createCutBatch(formData: {
  makine_id: string;
  sku: string;
  plaka_id: string;
  adet: number;
  plk_notu: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireProductionAccess();

    const parsed = cutBatchCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Get operator info from auth metadata
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = authUser?.user_metadata?.selected_operator_id ?? user.user_id;
    const email = authUser?.email ?? user.email;

    // Generate next KES-XXXX ID
    const { data: lastBatch } = await supabase
      .from("cut_batches")
      .select("cut_id")
      .order("cut_id", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastBatch && lastBatch.length > 0) {
      const match = lastBatch[0].cut_id.match(/KES-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const cutId = `KES-${String(nextNum).padStart(4, "0")}`;

    // Get plaka_parts for this plaka_id
    const { data: plakaParts, error: ppError } = await supabase
      .from("plaka_parts")
      .select("part_id, default_qty")
      .eq("plaka_id", parsed.data.plaka_id);

    if (ppError) return { success: false, error: ppError.message };

    const now = new Date().toISOString();

    // Insert cut_batch
    const { error: batchError } = await supabase.from("cut_batches").insert({
      cut_id: cutId,
      tarih: now,
      sku: parsed.data.sku,
      plaka_id: parsed.data.plaka_id,
      makine_id: parsed.data.makine_id,
      adet: parsed.data.adet,
      operator_id: operatorId,
      plk_notu: parsed.data.plk_notu,
      email: email,
      durum: "bekliyor",
    });

    if (batchError) return { success: false, error: batchError.message };

    // Generate cut_lines from plaka_parts
    if (plakaParts && plakaParts.length > 0) {
      // Get last K-XXXX ID
      const { data: lastLine } = await supabase
        .from("cut_lines")
        .select("cut_line_id")
        .order("cut_line_id", { ascending: false })
        .limit(1);

      let lineNum = 1;
      if (lastLine && lastLine.length > 0) {
        const match = lastLine[0].cut_line_id.match(/K-(\d+)/);
        if (match) lineNum = parseInt(match[1], 10) + 1;
      }

      const cutLines = plakaParts.map((pp) => {
        const lineId = `K-${String(lineNum).padStart(4, "0")}`;
        lineNum++;
        return {
          cut_line_id: lineId,
          cut_id: cutId,
          tarih: now,
          part_id: pp.part_id,
          adet: (pp.default_qty ?? 0) * parsed.data.adet,
          email: email,
        };
      });

      const { error: linesError } = await supabase.from("cut_lines").insert(cutLines);
      if (linesError) return { success: false, error: linesError.message };
    }

    revalidatePath("/uretim/kesim");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Kesimi başlat: bekliyor → kesiliyor */
export async function startCut(cutId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    // Durum kontrolü
    const { data: startData } = await supabase
      .from("cut_batches")
      .select("durum")
      .eq("cut_id", cutId)
      .single();

    const batch = startData as { durum: string } | null;
    if (!batch) return { success: false, error: "Kesim bulunamadı" };
    if (batch.durum !== "bekliyor") return { success: false, error: "Bu kesim zaten başlatılmış" };

    const { error } = await supabase
      .from("cut_batches")
      .update({ durum: "kesiliyor", baslama_zamani: new Date().toISOString() })
      .eq("cut_id", cutId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/kesim");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Kesimi tamamla: kesiliyor → tamamlandi + yari_mamul_stok INSERT */
export async function completeCut(cutId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    // Batch bilgilerini al
    const { data } = await supabase
      .from("cut_batches")
      .select("cut_id, durum, sku, operator_id")
      .eq("cut_id", cutId)
      .single();

    const batch = data as { cut_id: string; durum: string; sku: string | null; operator_id: string | null } | null;
    if (!batch) return { success: false, error: "Kesim bulunamadı" };
    if (batch.durum !== "kesiliyor") return { success: false, error: "Bu kesim henüz başlatılmamış veya zaten tamamlanmış" };

    const now = new Date().toISOString();

    // Update durum
    const { error: updateError } = await supabase
      .from("cut_batches")
      .update({ durum: "tamamlandi", bitis_zamani: now })
      .eq("cut_id", cutId);

    if (updateError) return { success: false, error: updateError.message };

    // Cut lines al
    const { data: lines } = await supabase
      .from("cut_lines")
      .select("cut_line_id, part_id, adet")
      .eq("cut_id", cutId);

    if (lines && lines.length > 0) {
      // Idempotency: mevcut kayıt kontrolü
      const { data: existing } = await supabase
        .from("yari_mamul_stok")
        .select("source_id")
        .eq("source_id", cutId)
        .limit(1);

      if (existing && existing.length > 0) {
        // Zaten kayıt var, tekrar ekleme
        revalidatePath("/uretim/kesim");
        return { success: true };
      }

      // Part adlarını çek
      const partIds = lines.filter(l => l.part_id).map(l => l.part_id!);
      const { data: allParts } = await supabase
        .from("all_parts")
        .select("part_id, part_adi")
        .in("part_id", partIds);

      const partNameMap = new Map(
        (allParts ?? []).map(p => [p.part_id, p.part_adi])
      );

      // Generate next YMS ID
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

      const ymsInserts = lines
        .filter(l => l.part_id)
        .map(l => {
          const ymsId = `YMS-${String(ymsNum).padStart(6, "0")}`;
          ymsNum++;
          return {
            yms_id: ymsId,
            tarih: now,
            part_id: l.part_id,
            part_adi: partNameMap.get(l.part_id!) ?? null,
            sku: batch.sku,
            qty: l.adet,
            direction: "IN",
            source: "Kesim",
            source_id: cutId,
            operator: batch.operator_id,
          };
        });

      if (ymsInserts.length > 0) {
        const { error: ymsError } = await supabase.from("yari_mamul_stok").insert(ymsInserts);
        if (ymsError) return { success: false, error: ymsError.message };
      }
    }

    revalidatePath("/uretim/kesim");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Kesimi iptal et: kesiliyor → bekliyor (yanlış başlatma düzeltme) */
export async function cancelCut(cutId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: cancelData } = await supabase
      .from("cut_batches")
      .select("durum")
      .eq("cut_id", cutId)
      .single();

    const cancelBatch = cancelData as { durum: string } | null;
    if (!cancelBatch) return { success: false, error: "Kesim bulunamadı" };
    if (cancelBatch.durum !== "kesiliyor") return { success: false, error: "Sadece kesiliyor durumundaki kayıt iptal edilebilir" };

    const { error } = await supabase
      .from("cut_batches")
      .update({ durum: "bekliyor", baslama_zamani: null })
      .eq("cut_id", cutId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/kesim");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Batch'in cut_lines + part_adi bilgisi */
export async function getCutLines(cutId: string) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: lines, error } = await supabase
      .from("cut_lines")
      .select("cut_line_id, cut_id, part_id, adet, renk, not_text")
      .eq("cut_id", cutId)
      .order("cut_line_id");

    if (error) return { success: false as const, error: error.message };
    if (!lines || lines.length === 0) return { success: true as const, data: [] };

    // Part adlarını çek
    const partIds = lines.filter(l => l.part_id).map(l => l.part_id!);
    const { data: allParts } = await supabase
      .from("all_parts")
      .select("part_id, part_adi")
      .in("part_id", partIds.length > 0 ? partIds : ["__none__"]);

    const partNameMap = new Map(
      (allParts ?? []).map(p => [p.part_id, p.part_adi])
    );

    const result = lines.map(l => ({
      ...l,
      part_adi: l.part_id ? (partNameMap.get(l.part_id) ?? "—") : "—",
    }));

    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
