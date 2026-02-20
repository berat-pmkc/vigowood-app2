import { z } from "zod";
import { PRODUCT_CATEGORIES, PART_TYPES, MAKINE_IDS, CUT_STATUS } from "@/lib/constants";

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
