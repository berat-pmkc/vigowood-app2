"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { odemeCreateSchema, type OdemeCreateData } from "@/lib/validations";
import { FINANCE_ROLES } from "@/lib/constants";

async function requireFinanceAccess() {
  const user = await getCurrentUser();
  if (!user || !FINANCE_ROLES.includes(user.role as (typeof FINANCE_ROLES)[number])) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "Yönetici") {
    throw new Error("Bu işlem sadece yöneticiler tarafından yapılabilir");
  }
  return user;
}

/** Yeni ödeme oluştur */
export async function createOdeme(
  formData: OdemeCreateData
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const parsed = odemeCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("odemeler")
      .insert({
        tanimi: parsed.data.tanimi,
        tutar: parsed.data.tutar,
        cinsi: parsed.data.cinsi,
        tarih: parsed.data.tarih,
        turu: parsed.data.turu,
        odeme_durum: parsed.data.odeme_durum,
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/muhasebe/odemeler");
    return { success: true, id: data.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/** Ödeme güncelle */
export async function updateOdeme(
  id: string,
  formData: OdemeCreateData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const parsed = odemeCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("odemeler")
      .update({
        tanimi: parsed.data.tanimi,
        tutar: parsed.data.tutar,
        cinsi: parsed.data.cinsi,
        tarih: parsed.data.tarih,
        turu: parsed.data.turu,
        odeme_durum: parsed.data.odeme_durum,
      })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/muhasebe/odemeler");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/** Ödeme durumunu toggle (BEKLİYOR ↔ TAMAMLANDI) */
export async function toggleOdemeDurum(
  id: string,
  newDurum: "TAMAMLANDI" | "BEKLİYOR"
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const { error } = await supabase
      .from("odemeler")
      .update({ odeme_durum: newDurum })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/muhasebe/odemeler");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/** Ödeme sil (sadece Yönetici) */
export async function deleteOdeme(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("odemeler")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/muhasebe/odemeler");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}
