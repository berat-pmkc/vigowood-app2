import { z } from "zod";
import { PRODUCT_CATEGORIES, PART_TYPES, MAKINE_IDS, CUT_STATUS, IADE_DURUM, SEVKIYAT_COUNTRY_CODES } from "@/lib/constants";

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

export const plakaUpdateSchema = z.object({
  plaka_adi: z
    .string()
    .min(1, "Plaka adı gereklidir")
    .max(200, "Plaka adı en fazla 200 karakter olabilir"),
  tipi: z.string().max(100, "Tip en fazla 100 karakter olabilir").nullable(),
  renk: z.string().max(100, "Renk en fazla 100 karakter olabilir").nullable(),
  makine_id: z.enum(MAKINE_IDS, {
    error: "Geçerli bir makine seçiniz",
  }),
  std_kesim_suresi_dk: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(0, "Kesim süresi 0 veya üzeri olmalıdır")
    .nullable(),
  sku: z.string().nullable(),
});

export type PlakaUpdateData = z.infer<typeof plakaUpdateSchema>;

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
  makine_id: z.enum(MAKINE_IDS, {
    error: "Geçerli bir makine seçiniz",
  }),
  sku: z.string().min(1, "Ürün seçimi gereklidir"),
  plaka_id: z.string().min(1, "Plaka seçimi gereklidir"),
  adet: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 adet olmalıdır")
    .max(100, "En fazla 100 adet olabilir"),
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

// Kutu-Koli seans oluşturma
export const kutuSessionCreateSchema = z.object({
  part_id: z.string().min(1, "Parça seçimi gereklidir"),
  qty: z
    .number()
    .int("Tam sayı olmalıdır")
    .min(1, "En az 1 adet olmalıdır")
    .max(1000, "En fazla 1000 adet olabilir"),
  not_text: z.string().max(500, "Not en fazla 500 karakter olabilir").nullable(),
});

export type KutuSessionCreateData = z.infer<typeof kutuSessionCreateSchema>;

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

// Sevkiyat oluşturma (v2 — ülke bazlı)
export const sevkiyatCreateSchema = z.object({
  country_code: z.enum(SEVKIYAT_COUNTRY_CODES, { message: "Ülke seçimi gereklidir" }),
  konteyner_no: z.string().max(50, "Konteyner no en fazla 50 karakter").nullable(),
  konteyner_tipi: z.string().nullable(),
  sevk_tarihi: z.string().nullable(),
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
  country_code: z.enum(SEVKIYAT_COUNTRY_CODES, { message: "Ülke seçimi gereklidir" }),
  sku: z.string().min(1, "SKU gereklidir"),
  urun_adi_en: z.string().max(300, "Ürün adı en fazla 300 karakter").nullable(),
  gtip: z.string().max(30, "GTIP en fazla 30 karakter").nullable(),
  birim_fiyat: z.number().min(0, "Fiyat 0 veya üzeri olmalıdır"),
  kategori: z.string().max(50, "Kategori en fazla 50 karakter").nullable(),
  package_qty: z.number().int("Tam sayı olmalıdır").nullable(),
  asin: z.string().max(50, "ASIN en fazla 50 karakter").nullable(),
});

export type SevkiyatFiyatData = z.infer<typeof sevkiyatFiyatSchema>;
