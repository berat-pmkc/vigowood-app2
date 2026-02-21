"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { appSettingSchema } from "@/lib/validations";
import { KRITIK_STOK_DEFAULT_GUN, KRITIK_STOK_DEFAULT_LOOKBACK_DAYS } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── Ayarları Oku ───────────────────────────────────────────────

export interface AppSettings {
  kritik_stok_gun: number;
  kritik_stok_lookback_days: number;
  kritik_stok_last_calculated: string | null;
  kritik_stok_last_summary: KritikStokSummary | null;
}

export interface KritikStokSummary {
  total_products: number;
  updated_products: number;
  products_with_sales: number;
  products_without_sales: number;
  total_parts: number;
  updated_parts: number;
  duration_ms: number;
  calculated_at: string;
  calculated_by: string;
}

export async function getSettings(): Promise<AppSettings> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "kritik_stok_gun",
      "kritik_stok_lookback_days",
      "kritik_stok_last_calculated",
      "kritik_stok_last_summary",
    ]);

  const settingsMap = new Map<string, unknown>();
  for (const row of data ?? []) {
    settingsMap.set(row.key, row.value);
  }

  return {
    kritik_stok_gun: Number(settingsMap.get("kritik_stok_gun")) || KRITIK_STOK_DEFAULT_GUN,
    kritik_stok_lookback_days:
      Number(settingsMap.get("kritik_stok_lookback_days")) || KRITIK_STOK_DEFAULT_LOOKBACK_DAYS,
    kritik_stok_last_calculated: settingsMap.get("kritik_stok_last_calculated") as string | null,
    kritik_stok_last_summary: settingsMap.get("kritik_stok_last_summary") as KritikStokSummary | null,
  };
}

// ─── Ayarları Güncelle ──────────────────────────────────────────

export async function updateSettings(
  formData: { kritik_stok_gun: number; kritik_stok_lookback_days: number }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = appSettingSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = createAdminClient();

    // Update her iki ayarı
    const { error: e1 } = await supabase
      .from("app_settings")
      .update({ value: parsed.data.kritik_stok_gun })
      .eq("key", "kritik_stok_gun");

    if (e1) return { success: false, error: e1.message };

    const { error: e2 } = await supabase
      .from("app_settings")
      .update({ value: parsed.data.kritik_stok_lookback_days })
      .eq("key", "kritik_stok_lookback_days");

    if (e2) return { success: false, error: e2.message };

    revalidatePath("/admin/ayarlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

