"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { partUpdateSchema, partCreateSchema } from "@/lib/validations";
import type { PartType, Database } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function createPart(
  formData: {
    part_id: string;
    part_adi: string;
    part_type: string;
    hazir_eleman_kritik_stok: number;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = partCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Check if part_id already exists
    const { data: existing } = await supabase
      .from("all_parts")
      .select("part_id")
      .eq("part_id", parsed.data.part_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: "Bu Parça ID zaten kullanılıyor" };
    }

    const { error } = await supabase.from("all_parts").insert({
      part_id: parsed.data.part_id,
      part_adi: parsed.data.part_adi,
      part_type: parsed.data.part_type as PartType,
      hazir_eleman_kritik_stok: parsed.data.hazir_eleman_kritik_stok,
      hazir_eleman_aktif_stok: 0,
      yari_mamul_stok: 0,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/parcalar");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function updatePart(
  partId: string,
  formData: { part_adi: string; part_type: string; hazir_eleman_kritik_stok: number }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = partUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("all_parts")
      .update({
        part_adi: parsed.data.part_adi,
        part_type: parsed.data.part_type as PartType,
        hazir_eleman_kritik_stok: parsed.data.hazir_eleman_kritik_stok,
      })
      .eq("part_id", partId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/parcalar");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function deletePart(partId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Check plaka_parts references
    const { data: plakaRefs } = await supabase
      .from("plaka_parts")
      .select("ppart_id")
      .eq("part_id", partId)
      .limit(1);

    if (plakaRefs && plakaRefs.length > 0) {
      return {
        success: false,
        error: "Bu parça bir plakada referans ediliyor, silinemez",
      };
    }

    // Check step_bom references
    const { data: bomRefs } = await supabase
      .from("step_bom")
      .select("step_bom_id")
      .eq("part_id", partId)
      .limit(1);

    if (bomRefs && bomRefs.length > 0) {
      return {
        success: false,
        error: "Bu parça BOM'da referans ediliyor, silinemez",
      };
    }

    const { error } = await supabase
      .from("all_parts")
      .delete()
      .eq("part_id", partId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/parcalar");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function exportParts(): Promise<
  { success: true; data: AllPart[] } | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("all_parts")
      .select("*")
      .order("part_id");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as AllPart[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function importParts(
  rows: { part_id: string; part_adi: string; part_type: string; hazir_eleman_kritik_stok: string }[]
): Promise<ActionResult & { count?: number }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    let count = 0;
    for (const row of rows) {
      if (!row.part_id) continue;
      const kritikStok = parseInt(row.hazir_eleman_kritik_stok, 10);
      const { error } = await supabase
        .from("all_parts")
        .upsert(
          {
            part_id: row.part_id,
            part_adi: row.part_adi || "",
            part_type: (row.part_type || "HAZIR") as PartType,
            hazir_eleman_kritik_stok: isNaN(kritikStok) ? 0 : kritikStok,
          },
          { onConflict: "part_id" }
        );

      if (error) {
        return { success: false, error: `Satır ${row.part_id}: ${error.message}` };
      }
      count++;
    }

    revalidatePath("/admin/parcalar");
    return { success: true, count };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
