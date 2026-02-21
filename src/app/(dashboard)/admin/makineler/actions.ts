"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { makineCreateSchema, makineUpdateSchema } from "@/lib/validations";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function createMakine(formData: {
  makine_id: string;
  tipi: string;
  bolum: string;
  aciklama: string | null;
}): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = makineCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Check if makine_id already exists
    const { data: existing } = await supabase
      .from("kesim_makinesi")
      .select("makine_id")
      .eq("makine_id", parsed.data.makine_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: "Bu Makine ID zaten kullanılıyor" };
    }

    const { error } = await supabase.from("kesim_makinesi").insert({
      makine_id: parsed.data.makine_id,
      tipi: parsed.data.tipi,
      bolum: parsed.data.bolum,
      aciklama: parsed.data.aciklama,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/makineler");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function updateMakine(
  makineId: string,
  formData: { tipi: string; bolum: string; aciklama: string | null; aktif: boolean }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = makineUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("kesim_makinesi")
      .update({
        tipi: parsed.data.tipi,
        bolum: parsed.data.bolum,
        aciklama: parsed.data.aciklama,
        aktif: parsed.data.aktif,
      })
      .eq("makine_id", makineId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/makineler");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function deleteMakine(makineId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Check cut_batches references
    const { data: cutRefs } = await supabase
      .from("cut_batches")
      .select("batch_id")
      .eq("makine_id", makineId)
      .limit(1);

    if (cutRefs && cutRefs.length > 0) {
      return {
        success: false,
        error: "Bu makineye ait kesim kayıtları var, silinemez",
      };
    }

    const { error } = await supabase
      .from("kesim_makinesi")
      .delete()
      .eq("makine_id", makineId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/makineler");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}
