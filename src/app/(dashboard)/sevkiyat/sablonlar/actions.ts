"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { paletSablonSchema } from "@/lib/validations";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

async function requireSevkiyatAccess() {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export interface PaletSablonRow {
  id: number;
  sku: string;
  palet_boyut: string;
  palet_yukseklik: number;
  en: number;
  boy: number;
  yuk: number;
  koli_adedi: number;
  palette_koli: number;
  koli_agirlik: number;
  created_at: string;
  updated_at: string;
}

export async function createPaletSablon(formData: {
  sku: string;
  palet_boyut: string;
  palet_yukseklik: number;
  en: number;
  boy: number;
  yuk: number;
  koli_adedi: number;
  palette_koli: number;
  koli_agirlik: number;
}): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();

    const parsed = paletSablonSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("sevkiyat_palet_sablon").insert({
      sku: parsed.data.sku,
      palet_boyut: parsed.data.palet_boyut,
      palet_yukseklik: parsed.data.palet_yukseklik,
      en: parsed.data.en,
      boy: parsed.data.boy,
      yuk: parsed.data.yuk,
      koli_adedi: parsed.data.koli_adedi,
      palette_koli: parsed.data.palette_koli,
      koli_agirlik: parsed.data.koli_agirlik,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat/sablonlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updatePaletSablon(
  id: number,
  formData: {
    sku: string;
    palet_boyut: string;
    palet_yukseklik: number;
    en: number;
    boy: number;
    yuk: number;
    koli_adedi: number;
    palette_koli: number;
    koli_agirlik: number;
  }
): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();

    const parsed = paletSablonSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("sevkiyat_palet_sablon")
      .update({
        sku: parsed.data.sku,
        palet_boyut: parsed.data.palet_boyut,
        palet_yukseklik: parsed.data.palet_yukseklik,
        en: parsed.data.en,
        boy: parsed.data.boy,
        yuk: parsed.data.yuk,
        koli_adedi: parsed.data.koli_adedi,
        palette_koli: parsed.data.palette_koli,
        koli_agirlik: parsed.data.koli_agirlik,
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat/sablonlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deletePaletSablon(id: number): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();

    const supabase = await createClient();
    const { error } = await supabase
      .from("sevkiyat_palet_sablon")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat/sablonlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
