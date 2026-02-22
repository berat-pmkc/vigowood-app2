"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type AllPart = Database["public"]["Tables"]["all_parts"]["Row"];
type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function getNextHPCode(): Promise<string> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("all_parts")
    .select("part_id")
    .eq("part_type", "HAZIR")
    .like("part_id", "HP%")
    .order("part_id", { ascending: false });

  let maxNum = 0;
  if (data && data.length > 0) {
    for (const row of data) {
      const match = row.part_id.match(/^HP(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `HP${String(nextNum).padStart(4, "0")}`;
}

export async function getNextMDFCode(): Promise<string> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("all_parts")
    .select("part_id")
    .eq("part_type", "HAZIR")
    .like("part_id", "MDF%")
    .order("part_id", { ascending: false });

  let maxNum = 0;
  if (data && data.length > 0) {
    for (const row of data) {
      const match = row.part_id.match(/^MDF(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `MDF${String(nextNum).padStart(4, "0")}`;
}

export async function createHazirEleman(formData: {
  part_id: string;
  part_adi: string;
  hazir_eleman_kritik_stok: number;
  mdf_tipi?: string | null;
  mdf_renk?: string | null;
}): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!formData.part_id || !formData.part_adi) {
      return { success: false, error: "Parça ID ve adı gereklidir" };
    }

    const supabase = await createClient();

    // Check if part_id already exists
    const { data: existing } = await supabase
      .from("all_parts")
      .select("part_id")
      .eq("part_id", formData.part_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: "Bu Parça ID zaten kullanılıyor" };
    }

    // MDF tipi+renk unique kontrolü
    if (formData.mdf_tipi && formData.mdf_renk) {
      const { data: mdfExisting } = await supabase
        .from("all_parts")
        .select("part_id")
        .eq("mdf_tipi", formData.mdf_tipi)
        .eq("mdf_renk", formData.mdf_renk)
        .limit(1);

      if (mdfExisting && mdfExisting.length > 0) {
        return {
          success: false,
          error: `Bu MDF tipi+renk kombinasyonu zaten ${mdfExisting[0].part_id} tarafından kullanılıyor`,
        };
      }
    }

    const { error } = await supabase.from("all_parts").insert({
      part_id: formData.part_id,
      part_adi: formData.part_adi,
      part_type: "HAZIR",
      hazir_eleman_kritik_stok: formData.hazir_eleman_kritik_stok || 0,
      hazir_eleman_aktif_stok: 0,
      yari_mamul_stok: 0,
      mdf_tipi: formData.mdf_tipi || null,
      mdf_renk: formData.mdf_renk || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/hazir-eleman");
    revalidatePath("/admin/parcalar");
    revalidateTag("parts", "default");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function updateHazirEleman(
  partId: string,
  formData: {
    part_adi: string;
    hazir_eleman_kritik_stok: number;
    mdf_tipi?: string | null;
    mdf_renk?: string | null;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!formData.part_adi) {
      return { success: false, error: "Parça adı gereklidir" };
    }

    const supabase = await createClient();

    // MDF tipi+renk unique kontrolü (başka parça kullanıyor mu?)
    if (formData.mdf_tipi && formData.mdf_renk) {
      const { data: mdfExisting } = await supabase
        .from("all_parts")
        .select("part_id")
        .eq("mdf_tipi", formData.mdf_tipi)
        .eq("mdf_renk", formData.mdf_renk)
        .neq("part_id", partId)
        .limit(1);

      if (mdfExisting && mdfExisting.length > 0) {
        return {
          success: false,
          error: `Bu MDF tipi+renk kombinasyonu zaten ${mdfExisting[0].part_id} tarafından kullanılıyor`,
        };
      }
    }

    const { error } = await supabase
      .from("all_parts")
      .update({
        part_adi: formData.part_adi,
        hazir_eleman_kritik_stok: formData.hazir_eleman_kritik_stok,
        mdf_tipi: formData.mdf_tipi || null,
        mdf_renk: formData.mdf_renk || null,
      })
      .eq("part_id", partId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/hazir-eleman");
    revalidatePath("/admin/parcalar");
    revalidateTag("parts", "default");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function deleteHazirEleman(partId: string): Promise<ActionResult> {
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
        error: "Bu hazır eleman bir plakada referans ediliyor, silinemez",
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
        error: "Bu hazır eleman BOM'da referans ediliyor, silinemez",
      };
    }

    const { error } = await supabase
      .from("all_parts")
      .delete()
      .eq("part_id", partId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/hazir-eleman");
    revalidatePath("/admin/parcalar");
    revalidateTag("parts", "default");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function exportHazirEleman(): Promise<
  { success: true; data: AllPart[] } | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("all_parts")
      .select("*")
      .eq("part_type", "HAZIR")
      .order("part_id");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as AllPart[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
