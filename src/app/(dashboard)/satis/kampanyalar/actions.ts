"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SATIS_ACCESS_ROLES } from "@/lib/constants";
import { kampanyaSchema } from "@/lib/validations";

type ActionResult = { success: true } | { success: false; error: string };

async function requireSalesAccess() {
  const user = await getCurrentUser();
  if (!user || !SATIS_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function createKampanya(formData: {
  kampanya_adi: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  ana_hedef: string | null;
  ziyaretci: number | null;
  siparis_sayisi: number | null;
  ciro: number | null;
  donusum_orani: number | null;
  ortalama_sepet: number | null;
  notlar: string | null;
}): Promise<ActionResult> {
  try {
    await requireSalesAccess();
    const parsed = kampanyaSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }
    const supabase = await createClient();

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const kodu = `VWK-${datePart}-${timePart}`;

    const { error } = await supabase.from("kampanyalar").insert({
      kodu,
      ...parsed.data,
      aktif_mi: true,
    });
    if (error) return { success: false, error: error.message };
    revalidatePath("/satis/kampanyalar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updateKampanya(
  id: string,
  formData: {
    kampanya_adi: string;
    baslangic_tarihi: string;
    bitis_tarihi: string;
    ana_hedef: string | null;
    ziyaretci: number | null;
    siparis_sayisi: number | null;
    ciro: number | null;
    donusum_orani: number | null;
    ortalama_sepet: number | null;
    notlar: string | null;
  },
): Promise<ActionResult> {
  try {
    await requireSalesAccess();
    const parsed = kampanyaSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("kampanyalar").update(parsed.data).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/satis/kampanyalar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function toggleKampanyaAktif(
  id: string,
  aktif: boolean,
): Promise<ActionResult> {
  try {
    await requireSalesAccess();
    const supabase = await createClient();
    const { error } = await supabase
      .from("kampanyalar")
      .update({ aktif_mi: aktif })
      .eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/satis/kampanyalar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteKampanya(id: string): Promise<ActionResult> {
  try {
    await requireSalesAccess();
    const supabase = await createClient();
    const { error } = await supabase.from("kampanyalar").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/satis/kampanyalar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
