"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSalesSettings, type SalesChannel, type BasariEsikleri } from "@/lib/sales-settings";
import type { PeriodType } from "../actions";
import type { Json } from "@/lib/supabase/types";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── Read ─────────────────────────────────────────────────────────

export async function getSatisAyarlari() {
  return getSalesSettings();
}

// ─── Update: Satış Kanalları ──────────────────────────────────────

export async function updateSatisKanallari(channels: SalesChannel[]): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(channels) || channels.length === 0) {
      return { success: false, error: "En az bir kanal gereklidir" };
    }

    // Validate each channel
    for (const ch of channels) {
      if (!ch.id || !ch.label) {
        return { success: false, error: "Her kanal için ID ve etiket gereklidir" };
      }
    }

    // Check for duplicate IDs
    const ids = channels.map((c) => c.id);
    if (new Set(ids).size !== ids.length) {
      return { success: false, error: "Kanal ID'leri benzersiz olmalıdır" };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "satis_kanallari", value: channels as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidatePath("/satis");
    revalidatePath("/satis/ayarlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── Update: Hizmet SKU'ları ──────────────────────────────────────

export async function updateHizmetSkulari(skus: string[]): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(skus)) {
      return { success: false, error: "Geçersiz veri" };
    }

    const cleaned = skus.map((s) => s.trim().toUpperCase()).filter(Boolean);

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "hizmet_skulari", value: cleaned as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidatePath("/satis");
    revalidatePath("/satis/ayarlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── Update: Pazaryeri Seçenekleri ────────────────────────────────

export async function updatePazaryeriSecenekleri(options: string[]): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(options)) {
      return { success: false, error: "Geçersiz veri" };
    }

    const cleaned = options.map((s) => s.trim()).filter(Boolean);

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "pazaryeri_secenekleri", value: cleaned as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidatePath("/satis/pazarlama");
    revalidatePath("/satis/ayarlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── Update: Başarı Eşikleri ──────────────────────────────────────

export async function updateBasariEsikleri(esikler: BasariEsikleri): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (typeof esikler.warning !== "number" || typeof esikler.success !== "number") {
      return { success: false, error: "Eşikler sayısal olmalıdır" };
    }

    if (esikler.warning < 0 || esikler.warning > 200) {
      return { success: false, error: "Uyarı eşiği 0-200 arasında olmalıdır" };
    }

    if (esikler.success < 0 || esikler.success > 200) {
      return { success: false, error: "Başarı eşiği 0-200 arasında olmalıdır" };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "satis_basari_esikleri", value: esikler as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidatePath("/satis/pazarlama");
    revalidatePath("/satis/ayarlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── Update: Varsayılan Dönem ─────────────────────────────────────

export async function updateVarsayilanDonem(donem: PeriodType): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!["today", "week", "month", "all"].includes(donem)) {
      return { success: false, error: "Geçersiz dönem" };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "satis_varsayilan_donem", value: donem as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidatePath("/satis");
    revalidatePath("/satis/ayarlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
