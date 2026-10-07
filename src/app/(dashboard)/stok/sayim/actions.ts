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

/** Bir satırın uygunsuz / fire miktarını yazar (yalnızca mamül ve yarı mamülde anlamlı). */
export async function satirKaliteGuncelle(
  satirId: string,
  alan: "uygunsuz_qty" | "fire_qty",
  miktar: number,
): Promise<Sonuc> {
  try {
    await yetkiKontrol();
    if (!Number.isFinite(miktar) || miktar < 0) {
      return { success: false, error: "Miktar 0 veya daha büyük olmalı" };
    }
    if (alan !== "uygunsuz_qty" && alan !== "fire_qty") {
      return { success: false, error: "Geçersiz alan" };
    }
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("stok_sayim_satirlari")
      .update({ [alan]: miktar })
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

export interface PencereSatiri {
  satir_id: string;
  kalem_id: string;
  pencere_miktar: number;
  canli_sistem: number;
}

/** Sayım başladığından beri kalemlere giren/çıkan hareketler (canlı) */
export async function sayimPencereGetir(
  sayimId: string,
): Promise<{ success: true; data: PencereSatiri[] } | { success: false; error: string }> {
  try {
    await yetkiKontrol();
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("stok_sayim_pencere", { p_sayim_id: sayimId });
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: ((data ?? []) as PencereSatiri[]).map((r) => ({
        ...r,
        pencere_miktar: Number(r.pencere_miktar),
        canli_sistem: Number(r.canli_sistem),
      })),
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Excel/CSV'den toplu miktar yükler. Eşleşmeyen kalemler rapor edilir. */
export async function topluMiktarYukle(
  sayimId: string,
  satirlar: { kalem_id: string; sayilan: number; uygunsuz?: number; fire?: number }[],
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
      const guncelle: Record<string, number> = { sayilan_miktar: s.sayilan };
      if (s.uygunsuz !== undefined && s.uygunsuz >= 0) guncelle.uygunsuz_qty = s.uygunsuz;
      if (s.fire !== undefined && s.fire >= 0) guncelle.fire_qty = s.fire;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("stok_sayim_satirlari")
        .update(guncelle)
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
): Promise<Sonuc & { guncellenen?: number; hareket?: number; uygunsuz?: number; fire?: number }> {
  try {
    const user = await yetkiKontrol();
    const supabase = await createClient();

    // Atomik tamamlama: sayım penceresi + düzeltme + uygunsuz/fire defteri tek işlemde
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("stok_sayim_tamamla", {
      p_sayim_id: sayimId,
      p_operator: user.user_id,
      p_operator_name: user.full_name ?? user.email ?? null,
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
      uygunsuz: (sonuc as { uygunsuz_kayit?: number })?.uygunsuz_kayit ?? 0,
      fire: (sonuc as { fire_kayit?: number })?.fire_kayit ?? 0,
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
