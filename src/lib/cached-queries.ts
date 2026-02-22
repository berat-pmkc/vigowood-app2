/**
 * Cached reference data queries using unstable_cache + admin client.
 *
 * Why admin client? unstable_cache callbacks run outside the request
 * context — cookies() is unavailable. Admin client (service_role)
 * bypasses RLS but we only cache data visible to all authenticated users.
 *
 * Invalidation: call revalidateTag("tag-name") in server actions
 * when the corresponding data is mutated.
 */
import "server-only";

import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type ProductCategory = Database["public"]["Enums"]["product_category"];
type PartType = Database["public"]["Enums"]["part_type"];

// ─── Machines (1 hour cache) ────────────────────────────────

export const getCachedMachines = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("kesim_makinesi")
      .select("*")
      .order("bolum")
      .order("makine_id");
    return data ?? [];
  },
  ["machines"],
  { revalidate: 3600, tags: ["machines"] }
);

// ─── Active products for dropdowns (2 min cache) ───────────

export const getCachedActiveProducts = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("sku, urun_adi, kategori")
      .eq("aktif_mi", true)
      .order("sku");
    return data ?? [];
  },
  ["active-products"],
  { revalidate: 120, tags: ["products"] }
);

// ─── All parts for BOM combobox (2 min cache) ──────────────

export const getCachedAllParts = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("all_parts")
      .select("part_id, part_adi, part_type")
      .order("part_id");
    return data ?? [];
  },
  ["all-parts"],
  { revalidate: 120, tags: ["parts"] }
);

// ─── Companies (5 min cache) ───────────────────────────────

export const getCachedFirmalar = unstable_cache(
  async () => {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("sevkiyat_firmalar")
      .select("*")
      .order("firma_tipi")
      .order("profil_adi");
    return data ?? [];
  },
  ["firmalar"],
  { revalidate: 300, tags: ["firmalar"] }
);

// ─── Paginated products (30s cache, keyed by params) ───────

export const getCachedProductsPage = unstable_cache(
  async (params: {
    search: string;
    kategori: string;
    aktif: string;
    sortColumn: string;
    sortOrder: boolean;
    from: number;
    to: number;
  }) => {
    const supabase = createAdminClient();
    let q = supabase.from("products").select("*", { count: "exact" });
    if (params.search) q = q.or(`sku.ilike.%${params.search}%,urun_adi.ilike.%${params.search}%`);
    if (params.kategori) q = q.eq("kategori", params.kategori as ProductCategory);
    if (params.aktif === "true") q = q.eq("aktif_mi", true);
    else if (params.aktif === "false") q = q.eq("aktif_mi", false);
    const { data, count } = await q
      .order(params.sortColumn, { ascending: params.sortOrder })
      .range(params.from, params.to);
    return { data: data ?? [], count: count ?? 0 };
  },
  ["products-page"],
  { revalidate: 30, tags: ["products"] }
);

// ─── Paginated parts (30s cache, keyed by params) ──────────

export const getCachedPartsPage = unstable_cache(
  async (params: {
    search: string;
    tip: string;
    sortColumn: string;
    sortOrder: boolean;
    from: number;
    to: number;
  }) => {
    const supabase = createAdminClient();
    let q = supabase.from("all_parts").select("*", { count: "exact" });
    if (params.search) q = q.or(`part_id.ilike.%${params.search}%,part_adi.ilike.%${params.search}%`);
    if (params.tip) q = q.eq("part_type", params.tip as PartType);
    const { data, count } = await q
      .order(params.sortColumn, { ascending: params.sortOrder })
      .range(params.from, params.to);
    return { data: data ?? [], count: count ?? 0 };
  },
  ["parts-page"],
  { revalidate: 30, tags: ["parts"] }
);
