"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tables not yet in generated types (pending db push + type regen)
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import {
  targetPriceSchema,
  boxDimensionSchema,
  shippingProviderSchema,
} from "@/lib/validations";

type ActionResult = { success: true } | { success: false; error: string };

// Helper: cast supabase.from() for tables not yet in generated types
// Remove after running: npx supabase gen types typescript --project-id qqoojonxpaufcyyzvfpo > src/lib/supabase/types.ts
async function getDb() {
  const supabase = await createClient();
  return supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function requireMarketplaceAccess() {
  const user = await getCurrentUser();
  if (!user || !MARKETPLACE_ACCESS_ROLES.includes(user.role as typeof MARKETPLACE_ACCESS_ROLES[number])) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// =============================================
// Hedef Fiyatlar
// =============================================

export async function upsertTargetPrice(formData: {
  sku: string;
  perakende_min: number;
  perakende_standart: number;
  toptan_min: number;
  toptan_standart: number;
  aktif?: boolean;
}): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const parsed = targetPriceSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    const d = parsed.data;
    const supabase = await getDb();

    const { error } = await supabase.from("product_target_prices").upsert({
      sku: d.sku,
      perakende_min: d.perakende_min,
      perakende_standart: d.perakende_standart,
      toptan_min: d.toptan_min,
      toptan_standart: d.toptan_standart,
      perakende_min_kdv: Math.round(d.perakende_min * 1.1 * 100) / 100,
      perakende_standart_kdv: Math.round(d.perakende_standart * 1.1 * 100) / 100,
      toptan_min_kdv: Math.round(d.toptan_min * 1.1 * 100) / 100,
      toptan_standart_kdv: Math.round(d.toptan_standart * 1.1 * 100) / 100,
      aktif: d.aktif ?? true,
    }, { onConflict: "sku" });

    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama/hedef-fiyatlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteTargetPrice(sku: string): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    const { error } = await supabase.from("product_target_prices").delete().eq("sku", sku);
    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama/hedef-fiyatlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function bulkUpsertTargetPrices(
  rows: Array<{
    sku: string;
    perakende_min: number;
    perakende_standart: number;
    toptan_min: number;
    toptan_standart: number;
  }>
): Promise<{ success: boolean; inserted: number; errors: string[] }> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    // Validate SKUs exist
    const { data: products } = await supabase.from("products").select("sku");
    const validSkus = new Set(products?.map((p: any) => p.sku) ?? []);

    const errors: string[] = [];
    const validRows = rows.filter(r => {
      if (!validSkus.has(r.sku)) {
        errors.push(`SKU bulunamadı: ${r.sku}`);
        return false;
      }
      return true;
    });

    if (validRows.length === 0) {
      return { success: false, inserted: 0, errors: errors.length > 0 ? errors : ["Geçerli satır bulunamadı"] };
    }

    const records = validRows.map(r => ({
      sku: r.sku,
      perakende_min: r.perakende_min,
      perakende_standart: r.perakende_standart,
      toptan_min: r.toptan_min,
      toptan_standart: r.toptan_standart,
      perakende_min_kdv: Math.round(r.perakende_min * 1.1 * 100) / 100,
      perakende_standart_kdv: Math.round(r.perakende_standart * 1.1 * 100) / 100,
      toptan_min_kdv: Math.round(r.toptan_min * 1.1 * 100) / 100,
      toptan_standart_kdv: Math.round(r.toptan_standart * 1.1 * 100) / 100,
      aktif: true,
    }));

    const { error } = await supabase.from("product_target_prices").upsert(records, { onConflict: "sku" });
    if (error) {
      return { success: false, inserted: 0, errors: [error.message] };
    }

    revalidatePath("/pazaryeri/fiyatlama/hedef-fiyatlar");
    return { success: true, inserted: validRows.length, errors };
  } catch (e) {
    return { success: false, inserted: 0, errors: [e instanceof Error ? e.message : "Bir hata oluştu"] };
  }
}

// =============================================
// Kutu Boyutları
// =============================================

export async function upsertBoxDimension(formData: {
  sku: string;
  en_cm: number;
  boy_cm: number;
  yukseklik_cm: number;
}): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const parsed = boxDimensionSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    const d = parsed.data;
    const desi = Math.ceil((d.en_cm * d.boy_cm * d.yukseklik_cm) / 3000);
    const supabase = await getDb();

    const { error } = await supabase.from("product_box_dimensions").upsert({
      sku: d.sku,
      en_cm: d.en_cm,
      boy_cm: d.boy_cm,
      yukseklik_cm: d.yukseklik_cm,
      desi,
    }, { onConflict: "sku" });

    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama/kutu-boyutlari");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteBoxDimension(sku: string): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    const { error } = await supabase.from("product_box_dimensions").delete().eq("sku", sku);
    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama/kutu-boyutlari");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function bulkUpsertBoxDimensions(
  rows: Array<{ sku: string; en_cm: number; boy_cm: number; yukseklik_cm: number }>
): Promise<{ success: boolean; inserted: number; errors: string[] }> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    const { data: products } = await supabase.from("products").select("sku");
    const validSkus = new Set(products?.map((p: any) => p.sku) ?? []);

    const errors: string[] = [];
    const validRows = rows.filter(r => {
      if (!validSkus.has(r.sku)) {
        errors.push(`SKU bulunamadı: ${r.sku}`);
        return false;
      }
      return true;
    });

    if (validRows.length === 0) {
      return { success: false, inserted: 0, errors: errors.length > 0 ? errors : ["Geçerli satır bulunamadı"] };
    }

    const records = validRows.map(r => ({
      sku: r.sku,
      en_cm: r.en_cm,
      boy_cm: r.boy_cm,
      yukseklik_cm: r.yukseklik_cm,
      desi: Math.ceil((r.en_cm * r.boy_cm * r.yukseklik_cm) / 3000),
    }));

    const { error } = await supabase.from("product_box_dimensions").upsert(records, { onConflict: "sku" });
    if (error) {
      return { success: false, inserted: 0, errors: [error.message] };
    }

    revalidatePath("/pazaryeri/fiyatlama/kutu-boyutlari");
    return { success: true, inserted: validRows.length, errors };
  } catch (e) {
    return { success: false, inserted: 0, errors: [e instanceof Error ? e.message : "Bir hata oluştu"] };
  }
}

// =============================================
// Kargo Yönetimi
// =============================================

export async function updateShippingProvider(
  id: string,
  formData: { name: string; desi_fiyatlari: Record<string, number>; aktif?: boolean }
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const parsed = shippingProviderSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    const supabase = await getDb();
    const { error } = await supabase
      .from("shipping_providers")
      .update({
        name: parsed.data.name,
        desi_fiyatlari: parsed.data.desi_fiyatlari,
        aktif: parsed.data.aktif ?? true,
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama/kargo");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updateMarketplaceShipping(
  marketplaceId: string,
  shippingProviderId: string
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    // Clear old default for this marketplace
    await supabase
      .from("marketplace_shipping")
      .update({ varsayilan: false })
      .eq("marketplace_id", marketplaceId);

    // Upsert new mapping
    const { error } = await supabase
      .from("marketplace_shipping")
      .upsert({
        marketplace_id: marketplaceId,
        shipping_provider_id: shippingProviderId,
        varsayilan: true,
      }, { onConflict: "marketplace_id,shipping_provider_id" });

    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama/kargo");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
