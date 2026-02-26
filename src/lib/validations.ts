import { z } from "zod";
import { PRODUCT_CATEGORIES, PART_TYPES, MAKINE_IDS, KESIM_MAKINE_IDS, MAKINE_BOLUMLERI, CUT_STATUS, IADE_DURUM, ATTENDANCE_DEPARTMENTS, USER_ROLES, USER_STATIONS, ODEME_TURLERI, PARA_BIRIMLERI, ODEME_DURUMLARI, TASK_STATUSES, TASK_PRIORITIES, TASK_DEPARTMENTS, TASK_SOURCE_TYPES } from "@/lib/constants";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "E-posta adresi gereklidir")
    .email("Geçerli bir e-posta adresi giriniz"),
  password: z
    .string()
    .min(1, "Şifre gereklidir")
    .min(6, "Şifre en az 6 karakter olmalıdır"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const productUpdateSchema = z.object({
  urun_adi: z
    .string()
    .min(1, "Ürün adı gereklidir")
    .max(200, "Ürün adı en fazla 200 karakter olabilir"),
  kategori: z.enum(PRODUCT_CATEGORIES, {
    error: "Geçerli bir kategori seçiniz",
  }),
  aktif_mi: z.boolean(),
});

export type ProductUpdateData = z.infer<typeof productUpdateSchema>;

export const productCreateSchema = z.object({
  sku: z
    .string()
    .min(1, "SKU gereklidir")
    .max(50, "SKU en fazla 50 karakter olabilir")
    .regex(/^[A-Za-z0-9\-_]+$/, "Geçersiz SKU formatı (harf, rakam, tire, alt çizgi)"),
  urun_adi: z
    .string()
    .min(1, "Ürün adı gereklidir")
    .max(200, "Ürün adı en fazla 200 karakter olabilir"),
  kategori: z.enum(PRODUCT_CATEGORIES, {
    error: "Geçerli bir kategori seçiniz",
  }),
  aktif_mi: z.boolean(),
});

export type ProductCreateData = z.infer<typeof productCreateSchema>;

export const partUpdateSchema = z.object({
  part_adi: z
    .string()
    .min(1, "Parça adı gereklidir")
    .max(200, "Parça adı en fazla 200 karakter olabilir"),
  part_type: z.enum(PART_TYPES, {
    error: "Geçerli bir parça tipi seçiniz",
  }),
  hazir_eleman_kritik_stok: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(0, "Kritik stok 0 veya üzeri olmalıdır"),
});

export type PartUpdateData = z.infer<typeof partUpdateSchema>;

export const partCreateSchema = z.object({
  part_id: z
    .string()
    .min(1, "Parça ID gereklidir")
    .max(30, "Parça ID en fazla 30 karakter olabilir")
    .regex(/^[A-Za-z0-9\-_]+$/, "Geçersiz ID formatı (harf, rakam, tire, alt çizgi)"),
  part_adi: z
    .string()
    .min(1, "Parça adı gereklidir")
    .max(200, "Parça adı en fazla 200 karakter olabilir"),
  part_type: z.enum(PART_TYPES, {
    error: "Geçerli bir parça tipi seçiniz",
  }),
  hazir_eleman_kritik_stok: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(0, "Kritik stok 0 veya üzeri olmalıdır"),
});

export type PartCreateData = z.infer<typeof partCreateSchema>;

// ─── Makine Yönetimi ────────────────────────────────────────

export const makineCreateSchema = z.object({
  makine_id: z
    .string()
    .min(1, "Makine ID gereklidir")
    .max(30, "Makine ID en fazla 30 karakter olabilir"),
  tipi: z
    .string()
    .min(1, "Makine tipi gereklidir")
    .max(100, "Makine tipi en fazla 100 karakter olabilir"),
  bolum: z.enum(MAKINE_BOLUMLERI, {
    error: "Geçerli bir bölüm seçiniz",
  }),
  aciklama: z.string().max(500, "Açıklama en fazla 500 karakter olabilir").nullable(),
});

export type MakineCreateData = z.infer<typeof makineCreateSchema>;

export const makineUpdateSchema = z.object({
  tipi: z
    .string()
    .min(1, "Makine tipi gereklidir")
    .max(100, "Makine tipi en fazla 100 karakter olabilir"),
  bolum: z.enum(MAKINE_BOLUMLERI, {
    error: "Geçerli bir bölüm seçiniz",
  }),
  aciklama: z.string().max(500, "Açıklama en fazla 500 karakter olabilir").nullable(),
  aktif: z.boolean(),
});

export type MakineUpdateData = z.infer<typeof makineUpdateSchema>;

export const kesimSureleriSchema = z.object({
  "MAK-1": z.number().int("Tam sayı olmalıdır").min(0, "0 veya üzeri olmalıdır").nullable().optional(),
  "MAK-2": z.number().int("Tam sayı olmalıdır").min(0, "0 veya üzeri olmalıdır").nullable().optional(),
  "MAK-3": z.number().int("Tam sayı olmalıdır").min(0, "0 veya üzeri olmalıdır").nullable().optional(),
  "KUTU": z.number().int("Tam sayı olmalıdır").min(0, "0 veya üzeri olmalıdır").nullable().optional(),
});

export const plakaUpdateSchema = z.object({
  plaka_adi: z
    .string()
    .min(1, "Plaka adı gereklidir")
    .max(200, "Plaka adı en fazla 200 karakter olabilir"),
  tipi: z.string().max(100, "Tip en fazla 100 karakter olabilir").nullable(),
  renk: z.string().max(100, "Renk en fazla 100 karakter olabilir").nullable(),
  kesim_sureleri: kesimSureleriSchema,
  sku: z.string().nullable(),
});

export type PlakaUpdateData = z.infer<typeof plakaUpdateSchema>;

export const plakaCreateSchema = plakaUpdateSchema.extend({
  plaka_id: z
    .string()
    .min(1, "Plaka grubu ID gereklidir")
    .max(30, "Plaka grubu ID en fazla 30 karakter olabilir"),
});

export type PlakaCreateData = z.infer<typeof plakaCreateSchema>;

export const plakaPartSchema = z.object({
  part_id: z.string().min(1, "Parça seçimi gereklidir"),
  default_qty: z
    .number()
    .min(0, "Miktar 0 veya üzeri olmalıdır")
    .nullable(),
});

export type PlakaPartData = z.infer<typeof plakaPartSchema>;

// Assembly Step
export const assemblyStepSchema = z.object({
  step_name: z
    .string()
    .min(1, "Adım adı gereklidir")
    .max(200, "Adım adı en fazla 200 karakter"),
  seq_no: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "Sıra numarası 1 veya üzeri olmalıdır"),
  is_final_step: z.boolean(),
});

export type AssemblyStepFormData = z.infer<typeof assemblyStepSchema>;

// StepBOM Item
export const stepBomItemSchema = z.object({
  part_id: z.string().min(1, "Parça/adım ID gereklidir"),
  qty_per: z.number().min(0.01, "Miktar 0'dan büyük olmalıdır"),
});

export type StepBomItemFormData = z.infer<typeof stepBomItemSchema>;

// Kesim Batch oluşturma
export const cutBatchCreateSchema = z.object({
  makine_id: z.enum(KESIM_MAKINE_IDS, {
    error: "Geçerli bir makine seçiniz",
  }),
  sku: z.string().min(1, "Ürün seçimi gereklidir"),
  plaka_id: z.string().min(1, "Plaka seçimi gereklidir"),
  adet: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 adet olmalıdır")
    .max(100, "En fazla 100 adet olabilir"),
  operator_id: z.string().min(1, "Operatör seçimi gereklidir"),
  plk_notu: z.string().max(500, "Not en fazla 500 karakter olabilir").nullable(),
});

export type CutBatchCreateData = z.infer<typeof cutBatchCreateSchema>;

// Montaj Batch oluşturma
export const montajBatchCreateSchema = z.object({
  sku: z.string().min(1, "Ürün seçimi gereklidir"),
  adet: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 adet olmalıdır")
    .max(50, "En fazla 50 adet olabilir"),
  notes: z.string().max(500, "Not en fazla 500 karakter olabilir").nullable(),
});

export type MontajBatchCreateData = z.infer<typeof montajBatchCreateSchema>;

// Montaj Seans kapatma (yeni seans bazlı sistem)
export const montajSessionCloseSchema = z.object({
  qty: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 adet olmalıdır")
    .max(9999, "En fazla 9999 adet olabilir"),
  workers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    )
    .min(1, "En az 1 çalışan seçilmelidir")
    .max(10, "En fazla 10 çalışan seçilebilir"),
});

export type MontajSessionCloseData = z.infer<typeof montajSessionCloseSchema>;

// Paketleme seans oluşturma
export const packSessionCreateSchema = z.object({
  sku: z.string().min(1, "Ürün seçimi gereklidir"),
  qty: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 adet olmalıdır")
    .max(500, "En fazla 500 adet olabilir"),
  not_text: z.string().max(500, "Not en fazla 500 karakter olabilir").nullable(),
});

export type PackSessionCreateData = z.infer<typeof packSessionCreateSchema>;

// Paketleme seans kapatma
export const packSessionCloseSchema = z.object({
  qty: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 adet olmalıdır")
    .max(9999, "En fazla 9999 adet olabilir"),
  workers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    )
    .min(1, "En az 1 çalışan seçilmelidir")
    .max(5, "En fazla 5 çalışan seçilebilir"),
});

export type PackSessionCloseData = z.infer<typeof packSessionCloseSchema>;

// Kutu-Koli seans oluşturma (v2 — plaka_id ve sku eklendi)
export const kutuSessionCreateSchema = z.object({
  plaka_id: z.string().min(1, "Karton şablon seçimi gereklidir"),
  sku: z.string().min(1, "Ürün seçimi gereklidir"),
  part_id: z.string().min(1, "Parça seçimi gereklidir"),
  qty: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 adet olmalıdır")
    .max(1000, "En fazla 1000 adet olabilir"),
  not_text: z.string().max(500, "Not en fazla 500 karakter olabilir").nullable(),
});

export type KutuSessionCreateData = z.infer<typeof kutuSessionCreateSchema>;

// Karton Şablon oluşturma (Admin)
export const kartonSablonCreateSchema = z.object({
  plaka_id: z
    .string()
    .min(1, "Şablon ID gereklidir")
    .max(30, "Şablon ID en fazla 30 karakter olabilir"),
  plaka_adi: z
    .string()
    .min(1, "Şablon adı gereklidir")
    .max(200, "Şablon adı en fazla 200 karakter olabilir"),
  tipi: z.string().max(100, "Tip en fazla 100 karakter olabilir").nullable(),
  renk: z.string().max(100, "Renk en fazla 100 karakter olabilir").nullable(),
  sku: z.string().min(1, "SKU (ürün) seçimi gereklidir"),
  kutu_sure_dk: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(0, "Süre 0 veya üzeri olmalıdır")
    .nullable(),
  output_part_id: z.string().min(1, "Çıkan parça seçimi gereklidir"),
});

export type KartonSablonCreateData = z.infer<typeof kartonSablonCreateSchema>;

export const kartonSablonUpdateSchema = z.object({
  plaka_adi: z
    .string()
    .min(1, "Şablon adı gereklidir")
    .max(200, "Şablon adı en fazla 200 karakter olabilir"),
  tipi: z.string().max(100, "Tip en fazla 100 karakter olabilir").nullable(),
  renk: z.string().max(100, "Renk en fazla 100 karakter olabilir").nullable(),
  sku: z.string().min(1, "SKU (ürün) seçimi gereklidir"),
  kutu_sure_dk: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(0, "Süre 0 veya üzeri olmalıdır")
    .nullable(),
  output_part_id: z.string().min(1, "Çıkan parça seçimi gereklidir"),
});

export type KartonSablonUpdateData = z.infer<typeof kartonSablonUpdateSchema>;

// Hazır Eleman stok girişi
export const hazirElemanGirisSchema = z.object({
  part_id: z.string().min(1, "Parça seçimi gereklidir"),
  qty: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 adet olmalıdır")
    .max(10000, "En fazla 10.000 adet olabilir"),
  not_text: z.string().max(500, "Not en fazla 500 karakter olabilir").nullable(),
});

export type HazirElemanGirisData = z.infer<typeof hazirElemanGirisSchema>;

// İade girişi
export const iadeGirisSchema = z.object({
  sku: z.string().min(1, "Ürün seçimi gereklidir"),
  qty: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 adet olmalıdır")
    .max(500, "En fazla 500 adet olabilir"),
  durum: z.enum(IADE_DURUM, {
    error: "Geçerli bir durum seçiniz",
  }),
  iade_nedeni: z
    .string()
    .min(1, "İade nedeni gereklidir")
    .max(500, "İade nedeni en fazla 500 karakter olabilir"),
  musteri_bilgisi: z.string().max(300, "Müşteri bilgisi en fazla 300 karakter olabilir").nullable(),
});

export type IadeGirisData = z.infer<typeof iadeGirisSchema>;

// Sevkiyat oluşturma (v4 — ülke bazlı + araç tipi + tarih + dorse + taşıyıcı)
export const sevkiyatCreateSchema = z.object({
  country_code: z.string().min(1, "Ülke seçimi gereklidir"),
  arac_tipi: z.string().min(1, "Araç tipi gereklidir"),
  konteyner_no: z.string().max(50, "Konteyner no en fazla 50 karakter").nullable(),
  konteyner_tipi: z.string().nullable(),
  tir_plaka: z.string().max(20, "Tır plaka en fazla 20 karakter").nullable(),
  dorse_plaka: z.string().max(30, "Dorse plaka en fazla 30 karakter").nullable().optional(),
  planlanan_sevk_tarihi: z.string().nullable(),
  tasiyici_firma: z.string().max(100, "Taşıyıcı firma en fazla 100 karakter").nullable().optional(),
  not_text: z.string().max(500, "Not en fazla 500 karakter olabilir").nullable(),
});

export type SevkiyatCreateData = z.infer<typeof sevkiyatCreateSchema>;

// Sevkiyat item (v2 — lojistik bilgiler)
export const sevkiyatItemSchema = z.object({
  sku: z.string().min(1, "Ürün seçimi gereklidir"),
  palet_boyut: z.string().min(1, "Palet boyutu gereklidir"),
  palet_yukseklik: z.number().min(1, "Palet yüksekliği gereklidir"),
  en: z.number().min(1, "Ürün genişliği gereklidir"),
  boy: z.number().min(1, "Ürün uzunluğu gereklidir"),
  yuk: z.number().min(1, "Ürün yüksekliği gereklidir"),
  koli_adedi: z.number().int("Tam sayı olmalıdır").min(1, "Koli adedi gereklidir"),
  palette_koli: z.number().int("Tam sayı olmalıdır").min(1, "Palette koli gereklidir"),
  koli_agirlik: z.number().min(0.1, "Koli ağırlığı gereklidir"),
  palet_sayisi: z.number().int("Tam sayı olmalıdır").min(1, "Palet sayısı gereklidir"),
  grup: z.string().nullable(),
});

export type SevkiyatItemData = z.infer<typeof sevkiyatItemSchema>;

// Sevkiyat fiyat
export const sevkiyatFiyatSchema = z.object({
  country_code: z.string().min(1, "Ülke seçimi gereklidir"),
  sku: z.string().min(1, "SKU gereklidir"),
  urun_adi_en: z.string().max(300, "Ürün adı en fazla 300 karakter").nullable(),
  gtip: z.string().max(30, "GTIP en fazla 30 karakter").nullable(),
  birim_fiyat: z.number().min(0, "Fiyat 0 veya üzeri olmalıdır"),
  kategori: z.string().max(50, "Kategori en fazla 50 karakter").nullable(),
  package_qty: z.number().int("Tam sayı olmalıdır").nullable(),
  asin: z.string().max(50, "ASIN en fazla 50 karakter").nullable(),
});

export type SevkiyatFiyatData = z.infer<typeof sevkiyatFiyatSchema>;

// Palet Şablon (palet boyutu + SKU bazlı)
export const paletSablonSchema = z.object({
  sku: z.string().min(1, "SKU gereklidir"),
  palet_boyut: z.string().min(1, "Palet boyutu gereklidir"),
  palet_yukseklik: z.number().min(1, "Palet yüksekliği gereklidir"),
  en: z.number().min(1, "Koli genişliği gereklidir"),
  boy: z.number().min(1, "Koli uzunluğu gereklidir"),
  yuk: z.number().min(1, "Koli yüksekliği gereklidir"),
  koli_adedi: z.number().int("Tam sayı olmalıdır").min(1, "Koli adedi gereklidir"),
  palette_koli: z.number().int("Tam sayı olmalıdır").min(1, "Palette koli gereklidir"),
  koli_agirlik: z.number().min(0.1, "Koli ağırlığı gereklidir"),
});

export type PaletSablonData = z.infer<typeof paletSablonSchema>;

// Firma profili
export const sevkiyatFirmaSchema = z.object({
  firma_tipi: z.string().min(1, "Firma tipi gereklidir"),
  country_code: z.string().max(10).nullable(),
  profil_adi: z.string().min(1, "Profil adı gereklidir").max(200),
  firma_adi: z.string().max(300).nullable(),
  adres_satir1: z.string().max(500).nullable(),
  adres_satir2: z.string().max(500).nullable(),
  telefon: z.string().max(50).nullable(),
  email: z.string().max(100).nullable(),
  web: z.string().max(100).nullable(),
  vergi_no: z.string().max(50).nullable(),
  vat_no: z.string().max(50).nullable(),
  banka_adi: z.string().max(100).nullable(),
  sube_adi: z.string().max(100).nullable(),
  swift_code: z.string().max(20).nullable(),
  iban: z.string().max(50).nullable(),
  para_birimi: z.string().max(10).nullable(),
  sevk_yontemi: z.string().max(50).nullable(),
  yetkili_adi: z.string().max(100).nullable(),
  imza_yeri: z.string().max(100).nullable(),
  aktif: z.boolean(),
  varsayilan: z.boolean(),
});

export type SevkiyatFirmaData = z.infer<typeof sevkiyatFirmaSchema>;

// Sevkiyat maliyet
export const sevkiyatMaliyetSchema = z.object({
  navlun: z.number().min(0).default(0),
  navlun_currency: z.string().default("USD"),
  ic_nakliye: z.number().min(0).default(0),
  ic_nakliye_currency: z.string().default("TRY"),
  ara_depo: z.number().min(0).default(0),
  ara_depo_currency: z.string().default("TRY"),
  amazon_pickup: z.number().min(0).default(0),
  amazon_pickup_currency: z.string().default("USD"),
  ydg: z.number().min(0).default(0),
  ydg_currency: z.string().default("USD"),
  tr_gumruk: z.number().min(0).default(0),
  tr_gumruk_currency: z.string().default("TRY"),
  diger: z.number().min(0).default(0),
  diger_currency: z.string().default("TRY"),
  not_text: z.string().max(500).nullable(),
});

export type SevkiyatMaliyetData = z.infer<typeof sevkiyatMaliyetSchema>;

// Döviz kuru
export const dovizKuruSchema = z.object({
  tarih: z.string().min(1, "Tarih gereklidir"),
  usd_try: z.number().min(0, "USD/TRY gereklidir"),
  eur_try: z.number().min(0, "EUR/TRY gereklidir"),
  gbp_try: z.number().min(0, "GBP/TRY gereklidir"),
});

export type DovizKuruData = z.infer<typeof dovizKuruSchema>;

// TR Pazarlama
export const trPazarlamaSchema = z.object({
  yil: z
    .number()
    .int()
    .min(2020, "Yıl 2020 veya üzeri olmalıdır")
    .max(2030),
  ay: z.number().int().min(1, "Ay 1-12 arası olmalıdır").max(12),
  pazaryeri: z.string().min(1, "Pazaryeri seçimi gereklidir"),
  hedef_ciro: z.number().min(0, "Hedef ciro 0 veya üzeri olmalıdır"),
  gercek_ciro: z.number().min(0, "Gerçek ciro 0 veya üzeri olmalıdır"),
  siparis_sayisi: z
    .number()
    .int()
    .min(0, "Sipariş sayısı 0 veya üzeri olmalıdır"),
  ziyaretci: z
    .number()
    .int()
    .min(0, "Ziyaretçi 0 veya üzeri olmalıdır"),
  donusum_orani: z
    .number()
    .min(0)
    .max(100, "Dönüşüm oranı 0-100 arası olmalıdır"),
  iadeler: z
    .number()
    .int()
    .min(0, "İade sayısı 0 veya üzeri olmalıdır"),
  ortalama_sepet: z.number().min(0).nullable(),
  reklam_harcamasi: z.number().min(0).nullable(),
  not_text: z
    .string()
    .max(500, "Not en fazla 500 karakter olabilir")
    .nullable(),
});

export type TrPazarlamaData = z.infer<typeof trPazarlamaSchema>;

// Kampanya
export const kampanyaSchema = z.object({
  kampanya_adi: z
    .string()
    .min(1, "Kampanya adı gereklidir")
    .max(200),
  baslangic_tarihi: z.string().min(1, "Başlangıç tarihi gereklidir"),
  bitis_tarihi: z.string().min(1, "Bitiş tarihi gereklidir"),
  ana_hedef: z.string().max(500).nullable(),
  ziyaretci: z.number().int().min(0).nullable(),
  siparis_sayisi: z.number().int().min(0).nullable(),
  ciro: z.number().min(0).nullable(),
  donusum_orani: z.number().min(0).max(100).nullable(),
  ortalama_sepet: z.number().min(0).nullable(),
  notlar: z.string().max(1000).nullable(),
});

export type KampanyaData = z.infer<typeof kampanyaSchema>;

// ─── Kritik Stok Ayarları ────────────────────────────────────

export const appSettingSchema = z.object({
  kritik_stok_gun: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 gün olmalıdır")
    .max(365, "En fazla 365 gün olabilir"),
  kritik_stok_lookback_days: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(7, "En az 7 gün olmalıdır")
    .max(365, "En fazla 365 gün olabilir"),
});

export type AppSettingData = z.infer<typeof appSettingSchema>;

// ─── Personel & Yoklama ───────────────────────────────────────

// ─── Bildirimler ─────────────────────────────────────────────

export const notificationCreateSchema = z.object({
  title: z.string().min(1, "Başlık gereklidir").max(200, "Başlık en fazla 200 karakter olabilir"),
  message: z.string().max(2000, "Mesaj en fazla 2000 karakter olabilir").nullable(),
  target_users: z.array(z.string()).default([]),
});

export type NotificationCreateData = z.infer<typeof notificationCreateSchema>;

// ─── Personel & Yoklama ───────────────────────────────────────

export const attendanceCreateSchema = z.object({
  employee: z
    .string()
    .min(1, "Çalışan seçimi gereklidir"),
  tarih: z
    .string()
    .min(1, "Tarih gereklidir"),
  department: z.enum(ATTENDANCE_DEPARTMENTS, {
    error: "Geçerli bir departman seçiniz",
  }),
  start_time: z
    .string()
    .min(1, "Giriş saati gereklidir")
    .regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (SS:DD)"),
  end_time: z
    .string()
    .min(1, "Çıkış saati gereklidir")
    .regex(/^\d{2}:\d{2}$/, "Geçerli bir saat formatı giriniz (SS:DD)"),
  not_text: z
    .string()
    .max(500, "Not en fazla 500 karakter olabilir")
    .nullable(),
});

export type AttendanceCreateData = z.infer<typeof attendanceCreateSchema>;

export const attendanceUpdateSchema = attendanceCreateSchema;

export type AttendanceUpdateData = z.infer<typeof attendanceUpdateSchema>;

// ─── Kullanıcı Yönetimi ─────────────────────────────────────

export const userCreateSchema = z.object({
  user_id: z
    .string()
    .min(1, "Kullanıcı ID gereklidir")
    .regex(/^VW\d{3}$/, "Kullanıcı ID formatı VW + 3 rakam olmalıdır (ör: VW057)"),
  full_name: z
    .string()
    .min(1, "Ad soyad gereklidir")
    .max(200, "Ad soyad en fazla 200 karakter olabilir"),
  email: z
    .string()
    .email("Geçerli bir e-posta adresi giriniz")
    .nullable(),
  role: z.enum(USER_ROLES, {
    error: "Geçerli bir rol seçiniz",
  }),
  station: z.enum(USER_STATIONS, {
    error: "Geçerli bir istasyon seçiniz",
  }),
});

export type UserCreateData = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  full_name: z
    .string()
    .min(1, "Ad soyad gereklidir")
    .max(200, "Ad soyad en fazla 200 karakter olabilir"),
  email: z
    .string()
    .email("Geçerli bir e-posta adresi giriniz")
    .nullable(),
  role: z.enum(USER_ROLES, {
    error: "Geçerli bir rol seçiniz",
  }),
  station: z.enum(USER_STATIONS, {
    error: "Geçerli bir istasyon seçiniz",
  }),
  is_active: z.boolean(),
});

export type UserUpdateData = z.infer<typeof userUpdateSchema>;

// ─── Muhasebe & Finans ─────────────────────────────────────

/** Ödeme oluşturma/güncelleme */
export const odemeCreateSchema = z.object({
  tanimi: z
    .string()
    .min(1, "Ödeme tanımı gereklidir")
    .max(500, "Tanım en fazla 500 karakter olabilir"),
  tutar: z
    .number()
    .min(0, "Tutar 0 veya üzeri olmalıdır"),
  cinsi: z.enum(PARA_BIRIMLERI, {
    error: "Geçerli bir para birimi seçiniz",
  }),
  tarih: z.string().min(1, "Tarih gereklidir"),
  turu: z.enum(ODEME_TURLERI, {
    error: "Geçerli bir ödeme türü seçiniz",
  }),
  odeme_durum: z.enum(ODEME_DURUMLARI, {
    error: "Geçerli bir durum seçiniz",
  }),
  kredi_grubu: z.string().max(200, "Kredi grubu en fazla 200 karakter olabilir").nullable().optional(),
});

export type OdemeCreateData = z.infer<typeof odemeCreateSchema>;

/** Nakit giriş takip oluşturma/güncelleme */
export const nakitGirisTakipSchema = z.object({
  tanimi: z
    .string()
    .min(1, "Tanım gereklidir")
    .max(500, "Tanım en fazla 500 karakter olabilir"),
  tutar: z
    .number()
    .min(0, "Tutar 0 veya üzeri olmalıdır"),
  cinsi: z.enum(PARA_BIRIMLERI, {
    error: "Geçerli bir para birimi seçiniz",
  }),
  tarih: z.string().nullable(),
  turu: z.string().max(100, "Tür en fazla 100 karakter olabilir").nullable(),
  marka: z.string().max(100, "Marka en fazla 100 karakter olabilir").nullable(),
  odeme_durum: z.enum(ODEME_DURUMLARI, {
    error: "Geçerli bir durum seçiniz",
  }),
});

export type NakitGirisTakipData = z.infer<typeof nakitGirisTakipSchema>;

// ─── Faaliyet Hesapları ─────────────────────────────────────

/** Satış giriş satırı */
export const satisGirisRowSchema = z.object({
  marka: z.string().min(1, "Marka seçiniz"),
  kanal: z.string().min(1, "Kanal seçiniz"),
  tur: z.enum(["FAALIYET", "FAALIYET_DISI"] as const, {
    error: "Geçerli bir tür seçiniz",
  }),
  pazaryeri: z.string().min(1, "Pazaryeri giriniz"),
  ulke: z.string().nullable().optional(),
  tl_satislar: z.number().min(0, "Tutar 0 veya üzeri olmalıdır"),
  usd_satislar: z.number().min(0, "Tutar 0 veya üzeri olmalıdır"),
});

/** Satış giriş toplu form */
export const satisGirisBatchSchema = z.object({
  donem_yil: z.number().min(2020).max(2100),
  donem_ay: z.number().min(1).max(12),
  kur_tl_usd: z.number().min(0, "Kur 0 veya üzeri olmalıdır"),
  satirlar: z.array(satisGirisRowSchema).min(1, "En az bir satış satırı gereklidir"),
});

export type SatisGirisBatchData = z.infer<typeof satisGirisBatchSchema>;

/** Maliyet giriş satırı */
export const maliyetGirisRowSchema = z.object({
  kategori: z.string().min(1, "Kategori seçiniz"),
  maliyet_grubu: z.enum(["VIGO_WOOD", "HAS_MOB", "ORTAK"] as const, {
    error: "Geçerli bir maliyet grubu seçiniz",
  }),
  cari_adi: z.string().nullable().optional(),
  tl_maliyet: z.number().min(0, "Tutar 0 veya üzeri olmalıdır"),
  vigo_wood_orani: z.number().min(0).max(100).nullable().optional(),
});

/** Maliyet giriş toplu form */
export const maliyetGirisBatchSchema = z.object({
  donem_yil: z.number().min(2020).max(2100),
  donem_ay: z.number().min(1).max(12),
  kur_tl_usd: z.number().min(0, "Kur 0 veya üzeri olmalıdır"),
  satirlar: z.array(maliyetGirisRowSchema).min(1, "En az bir maliyet satırı gereklidir"),
});

export type MaliyetGirisBatchData = z.infer<typeof maliyetGirisBatchSchema>;

// ─── Ops Center — Task Management ────────────────────────────

/** Hızlı görev oluşturma (sadece başlık) */
export const taskQuickCreateSchema = z.object({
  title: z
    .string()
    .min(1, "Görev başlığı gereklidir")
    .max(300, "Başlık en fazla 300 karakter olabilir"),
});

export type TaskQuickCreateData = z.infer<typeof taskQuickCreateSchema>;

/** Detaylı görev oluşturma */
export const taskCreateSchema = z.object({
  title: z
    .string()
    .min(1, "Görev başlığı gereklidir")
    .max(300, "Başlık en fazla 300 karakter olabilir"),
  description: z
    .string()
    .max(5000, "Açıklama en fazla 5000 karakter olabilir")
    .nullable()
    .optional(),
  status: z.enum(TASK_STATUSES).default("queue"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assigned_to: z.string().nullable().optional(),
  department: z.enum(TASK_DEPARTMENTS).default("genel"),
  due_date: z.string().nullable().optional(),
  parent_id: z.string().uuid("Geçersiz üst görev ID").nullable().optional(),
  source_type: z.enum(TASK_SOURCE_TYPES).default("manual"),
});

export type TaskCreateData = z.infer<typeof taskCreateSchema>;

/** Görev güncelleme */
export const taskUpdateSchema = z.object({
  title: z
    .string()
    .min(1, "Görev başlığı gereklidir")
    .max(300, "Başlık en fazla 300 karakter olabilir")
    .optional(),
  description: z
    .string()
    .max(5000, "Açıklama en fazla 5000 karakter olabilir")
    .nullable()
    .optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigned_to: z.string().nullable().optional(),
  department: z.enum(TASK_DEPARTMENTS).optional(),
  due_date: z.string().nullable().optional(),
  is_blocked: z.boolean().optional(),
  is_waiting_approval: z.boolean().optional(),
});

export type TaskUpdateData = z.infer<typeof taskUpdateSchema>;

/** Yorum ekleme */
export const taskCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Yorum içeriği gereklidir")
    .max(5000, "Yorum en fazla 5000 karakter olabilir"),
});

export type TaskCommentData = z.infer<typeof taskCommentSchema>;

/** Görev şablonu oluşturma/güncelleme */
export const taskTemplateSchema = z.object({
  title: z
    .string()
    .min(1, "Şablon başlığı gereklidir")
    .max(300, "Başlık en fazla 300 karakter olabilir"),
  description: z
    .string()
    .max(5000, "Açıklama en fazla 5000 karakter olabilir")
    .nullable()
    .optional(),
  department: z.enum(TASK_DEPARTMENTS).default("genel"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assignee_id: z.string().nullable().optional(),
  checklist: z.array(z.object({
    text: z.string().min(1),
    done: z.boolean().default(false),
  })).default([]),
});

export type TaskTemplateData = z.infer<typeof taskTemplateSchema>;

/** Tekrar eden görev oluşturma/güncelleme */
export const recurringTaskSchema = z.object({
  title: z
    .string()
    .min(1, "Görev başlığı gereklidir")
    .max(300, "Başlık en fazla 300 karakter olabilir"),
  description: z
    .string()
    .max(5000, "Açıklama en fazla 5000 karakter olabilir")
    .nullable()
    .optional(),
  department: z.enum(TASK_DEPARTMENTS).default("genel"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  assignee_id: z.string().nullable().optional(),
  cron_schedule: z.string().min(1, "Zamanlama gereklidir"),
  is_active: z.boolean().default(true),
  template_id: z.string().uuid().nullable().optional(),
});

export type RecurringTaskData = z.infer<typeof recurringTaskSchema>;
