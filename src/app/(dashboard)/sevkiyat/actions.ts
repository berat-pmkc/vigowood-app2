"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sevkiyatCreateSchema, sevkiyatItemSchema } from "@/lib/validations";
import { SEVKIYAT_ACCESS_ROLES, SEVKIYAT_COUNTRIES, type SevkiyatCountryCode } from "@/lib/constants";

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
}) {
  const toplam_koli = input.palette_koli * input.palet_sayisi;
  const qty = input.koli_adedi * toplam_koli;
  const agirlik = input.koli_agirlik * toplam_koli;

  // Palet boyutu parse: "80x120" → en=80, boy=120 (cm)
  const [paletEn, paletBoy] = input.palet_boyut.split("x").map(Number);
  const hacim = ((paletEn || 80) * (paletBoy || 120) * input.palet_yukseklik * input.palet_sayisi) / 1_000_000;
  const desi = hacim * 333.33;

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

/** Palet şablonu getir (ülke + sku) */
export async function getPaletSablon(countryCode: string, sku: string) {
  try {
    await requireSevkiyatAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("sevkiyat_palet_sablon")
      .select("*")
      .eq("country_code", countryCode)
      .eq("sku", sku)
      .single();

    if (error || !data) return { success: true as const, data: null };
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
      },
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

/** Yeni sevkiyat oluştur (v2 — ülke bazlı ID) */
export async function createSevkiyat(formData: {
  country_code: string;
  sevk_tarihi: string | null;
  konteyner_no: string | null;
  konteyner_tipi: string | null;
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
    const countryCode = parsed.data.country_code as SevkiyatCountryCode;
    const country = SEVKIYAT_COUNTRIES[countryCode];

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

    const { error } = await supabase.from("sevkiyat").insert({
      sevkiyat_id: sevkiyatId,
      musteri: country.buyer,
      ulke: country.nameEN,
      country_code: countryCode,
      shipment_number: newNum,
      sevkiyat_adi: sevkiyatAdi,
      liman: country.port,
      teslimat_tipi: "DAP",
      sevk_tarihi: parsed.data.sevk_tarihi || null,
      konteyner_no: parsed.data.konteyner_no || null,
      konteyner_tipi: parsed.data.konteyner_tipi || null,
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

/** Sevkiyatı gönder: hazirlaniyor → yolda + STOK DÜŞÜMÜ */
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
      .select("item_id, sku, qty")
      .eq("sevkiyat_id", sevkiyatId);

    const itemRows = (items ?? []) as { item_id: string; sku: string; qty: number }[];
    if (itemRows.length === 0) return { success: false, error: "Sevkiyatta ürün bulunmuyor" };

    // Idempotency
    const { data: existingMov } = await supabase
      .from("stock_movements")
      .select("id")
      .eq("source_row_id", sevkiyatId)
      .eq("source", "Sevkiyat")
      .limit(1);

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("sevkiyat")
      .update({ durum: "yolda", gonderim_zamani: now })
      .eq("sevkiyat_id", sevkiyatId);

    if (updateError) return { success: false, error: updateError.message };

    if (!existingMov || existingMov.length === 0) {
      for (const item of itemRows) {
        const { error: movError } = await supabase.from("stock_movements").insert({
          tarih: now,
          sku: item.sku,
          qty: -item.qty,
          source: "Sevkiyat",
          source_row_id: sevkiyatId,
          batch_id: sevkiyatId,
        });
        if (movError) return { success: false, error: `Stok hareketi hatası: ${movError.message}` };

        const { data: productData } = await supabase
          .from("products")
          .select("sku, stok_aktif")
          .eq("sku", item.sku)
          .single();

        const product = productData as { sku: string; stok_aktif: number } | null;
        if (product) {
          const newStok = Math.max(0, (product.stok_aktif || 0) - item.qty);
          await supabase.from("products").update({ stok_aktif: newStok }).eq("sku", item.sku);
        }
      }
    }

    revalidatePath("/sevkiyat");
    revalidatePath("/stok/mamul");
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

/** İptal (bir adım geri): yolda→hazirlaniyor ise stok iadesi */
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

    // yolda → hazirlaniyor: stok iadesi
    if (row.durum === "yolda" && newDurum === "hazirlaniyor") {
      const { data: movs } = await supabase
        .from("stock_movements")
        .select("sku, qty")
        .eq("source_row_id", sevkiyatId)
        .eq("source", "Sevkiyat");

      const movements = (movs ?? []) as { sku: string; qty: number }[];
      const now = new Date().toISOString();

      for (const mov of movements) {
        await supabase.from("stock_movements").insert({
          tarih: now,
          sku: mov.sku,
          qty: Math.abs(mov.qty),
          source: "Sevkiyat \u0130ptal",
          source_row_id: `${sevkiyatId}-iptal`,
          batch_id: sevkiyatId,
        });

        const { data: productData } = await supabase
          .from("products")
          .select("sku, stok_aktif")
          .eq("sku", mov.sku)
          .single();

        const product = productData as { sku: string; stok_aktif: number } | null;
        if (product) {
          const newStok = (product.stok_aktif || 0) + Math.abs(mov.qty);
          await supabase.from("products").update({ stok_aktif: newStok }).eq("sku", mov.sku);
        }
      }
    }

    revalidatePath("/sevkiyat");
    revalidatePath("/stok/mamul");
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

    // Auto-ID
    const { data: lastItem } = await supabase
      .from("sevkiyat_items")
      .select("item_id")
      .like("item_id", "SVI-%")
      .order("item_id", { ascending: false })
      .limit(1);

    let itemNum = 1;
    if (lastItem && lastItem.length > 0) {
      const match = (lastItem[0] as { item_id: string }).item_id.match(/SVI-(\d+)/);
      if (match) itemNum = parseInt(match[1], 10) + 1;
    }
    const itemId = `SVI-${String(itemNum).padStart(6, "0")}`;

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
    if (!item) return { success: false, error: "Kalem bulunamad\u0131" };

    const { data: sevkData } = await supabase
      .from("sevkiyat")
      .select("durum")
      .eq("sevkiyat_id", item.sevkiyat_id)
      .single();

    const sev = sevkData as { durum: string } | null;
    if (!sev) return { success: false, error: "Sevkiyat bulunamad\u0131" };
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
