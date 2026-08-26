"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { urunMaliyetleriHesapla, getMaliyetAyarlari, type UrunMaliyet } from "@/lib/maliyet";
import { MALIYET_ROLES, type MaliyetVerisi } from "./constants";

async function yetki() {
  const user = await getCurrentUser();
  if (!user || !MALIYET_ROLES.includes(user.role)) throw new Error("Bu ekranı görme yetkiniz yok");
  return user;
}

/** Aktif ürünlerin birim maliyetleri + ayarlar. */
export async function getMaliyetVerisi(): Promise<MaliyetVerisi> {
  await yetki();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("sku")
    .eq("aktif_mi", true);
  const skular = (data ?? []).map((p) => p.sku);
  const harita = await urunMaliyetleriHesapla(skular);
  const ayar = await getMaliyetAyarlari();
  const urunler = [...harita.values()].sort((a, b) => b.birimMaliyet - a.birimMaliyet);
  return { urunler, ayar };
}

/** Tek ürün detay (breakdown) — gerekirse ayrı çağrı için. */
export async function getUrunMaliyetDetay(sku: string): Promise<UrunMaliyet | null> {
  await yetki();
  const harita = await urunMaliyetleriHesapla([sku]);
  return harita.get(sku) ?? null;
}

export async function maliyetAyarKaydet(
  montaj: number, paketleme: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await yetki();
    const supabase = await createClient();
    const { error } = await supabase.from("app_settings").upsert(
      { key: "maliyet_ayarlari", value: { montaj_saat_ucreti: montaj, paketleme_saat_ucreti: paketleme, guncelleme: new Date().toISOString() } },
      { onConflict: "key" },
    );
    if (error) return { success: false, error: error.message };
    revalidatePath("/maliyet");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Hata" };
  }
}

/** HP/malzeme fiyatı güncelle (admin). */
export async function malzemeFiyatKaydet(
  partId: string, fiyat: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await yetki();
    const supabase = await createClient();
    const { error } = await supabase.from("all_parts").update({ birim_fiyat: fiyat }).eq("part_id", partId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/maliyet");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Hata" };
  }
}
