"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { SATIS_ACCESS_ROLES } from "@/lib/constants";
import { diaAyarOku, diaCagir, diaLogin, DiaHata } from "@/lib/dia/client";
import {
  diaSatisCek,
  diaSatisIsle,
  diaLogYaz,
  diaLogOku,
  diaAyarKaydet,
  getDiaSatisAyarlari,
  type DiaSatisAyarlari,
  type SyncKaydi,
} from "@/lib/dia/satis";

async function yetkiKontrol() {
  const user = await getCurrentUser();
  if (!user || !SATIS_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

function hataMetni(e: unknown) {
  if (e instanceof DiaHata) return e.message;
  return e instanceof Error ? e.message : "Bilinmeyen hata";
}

// ─── Bağlantı testi ─────────────────────────────────────────────

export interface BaglantiSonucu {
  baglandi: boolean;
  mesaj: string;
  firmalar?: { kod: unknown; ad: unknown; donemler?: unknown }[];
  kontor?: unknown;
}

/**
 * Yalnızca login atar ve yetkili firma/dönem listesini ister.
 * Kurulum sırasında firma_kodu / donem_kodu'nun doğru olduğunu
 * tahminle değil, DİA'nın kendi cevabıyla doğrulamak için.
 */
export async function diaBaglantiTest(): Promise<BaglantiSonucu> {
  try {
    await yetkiKontrol();
  } catch (e) {
    return { baglandi: false, mesaj: hataMetni(e) };
  }

  const ayar = diaAyarOku();
  if (!ayar) {
    return {
      baglandi: false,
      mesaj:
        "DİA ayarları eksik. Vercel ortam değişkenlerinde DIA_UYE_KODU, DIA_KULLANICI, DIA_SIFRE, DIA_FIRMA_KODU tanımlı olmalı.",
    };
  }

  try {
    await diaLogin(ayar, true);
  } catch (e) {
    return { baglandi: false, mesaj: hataMetni(e) };
  }

  const sonuc: BaglantiSonucu = {
    baglandi: true,
    mesaj: `Giriş başarılı (üye: ${ayar.uyeKodu}, firma: ${ayar.firmaKodu}, dönem: ${ayar.donemKodu || "öntanımlı"})`,
  };

  // Bilgilendirici; başarısız olsa da bağlantı testini bozmasın.
  try {
    sonuc.firmalar = await diaCagir(ayar, "sis", "sis_yetkili_firma_donem_listele", {});
  } catch {
    /* yetki yoksa atla */
  }
  try {
    sonuc.kontor = await diaCagir(ayar, "sis", "sis_kontor_sorgula", {});
  } catch {
    /* yetki yoksa atla */
  }

  return sonuc;
}

// ─── Alan keşfi ─────────────────────────────────────────────────

export interface OnizlemeSonucu {
  success: boolean;
  error?: string;
  hamKayitSayisi?: number;
  gecerliSatir?: number;
  ornekAnahtarlar?: string[];
  ornekKayit?: Record<string, unknown> | null;
  eslesmeyenAlanlar?: string[];
  ilkSatirlar?: unknown[];
}

/**
 * Veriyi ÇEKER ama YAZMAZ. Alan eşleştirmesinin doğru olduğunu
 * canlı veriyle görmeden otomatik işe geçmek riskli.
 */
export async function diaOnizle(
  baslangic: string,
  bitis: string,
): Promise<OnizlemeSonucu> {
  try {
    await yetkiKontrol();
    const c = await diaSatisCek(baslangic, bitis);
    return {
      success: true,
      hamKayitSayisi: c.hamKayitSayisi,
      gecerliSatir: c.satirlar.length,
      ornekAnahtarlar: c.ornekAnahtarlar,
      ornekKayit: c.ornekKayit,
      eslesmeyenAlanlar: c.eslesmeyenAlanlar,
      ilkSatirlar: c.satirlar.slice(0, 25),
    };
  } catch (e) {
    return { success: false, error: hataMetni(e) };
  }
}

// ─── Elle çekim ─────────────────────────────────────────────────

export async function diaElleCek(
  baslangic: string,
  bitis: string,
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    const user = await yetkiKontrol();
    const sonuc = await diaSatisIsle(baslangic, bitis, {
      kaynak: "elle",
      kullaniciAdi: `DİA — ${user.full_name}`,
    });

    await diaLogYaz({
      baslangic_tarihi: baslangic,
      bitis_tarihi: bitis,
      rapor_id: sonuc.raporId,
      cekilen: sonuc.cekilen,
      yazilan: sonuc.yazilan,
      atlanan: sonuc.atlanan,
      durum: sonuc.eslesmeyenAlanlar.length > 0 ? "uyari" : "basarili",
      mesaj: `Elle çekim — ${user.full_name}`,
    });

    revalidatePath("/satis");
    revalidatePath("/satis/raporlar");
    revalidatePath("/satis/dia");
    revalidatePath("/stok/mamul");

    return { success: true, data: sonuc };
  } catch (e) {
    return { success: false, error: hataMetni(e) };
  }
}

// ─── Ayarlar ────────────────────────────────────────────────────

export async function diaAyarlariOku(): Promise<DiaSatisAyarlari> {
  await yetkiKontrol();
  return getDiaSatisAyarlari();
}

export async function diaAyarlariKaydet(
  ayar: DiaSatisAyarlari,
): Promise<{ success: boolean; error?: string }> {
  try {
    await yetkiKontrol();
    const r = await diaAyarKaydet(ayar);
    if (!r.success) return r;
    revalidatePath("/satis/dia");
    return { success: true };
  } catch (e) {
    return { success: false, error: hataMetni(e) };
  }
}

// ─── Günlük ─────────────────────────────────────────────────────

export async function diaGunlukOku(limit = 30): Promise<SyncKaydi[]> {
  await yetkiKontrol();
  return diaLogOku(limit);
}
