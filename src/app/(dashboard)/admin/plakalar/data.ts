import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TreeData, TreePlaka, TreePlakaPart, TreePart, TreeProduct } from "./components/tree-types";

const PAGE = 1000;

/** Supabase 1000 satır sınırını aşmak için sayfalı okuma. */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function loadTreeData(): Promise<TreeData> {
  const supabase = await createClient();

  const [products, plakalar, plakaParts, parts] = await Promise.all([
    fetchAll<TreeProduct>((a, b) =>
      supabase.from("products").select("sku, urun_adi, aktif_mi").order("sku").range(a, b)
    ),
    fetchAll<Record<string, unknown>>((a, b) =>
      supabase
        .from("plakalar")
        .select("plakalar_id, plaka_id, plaka_adi, tipi, renk, kesim_sureleri, sku, created_at")
        .eq("plaka_kategori", "MDF")
        .order("plakalar_id")
        .range(a, b)
    ),
    fetchAll<TreePlakaPart>((a, b) =>
      supabase
        .from("plaka_parts")
        .select("ppart_id, plaka_id, part_id, default_qty, sku")
        .order("part_id")
        .range(a, b)
    ),
    fetchAll<TreePart>((a, b) =>
      supabase
        .from("all_parts")
        .select(
          "part_id, part_adi, part_type, tur, mdf_tipi, mdf_renk, yari_mamul_stok, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok"
        )
        .order("part_id")
        .range(a, b)
    ),
  ]);

  const plakaRows: TreePlaka[] = plakalar.map((p) => ({
    plakalar_id: p.plakalar_id as string,
    plaka_id: p.plaka_id as string,
    plaka_adi: (p.plaka_adi as string) ?? "",
    tipi: (p.tipi as string | null) ?? null,
    renk: (p.renk as string | null) ?? null,
    kesim_sureleri: (p.kesim_sureleri ?? {}) as Record<string, number | null>,
    sku: Array.isArray(p.sku) ? (p.sku as string[]) : [],
    created_at: (p.created_at as string) ?? "",
  }));

  return { products, plakalar: plakaRows, plakaParts, parts };
}
