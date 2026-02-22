"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { productUpdateSchema, productCreateSchema } from "@/lib/validations";
import type { ProductCategory, Database } from "@/lib/supabase/types";

type ActionResult = { success: true } | { success: false; error: string };
type Product = Database["public"]["Tables"]["products"]["Row"];

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function createProduct(
  formData: {
    sku: string;
    urun_adi: string;
    kategori: string;
    aktif_mi: boolean;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = productCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Check if SKU already exists
    const { data: existing } = await supabase
      .from("products")
      .select("sku")
      .eq("sku", parsed.data.sku)
      .limit(1);

    if (existing && existing.length > 0) {
      return { success: false, error: "Bu SKU zaten kullanılıyor" };
    }

    const { error } = await supabase.from("products").insert({
      sku: parsed.data.sku,
      urun_adi: parsed.data.urun_adi,
      kategori: parsed.data.kategori as ProductCategory,
      aktif_mi: parsed.data.aktif_mi,
      stok_aktif: 0,
      gunluk_satis: 0,
      aylik_uretim: 0,
      gecen_ay_uretim: 0,
      satilan_gun_sayisi: 0,
      toplam_satis: 0,
      mamul_stok_kritik: 0,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/urunler");
    revalidateTag("products", "default");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function updateProduct(
  sku: string,
  formData: { urun_adi: string; kategori: string; aktif_mi: boolean }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = productUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({
        urun_adi: parsed.data.urun_adi,
        kategori: parsed.data.kategori as ProductCategory,
        aktif_mi: parsed.data.aktif_mi,
      })
      .eq("sku", sku);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/urunler");
    revalidateTag("products", "default");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function bulkToggleActive(
  skus: string[],
  aktif: boolean
): Promise<ActionResult> {
  try {
    await requireAdmin();

    if (skus.length === 0) {
      return { success: false, error: "Hiç ürün seçilmedi" };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("products")
      .update({ aktif_mi: aktif })
      .in("sku", skus);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/urunler");
    revalidateTag("products", "default");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function exportProducts(): Promise<
  { success: true; data: Product[] } | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sku");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as Product[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function importProducts(
  rows: { sku: string; urun_adi: string; kategori: string; aktif_mi: string }[]
): Promise<ActionResult & { count?: number }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    let count = 0;
    for (const row of rows) {
      if (!row.sku) continue;
      const { error } = await supabase
        .from("products")
        .upsert(
          {
            sku: row.sku,
            urun_adi: row.urun_adi || null,
            kategori: (row.kategori || "Diğer") as ProductCategory,
            aktif_mi: row.aktif_mi === "true" || row.aktif_mi === "1" || row.aktif_mi === "Evet",
          },
          { onConflict: "sku" }
        );

      if (error) {
        return { success: false, error: `Satır ${row.sku}: ${error.message}` };
      }
      count++;
    }

    revalidatePath("/admin/urunler");
    revalidateTag("products", "default");
    return { success: true, count };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
