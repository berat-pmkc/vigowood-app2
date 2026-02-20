"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { productUpdateSchema } from "@/lib/validations";
import type { ProductCategory } from "@/lib/supabase/types";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function updateProduct(
  sku: string,
  formData: { urun_adi: string; kategori: string; aktif_mi: boolean }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = productUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({
        urun_adi: parsed.data.urun_adi,
        kategori: parsed.data.kategori as ProductCategory,
        aktif_mi: parsed.data.aktif_mi,
      })
      .eq("sku", sku);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/urunler");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function bulkToggleActive(
  skus: string[],
  aktif: boolean
): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (skus.length === 0) {
      return { success: false, error: "Hiç ürün seçilmedi" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ aktif_mi: aktif })
      .in("sku", skus);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/urunler");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
