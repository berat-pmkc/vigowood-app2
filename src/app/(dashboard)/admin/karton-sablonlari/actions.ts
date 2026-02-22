"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { kartonSablonCreateSchema, kartonSablonUpdateSchema } from "@/lib/validations";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

/** KUTU ve KARTON tipindeki parçaları getir (çıkan parça seçimi için) */
export async function getKutuKartonParts(): Promise<
  | { success: true; data: { part_id: string; part_adi: string; part_type: string }[] }
  | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("all_parts")
      .select("part_id, part_adi, part_type")
      .in("part_type", ["KUTU", "KARTON"])
      .order("part_adi");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as { part_id: string; part_adi: string; part_type: string }[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Karton şablon oluştur: plaka (KARTON) + tek plaka_parts kaydı */
export async function createKartonSablon(formData: {
  plaka_id: string;
  plaka_adi: string;
  tipi: string | null;
  renk: string | null;
  sku: string;
  kutu_sure_dk: number | null;
  output_part_id: string;
}): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = kartonSablonCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Generate next plakalar_id (PL-XXXX)
    const { data: lastPlaka } = await supabase
      .from("plakalar")
      .select("plakalar_id")
      .like("plakalar_id", "PL-%")
      .order("plakalar_id", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastPlaka && lastPlaka.length > 0) {
      const match = lastPlaka[0].plakalar_id.match(/PL-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const plakalarId = `PL-${String(nextNum).padStart(4, "0")}`;

    // Build kesim_sureleri (only KUTU key)
    const kesimSureleri: Record<string, number> = {};
    if (parsed.data.kutu_sure_dk != null) {
      kesimSureleri["KUTU"] = parsed.data.kutu_sure_dk;
    }

    // Insert plaka
    const { error: plakaError } = await supabase.from("plakalar").insert({
      plakalar_id: plakalarId,
      plaka_id: parsed.data.plaka_id,
      plaka_adi: parsed.data.plaka_adi,
      tipi: parsed.data.tipi,
      renk: parsed.data.renk,
      kesim_sureleri: kesimSureleri,
      sku: parsed.data.sku,
      plaka_kategori: "KARTON",
    });

    if (plakaError) return { success: false, error: plakaError.message };

    // Generate next ppart_id
    const { data: lastPpart } = await supabase
      .from("plaka_parts")
      .select("ppart_id")
      .order("ppart_id", { ascending: false })
      .limit(1);

    let ppartNum = 1;
    if (lastPpart && lastPpart.length > 0) {
      const match = lastPpart[0].ppart_id.match(/PPart(\d+)/);
      if (match) ppartNum = parseInt(match[1], 10) + 1;
    }
    const ppartId = `PPart${String(ppartNum).padStart(4, "0")}`;

    // Insert plaka_parts (1:1)
    const { error: partError } = await supabase.from("plaka_parts").insert({
      ppart_id: ppartId,
      plaka_id: parsed.data.plaka_id,
      part_id: parsed.data.output_part_id,
      default_qty: 1,
      sku: parsed.data.sku,
    });

    if (partError) return { success: false, error: partError.message };

    revalidatePath("/admin/karton-sablonlari");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Karton şablon güncelle */
export async function updateKartonSablon(
  plakalarId: string,
  formData: {
    plaka_adi: string;
    tipi: string | null;
    renk: string | null;
    sku: string;
    kutu_sure_dk: number | null;
    output_part_id: string;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = kartonSablonUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Get plaka_id
    const { data: plaka } = await supabase
      .from("plakalar")
      .select("plaka_id")
      .eq("plakalar_id", plakalarId)
      .single();

    if (!plaka) return { success: false, error: "Şablon bulunamadı" };

    // Build kesim_sureleri
    const kesimSureleri: Record<string, number> = {};
    if (parsed.data.kutu_sure_dk != null) {
      kesimSureleri["KUTU"] = parsed.data.kutu_sure_dk;
    }

    // Update plaka
    const { error: plakaError } = await supabase
      .from("plakalar")
      .update({
        plaka_adi: parsed.data.plaka_adi,
        tipi: parsed.data.tipi,
        renk: parsed.data.renk,
        kesim_sureleri: kesimSureleri,
        sku: parsed.data.sku,
      })
      .eq("plakalar_id", plakalarId);

    if (plakaError) return { success: false, error: plakaError.message };

    // Update plaka_parts (upsert the single part)
    const { data: existingParts } = await supabase
      .from("plaka_parts")
      .select("ppart_id")
      .eq("plaka_id", plaka.plaka_id);

    if (existingParts && existingParts.length > 0) {
      // Update existing
      await supabase
        .from("plaka_parts")
        .update({
          part_id: parsed.data.output_part_id,
          default_qty: 1,
          sku: parsed.data.sku,
        })
        .eq("ppart_id", existingParts[0].ppart_id);
    } else {
      // Insert new
      const { data: lastPpart } = await supabase
        .from("plaka_parts")
        .select("ppart_id")
        .order("ppart_id", { ascending: false })
        .limit(1);

      let ppartNum = 1;
      if (lastPpart && lastPpart.length > 0) {
        const match = lastPpart[0].ppart_id.match(/PPart(\d+)/);
        if (match) ppartNum = parseInt(match[1], 10) + 1;
      }
      const ppartId = `PPart${String(ppartNum).padStart(4, "0")}`;

      await supabase.from("plaka_parts").insert({
        ppart_id: ppartId,
        plaka_id: plaka.plaka_id,
        part_id: parsed.data.output_part_id,
        default_qty: 1,
        sku: parsed.data.sku,
      });
    }

    revalidatePath("/admin/karton-sablonlari");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Karton şablon sil */
export async function deleteKartonSablon(plakalarId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Get plaka_id
    const { data: plaka } = await supabase
      .from("plakalar")
      .select("plaka_id")
      .eq("plakalar_id", plakalarId)
      .single();

    if (!plaka) return { success: false, error: "Şablon bulunamadı" };

    // Check kutu_uretim references
    const { data: kutuRefs } = await supabase
      .from("kutu_uretim")
      .select("session_id")
      .eq("plaka_id", plaka.plaka_id)
      .limit(1);

    if (kutuRefs && kutuRefs.length > 0) {
      return { success: false, error: "Bu şablon üretimde kullanılmış, silinemez" };
    }

    // Delete plaka_parts
    await supabase.from("plaka_parts").delete().eq("plaka_id", plaka.plaka_id);

    // Delete plaka
    const { error } = await supabase.from("plakalar").delete().eq("plakalar_id", plakalarId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/karton-sablonlari");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
