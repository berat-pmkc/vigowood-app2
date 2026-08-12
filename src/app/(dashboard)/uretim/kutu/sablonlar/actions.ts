"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";
import { dieLineHesapla, type FefcoKodu } from "@/lib/kutu/fefco";

type Sonuc = { success: true } | { success: false; error: string };

async function yetkiKontrol() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

export interface SablonKaydi {
  sablon_id: string;
  ad: string;
  fefco_kodu: string;
  ic_uzunluk: number;
  ic_genislik: number;
  ic_yukseklik: number;
  hesaplanan_en: number | null;
  hesaplanan_boy: number | null;
  alan_m2: number | null;
  part_id: string | null;
  sku: string | null;
  oluk_tipi: string | null;
  notlar: string | null;
}

export async function sablonKaydet(veri: {
  ad: string;
  fefco_kodu: FefcoKodu;
  ic_uzunluk: number;
  ic_genislik: number;
  ic_yukseklik: number;
  part_id?: string | null;
  sku?: string | null;
  oluk_tipi?: string | null;
  notlar?: string | null;
}): Promise<Sonuc & { sablon_id?: string }> {
  try {
    const user = await yetkiKontrol();

    if (!veri.ad.trim()) return { success: false, error: "Şablon adı gerekli" };

    // Levha ölçüsü sunucuda yeniden hesaplanıyor; istemciden gelen
    // değere güvenilmiyor
    const die = dieLineHesapla(veri.fefco_kodu, {
      uzunluk: veri.ic_uzunluk,
      genislik: veri.ic_genislik,
      yukseklik: veri.ic_yukseklik,
    });
    if (!die) return { success: false, error: "Ölçüler sıfırdan büyük olmalı" };

    const supabase = await createClient();
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const sablonId = `KS-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;

    const { error } = await supabase.from("kutu_sablonlari").insert({
      sablon_id: sablonId,
      ad: veri.ad.trim(),
      fefco_kodu: veri.fefco_kodu,
      ic_uzunluk: veri.ic_uzunluk,
      ic_genislik: veri.ic_genislik,
      ic_yukseklik: veri.ic_yukseklik,
      hesaplanan_en: die.en,
      hesaplanan_boy: die.boy,
      alan_m2: Number(die.alanM2.toFixed(4)),
      part_id: veri.part_id || null,
      sku: veri.sku || null,
      oluk_tipi: veri.oluk_tipi || null,
      notlar: veri.notlar || null,
      olusturan: user.user_id,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/kutu/sablonlar");
    return { success: true, sablon_id: sablonId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function sablonSil(sablonId: string): Promise<Sonuc> {
  try {
    await yetkiKontrol();
    const supabase = await createClient();

    // RLS engellerse PostgREST hata döndürmez, sessizce 0 satır siler
    const { data, error } = await supabase
      .from("kutu_sablonlari")
      .delete()
      .eq("sablon_id", sablonId)
      .select("sablon_id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Şablon silinemedi (yetki veya kayıt bulunamadı)" };
    }
    revalidatePath("/uretim/kutu/sablonlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
