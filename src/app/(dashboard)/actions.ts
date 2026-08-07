"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

/**
 * Üretim uyarısını okundu olarak işaretler.
 *
 * RLS yalnızca kendisine hedeflenen uyarıyı güncellemeye izin verdiği için
 * ek yetki kontrolüne gerek yok; yine de silinen/güncellenen satır sayısı
 * doğrulanıyor — RLS engellediğinde PostgREST hata döndürmüyor.
 */
export async function uyariyiOkunduIsaretle(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Oturum bulunamadı" };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("uretim_uyarilari")
      .update({ durum: "okundu" })
      .eq("id", id)
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Uyarı güncellenemedi" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}
