"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sevkiyatFirmaSchema } from "@/lib/validations";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

type ActionResult = { success: true } | { success: false; error: string };

export async function createFirma(formData: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = sevkiyatFirmaSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    const supabase = await createClient();

    const { error } = await supabase.from("sevkiyat_firmalar").insert(parsed.data);
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/firmalar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updateFirma(id: number, formData: Record<string, unknown>): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = sevkiyatFirmaSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("sevkiyat_firmalar")
      .update(parsed.data)
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/firmalar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteFirma(id: number): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("sevkiyat_firmalar")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/firmalar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
