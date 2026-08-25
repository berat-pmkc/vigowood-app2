"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sevkiyatCreateSchema, sevkiyatItemSchema } from "@/lib/validations";
import { SEVKIYAT_ACCESS_ROLES, SEVKIYAT_STATUS, type SevkiyatStatus } from "@/lib/constants";
import { getShipmentSettings, getCountryByCode } from "@/lib/shipment-settings";

type ActionResult = { success: true } | { success: false; error: string };

async function requireSevkiyatAccess() {
  const user = await getCurrentUser();
  if (!user || !SEVKIYAT_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── HELPER: Lojistik hesaplamalar ────────────────────────────

function calculateLogistics(input: {
  palet_boyut: string;
  palet_yukseklik: number;
  koli_adedi: number;
  palette_koli: number;
  koli_agirlik: number;
  palet_sayisi: number;
  desiCarpani?: number;
}) {
  const toplam_koli = input.palette_koli * input.palet_sayisi;
  const qty = input.koli_adedi * toplam_koli;
  const agirlik = input.koli_agirlik * toplam_koli;

  // Palet boyutu parse: "80x120" → en=80, boy=120 (cm)
  const [paletEn, paletBoy] = input.palet_boyut.split("x").map(Number);
  const hacim = ((paletEn || 80) * (paletBoy || 120) * input.palet_yukseklik * input.palet_sayisi) / 1_000_000;
  const desi = hacim * (input.desiCarpani ?? 333.33);

  return { toplam_koli, qty, agirlik, hacim: Math.round(hacim * 1000) / 1000, desi: Math.round(desi * 100) / 100 };
}

// ─── READ ACTIONS ───────────────────────────────────────────────

/** Aktif ürünleri getir (sevkiyat ürün ekleme için) */
export async function getActiveProducts() {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select("sku, urun_adi, kategori, stok_aktif")
      .eq("aktif_mi", true)
      .order("urun_adi");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Sevkiyat kalemlerini getir */
export async function getSevkiyatItems(sevkiyatId: string) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sevkiyat_items")
      .select("*")
      .eq("sevkiyat_id", sevkiyatId)
      .order("created_at");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: (data ?? []) as SevkiyatItemRow[] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export interface SevkiyatItemRow {
  item_id: string;
  sevkiyat_id: string;
  sku: string;
  urun_adi: string | null;
  qty: number;
  palet_boyut: string | null;
  palet_yukseklik: number | null;
  en: number | null;
  boy: number | null;
  yuk: number | null;
  koli_adedi: number | null;
  palette_koli: number | null;
  toplam_koli: number | null;
  hacim: number | null;
  desi: number | null;
  koli_agirlik: number | null;
  agirlik: number | null;
  grup: string | null;
  palet_sayisi: number | null;
  birim_fiyat: number | null;
  toplam_fiyat: number | null;
  created_at: string;
}

/** Ülke bazlı fiyat listesi */
export async function getFiyatlarForCountry(countryCode: string) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sevkiyat_fiyatlar")
      .select("sku, urun_adi_en, gtip, birim_fiyat, kategori")
      .eq("country_code", countryCode)
      .order("sku");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Palet şablonlarını getir (SKU bazlı, tüm palet boyutları) */
export async function getPaletSablonlar(sku: string) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sevkiyat_palet_sablon")
      .select("*")
      .eq("sku", sku)
      .order("palet_boyut");

    if (error || !data || data.length === 0) return { success: true as const, data: [] };
    return {
      success: true as const,
      data: data as {
        palet_boyut: string;
        palet_yukseklik: number;
        en: number;
        boy: number;
        yuk: number;
        koli_adedi: number;
        palette_koli: number;
        koli_agirlik: number;
      }[],
    };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Sevkiyat + items + şablon bilgileriyle birlikte getir (planlama sayfası) */
export async function getSevkiyatWithItems(sevkiyatId: string) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data: sevkData, error: sevkErr } = await supabase
      .from("sevkiyat")
      .select("*")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    if (sevkErr || !sevkData) return { success: false as const, error: "Sevkiyat bulunamadı" };

    const { data: items, error: itemsErr } = await supabase
      .from("sevkiyat_items")
      .select("*")
      .eq("sevkiyat_id", sevkiyatId)
      .order("created_at");

    if (itemsErr) return { success: false as const, error: itemsErr.message };

    return {
      success: true as const,
      data: {
        sevkiyat: sevkData as SevkiyatRow,
        items: (items ?? []) as SevkiyatItemRow[],
      },
    };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export interface SevkiyatRow {
  sevkiyat_id: string;
  musteri: string;
  ulke: string | null;
  sevk_tarihi: string | null;
  konteyner_no: string | null;
  konteyner_tipi: string | null;
  durum: string;
  not_text: string | null;
  operator_id: string | null;
  operator_name: string | null;
  email: string | null;
  hazirlama_zamani: string | null;
  gonderim_zamani: string | null;
  teslim_zamani: string | null;
  country_code: string | null;
  shipment_number: number | null;
  sevkiyat_adi: string | null;
  liman: string | null;
  teslimat_tipi: string | null;
  arac_tipi: string | null;
  tir_plaka: string | null;
  dorse_plaka: string | null;
  tasiyici_firma: string | null;
  planlanan_sevk_tarihi: string | null;
  gerceklesen_sevk_tarihi: string | null;
  ihracatci_firma_id: number | null;
  alici_firma_id: number | null;
  banka_firma_id: number | null;
  created_at: string;
  updated_at: string;
}

/** Proforma için — fiyat bilgileri dahil */
export async function getProformaData(sevkiyatId: string) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data: sevkData } = await supabase
      .from("sevkiyat")
      .select("*")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    const sev = sevkData as SevkiyatRow | null;
    if (!sev) return { success: false as const, error: "Sevkiyat bulunamadı" };

    const { data: items } = await supabase
      .from("sevkiyat_items")
      .select("*")
      .eq("sevkiyat_id", sevkiyatId)
      .order("created_at");

    const itemRows = (items ?? []) as SevkiyatItemRow[];

    // Fiyat bilgilerini getir
    let fiyatlar: Record<string, { urun_adi_en: string; gtip: string; birim_fiyat: number }> = {};
    if (sev.country_code) {
      const { data: fData } = await supabase
        .from("sevkiyat_fiyatlar")
        .select("sku, urun_adi_en, gtip, birim_fiyat")
        .eq("country_code", sev.country_code);

      if (fData) {
        for (const row of fData as { sku: string; urun_adi_en: string | null; gtip: string | null; birim_fiyat: number }[]) {
          fiyatlar[row.sku] = {
            urun_adi_en: row.urun_adi_en ?? row.sku,
            gtip: row.gtip ?? "",
            birim_fiyat: row.birim_fiyat,
          };
        }
      }
    }

    return { success: true as const, data: { sevkiyat: sev, items: itemRows, fiyatlar } };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Packing list için — brüt ağırlık hesabı dahil */
export async function getPackingListData(sevkiyatId: string) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data: sevkData } = await supabase
      .from("sevkiyat")
      .select("*")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    const sev = sevkData as SevkiyatRow | null;
    if (!sev) return { success: false as const, error: "Sevkiyat bulunamadı" };

    const { data: items } = await supabase
      .from("sevkiyat_items")
      .select("*")
      .eq("sevkiyat_id", sevkiyatId)
      .order("created_at");

    const itemRows = (items ?? []) as SevkiyatItemRow[];

    // İngilizce ürün isimlerini getir
    let productNames: Record<string, string> = {};
    if (sev.country_code) {
      const { data: fData } = await supabase
        .from("sevkiyat_fiyatlar")
        .select("sku, urun_adi_en")
        .eq("country_code", sev.country_code);

      if (fData) {
        for (const row of fData as { sku: string; urun_adi_en: string | null }[]) {
          if (row.urun_adi_en) productNames[row.sku] = row.urun_adi_en;
        }
      }
    }

    return { success: true as const, data: { sevkiyat: sev, items: itemRows, productNames } };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Inline palet sayısı güncelleme (spreadsheet edit) */
export async function updateItemPaletSayisi(
  itemId: string,
  paletSayisi: number
): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    if (paletSayisi < 1) return { success: false, error: "Palet sayısı en az 1 olmalıdır" };

    const { data: itemData } = await supabase
      .from("sevkiyat_items")
      .select("sevkiyat_id, palet_boyut, palet_yukseklik, koli_adedi, palette_koli, koli_agirlik, birim_fiyat")
      .eq("item_id", itemId)
      .single();

    const item = itemData as {
      sevkiyat_id: string;
      palet_boyut: string | null;
      palet_yukseklik: number | null;
      koli_adedi: number | null;
      palette_koli: number | null;
      koli_agirlik: number | null;
      birim_fiyat: number | null;
    } | null;
    if (!item) return { success: false, error: "Kalem bulunamadı" };

    // Sevkiyat durum kontrolü
    const { data: sevkData } = await supabase
      .from("sevkiyat")
      .select("durum")
      .eq("sevkiyat_id", item.sevkiyat_id)
      .single();

    const sev = sevkData as { durum: string } | null;
    if (!sev) return { success: false, error: "Sevkiyat bulunamadı" };
    if (sev.durum !== "bekliyor" && sev.durum !== "hazirlaniyor") {
      return { success: false, error: "Bu durumda düzenlenemez" };
    }

    const calc = calculateLogistics({
      palet_boyut: item.palet_boyut ?? "80x120",
      palet_yukseklik: item.palet_yukseklik ?? 100,
      koli_adedi: item.koli_adedi ?? 1,
      palette_koli: item.palette_koli ?? 1,
      koli_agirlik: item.koli_agirlik ?? 0,
      palet_sayisi: paletSayisi,
    });

    const birimFiyat = item.birim_fiyat ?? 0;
    const toplamFiyat = calc.qty * birimFiyat;

    const { error } = await supabase
      .from("sevkiyat_items")
      .update({
        palet_sayisi: paletSayisi,
        toplam_koli: calc.toplam_koli,
        qty: calc.qty,
        agirlik: calc.agirlik,
        hacim: calc.hacim,
        desi: calc.desi,
        toplam_fiyat: Math.round(toplamFiyat * 100) / 100,
      })
      .eq("item_id", itemId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Inline grup güncelleme */
export async function updateItemGrup(
  itemId: string,
  grup: string | null
): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data: itemData } = await supabase
      .from("sevkiyat_items")
      .select("sevkiyat_id")
      .eq("item_id", itemId)
      .single();

    const item = itemData as { sevkiyat_id: string } | null;
    if (!item) return { success: false, error: "Kalem bulunamadı" };

    const { data: sevkData } = await supabase
      .from("sevkiyat")
      .select("durum")
      .eq("sevkiyat_id", item.sevkiyat_id)
      .single();

    const sev = sevkData as { durum: string } | null;
    if (!sev) return { success: false, error: "Sevkiyat bulunamadı" };
    if (sev.durum !== "bekliyor" && sev.durum !== "hazirlaniyor") {
      return { success: false, error: "Bu durumda düzenlenemez" };
    }

    const { error } = await supabase
      .from("sevkiyat_items")
      .update({ grup: grup || null })
      .eq("item_id", itemId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── MUTATION ACTIONS ───────────────────────────────────────────

/** Yeni sevkiyat oluştur */
export async function createSevkiyat(formData: {
  country_code: string;
  arac_tipi?: string;
  konteyner_no: string | null;
  konteyner_tipi: string | null;
  tir_plaka?: string | null;
  dorse_plaka?: string | null;
  planlanan_sevk_tarihi?: string | null;
  tasiyici_firma?: string | null;
  not_text: string | null;
}): Promise<ActionResult & { sevkiyatId?: string }> {
  try {
    const user = await requireSevkiyatAccess();

    const parsed = sevkiyatCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const settings = await getShipmentSettings();
    const countryCode = parsed.data.country_code;
    const country = getCountryByCode(countryCode, settings.ulkeler);
    if (!country) return { success: false, error: "Geçersiz ülke kodu" };

    // Operatör bilgisi
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = authUser?.user_metadata?.selected_operator_id ?? user.user_id;
    const operatorName = authUser?.user_metadata?.selected_operator_name ?? user.full_name;
    const email = authUser?.email ?? user.email;

    // Son shipment_number bul (ülke bazlı)
    const { data: lastSevkiyat } = await supabase
      .from("sevkiyat")
      .select("shipment_number")
      .eq("country_code", countryCode)
      .order("shipment_number", { ascending: false })
      .limit(1);

    const lastNum = (lastSevkiyat && lastSevkiyat.length > 0)
      ? (lastSevkiyat[0] as { shipment_number: number | null }).shipment_number ?? 0
      : 0;
    const newNum = lastNum + 1;

    // sevkiyat_id: ülke kodu + sıra no (DE21, UK29)
    const sevkiyatId = `${countryCode}${newNum}`;
    const sevkiyatAdi = `${country.name} ${newNum}`;

    const aracTipi = parsed.data.arac_tipi ?? "konteyner";

    const { error } = await supabase.from("sevkiyat").insert({
      sevkiyat_id: sevkiyatId,
      musteri: country.buyer,
      ulke: country.nameEN,
      country_code: countryCode,
      shipment_number: newNum,
      sevkiyat_adi: sevkiyatAdi,
      liman: country.port,
      teslimat_tipi: "DAP",
      arac_tipi: aracTipi,
      sevk_tarihi: parsed.data.planlanan_sevk_tarihi || null,
      planlanan_sevk_tarihi: parsed.data.planlanan_sevk_tarihi || null,
      konteyner_no: aracTipi === "konteyner" ? (parsed.data.konteyner_no || null) : null,
      konteyner_tipi: aracTipi === "konteyner" ? (parsed.data.konteyner_tipi || null) : null,
      tir_plaka: aracTipi === "tir" ? (parsed.data.tir_plaka || null) : null,
      dorse_plaka: aracTipi === "tir" ? (parsed.data.dorse_plaka || null) : null,
      tasiyici_firma: parsed.data.tasiyici_firma || null,
      not_text: parsed.data.not_text || null,
      durum: "bekliyor",
      operator_id: operatorId,
      operator_name: operatorName,
      email: email,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true, sevkiyatId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Yeni sevkiyat + items birlikte oluştur (birleşik akış) */
export async function createSevkiyatWithItems(
  headerData: {
    country_code: string;
    arac_tipi?: string;
    konteyner_no: string | null;
    konteyner_tipi: string | null;
    tir_plaka?: string | null;
    dorse_plaka?: string | null;
    planlanan_sevk_tarihi?: string | null;
    tasiyici_firma?: string | null;
    not_text: string | null;
  },
  itemsData: {
    sku: string;
    palet_boyut: string;
    palet_yukseklik: number;
    en: number;
    boy: number;
    yuk: number;
    koli_adedi: number;
    palette_koli: number;
    koli_agirlik: number;
    palet_sayisi: number;
    grup: string | null;
  }[]
): Promise<ActionResult & { sevkiyatId?: string }> {
  try {
    const user = await requireSevkiyatAccess();

    const parsed = sevkiyatCreateSchema.safeParse(headerData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const settings = await getShipmentSettings();
    const countryCode = parsed.data.country_code;
    const country = getCountryByCode(countryCode, settings.ulkeler);
    if (!country) return { success: false, error: "Geçersiz ülke kodu" };

    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = authUser?.user_metadata?.selected_operator_id ?? user.user_id;
    const operatorName = authUser?.user_metadata?.selected_operator_name ?? user.full_name;
    const email = authUser?.email ?? user.email;

    const { data: lastSevkiyat } = await supabase
      .from("sevkiyat")
      .select("shipment_number")
      .eq("country_code", countryCode)
      .order("shipment_number", { ascending: false })
      .limit(1);

    const lastNum = (lastSevkiyat && lastSevkiyat.length > 0)
      ? (lastSevkiyat[0] as { shipment_number: number | null }).shipment_number ?? 0
      : 0;
    const newNum = lastNum + 1;

    const sevkiyatId = `${countryCode}${newNum}`;
    const sevkiyatAdi = `${country.name} ${newNum}`;
    const aracTipi = parsed.data.arac_tipi ?? "konteyner";

    // 1. Header oluştur
    const { error: headerError } = await supabase.from("sevkiyat").insert({
      sevkiyat_id: sevkiyatId,
      musteri: country.buyer,
      ulke: country.nameEN,
      country_code: countryCode,
      shipment_number: newNum,
      sevkiyat_adi: sevkiyatAdi,
      liman: country.port,
      teslimat_tipi: "DAP",
      arac_tipi: aracTipi,
      sevk_tarihi: parsed.data.planlanan_sevk_tarihi || null,
      planlanan_sevk_tarihi: parsed.data.planlanan_sevk_tarihi || null,
      konteyner_no: aracTipi === "konteyner" ? (parsed.data.konteyner_no || null) : null,
      konteyner_tipi: aracTipi === "konteyner" ? (parsed.data.konteyner_tipi || null) : null,
      tir_plaka: aracTipi === "tir" ? (parsed.data.tir_plaka || null) : null,
      dorse_plaka: aracTipi === "tir" ? (parsed.data.dorse_plaka || null) : null,
      tasiyici_firma: parsed.data.tasiyici_firma || null,
      not_text: parsed.data.not_text || null,
      durum: "bekliyor",
      operator_id: operatorId,
      operator_name: operatorName,
      email: email,
    });

    if (headerError) return { success: false, error: headerError.message };

    // 2. Items batch insert
    if (itemsData.length > 0) {
      // Fiyat bilgilerini toplu çek
      const { data: fiyatData } = await supabase
        .from("sevkiyat_fiyatlar")
        .select("sku, birim_fiyat")
        .eq("country_code", countryCode);
      const fiyatMap = new Map<string, number>();
      if (fiyatData) {
        for (const f of fiyatData as { sku: string; birim_fiyat: number }[]) {
          fiyatMap.set(f.sku, f.birim_fiyat);
        }
      }

      // Ürün isimleri toplu çek
      const skus = [...new Set(itemsData.map((i) => i.sku))];
      const { data: productData } = await supabase
        .from("products")
        .select("sku, urun_adi")
        .in("sku", skus);
      const nameMap = new Map<string, string>();
      if (productData) {
        for (const p of productData as { sku: string; urun_adi: string | null }[]) {
          if (p.urun_adi) nameMap.set(p.sku, p.urun_adi);
        }
      }

      for (const item of itemsData) {
        const itemParsed = sevkiyatItemSchema.safeParse(item);
        if (!itemParsed.success) continue;

        const birimFiyat = fiyatMap.get(item.sku) ?? 0;
        const calc = calculateLogistics({
          palet_boyut: item.palet_boyut,
          palet_yukseklik: item.palet_yukseklik,
          koli_adedi: item.koli_adedi,
          palette_koli: item.palette_koli,
          koli_agirlik: item.koli_agirlik,
          palet_sayisi: item.palet_sayisi,
        });
        const toplamFiyat = calc.qty * birimFiyat;

        const { data: idResult } = await supabase.rpc("next_sevkiyat_item_id");
        const itemId = (idResult as string) ?? `SVI-${Date.now()}`;

        await supabase.from("sevkiyat_items").insert({
          item_id: itemId,
          sevkiyat_id: sevkiyatId,
          sku: item.sku,
          urun_adi: nameMap.get(item.sku) || null,
          qty: calc.qty,
          palet_boyut: item.palet_boyut,
          palet_yukseklik: item.palet_yukseklik,
          en: item.en,
          boy: item.boy,
          yuk: item.yuk,
          koli_adedi: item.koli_adedi,
          palette_koli: item.palette_koli,
          toplam_koli: calc.toplam_koli,
          hacim: calc.hacim,
          desi: calc.desi,
          koli_agirlik: item.koli_agirlik,
          agirlik: calc.agirlik,
          grup: item.grup || null,
          palet_sayisi: item.palet_sayisi,
          birim_fiyat: birimFiyat,
          toplam_fiyat: Math.round(toplamFiyat * 100) / 100,
        });
      }
    }

    revalidatePath("/sevkiyat");
    return { success: true, sevkiyatId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Hazırlamayı başlat: bekliyor → hazirlaniyor */
export async function startPreparation(sevkiyatId: string): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("sevkiyat")
      .select("durum")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    const row = data as { durum: string } | null;
    if (!row) return { success: false, error: "Sevkiyat bulunamadı" };
    if (row.durum !== "bekliyor") return { success: false, error: "Sadece 'Bekliyor' durumundaki sevkiyat hazırlanabilir" };

    const { error } = await supabase
      .from("sevkiyat")
      .update({
        durum: "hazirlaniyor",
        hazirlama_zamani: new Date().toISOString(),
      })
      .eq("sevkiyat_id", sevkiyatId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Sevkiyatı gönder: hazirlaniyor → yolda */
export async function shipSevkiyat(sevkiyatId: string): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("sevkiyat")
      .select("sevkiyat_id, durum")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    const row = data as { sevkiyat_id: string; durum: string } | null;
    if (!row) return { success: false, error: "Sevkiyat bulunamadı" };
    if (row.durum !== "hazirlaniyor") return { success: false, error: "Sadece 'Hazırlanıyor' durumundaki sevkiyat gönderilebilir" };

    const { data: items } = await supabase
      .from("sevkiyat_items")
      .select("item_id")
      .eq("sevkiyat_id", sevkiyatId)
      .limit(1);

    if (!items || items.length === 0) return { success: false, error: "Sevkiyatta ürün bulunmuyor" };

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("sevkiyat")
      .update({ durum: "yolda", gonderim_zamani: now, gerceklesen_sevk_tarihi: now.split("T")[0] })
      .eq("sevkiyat_id", sevkiyatId);

    if (updateError) return { success: false, error: updateError.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Teslim et: yolda → teslim_edildi */
export async function deliverSevkiyat(sevkiyatId: string): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("sevkiyat")
      .select("durum")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    const row = data as { durum: string } | null;
    if (!row) return { success: false, error: "Sevkiyat bulunamadı" };
    if (row.durum !== "yolda") return { success: false, error: "Sadece 'Yolda' durumundaki sevkiyat teslim edilebilir" };

    const { error } = await supabase
      .from("sevkiyat")
      .update({ durum: "teslim_edildi", teslim_zamani: new Date().toISOString() })
      .eq("sevkiyat_id", sevkiyatId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Bir adım geri al */
export async function cancelSevkiyat(sevkiyatId: string): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("sevkiyat")
      .select("durum")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    const row = data as { durum: string } | null;
    if (!row) return { success: false, error: "Sevkiyat bulunamadı" };

    let newDurum: string;
    const updates: Record<string, unknown> = {};

    switch (row.durum) {
      case "hazirlaniyor":
        newDurum = "bekliyor";
        updates.hazirlama_zamani = null;
        break;
      case "yolda":
        newDurum = "hazirlaniyor";
        updates.gonderim_zamani = null;
        break;
      case "teslim_edildi":
        newDurum = "yolda";
        updates.teslim_zamani = null;
        break;
      default:
        return { success: false, error: "Bu durumdaki sevkiyat geri alınamaz" };
    }

    updates.durum = newDurum;

    const { error } = await supabase
      .from("sevkiyat")
      .update(updates)
      .eq("sevkiyat_id", sevkiyatId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Sevkiyatı iptal et (terminal state) */
export async function voidSevkiyat(sevkiyatId: string): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("sevkiyat")
      .select("durum")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    const row = data as { durum: string } | null;
    if (!row) return { success: false, error: "Sevkiyat bulunamadı" };

    if (row.durum === "teslim_edildi" || row.durum === "iptal_edildi") {
      return { success: false, error: "Bu durumdaki sevkiyat iptal edilemez" };
    }

    const { error } = await supabase
      .from("sevkiyat")
      .update({ durum: "iptal_edildi" })
      .eq("sevkiyat_id", sevkiyatId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Gerçekleşen sevk tarihini güncelle */
export async function updateGerceklesenTarih(
  sevkiyatId: string,
  tarih: string
): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    if (!tarih || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
      return { success: false, error: "Geçersiz tarih formatı" };
    }

    const { error } = await supabase
      .from("sevkiyat")
      .update({ gerceklesen_sevk_tarihi: tarih })
      .eq("sevkiyat_id", sevkiyatId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── ITEM ACTIONS ───────────────────────────────────────────────

/** Sevkiyata ürün ekle (v2 — lojistik bilgiler) */
export async function addSevkiyatItem(
  sevkiyatId: string,
  formData: {
    sku: string;
    palet_boyut: string;
    palet_yukseklik: number;
    en: number;
    boy: number;
    yuk: number;
    koli_adedi: number;
    palette_koli: number;
    koli_agirlik: number;
    palet_sayisi: number;
    grup: string | null;
  }
): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();

    const parsed = sevkiyatItemSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Sevkiyat durumu kontrolü
    const { data: sevkData } = await supabase
      .from("sevkiyat")
      .select("durum, country_code")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    const sev = sevkData as { durum: string; country_code: string | null } | null;
    if (!sev) return { success: false, error: "Sevkiyat bulunamadı" };
    if (sev.durum !== "bekliyor" && sev.durum !== "hazirlaniyor") {
      return { success: false, error: "Bu durumda ürün eklenemez" };
    }

    // Ürün adını cache'le
    const { data: productData } = await supabase
      .from("products")
      .select("urun_adi")
      .eq("sku", parsed.data.sku)
      .single();
    const product = productData as { urun_adi: string | null } | null;

    // Fiyat bilgisini çek
    let birimFiyat = 0;
    if (sev.country_code) {
      const { data: fiyatData } = await supabase
        .from("sevkiyat_fiyatlar")
        .select("birim_fiyat")
        .eq("country_code", sev.country_code)
        .eq("sku", parsed.data.sku)
        .single();
      if (fiyatData) birimFiyat = (fiyatData as { birim_fiyat: number }).birim_fiyat;
    }

    // Lojistik hesaplamalar
    const calc = calculateLogistics({
      palet_boyut: parsed.data.palet_boyut,
      palet_yukseklik: parsed.data.palet_yukseklik,
      koli_adedi: parsed.data.koli_adedi,
      palette_koli: parsed.data.palette_koli,
      koli_agirlik: parsed.data.koli_agirlik,
      palet_sayisi: parsed.data.palet_sayisi,
    });

    const toplamFiyat = calc.qty * birimFiyat;

    // Auto-ID (atomic sequence — race condition fix)
    const { data: idResult } = await supabase.rpc("next_sevkiyat_item_id");
    const itemId = (idResult as string) ?? `SVI-${Date.now()}`;

    const { error } = await supabase.from("sevkiyat_items").insert({
      item_id: itemId,
      sevkiyat_id: sevkiyatId,
      sku: parsed.data.sku,
      urun_adi: product?.urun_adi || null,
      qty: calc.qty,
      palet_boyut: parsed.data.palet_boyut,
      palet_yukseklik: parsed.data.palet_yukseklik,
      en: parsed.data.en,
      boy: parsed.data.boy,
      yuk: parsed.data.yuk,
      koli_adedi: parsed.data.koli_adedi,
      palette_koli: parsed.data.palette_koli,
      toplam_koli: calc.toplam_koli,
      hacim: calc.hacim,
      desi: calc.desi,
      koli_agirlik: parsed.data.koli_agirlik,
      agirlik: calc.agirlik,
      grup: parsed.data.grup || null,
      palet_sayisi: parsed.data.palet_sayisi,
      birim_fiyat: birimFiyat,
      toplam_fiyat: Math.round(toplamFiyat * 100) / 100,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Sevkiyat kalemi güncelle (v2 — tüm lojistik alanlar) */
export async function updateSevkiyatItem(
  itemId: string,
  formData: {
    palet_boyut: string;
    palet_yukseklik: number;
    en: number;
    boy: number;
    yuk: number;
    koli_adedi: number;
    palette_koli: number;
    koli_agirlik: number;
    palet_sayisi: number;
    grup: string | null;
  }
): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    // Sevkiyat durumu kontrolü
    const { data: itemData } = await supabase
      .from("sevkiyat_items")
      .select("sevkiyat_id, birim_fiyat")
      .eq("item_id", itemId)
      .single();

    const item = itemData as { sevkiyat_id: string; birim_fiyat: number | null } | null;
    if (!item) return { success: false, error: "Kalem bulunamad\u0131" };

    const { data: sevkData } = await supabase
      .from("sevkiyat")
      .select("durum")
      .eq("sevkiyat_id", item.sevkiyat_id)
      .single();

    const sev = sevkData as { durum: string } | null;
    if (!sev) return { success: false, error: "Sevkiyat bulunamad\u0131" };
    if (sev.durum !== "bekliyor" && sev.durum !== "hazirlaniyor") {
      return { success: false, error: "Bu durumda kalem d\u00fczenlenemez" };
    }

    const calc = calculateLogistics({
      palet_boyut: formData.palet_boyut,
      palet_yukseklik: formData.palet_yukseklik,
      koli_adedi: formData.koli_adedi,
      palette_koli: formData.palette_koli,
      koli_agirlik: formData.koli_agirlik,
      palet_sayisi: formData.palet_sayisi,
    });

    const birimFiyat = item.birim_fiyat ?? 0;
    const toplamFiyat = calc.qty * birimFiyat;

    const { error } = await supabase
      .from("sevkiyat_items")
      .update({
        palet_boyut: formData.palet_boyut,
        palet_yukseklik: formData.palet_yukseklik,
        en: formData.en,
        boy: formData.boy,
        yuk: formData.yuk,
        koli_adedi: formData.koli_adedi,
        palette_koli: formData.palette_koli,
        toplam_koli: calc.toplam_koli,
        hacim: calc.hacim,
        desi: calc.desi,
        koli_agirlik: formData.koli_agirlik,
        agirlik: calc.agirlik,
        qty: calc.qty,
        grup: formData.grup || null,
        palet_sayisi: formData.palet_sayisi,
        toplam_fiyat: Math.round(toplamFiyat * 100) / 100,
      })
      .eq("item_id", itemId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Sevkiyat kalemini sil */
export async function deleteSevkiyatItem(itemId: string): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data: itemData } = await supabase
      .from("sevkiyat_items")
      .select("sevkiyat_id")
      .eq("item_id", itemId)
      .single();

    const item = itemData as { sevkiyat_id: string } | null;
    if (!item) return { success: false, error: "Kalem bulunamadı" };

    const { data: sevkData } = await supabase
      .from("sevkiyat")
      .select("durum")
      .eq("sevkiyat_id", item.sevkiyat_id)
      .single();

    const sev = sevkData as { durum: string } | null;
    if (!sev) return { success: false, error: "Sevkiyat bulunamadı" };
    if (sev.durum !== "bekliyor" && sev.durum !== "hazirlaniyor") {
      return { success: false, error: "Bu durumda kalem silinemez" };
    }

    const { error } = await supabase
      .from("sevkiyat_items")
      .delete()
      .eq("item_id", itemId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── MALİYET ACTIONS ─────────────────────────────────────────────

export interface SevkiyatMaliyetRow {
  id: number;
  sevkiyat_id: string;
  navlun: number;
  navlun_currency: string;
  ic_nakliye: number;
  ic_nakliye_currency: string;
  ara_depo: number;
  ara_depo_currency: string;
  amazon_pickup: number;
  amazon_pickup_currency: string;
  ydg: number;
  ydg_currency: string;
  tr_gumruk: number;
  tr_gumruk_currency: string;
  diger: number;
  diger_currency: string;
  not_text: string | null;
}

/** Sevkiyat maliyetlerini getir */
export async function getSevkiyatMaliyet(sevkiyatId: string) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sevkiyat_maliyetler")
      .select("*")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    if (error || !data) return { success: true as const, data: null };
    return { success: true as const, data: data as SevkiyatMaliyetRow };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Sevkiyat maliyetini oluştur veya güncelle */
export async function upsertSevkiyatMaliyet(
  sevkiyatId: string,
  formData: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    // Sadece izin verilen maliyet alanlarını geçir (arbitrary data injection engelle)
    const allowedKeys = [
      "navlun", "navlun_currency", "ic_nakliye", "ic_nakliye_currency",
      "ara_depo", "ara_depo_currency", "amazon_pickup", "amazon_pickup_currency",
      "ydg", "ydg_currency", "tr_gumruk", "tr_gumruk_currency",
      "diger", "diger_currency", "not_text",
    ];
    const safeData: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in formData) safeData[key] = formData[key];
    }

    const { data: existing } = await supabase
      .from("sevkiyat_maliyetler")
      .select("id")
      .eq("sevkiyat_id", sevkiyatId)
      .maybeSingle();

    const payload = { sevkiyat_id: sevkiyatId, ...safeData };

    if (existing) {
      const { error } = await supabase
        .from("sevkiyat_maliyetler")
        .update(payload)
        .eq("sevkiyat_id", sevkiyatId);
      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase
        .from("sevkiyat_maliyetler")
        .insert(payload);
      if (error) return { success: false, error: error.message };
    }

    revalidatePath("/sevkiyat");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── DÖVİZ KURU ACTIONS ─────────────────────────────────────────

export interface DovizKuruRow {
  id: number;
  tarih: string;
  usd_try: number | null;
  eur_try: number | null;
  gbp_try: number | null;
  pln_try: number | null;
  sek_try: number | null;
  eur_usd: number | null;
  gbp_usd: number | null;
  gbp_eur: number | null;
  kaynak: string;
  created_at: string;
}

/** En son döviz kurunu getir */
export async function getLatestKur() {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("doviz_kurlari")
      .select("*")
      .order("tarih", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { success: true as const, data: null };
    return { success: true as const, data: data as DovizKuruRow };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Son N günün kurlarını getir */
export async function getKurHistory(days: number = 30) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from("doviz_kurlari")
      .select("*")
      .gte("tarih", since.toISOString().split("T")[0])
      .order("tarih", { ascending: false });

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: (data ?? []) as DovizKuruRow[] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Frankfurter API'den güncel kurları çek ve kaydet */
export async function fetchKurFromApi(): Promise<ActionResult & { data?: DovizKuruRow }> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    // Frankfurter API — 1 TRY → USD, EUR, GBP, PLN, SEK
    const res = await fetch("https://api.frankfurter.app/latest?from=TRY&to=USD,EUR,GBP,PLN,SEK", {
      next: { revalidate: 3600 }, // 1 saat cache
    });

    if (!res.ok) return { success: false, error: `API hatası: ${res.status}` };

    const json = await res.json() as {
      date: string;
      rates: { USD: number; EUR: number; GBP: number; PLN: number; SEK: number };
    };

    // Ters çevir: 1 USD = ? TRY
    const usd_try = Math.round((1 / json.rates.USD) * 10000) / 10000;
    const eur_try = Math.round((1 / json.rates.EUR) * 10000) / 10000;
    const gbp_try = Math.round((1 / json.rates.GBP) * 10000) / 10000;
    const pln_try = Math.round((1 / json.rates.PLN) * 10000) / 10000;
    const sek_try = Math.round((1 / json.rates.SEK) * 10000) / 10000;

    // Çapraz kurlar
    const eur_usd = Math.round((eur_try / usd_try) * 10000) / 10000;
    const gbp_usd = Math.round((gbp_try / usd_try) * 10000) / 10000;
    const gbp_eur = Math.round((gbp_try / eur_try) * 10000) / 10000;

    const { data, error } = await supabase.from("doviz_kurlari").upsert(
      {
        tarih: json.date,
        usd_try,
        eur_try,
        gbp_try,
        pln_try,
        sek_try,
        eur_usd,
        gbp_usd,
        gbp_eur,
        kaynak: "frankfurter",
      },
      { onConflict: "tarih" }
    ).select().single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat/kurlar");
    return { success: true, data: data as DovizKuruRow };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "API bağlantı hatası" };
  }
}

/** Yeni döviz kuru ekle/güncelle (manuel) */
export async function createKur(formData: {
  tarih: string;
  usd_try: number;
  eur_try: number;
  gbp_try: number;
  pln_try?: number;
  sek_try?: number;
}): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    // Çapraz kurları hesapla
    const eur_usd = formData.usd_try > 0 ? Math.round((formData.eur_try / formData.usd_try) * 10000) / 10000 : 0;
    const gbp_usd = formData.usd_try > 0 ? Math.round((formData.gbp_try / formData.usd_try) * 10000) / 10000 : 0;
    const gbp_eur = formData.eur_try > 0 ? Math.round((formData.gbp_try / formData.eur_try) * 10000) / 10000 : 0;

    const { error } = await supabase.from("doviz_kurlari").upsert(
      {
        tarih: formData.tarih,
        usd_try: formData.usd_try,
        eur_try: formData.eur_try,
        gbp_try: formData.gbp_try,
        pln_try: formData.pln_try ?? null,
        sek_try: formData.sek_try ?? null,
        eur_usd,
        gbp_usd,
        gbp_eur,
        kaynak: "manual",
      },
      { onConflict: "tarih" }
    );

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat/kurlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── FİRMA ACTIONS ───────────────────────────────────────────────

export interface SevkiyatFirmaRow {
  id: number;
  firma_tipi: string;
  country_code: string | null;
  profil_adi: string;
  firma_adi: string | null;
  adres_satir1: string | null;
  adres_satir2: string | null;
  telefon: string | null;
  email: string | null;
  web: string | null;
  vergi_no: string | null;
  vat_no: string | null;
  banka_adi: string | null;
  sube_adi: string | null;
  swift_code: string | null;
  iban: string | null;
  para_birimi: string | null;
  sevk_yontemi: string | null;
  yetkili_adi: string | null;
  imza_yeri: string | null;
  aktif: boolean;
  varsayilan: boolean;
}

/** Tüm firma profillerini getir */
export async function getFirmalar(firmaTipi?: string) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    let query = supabase
      .from("sevkiyat_firmalar")
      .select("*")
      .order("firma_tipi")
      .order("profil_adi");

    if (firmaTipi) {
      query = query.eq("firma_tipi", firmaTipi);
    }

    const { data, error } = await query;
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: (data ?? []) as SevkiyatFirmaRow[] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Varsayılan firmayı getir (tip + ülke) */
export async function getDefaultFirma(firmaTipi: string, countryCode?: string) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    let query = supabase
      .from("sevkiyat_firmalar")
      .select("*")
      .eq("firma_tipi", firmaTipi)
      .eq("aktif", true)
      .eq("varsayilan", true);

    if (countryCode) {
      query = query.eq("country_code", countryCode);
    } else {
      query = query.is("country_code", null);
    }

    const { data } = await query.limit(1).single();
    if (!data) return { success: true as const, data: null };
    return { success: true as const, data: data as SevkiyatFirmaRow };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/**
 * Sevkiyat durumunu doğrudan ayarlar.
 *
 * startPreparation / shipSevkiyat / deliverSevkiyat akışı tek yönlüdür ve
 * normal kullanımda tercih edilmelidir. Bu fonksiyon veri düzeltmek için
 * vardır: yanlış işaretlenmiş ya da dışarıdan aktarılmış kayıtları doğru
 * duruma çekmeyi sağlar. Zaman damgaları yeni duruma göre tutarlı hale
 * getirilir — ileri alınan adımların damgası doldurulur, geri alınanlarınki
 * temizlenir.
 */
export async function setSevkiyatDurum(
  sevkiyatId: string,
  durum: string
): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();

    if (!SEVKIYAT_STATUS.includes(durum as SevkiyatStatus)) {
      return { success: false, error: "Geçersiz durum" };
    }

    const supabase = await createClient();

    const { data } = await supabase
      .from("sevkiyat")
      .select("durum, hazirlama_zamani, gonderim_zamani, teslim_zamani, gerceklesen_sevk_tarihi")
      .eq("sevkiyat_id", sevkiyatId)
      .single();

    const row = data as {
      durum: string;
      hazirlama_zamani: string | null;
      gonderim_zamani: string | null;
      teslim_zamani: string | null;
      gerceklesen_sevk_tarihi: string | null;
    } | null;

    if (!row) return { success: false, error: "Sevkiyat bulunamadı" };
    if (row.durum === durum) return { success: true };

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { durum };

    // İptal durumunda geçmiş damgalara dokunma — kayıt olduğu gibi dursun
    if (durum !== "iptal_edildi") {
      const hazirlandi = durum === "hazirlaniyor" || durum === "yolda" || durum === "teslim_edildi";
      const gonderildi = durum === "yolda" || durum === "teslim_edildi";
      const teslimEdildi = durum === "teslim_edildi";

      updates.hazirlama_zamani = hazirlandi ? (row.hazirlama_zamani ?? now) : null;
      updates.gonderim_zamani = gonderildi ? (row.gonderim_zamani ?? now) : null;
      updates.teslim_zamani = teslimEdildi ? (row.teslim_zamani ?? now) : null;

      // Sevk tarihi gönderimle birlikte oluşur, geri alınırsa temizlenir
      if (gonderildi) {
        updates.gerceklesen_sevk_tarihi =
          row.gerceklesen_sevk_tarihi ?? (updates.gonderim_zamani as string).split("T")[0];
      } else {
        updates.gerceklesen_sevk_tarihi = null;
      }
    }

    const { error } = await supabase
      .from("sevkiyat")
      .update(updates)
      .eq("sevkiyat_id", sevkiyatId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    revalidatePath(`/sevkiyat/${sevkiyatId}`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/**
 * Sevkiyatı tamamen siler.
 *
 * İptal etmekten farkı: iptal kaydı bırakır, listede durmaya devam eder.
 * Silme kaydı ortadan kaldırır — yanlışlıkla açılmış sevkiyatlar için.
 *
 * İş veritabanı fonksiyonunda (sevkiyat_sil): sevkiyat tablosunda DELETE
 * yetkisi yalnızca yöneticide, sevkiyat sorumlusu silemiyordu. Tabloya
 * geniş yetki açmak yerine yetkiyi içinde kontrol eden fonksiyon
 * kullanılıyor. Kalemler ve maliyetler FK CASCADE ile, yükleme planı
 * SET NULL ile otomatik hallediliyor.
 */
export async function deleteSevkiyat(sevkiyatId: string): Promise<ActionResult> {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { error } = await supabase.rpc("sevkiyat_sil", {
      p_sevkiyat_id: sevkiyatId,
    });
    if (error) return { success: false, error: error.message };

    revalidatePath("/sevkiyat");
    revalidatePath("/uretim/kesim/ihtiyac");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── SEVKİYAT KOPYALAMA ─────────────────────────────────────────
// Excel'de son sevkiyatı kopyalayıp ürün/adet değiştirme alışkanlığının
// sistem içi karşılığı. Yeni sevkiyat formunda "önceki sevkiyattan kopyala".

export interface KopyaSevkiyat {
  sevkiyatId: string;
  ad: string;
  ulke: string;
  countryCode: string;
  durum: string;
  tarih: string | null;
  kalemSayisi: number;
}

/** Kopyalanabilir sevkiyatları listeler. Aynı ülke önce gelir. */
export async function getKopyalanabilirSevkiyatlar(
  countryCode?: string,
): Promise<KopyaSevkiyat[]> {
  await requireSevkiyatAccess();
  const supabase = await createClient();

  const { data } = await supabase
    .from("sevkiyat")
    .select("sevkiyat_id, sevkiyat_adi, ulke, country_code, durum, planlanan_sevk_tarihi, sevk_tarihi, created_at")
    .order("created_at", { ascending: false })
    .limit(60);

  const sevkiyatlar = (data ?? []) as {
    sevkiyat_id: string; sevkiyat_adi: string | null; ulke: string | null;
    country_code: string | null; durum: string | null;
    planlanan_sevk_tarihi: string | null; sevk_tarihi: string | null; created_at: string;
  }[];
  if (sevkiyatlar.length === 0) return [];

  // Kalem sayıları
  const ids = sevkiyatlar.map((s) => s.sevkiyat_id);
  const sayim = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data: kalemler } = await supabase
      .from("sevkiyat_items")
      .select("sevkiyat_id")
      .in("sevkiyat_id", ids.slice(i, i + 100));
    for (const k of kalemler ?? []) sayim.set(k.sevkiyat_id, (sayim.get(k.sevkiyat_id) ?? 0) + 1);
  }

  const liste: KopyaSevkiyat[] = sevkiyatlar
    .map((s) => ({
      sevkiyatId: s.sevkiyat_id,
      ad: s.sevkiyat_adi ?? s.sevkiyat_id,
      ulke: s.ulke ?? "",
      countryCode: s.country_code ?? "",
      durum: s.durum ?? "",
      tarih: s.sevk_tarihi ?? s.planlanan_sevk_tarihi,
      kalemSayisi: sayim.get(s.sevkiyat_id) ?? 0,
    }))
    // İçi boş sevkiyatı kopyalamanın anlamı yok
    .filter((s) => s.kalemSayisi > 0);

  // Aynı ülke başa
  if (countryCode) {
    liste.sort((a, b) => {
      const au = a.countryCode === countryCode ? 0 : 1;
      const bu = b.countryCode === countryCode ? 0 : 1;
      return au - bu;
    });
  }
  return liste;
}

export interface KopyaKalem {
  sku: string;
  urun_adi: string;
  palet_boyut: string;
  palet_yukseklik: number;
  en: number;
  boy: number;
  yuk: number;
  koli_adedi: number;
  palette_koli: number;
  koli_agirlik: number;
  palet_sayisi: number;
  grup: string | null;
}

/** Bir sevkiyatın kalemlerini yeni forma yüklenmeye hazır döndürür. */
export async function getSevkiyatKalemleriKopya(sevkiyatId: string): Promise<KopyaKalem[]> {
  await requireSevkiyatAccess();
  const supabase = await createClient();
  const { data } = await supabase
    .from("sevkiyat_items")
    .select("sku, urun_adi, palet_boyut, palet_yukseklik, en, boy, yuk, koli_adedi, palette_koli, koli_agirlik, palet_sayisi, grup")
    .eq("sevkiyat_id", sevkiyatId)
    .order("created_at");

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    sku: String(r.sku ?? ""),
    urun_adi: r.urun_adi ? String(r.urun_adi) : String(r.sku ?? ""),
    palet_boyut: r.palet_boyut ? String(r.palet_boyut) : "80x120",
    palet_yukseklik: Number(r.palet_yukseklik ?? 0),
    en: Number(r.en ?? 0),
    boy: Number(r.boy ?? 0),
    yuk: Number(r.yuk ?? 0),
    koli_adedi: Number(r.koli_adedi ?? 0),
    palette_koli: Number(r.palette_koli ?? 0),
    koli_agirlik: Number(r.koli_agirlik ?? 0),
    palet_sayisi: Number(r.palet_sayisi ?? 1),
    grup: r.grup ? String(r.grup) : null,
  }));
}
