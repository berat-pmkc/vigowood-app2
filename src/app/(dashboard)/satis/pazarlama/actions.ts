"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SATIS_ACCESS_ROLES } from "@/lib/constants";
import { trPazarlamaSchema } from "@/lib/validations";

type ActionResult = { success: true } | { success: false; error: string };

async function requireSalesAccess() {
  const user = await getCurrentUser();
  if (!user || !SATIS_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function createPazarlama(formData: {
  yil: number;
  ay: number;
  pazaryeri: string;
  hedef_ciro: number;
  gercek_ciro: number;
  siparis_sayisi: number;
  ziyaretci: number;
  donusum_orani: number;
  iadeler: number;
  ortalama_sepet: number | null;
  reklam_harcamasi: number | null;
  not_text: string | null;
}): Promise<ActionResult> {
  try {
    await requireSalesAccess();
    const parsed = trPazarlamaSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }
    const supabase = await createClient();
    const { data: lastRow } = await supabase
      .from("tr_pazarlama")
      .select("kodu")
      .order("kodu", { ascending: false })
      .limit(1)
      .single();
    let nextNum = 1;
    if (lastRow) {
      const match = (lastRow as { kodu: string }).kodu.match(/TRP-(\d+)/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const kodu = `TRP-${String(nextNum).padStart(4, "0")}`;
    const { error } = await supabase.from("tr_pazarlama").insert({ kodu, ...parsed.data });
    if (error) return { success: false, error: error.message };
    revalidatePath("/satis/pazarlama");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updatePazarlama(
  id: string,
  formData: {
    yil: number;
    ay: number;
    pazaryeri: string;
    hedef_ciro: number;
    gercek_ciro: number;
    siparis_sayisi: number;
    ziyaretci: number;
    donusum_orani: number;
    iadeler: number;
    ortalama_sepet: number | null;
    reklam_harcamasi: number | null;
    not_text: string | null;
  },
): Promise<ActionResult> {
  try {
    await requireSalesAccess();
    const parsed = trPazarlamaSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }
    const supabase = await createClient();
    const { error } = await supabase.from("tr_pazarlama").update(parsed.data).eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/satis/pazarlama");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deletePazarlama(id: string): Promise<ActionResult> {
  try {
    await requireSalesAccess();
    const supabase = await createClient();
    const { error } = await supabase.from("tr_pazarlama").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidatePath("/satis/pazarlama");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
