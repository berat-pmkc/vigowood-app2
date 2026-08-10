"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { SEVKIYAT_ACCESS_ROLES } from "@/lib/constants";

type Sonuc = { success: true } | { success: false; error: string };

async function yetkiKontrol() {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

export interface PlanlamaUrun {
  sku: string;
  urun_adi: string | null;
  kategori: string | null;
  boy: number | null;
  en: number | null;
  yuk: number | null;
  koli_adedi: number | null;
  koli_agirlik: number | null;
}

/** Planlamaya girebilecek ürünler — ölçüsü olmayanlar da gelir, ekranda işaretlenir */
export async function getPlanlamaUrunleri(): Promise<PlanlamaUrun[]> {
  await yetkiKontrol();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("sku, urun_adi, kategori, kutu_boy_cm, kutu_en_cm, kutu_yukseklik_cm, koli_adedi, kutu_agirlik_kg")
    .eq("aktif_mi", true)
    .order("kategori")
    .order("sku");

  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    sku: p.sku as string,
    urun_adi: (p.urun_adi as string) ?? null,
    kategori: (p.kategori as string) ?? null,
    boy: p.kutu_boy_cm as number | null,
    en: p.kutu_en_cm as number | null,
    yuk: p.kutu_yukseklik_cm as number | null,
    koli_adedi: p.koli_adedi as number | null,
    koli_agirlik: p.kutu_agirlik_kg as number | null,
  }));
}

/**
 * Ürünün koli ölçülerini kaydeder.
 *
 * Planlama ekranından doğrudan girilebilmesi için — ölçüsü olmayan ya da
 * yeni çıkan bir ürün, ayrı bir ekrana gitmeden simülasyona dahil edilebilsin.
 */
export async function urunOlcuKaydet(
  sku: string,
  olcu: { boy: number; en: number; yuk: number; koli_adedi: number; koli_agirlik: number | null },
): Promise<Sonuc> {
  try {
    await yetkiKontrol();

    if (![olcu.boy, olcu.en, olcu.yuk].every((v) => Number.isFinite(v) && v > 0)) {
      return { success: false, error: "Boy, en ve yükseklik sıfırdan büyük olmalı" };
    }
    if (!Number.isFinite(olcu.koli_adedi) || olcu.koli_adedi < 1) {
      return { success: false, error: "Koli içi adet en az 1 olmalı" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .update({
        kutu_boy_cm: olcu.boy,
        kutu_en_cm: olcu.en,
        kutu_yukseklik_cm: olcu.yuk,
        koli_adedi: Math.trunc(olcu.koli_adedi),
        kutu_agirlik_kg: olcu.koli_agirlik,
        updated_at: new Date().toISOString(),
      })
      .eq("sku", sku)
      .select("sku");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Ölçü kaydedilemedi — yetkiniz olmayabilir" };
    }

    revalidatePath("/sevkiyat/planlama");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function planKaydet(veri: {
  ad: string;
  konteyner_tipi: string;
  ic_uzunluk: number;
  ic_genislik: number;
  ic_yukseklik: number;
  girdi: Record<string, unknown>;
  sonuc: Record<string, unknown>;
  doluluk_yuzde: number;
  toplam_koli: number;
  toplam_hacim: number;
  toplam_agirlik: number;
  kullanilan_boy: number;
}): Promise<Sonuc & { id?: string }> {
  try {
    const user = await yetkiKontrol();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("yukleme_planlari")
      .insert({
        ...veri,
        girdi: veri.girdi as never,
        sonuc: veri.sonuc as never,
        olusturan: user.user_id,
      })
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Plan kaydedilemedi" };
    }

    revalidatePath("/sevkiyat/planlama");
    return { success: true, id: (data[0] as { id: string }).id };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
