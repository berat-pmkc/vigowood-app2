"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { partUpdateSchema } from "@/lib/validations";
import type { PartType } from "@/lib/supabase/types";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
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
