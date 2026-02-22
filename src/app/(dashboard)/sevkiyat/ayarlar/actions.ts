"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ShipmentCountry,
  PaletAyarlari,
  KonteynerTipi,
  AracTipi,
  MaliyetAyarlari,
  FirmaTipi,
  DurumEtiketi,
  KurAyarlari,
} from "@/lib/shipment-settings";
import type { Json } from "@/lib/supabase/types";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

function revalidateSevkiyat() {
  revalidatePath("/sevkiyat");
  revalidatePath("/sevkiyat/ayarlar");
  revalidatePath("/sevkiyat/yeni");
  revalidatePath("/sevkiyat/fiyatlar");
  revalidatePath("/sevkiyat/maliyetler");
  revalidatePath("/sevkiyat/kurlar");
  revalidatePath("/sevkiyat/sablonlar");
}

// ─── 1. Ülkeler ─────────────────────────────────────────────────

export async function updateSevkiyatUlkeler(countries: ShipmentCountry[]): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(countries) || countries.length === 0) {
      return { success: false, error: "En az bir ülke gereklidir" };
    }

    for (const c of countries) {
      if (!c.code || !c.name || !c.currency) {
        return { success: false, error: "Her ülke için kod, isim ve para birimi gereklidir" };
      }
    }

    const codes = countries.map((c) => c.code);
    if (new Set(codes).size !== codes.length) {
      return { success: false, error: "Ülke kodları benzersiz olmalıdır" };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "sevkiyat_ulkeler", value: countries as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidateSevkiyat();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── 2. Palet Ayarları ──────────────────────────────────────────

export async function updatePaletAyarlari(ayarlar: PaletAyarlari): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(ayarlar.boyutlar) || ayarlar.boyutlar.length === 0) {
      return { success: false, error: "En az bir palet boyutu gereklidir" };
    }

    if (typeof ayarlar.paletWeightKg !== "number" || ayarlar.paletWeightKg < 0) {
      return { success: false, error: "Palet ağırlığı geçerli bir sayı olmalıdır" };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "sevkiyat_palet_ayarlari", value: ayarlar as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidateSevkiyat();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── 3. Konteyner Tipleri ───────────────────────────────────────

export async function updateKonteynerTipleri(tipleri: KonteynerTipi[]): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(tipleri) || tipleri.length === 0) {
      return { success: false, error: "En az bir konteyner tipi gereklidir" };
    }

    for (const k of tipleri) {
      if (!k.type || !k.label) {
        return { success: false, error: "Her tip için tür ve etiket gereklidir" };
      }
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "sevkiyat_konteyner_tipleri", value: tipleri as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidateSevkiyat();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── 4. Araç Tipleri ────────────────────────────────────────────

export async function updateAracTipleri(tipleri: AracTipi[]): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(tipleri) || tipleri.length === 0) {
      return { success: false, error: "En az bir araç tipi gereklidir" };
    }

    for (const a of tipleri) {
      if (!a.id || !a.label) {
        return { success: false, error: "Her tip için ID ve etiket gereklidir" };
      }
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "sevkiyat_arac_tipleri", value: tipleri as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidateSevkiyat();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── 5. Maliyet Ayarları ────────────────────────────────────────

export async function updateMaliyetAyarlari(ayarlar: MaliyetAyarlari): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(ayarlar.paraBirimleri) || ayarlar.paraBirimleri.length === 0) {
      return { success: false, error: "En az bir para birimi gereklidir" };
    }

    if (!Array.isArray(ayarlar.fields) || ayarlar.fields.length === 0) {
      return { success: false, error: "En az bir maliyet alanı gereklidir" };
    }

    if (typeof ayarlar.desiCarpani !== "number" || ayarlar.desiCarpani <= 0) {
      return { success: false, error: "Desi çarpanı pozitif bir sayı olmalıdır" };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "sevkiyat_maliyet_ayarlari", value: ayarlar as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidateSevkiyat();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── 6. Firma Tipleri ───────────────────────────────────────────

export async function updateFirmaTipleri(tipleri: FirmaTipi[]): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(tipleri) || tipleri.length === 0) {
      return { success: false, error: "En az bir firma tipi gereklidir" };
    }

    for (const f of tipleri) {
      if (!f.id || !f.label) {
        return { success: false, error: "Her tip için ID ve etiket gereklidir" };
      }
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "sevkiyat_firma_tipleri", value: tipleri as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidateSevkiyat();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── 7. Durum Ayarları ──────────────────────────────────────────

export async function updateDurumAyarlari(etiketler: DurumEtiketi[]): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(etiketler) || etiketler.length === 0) {
      return { success: false, error: "En az bir durum gereklidir" };
    }

    for (const d of etiketler) {
      if (!d.id || !d.label) {
        return { success: false, error: "Her durum için ID ve etiket gereklidir" };
      }
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "sevkiyat_durum_ayarlari", value: etiketler as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidateSevkiyat();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── 8. Kur Ayarları ────────────────────────────────────────────

export async function updateKurAyarlari(ayarlar: KurAyarlari): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (!Array.isArray(ayarlar.currencies) || ayarlar.currencies.length === 0) {
      return { success: false, error: "En az bir para birimi gereklidir" };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "sevkiyat_kur_ayarlari", value: ayarlar as unknown as Json }, { onConflict: "key" });

    if (error) return { success: false, error: error.message };

    revalidateSevkiyat();
    revalidatePath("/sevkiyat/kurlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
