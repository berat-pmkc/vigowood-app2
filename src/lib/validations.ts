import { z } from "zod";
import { PRODUCT_CATEGORIES, PART_TYPES, MAKINE_IDS } from "@/lib/constants";

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
