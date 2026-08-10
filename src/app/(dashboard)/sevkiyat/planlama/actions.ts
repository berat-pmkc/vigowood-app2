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

export interface PlanKalem {
  sku: string;
  urun_adi: string | null;
  koli: number;
  adet: number;
  boy: number;
  en: number;
  yuk: number;
  koli_agirlik: number;
}

/**
 * Planı sevkiyata dönüştürür.
 *
 * Kalemler koli bazında yazılır; palet planlaması yapılmadığı için
 * palet_sayisi 1, palette_koli toplam koli olarak kaydedilir — böylece
 * toplam koli ve adet doğru kalır. Palet dizilimi gerekiyorsa sevkiyat
 * detayından düzenlenebilir.
 */
export async function plandanSevkiyatOlustur(veri: {
  planId: string | null;
  country_code: string;
  sevkiyat_adi: string;
  konteyner_tipi: string;
  kalemler: PlanKalem[];
}): Promise<Sonuc & { sevkiyat_id?: string }> {
  try {
    await yetkiKontrol();
    const supabase = await createClient();

    if (veri.kalemler.length === 0) {
      return { success: false, error: "Planda kalem yok" };
    }

    // Ülkeye göre sıradaki sevkiyat numarası: DE21, USA30 gibi
    const { data: mevcut } = await supabase
      .from("sevkiyat")
      .select("shipment_number")
      .eq("country_code", veri.country_code)
      .order("shipment_number", { ascending: false })
      .limit(1);

    const sonNo = (mevcut?.[0] as { shipment_number: number | null } | undefined)?.shipment_number ?? 0;
    const yeniNo = sonNo + 1;
    const sevkiyatId = `${veri.country_code}${yeniNo}`;

    const ULKE: Record<string, string> = { DE: "Almanya", UK: "İngiltere", USA: "Amerika" };
    const { data: alici } = await supabase
      .from("sevkiyat_firmalar")
      .select("id, profil_adi")
      .eq("firma_tipi", "alici")
      .eq("country_code", veri.country_code)
      .eq("varsayilan", true)
      .maybeSingle();

    const { error: sevkError } = await supabase.from("sevkiyat").insert({
      sevkiyat_id: sevkiyatId,
      country_code: veri.country_code,
      shipment_number: yeniNo,
      sevkiyat_adi: veri.sevkiyat_adi,
      ulke: ULKE[veri.country_code] ?? veri.country_code,
      musteri: (alici as { profil_adi: string } | null)?.profil_adi ?? veri.country_code,
      alici_firma_id: (alici as { id: number } | null)?.id ?? null,
      konteyner_tipi: veri.konteyner_tipi,
      durum: "bekliyor",
      not_text: "Planlama ekranından oluşturuldu",
    });
    if (sevkError) return { success: false, error: sevkError.message };

    const kalemler = veri.kalemler.map((k, i) => ({
      item_id: `${sevkiyatId}-${String(i + 1).padStart(3, "0")}`,
      sevkiyat_id: sevkiyatId,
      sku: k.sku,
      urun_adi: k.urun_adi,
      qty: k.adet,
      en: k.en,
      boy: k.boy,
      yuk: k.yuk,
      koli_adedi: k.koli > 0 ? Math.round(k.adet / k.koli) : null,
      palette_koli: k.koli,
      palet_sayisi: 1,
      toplam_koli: k.koli,
      koli_agirlik: k.koli_agirlik,
      agirlik: Math.round(k.koli * k.koli_agirlik * 100) / 100,
      hacim: Math.round((k.koli * k.boy * k.en * k.yuk) / 1e6 * 1000) / 1000,
    }));

    const { error: kalemError } = await supabase.from("sevkiyat_items").insert(kalemler);
    if (kalemError) return { success: false, error: kalemError.message };

    if (veri.planId) {
      await supabase
        .from("yukleme_planlari")
        .update({ durum: "sevkiyata_donustu", sevkiyat_id: sevkiyatId })
        .eq("id", veri.planId);
    }

    revalidatePath("/sevkiyat");
    revalidatePath("/sevkiyat/planlama");
    return { success: true, sevkiyat_id: sevkiyatId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
