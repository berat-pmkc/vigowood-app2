"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type SkuMapping = Database["public"]["Tables"]["sku_mappings"]["Row"];
type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ---------- GET ----------

export async function getSkuMappings(filters?: {
  channel?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<{ data: SkuMapping[]; count: number }> {
  await requireAdmin();
  const supabase = await createClient();

  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 25;
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const sortBy = filters?.sortBy || "created_at";
  const ascending = filters?.sortOrder === "asc";

  let query = supabase
    .from("sku_mappings")
    .select("*", { count: "exact" });

  if (filters?.channel) {
    query = query.eq("channel", filters.channel);
  }

  if (filters?.status) {
    query = query.eq("match_status", filters.status);
  }

  if (filters?.search) {
    const s = `%${filters.search}%`;
    query = query.or(
      `master_sku.ilike.${s},channel_sku.ilike.${s},channel_barcode.ilike.${s},channel_product_name.ilike.${s},channel_product_code.ilike.${s}`
    );
  }

  query = query.order(sortBy, { ascending }).range(from, to);

  const { data, count, error } = await query;

  if (error) throw new Error(error.message);
  return { data: (data ?? []) as SkuMapping[], count: count ?? 0 };
}

export async function getSkuMappingStats() {
  await requireAdmin();
  const supabase = await createClient();

  // Toplam unique master_sku sayısı
  const { data: allMappings } = await supabase
    .from("sku_mappings")
    .select("master_sku, channel, match_status");

  const mappings = allMappings ?? [];
  const uniqueMasterSkus = new Set(mappings.map((m) => m.master_sku));

  const trendyolAll = mappings.filter((m) => m.channel === "trendyol");
  const trendyolMatched = trendyolAll.filter((m) => m.match_status === "matched");
  const trendyolUnmatched = trendyolAll.filter((m) => m.match_status === "unmatched");

  const ikasAll = mappings.filter((m) => m.channel === "ikas");
  const ikasMatched = ikasAll.filter((m) => m.match_status === "matched");
  const ikasUnmatched = ikasAll.filter((m) => m.match_status === "unmatched");

  const totalMatched = mappings.filter((m) => m.match_status === "matched").length;
  const totalUnmatched = mappings.filter((m) => m.match_status === "unmatched").length;

  return {
    totalMasterSku: uniqueMasterSkus.size,
    totalMatched,
    totalUnmatched,
    total: mappings.length,
    matchRate: mappings.length > 0 ? Math.round((totalMatched / mappings.length) * 100) : 0,
    channels: {
      trendyol: {
        total: trendyolAll.length,
        matched: trendyolMatched.length,
        unmatched: trendyolUnmatched.length,
      },
      ikas: {
        total: ikasAll.length,
        matched: ikasMatched.length,
        unmatched: ikasUnmatched.length,
      },
    },
  };
}

export type UnmatchedProduct = {
  id: string;
  source: "sku_mappings" | "trendyol_products";
  channel: string;
  channel_sku: string | null;
  channel_barcode: string | null;
  channel_product_name: string | null;
  channel_product_code: string | null;
  channel_product_id: string | null;
};

export async function getUnmatchedProducts(): Promise<UnmatchedProduct[]> {
  await requireAdmin();
  const supabase = await createClient();

  // a) sku_mappings'te match_status='unmatched' olanlar
  const { data: unmatchedMappings } = await supabase
    .from("sku_mappings")
    .select("id, channel, channel_sku, channel_barcode, channel_product_name, channel_product_code, channel_product_id")
    .eq("match_status", "unmatched");

  const fromMappings: UnmatchedProduct[] = (unmatchedMappings ?? []).map((m) => ({
    id: m.id,
    source: "sku_mappings" as const,
    channel: m.channel,
    channel_sku: m.channel_sku,
    channel_barcode: m.channel_barcode,
    channel_product_name: m.channel_product_name,
    channel_product_code: m.channel_product_code,
    channel_product_id: m.channel_product_id,
  }));

  // b) trendyol_products'ta olup sku_mappings'te channel='trendyol' kaydı olmayanlar
  const { data: allTrendyol } = await supabase
    .from("trendyol_products")
    .select("id, barcode, stock_code, product_main_id, title");

  const { data: mappedBarcodes } = await supabase
    .from("sku_mappings")
    .select("channel_barcode")
    .eq("channel", "trendyol");

  const mappedSet = new Set(
    (mappedBarcodes ?? []).map((m) => m.channel_barcode).filter(Boolean)
  );

  const missingFromTable: UnmatchedProduct[] = (allTrendyol ?? [])
    .filter((tp) => !mappedSet.has(tp.barcode))
    .map((tp) => ({
      id: tp.id,
      source: "trendyol_products" as const,
      channel: "trendyol",
      channel_sku: tp.stock_code,
      channel_barcode: tp.barcode,
      channel_product_name: tp.title,
      channel_product_code: tp.product_main_id,
      channel_product_id: tp.id,
    }));

  return [...fromMappings, ...missingFromTable];
}

export async function getProductsList(): Promise<
  { sku: string; urun_adi: string | null }[]
> {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("sku, urun_adi")
    .eq("aktif_mi", true)
    .order("sku");

  return (data ?? []) as { sku: string; urun_adi: string | null }[];
}

// ---------- MUTATE ----------

export async function createSkuMapping(formData: {
  master_sku: string;
  channel: string;
  channel_sku?: string;
  channel_barcode?: string;
  channel_product_code?: string;
  channel_product_name?: string;
  channel_product_id?: string;
  match_method?: string;
  match_status?: string;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    if (!formData.master_sku || !formData.channel) {
      return { success: false, error: "Master SKU ve kanal zorunludur" };
    }

    const { error } = await supabase.from("sku_mappings").insert({
      master_sku: formData.master_sku,
      channel: formData.channel,
      channel_sku: formData.channel_sku || null,
      channel_barcode: formData.channel_barcode || null,
      channel_product_code: formData.channel_product_code || null,
      channel_product_name: formData.channel_product_name || null,
      channel_product_id: formData.channel_product_id || null,
      match_method: formData.match_method || "manuel",
      match_status: formData.match_status || "matched",
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/sku-eslestirme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function updateSkuMapping(
  id: string,
  formData: {
    master_sku?: string;
    channel_sku?: string;
    channel_barcode?: string;
    channel_product_code?: string;
    channel_product_name?: string;
    match_method?: string;
    match_status?: string;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("sku_mappings")
      .update(formData)
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/sku-eslestirme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function deleteSkuMapping(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("sku_mappings")
      .delete()
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/sku-eslestirme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function manualMatch(
  mappingId: string,
  masterSku: string
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("sku_mappings")
      .update({
        master_sku: masterSku,
        match_status: "matched",
        match_method: "manuel",
      })
      .eq("id", mappingId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/sku-eslestirme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function manualMatchFromTrendyol(
  trendyolProductId: string,
  masterSku: string,
  barcode: string,
  stockCode: string | null,
  productMainId: string | null,
  title: string
): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase.from("sku_mappings").insert({
      master_sku: masterSku,
      channel: "trendyol",
      channel_sku: stockCode,
      channel_barcode: barcode,
      channel_product_code: productMainId,
      channel_product_name: title,
      channel_product_id: trendyolProductId,
      match_method: "manuel",
      match_status: "matched",
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/sku-eslestirme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function getRecentMappings(): Promise<SkuMapping[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("sku_mappings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(10);

  return (data ?? []) as SkuMapping[];
}
