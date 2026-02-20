"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sevkiyatFiyatSchema } from "@/lib/validations";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export interface FiyatRow {
  id: number;
  country_code: string;
  sku: string;
  urun_adi_en: string | null;
  gtip: string | null;
  birim_fiyat: number;
  kategori: string | null;
  package_qty: number | null;
  asin: string | null;
  created_at: string;
  updated_at: string;
}

export async function createFiyat(formData: {
  country_code: string;
  sku: string;
  urun_adi_en: string | null;
  gtip: string | null;
  birim_fiyat: number;
  kategori: string | null;
  package_qty: number | null;
  asin: string | null;
}): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = sevkiyatFiyatSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("sevkiyat_fiyatlar").insert({
      country_code: parsed.data.country_code,
      sku: parsed.data.sku,
      urun_adi_en: parsed.data.urun_adi_en,
      gtip: parsed.data.gtip,
      birim_fiyat: parsed.data.birim_fiyat,
      kategori: parsed.data.kategori,
      package_qty: parsed.data.package_qty,
      asin: parsed.data.asin,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/fiyatlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updateFiyat(
  id: number,
  formData: {
    country_code: string;
    sku: string;
    urun_adi_en: string | null;
    gtip: string | null;
    birim_fiyat: number;
    kategori: string | null;
    package_qty: number | null;
    asin: string | null;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = sevkiyatFiyatSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("sevkiyat_fiyatlar")
      .update({
        country_code: parsed.data.country_code,
        sku: parsed.data.sku,
        urun_adi_en: parsed.data.urun_adi_en,
        gtip: parsed.data.gtip,
        birim_fiyat: parsed.data.birim_fiyat,
        kategori: parsed.data.kategori,
        package_qty: parsed.data.package_qty,
        asin: parsed.data.asin,
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/fiyatlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteFiyat(id: number): Promise<ActionResult> {
  try {
    await requireAdmin();

    const supabase = await createClient();
    const { error } = await supabase
      .from("sevkiyat_fiyatlar")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/fiyatlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
