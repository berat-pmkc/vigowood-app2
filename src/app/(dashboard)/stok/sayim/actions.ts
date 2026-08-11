"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";

type Sonuc = { success: true } | { success: false; error: string };

async function yetkiKontrol() {
  const user = await getCurrentUser();
  if (!user || !STOCK_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

export const KAPSAM_SECENEKLERI = [
  { deger: "YARIMAMUL", etiket: "Yarı mamül (kesilmiş parçalar)" },
  { deger: "HAZIR", etiket: "Hazır eleman (menteşe, vida, mıknatıs)" },
  { deger: "KUTU", etiket: "Kutu" },
  { deger: "KARTON", etiket: "Karton" },
  { deger: "MAMUL", etiket: "Mamül (bitmiş ürün)" },
] as const;

/** Yeni sayım açar ve kapsamdaki kalemleri satır olarak üretir */
export async function sayimOlustur(veri: {
  ad: string;
  sayim_tarihi: string;
  kapsam: string[];
  notlar?: string;
}): Promise<Sonuc & { sayim_id?: string }> {
  try {
    const user = await yetkiKontrol();
    if (veri.kapsam.length === 0) {
      return { success: false, error: "En az bir kapsam seçmelisiniz" };
    }
    const supabase = await createClient();

    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const sayimId = `SYM-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;

    const { error: insErr } = await supabase.from("stok_sayimlari").insert({
      sayim_id: sayimId,
      ad: veri.ad,
      sayim_tarihi: veri.sayim_tarihi,
      kapsam: veri.kapsam,
      notlar: veri.notlar || null,
      olusturan: user.user_id,
    });
    if (insErr) return { success: false, error: insErr.message };

    // Satırları ve o anki sistem miktarını dondur
    const { error: rpcErr } = await supabase.rpc("stok_sayimi_satirlari_olustur", {
      p_sayim_id: sayimId,
    });
    if (rpcErr) {
      await supabase.from("stok_sayimlari").delete().eq("sayim_id", sayimId);
      return { success: false, error: `Satırlar oluşturulamadı: ${rpcErr.message}` };
    }

    revalidatePath("/stok/sayim");
    return { success: true, sayim_id: sayimId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Tek bir satırın sayılan miktarını yazar. null = sayılmadı işaretine geri döner. */
export async function satirGuncelle(
  satirId: string,
  sayilan: number | null,
  not?: string | null,
): Promise<Sonuc> {
  try {
    await yetkiKontrol();
    const supabase = await createClient();

    // RLS engellerse PostgREST hata DÖNDÜRMEZ, sessizce 0 satır günceller.
    // Bu yüzden .select() ile gerçekten yazıldığı doğrulanıyor.
    const { data, error } = await supabase
      .from("stok_sayim_satirlari")
      .update({ sayilan_miktar: sayilan, not_text: not ?? null })
      .eq("id", satirId)
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Satır güncellenemedi (yetki veya kayıt bulunamadı)" };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Excel/CSV'den toplu miktar yükler. Eşleşmeyen kalemler rapor edilir. */
export async function topluMiktarYukle(
  sayimId: string,
  satirlar: { kalem_id: string; sayilan: number }[],
): Promise<Sonuc & { guncellenen?: number; eslesmeyen?: string[] }> {
  try {
    await yetkiKontrol();
    const supabase = await createClient();

    const { data: mevcut, error: selErr } = await supabase
      .from("stok_sayim_satirlari")
      .select("id, kalem_id")
      .eq("sayim_id", sayimId);
    if (selErr) return { success: false, error: selErr.message };

    const harita = new Map((mevcut ?? []).map((s) => [s.kalem_id, s.id]));
    const eslesmeyen: string[] = [];
    let guncellenen = 0;

    // Tek tek güncelleniyor: upsert kullanılsa sistem_miktar sıfırlanır
    for (const s of satirlar) {
      const id = harita.get(s.kalem_id);
      if (!id) {
        eslesmeyen.push(s.kalem_id);
        continue;
      }
      const { data, error } = await supabase
        .from("stok_sayim_satirlari")
        .update({ sayilan_miktar: s.sayilan })
        .eq("id", id)
        .select("id");
      if (error) return { success: false, error: error.message };
      if (data && data.length > 0) guncellenen++;
    }

    revalidatePath(`/stok/sayim/${sayimId}`);
    return { success: true, guncellenen, eslesmeyen };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Sayımı uygular: farkları hareket olarak yazar, bakiyeleri sabitler */
export async function sayimUygula(
  sayimId: string,
): Promise<Sonuc & { guncellenen?: number; hareket?: number }> {
  try {
    const user = await yetkiKontrol();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("stok_sayimi_uygula", {
      p_sayim_id: sayimId,
      p_operator: user.email ?? user.user_id,
    });
    if (error) return { success: false, error: error.message };

    const sonuc = Array.isArray(data) ? data[0] : data;
    revalidatePath("/stok/sayim");
    revalidatePath(`/stok/sayim/${sayimId}`);
    revalidatePath("/stok/yari-mamul");
    revalidatePath("/stok/hazir-eleman");
    revalidatePath("/stok/mamul");
    return {
      success: true,
      guncellenen: (sonuc as { guncellenen?: number })?.guncellenen ?? 0,
      hareket: (sonuc as { hareket?: number })?.hareket ?? 0,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Taslak sayımı iptal eder (kayıt kalır, izlenebilirlik için silinmez) */
export async function sayimIptal(sayimId: string): Promise<Sonuc> {
  try {
    await yetkiKontrol();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("stok_sayimlari")
      .update({ durum: "iptal" })
      .eq("sayim_id", sayimId)
      .eq("durum", "taslak")
      .select("sayim_id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Yalnızca taslak sayımlar iptal edilebilir" };
    }
    revalidatePath("/stok/sayim");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
