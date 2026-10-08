"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";
import type { Json } from "@/lib/supabase/types";

const KEY = "kritik_stok_uyari";
const DEFAULT_SARI_ESIK = 50;

export async function getKritikStokUyari(): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
    const v = (data?.value as { sari_esik?: unknown } | null)?.sari_esik;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_SARI_ESIK;
  } catch {
    return DEFAULT_SARI_ESIK;
  }
}

export async function saveKritikStokUyari(
  sariEsik: number
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !STOCK_ACCESS_ROLES.includes(user.role)) {
      return { success: false, error: "Bu işlem için yetkiniz yok" };
    }
    if (!Number.isFinite(sariEsik) || sariEsik < 0 || sariEsik > 100000) {
      return { success: false, error: "Geçersiz değer" };
    }
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: KEY, value: { sari_esik: Math.round(sariEsik) } as unknown as Json }, { onConflict: "key" });
    if (error) return { success: false, error: error.message };
    revalidatePath("/stok/kritik-stok");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
