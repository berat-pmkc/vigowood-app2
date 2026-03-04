"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tables not yet in generated types (pending db push + type regen)
import { MARKETPLACE_ACCESS_ROLES } from "@/lib/constants";
import {
  targetPriceSchema,
  shippingProviderSchema,
  shippingProviderCreateSchema,
  marketplaceCreateSchema,
} from "@/lib/validations";

type ActionResult = { success: true } | { success: false; error: string };

// Helper: cast supabase.from() for tables not yet in generated types
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
  hedef_fiyat: number;
  toptan_hedef_fiyat: number;
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
      hedef_fiyat: d.hedef_fiyat,
      toptan_hedef_fiyat: d.toptan_hedef_fiyat,
      hedef_fiyat_kdv: Math.round(d.hedef_fiyat * 1.1 * 100) / 100,
      toptan_hedef_fiyat_kdv: Math.round(d.toptan_hedef_fiyat * 1.1 * 100) / 100,
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
    hedef_fiyat: number;
    toptan_hedef_fiyat: number;
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
      hedef_fiyat: r.hedef_fiyat,
      toptan_hedef_fiyat: r.toptan_hedef_fiyat,
      hedef_fiyat_kdv: Math.round(r.hedef_fiyat * 1.1 * 100) / 100,
      toptan_hedef_fiyat_kdv: Math.round(r.toptan_hedef_fiyat * 1.1 * 100) / 100,
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

export async function createShippingProvider(formData: {
  name: string;
  code: string;
  desi_fiyatlari: Record<string, number>;
  aktif?: boolean;
}): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const parsed = shippingProviderCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    const supabase = await getDb();
    const d = parsed.data;

    // Insert shipping provider
    const { data: sp, error } = await supabase
      .from("shipping_providers")
      .insert({ name: d.name, code: d.code, desi_fiyatlari: d.desi_fiyatlari, aktif: d.aktif ?? true })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    // Auto-create marketplace_shipping entries for all active marketplaces (#13)
    const { data: mps } = await supabase.from("marketplaces").select("id").eq("aktif", true);
    if (mps && mps.length > 0 && sp) {
      const mappings = mps.map((m: any) => ({
        marketplace_id: m.id,
        shipping_provider_id: sp.id,
        varsayilan: false,
      }));
      await supabase.from("marketplace_shipping").insert(mappings);
    }

    revalidatePath("/pazaryeri/fiyatlama/kargo");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteShippingProvider(id: string): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    // Check if any listings reference this provider
    const { data: refs } = await supabase
      .from("marketplace_listings")
      .select("id")
      .eq("shipping_provider_id", id)
      .limit(1);

    if (refs && refs.length > 0) {
      return { success: false, error: "Bu kargo firması listing'lerde kullanılıyor, silinemez" };
    }

    const { error } = await supabase.from("shipping_providers").delete().eq("id", id);
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

// =============================================
// Pazaryeri CRUD
// =============================================

export async function createMarketplace(formData: {
  code: string;
  name: string;
  vergi_dahil: boolean;
  stopaj_orani: number;
  hedef_fiyat_tipi: string;
  sira?: number;
}): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const parsed = marketplaceCreateSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
    }

    const supabase = await getDb();
    const d = parsed.data;

    // Insert marketplace
    const { data: mp, error } = await supabase
      .from("marketplaces")
      .insert({
        code: d.code,
        name: d.name,
        vergi_dahil: d.vergi_dahil,
        stopaj_orani: d.stopaj_orani,
        hedef_fiyat_tipi: d.hedef_fiyat_tipi,
        sira: d.sira ?? 0,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    // Auto-create marketplace_shipping entries for all active shipping providers (#13)
    const { data: sps } = await supabase.from("shipping_providers").select("id").eq("aktif", true);
    if (sps && sps.length > 0 && mp) {
      const mappings = sps.map((sp: any) => ({
        marketplace_id: mp.id,
        shipping_provider_id: sp.id,
        varsayilan: false,
      }));
      await supabase.from("marketplace_shipping").insert(mappings);
    }

    revalidatePath("/pazaryeri/fiyatlama");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteMarketplace(id: string): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    // Check if any active listings exist
    const { data: refs } = await supabase
      .from("marketplace_listings")
      .select("id")
      .eq("marketplace_id", id)
      .eq("aktif", true)
      .limit(1);

    if (refs && refs.length > 0) {
      return { success: false, error: "Bu pazaryerinde aktif listing'ler var, önce bunları kaldırın" };
    }

    // CASCADE will delete marketplace_shipping entries
    const { error } = await supabase.from("marketplaces").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updateMarketplaceStopaj(
  marketplaceId: string,
  stopajOrani: number
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    const { error } = await supabase
      .from("marketplaces")
      .update({ stopaj_orani: stopajOrani })
      .eq("id", marketplaceId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama/panel");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// =============================================
// Listing CRUD
// =============================================

export async function createListing(formData: {
  marketplace_id: string;
  sku: string;
  listing_kodu: string;
  barkod?: string;
  urun_adi?: string;
}): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    const { error } = await supabase.from("marketplace_listings").insert({
      marketplace_id: formData.marketplace_id,
      sku: formData.sku,
      listing_kodu: formData.listing_kodu,
      barkod: formData.barkod || null,
      urun_adi: formData.urun_adi || null,
      satis_fiyati: 0,
      komisyon_orani: 0,
      reklam_orani: 0,
      kargo_maliyeti: 0,
      ham_fiyat: 0,
      hedef_fiyat_kullanilan: 0,
      kar_marji: 0,
      oneri_fiyat: 0,
      aktif: true,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama/panel");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deactivateListing(id: string): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    const { error } = await supabase
      .from("marketplace_listings")
      .update({ aktif: false })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama/panel");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function bulkUpdateReklamOrani(
  marketplaceId: string,
  reklamOrani: number
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    const { error } = await supabase
      .from("marketplace_listings")
      .update({ reklam_orani: reklamOrani })
      .eq("marketplace_id", marketplaceId)
      .eq("aktif", true);

    if (error) return { success: false, error: error.message };

    revalidatePath("/pazaryeri/fiyatlama/panel");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// =============================================
// Fiyatlama Paneli — Pazaryeri & Listing İşlemleri
// =============================================

export async function getMarketplaces() {
  await requireMarketplaceAccess();
  const supabase = await getDb();

  const { data, error } = await supabase
    .from("marketplaces")
    .select("*")
    .eq("aktif", true)
    .order("sira", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as import("@/types/pricing").Marketplace[];
}

export async function getListingsForMarketplace(marketplaceId: string) {
  await requireMarketplaceAccess();
  const supabase = await getDb();

  // 1. Get marketplace info (for stopaj_orani, hedef_fiyat_tipi)
  const { data: mp } = await supabase
    .from("marketplaces")
    .select("*")
    .eq("id", marketplaceId)
    .single();

  if (!mp) throw new Error("Pazaryeri bulunamadı");

  // 2. Get default shipping provider for this marketplace
  const { data: msData } = await supabase
    .from("marketplace_shipping")
    .select("shipping_provider_id")
    .eq("marketplace_id", marketplaceId)
    .eq("varsayilan", true)
    .single();

  let defaultProvider: import("@/types/pricing").ShippingProvider | null = null;
  if (msData?.shipping_provider_id) {
    const { data: sp } = await supabase
      .from("shipping_providers")
      .select("*")
      .eq("id", msData.shipping_provider_id)
      .single();
    defaultProvider = sp;
  }

  // 3. Get listings
  const { data: listings, error } = await supabase
    .from("marketplace_listings")
    .select("*")
    .eq("marketplace_id", marketplaceId)
    .eq("aktif", true)
    .order("listing_kodu", { ascending: true });

  if (error) throw new Error(error.message);

  const skus = (listings ?? []).map((l: any) => l.sku).filter(Boolean);

  // 4. Batch fetch target prices + desi from products for all SKUs
  let targetPrices: Record<string, any> = {};
  let productDesi: Record<string, number> = {};

  if (skus.length > 0) {
    const [tpResult, prodResult] = await Promise.all([
      supabase.from("product_target_prices").select("*").in("sku", skus),
      supabase.from("products").select("sku, desi").in("sku", skus),
    ]);
    for (const tp of tpResult.data ?? []) targetPrices[tp.sku] = tp;
    for (const p of prodResult.data ?? []) productDesi[p.sku] = Number(p.desi) || 0;
  }

  // 5. Enrich listings with joined data
  const enriched = (listings ?? []).map((listing: any) => {
    const tp = targetPrices[listing.sku] ?? null;

    // Determine which target price to use based on marketplace's hedef_fiyat_tipi
    const tipi = mp.hedef_fiyat_tipi ?? "perakende";
    const hedefFiyat = tp
      ? (tipi === "toptan" ? (tp.toptan_hedef_fiyat ?? 0) : (tp.hedef_fiyat ?? 0))
      : 0;

    return {
      ...listing,
      hedef_fiyat: hedefFiyat,
      desi: productDesi[listing.sku] ?? 0,
      stopaj_orani: mp.stopaj_orani ?? 0.01,
    };
  });

  return {
    marketplace: mp as import("@/types/pricing").Marketplace,
    listings: enriched,
    defaultProvider,
  };
}

export async function updateListings(
  updates: Array<{
    id: string;
    satis_fiyati?: number;
    komisyon_orani?: number;
    reklam_orani?: number;
    ham_fiyat?: number;
    kar_marji?: number;
    oneri_fiyat?: number;
    kargo_maliyeti?: number;
    hedef_fiyat_kullanilan?: number;
  }>
): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    // Update each listing individually (Supabase doesn't support batch update by different IDs)
    for (const u of updates) {
      const { id, ...fields } = u;
      const { error } = await supabase
        .from("marketplace_listings")
        .update(fields)
        .eq("id", id);
      if (error) return { success: false, error: `${id}: ${error.message}` };
    }

    revalidatePath("/pazaryeri/fiyatlama/panel");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// =============================================
// Snapshot Geçmişi & Karşılaştırma
// =============================================

export interface SnapshotPeriodSummary {
  donem_kodu: string;
  marketplace_count: number;
  listing_count: number;
  avg_kar_marji: number;
  created_at: string;
  created_by: string | null;
}

export async function getSnapshotPeriods(): Promise<SnapshotPeriodSummary[]> {
  await requireMarketplaceAccess();
  const supabase = await getDb();

  // Get all distinct periods with aggregated info
  const { data, error } = await supabase
    .from("pricing_snapshots")
    .select("donem_kodu, marketplace_id, kar_marji, created_at, created_by");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  // Group by donem_kodu
  const grouped: Record<string, { marketplaces: Set<string>; count: number; totalMarj: number; marjCount: number; created_at: string; created_by: string | null }> = {};

  for (const row of data) {
    const dk = row.donem_kodu;
    if (!grouped[dk]) {
      grouped[dk] = { marketplaces: new Set(), count: 0, totalMarj: 0, marjCount: 0, created_at: row.created_at, created_by: row.created_by };
    }
    grouped[dk].marketplaces.add(row.marketplace_id);
    grouped[dk].count++;
    if (row.kar_marji != null) {
      grouped[dk].totalMarj += Number(row.kar_marji);
      grouped[dk].marjCount++;
    }
    // Keep the latest created_at
    if (row.created_at > grouped[dk].created_at) {
      grouped[dk].created_at = row.created_at;
    }
  }

  return Object.entries(grouped)
    .map(([donem_kodu, g]) => ({
      donem_kodu,
      marketplace_count: g.marketplaces.size,
      listing_count: g.count,
      avg_kar_marji: g.marjCount > 0 ? g.totalMarj / g.marjCount : 0,
      created_at: g.created_at,
      created_by: g.created_by,
    }))
    .sort((a, b) => b.donem_kodu.localeCompare(a.donem_kodu));
}

export async function getSnapshotsByPeriod(donemKodu: string) {
  await requireMarketplaceAccess();
  const supabase = await getDb();

  // 1. Get snapshots for period
  const { data: snapshots, error } = await supabase
    .from("pricing_snapshots")
    .select("*")
    .eq("donem_kodu", donemKodu)
    .order("listing_kodu", { ascending: true });

  if (error) throw new Error(error.message);
  if (!snapshots || snapshots.length === 0) return { snapshots: [], marketplaces: [], currentListings: {} };

  // 2. Get marketplace info
  const mpIds = [...new Set(snapshots.map((s: any) => s.marketplace_id))];
  const { data: mps } = await supabase
    .from("marketplaces")
    .select("*")
    .in("id", mpIds)
    .order("sira", { ascending: true });

  // 3. Get current listings for comparison
  const skus = [...new Set(snapshots.map((s: any) => s.sku).filter(Boolean))];
  const currentListings: Record<string, any> = {};

  if (skus.length > 0) {
    for (const mpId of mpIds) {
      const { data: listings } = await supabase
        .from("marketplace_listings")
        .select("sku, satis_fiyati, komisyon_orani, ham_fiyat, kar_marji, kargo_maliyeti")
        .eq("marketplace_id", mpId)
        .in("sku", skus)
        .eq("aktif", true);

      for (const l of listings ?? []) {
        currentListings[`${mpId}:${l.sku}`] = l;
      }
    }
  }

  return {
    snapshots: snapshots as import("@/types/pricing").PricingSnapshot[],
    marketplaces: (mps ?? []) as import("@/types/pricing").Marketplace[],
    currentListings,
  };
}

export async function getCrossMarketplaceComparison() {
  await requireMarketplaceAccess();
  const supabase = await getDb();

  // 1. Get all active marketplaces
  const { data: mps } = await supabase
    .from("marketplaces")
    .select("*")
    .eq("aktif", true)
    .order("sira", { ascending: true });

  if (!mps || mps.length === 0) return { marketplaces: [], skuRows: [] };

  // 2. Get all active listings
  const { data: listings } = await supabase
    .from("marketplace_listings")
    .select("marketplace_id, sku, urun_adi, satis_fiyati, ham_fiyat, kar_marji, komisyon_orani, kargo_maliyeti")
    .eq("aktif", true);

  if (!listings || listings.length === 0) return { marketplaces: mps as import("@/types/pricing").Marketplace[], skuRows: [] };

  // 3. Group by SKU
  const skuMap: Record<string, { sku: string; urun_adi: string | null; byMarketplace: Record<string, { satis_fiyati: number; ham_fiyat: number; kar_marji: number; komisyon_orani: number; kargo_maliyeti: number }> }> = {};

  for (const l of listings) {
    if (!skuMap[l.sku]) {
      skuMap[l.sku] = { sku: l.sku, urun_adi: l.urun_adi, byMarketplace: {} };
    }
    skuMap[l.sku].byMarketplace[l.marketplace_id] = {
      satis_fiyati: Number(l.satis_fiyati) || 0,
      ham_fiyat: Number(l.ham_fiyat) || 0,
      kar_marji: Number(l.kar_marji) || 0,
      komisyon_orani: Number(l.komisyon_orani) || 0,
      kargo_maliyeti: Number(l.kargo_maliyeti) || 0,
    };
  }

  // Sort SKUs alphabetically
  const skuRows = Object.values(skuMap).sort((a, b) => a.sku.localeCompare(b.sku));

  return {
    marketplaces: mps as import("@/types/pricing").Marketplace[],
    skuRows,
  };
}

export async function deleteSnapshotPeriod(donemKodu: string): Promise<ActionResult> {
  try {
    await requireMarketplaceAccess();
    const supabase = await getDb();

    const { error } = await supabase
      .from("pricing_snapshots")
      .delete()
      .eq("donem_kodu", donemKodu);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function saveSnapshot(
  donemKodu: string,
  marketplaceId: string
): Promise<ActionResult> {
  try {
    const user = await requireMarketplaceAccess();
    const supabase = await getDb();

    // Get all active listings for this marketplace
    const { data: listings, error: fetchError } = await supabase
      .from("marketplace_listings")
      .select("*")
      .eq("marketplace_id", marketplaceId)
      .eq("aktif", true);

    if (fetchError) return { success: false, error: fetchError.message };
    if (!listings || listings.length === 0) {
      return { success: false, error: "Kayıt edilecek listing bulunamadı" };
    }

    const snapshots = listings.map((l: any) => ({
      donem_kodu: donemKodu,
      marketplace_id: marketplaceId,
      sku: l.sku,
      listing_kodu: l.listing_kodu,
      satis_fiyati: l.satis_fiyati,
      komisyon_orani: l.komisyon_orani,
      reklam_orani: l.reklam_orani,
      kargo_maliyeti: l.kargo_maliyeti,
      ham_fiyat: l.ham_fiyat,
      kar_marji: l.kar_marji,
      hedef_fiyat: l.hedef_fiyat_kullanilan,
      created_by: user.user_id,
    }));

    const { error } = await supabase.from("pricing_snapshots").insert(snapshots);
    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// =============================================
// Ürün listesi (hedef fiyatlar sayfası için)
// =============================================

export async function getAllProductsWithTargetPrices() {
  await requireMarketplaceAccess();
  const supabase = await getDb();

  const { data: products } = await supabase
    .from("products")
    .select("sku, urun_adi")
    .eq("aktif_mi", true)
    .order("sku");

  const { data: targetPrices } = await supabase
    .from("product_target_prices")
    .select("*")
    .order("sku");

  const tpMap: Record<string, any> = {};
  for (const tp of targetPrices ?? []) {
    tpMap[tp.sku] = tp;
  }

  return {
    products: (products ?? []) as Array<{ sku: string; urun_adi: string | null }>,
    targetPrices: tpMap,
  };
}
