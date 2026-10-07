"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { plakaUpdateSchema, plakaCreateSchema, plakaPartSchema } from "@/lib/validations";
import type { Database } from "@/lib/supabase/types";

type ActionResult = { success: true } | { success: false; error: string };
type Plaka = Database["public"]["Tables"]["plakalar"]["Row"];

/** Admin ağacı + tablet kesim ekranı (parça/plaka değişiklikleri orada da görünsün) */
function revalidateAll() {
  revalidatePath("/admin/plakalar");
  revalidatePath("/admin/parcalar");
  revalidatePath("/uretim/kesim");
  revalidatePath("/uretim/kesim/ihtiyac");
  revalidateTag("parts", "default");
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

/** Clean kesim_sureleri: remove null/undefined entries */
function cleanKesimSureleri(ks: Record<string, number | null | undefined> | undefined): Record<string, number> {
  const clean: Record<string, number> = {};
  if (ks) {
    for (const [key, val] of Object.entries(ks)) {
      if (val != null) clean[key] = val;
    }
  }
  return clean;
}

/** Aktif ürünleri getir (SKU dropdown için) */
export async function getProductsForSelect(): Promise<
  | { success: true; data: { sku: string; urun_adi: string | null }[] }
  | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select("sku, urun_adi")
      .eq("aktif_mi", true)
      .order("urun_adi");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as { sku: string; urun_adi: string | null }[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Mevcut tip ve renk değerlerini getir (dropdown seçenekleri için) */
export async function getDistinctPlakaValues(kategori: "MDF" | "KARTON"): Promise<
  | { success: true; data: { types: string[]; colors: string[] } }
  | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("plakalar")
      .select("tipi, renk")
      .eq("plaka_kategori", kategori);

    if (error) return { success: false, error: error.message };

    const types = [...new Set((data ?? []).map((r) => r.tipi).filter(Boolean))] as string[];
    const colors = [...new Set((data ?? []).map((r) => r.renk).filter(Boolean))] as string[];

    return { success: true, data: { types: types.sort(), colors: colors.sort() } };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function createPlaka(
  formData: {
    plaka_id: string;
    plaka_adi: string;
    tipi: string | null;
    renk: string | null;
    kesim_sureleri: Record<string, number | null | undefined>;
    sku: string[] | null;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = plakaCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Generate next plakalar_id (PL-0001 format) — atomic via next_id RPC
    const { data: plakalarId, error: idError } = await supabase.rpc("next_id", {
      p_prefix: "PL-",
      p_width: 4,
    });
    if (idError || !plakalarId) {
      return { success: false, error: "ID üretilemedi" };
    }

    const { error } = await supabase.from("plakalar").insert({
      plakalar_id: plakalarId,
      plaka_id: parsed.data.plaka_id,
      plaka_adi: parsed.data.plaka_adi,
      tipi: parsed.data.tipi,
      renk: parsed.data.renk,
      kesim_sureleri: cleanKesimSureleri(parsed.data.kesim_sureleri),
      sku: parsed.data.sku,
      plaka_kategori: "MDF",
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateAll();
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function updatePlaka(
  plakalarId: string,
  formData: {
    plaka_adi: string;
    tipi: string | null;
    renk: string | null;
    kesim_sureleri: Record<string, number | null | undefined>;
    sku: string[] | null;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = plakaUpdateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("plakalar")
      .update({
        plaka_adi: parsed.data.plaka_adi,
        tipi: parsed.data.tipi,
        renk: parsed.data.renk,
        kesim_sureleri: cleanKesimSureleri(parsed.data.kesim_sureleri),
        sku: parsed.data.sku,
      })
      .eq("plakalar_id", plakalarId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateAll();
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function getPlakaParts(
  plakaId: string
): Promise<
  | { success: true; data: { ppart_id: string; part_id: string; part_adi: string; default_qty: number | null }[] }
  | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Get plaka_parts for this plaka_id, then join part names
    const { data: parts, error } = await supabase
      .from("plaka_parts")
      .select("ppart_id, plaka_id, part_id, default_qty")
      .eq("plaka_id", plakaId)
      .order("part_id");

    if (error) {
      return { success: false, error: error.message };
    }

    if (!parts || parts.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch part names
    const partIds = parts.map((p) => p.part_id);
    const { data: allParts } = await supabase
      .from("all_parts")
      .select("part_id, part_adi")
      .in("part_id", partIds);

    const partNameMap = new Map(
      (allParts ?? []).map((p) => [p.part_id, p.part_adi])
    );

    const result = parts.map((p) => ({
      ppart_id: p.ppart_id,
      part_id: p.part_id,
      part_adi: partNameMap.get(p.part_id) || "—",
      default_qty: p.default_qty,
    }));

    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function updatePlakaPart(
  ppartId: string,
  formData: { part_id: string; default_qty: number | null }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = plakaPartSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("plaka_parts")
      .update({
        part_id: parsed.data.part_id,
        default_qty: parsed.data.default_qty,
      })
      .eq("ppart_id", ppartId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateAll();
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function addPlakaPart(
  plakaId: string,
  sku: string | null,
  formData: { part_id: string; default_qty: number | null }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = plakaPartSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Generate next ppart_id — atomic via next_id RPC
    const { data: ppartId, error: idError } = await supabase.rpc("next_id", {
      p_prefix: "PPart",
      p_width: 4,
    });
    if (idError || !ppartId) {
      return { success: false, error: "ID üretilemedi" };
    }

    const { error } = await supabase.from("plaka_parts").insert({
      ppart_id: ppartId,
      plaka_id: plakaId,
      part_id: parsed.data.part_id,
      default_qty: parsed.data.default_qty,
      sku: sku,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateAll();
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function deletePlakaPart(
  ppartId: string
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const supabase = await createClient();
    const { error } = await supabase
      .from("plaka_parts")
      .delete()
      .eq("ppart_id", ppartId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateAll();
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

export async function deletePlaka(plakalarId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Get plaka_id for this plakalar_id
    const { data: plaka } = await supabase
      .from("plakalar")
      .select("plaka_id")
      .eq("plakalar_id", plakalarId)
      .single();

    if (!plaka) {
      return { success: false, error: "Plaka bulunamadı" };
    }

    // Check cut_batches references
    const { data: cutRefs } = await supabase
      .from("cut_batches")
      .select("batch_id")
      .eq("plaka_id", plaka.plaka_id)
      .limit(1);

    if (cutRefs && cutRefs.length > 0) {
      return {
        success: false,
        error: "Bu plaka üretimde kullanılmış, silinemez",
      };
    }

    // Delete plaka_parts for this plaka_id
    await supabase
      .from("plaka_parts")
      .delete()
      .eq("plaka_id", plaka.plaka_id);

    // Delete the plaka
    const { error } = await supabase
      .from("plakalar")
      .delete()
      .eq("plakalar_id", plakalarId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidateAll();
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

/** Export helper: flatten kesim_sureleri into separate columns (MDF only) */
interface ExportPlaka extends Omit<Plaka, "kesim_sureleri" | "sku"> {
  sku: string | null;
  mak1_dk: number | null;
  mak2_dk: number | null;
  mak3_dk: number | null;
}

export async function exportPlakalar(): Promise<
  { success: true; data: ExportPlaka[] } | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plakalar")
      .select("*")
      .eq("plaka_kategori", "MDF")
      .order("plakalar_id");

    if (error) return { success: false, error: error.message };

    const exportData = ((data ?? []) as Plaka[]).map((p) => {
      const ks = (p.kesim_sureleri ?? {}) as Record<string, number>;
      const { kesim_sureleri: _ks, sku: skuArr, ...rest } = p;
      return {
        ...rest,
        sku: skuArr ? skuArr.join(", ") : null,
        mak1_dk: ks["MAK-1"] ?? null,
        mak2_dk: ks["MAK-2"] ?? null,
        mak3_dk: ks["MAK-3"] ?? null,
      };
    });

    return { success: true, data: exportData };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export async function importPlakalar(
  rows: {
    plakalar_id?: string;
    plaka_id: string;
    plaka_adi: string;
    tipi?: string;
    renk?: string;
    mak1_dk?: string;
    mak2_dk?: string;
    mak3_dk?: string;
    sku?: string;
  }[]
): Promise<ActionResult & { count?: number }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    let count = 0;
    for (const row of rows) {
      if (!row.plaka_id || !row.plaka_adi) continue;

      // Build kesim_sureleri from 3 MDF columns
      const kesimSureleri: Record<string, number> = {};
      if (row.mak1_dk) {
        const v = parseInt(row.mak1_dk, 10);
        if (!isNaN(v)) kesimSureleri["MAK-1"] = v;
      }
      if (row.mak2_dk) {
        const v = parseInt(row.mak2_dk, 10);
        if (!isNaN(v)) kesimSureleri["MAK-2"] = v;
      }
      if (row.mak3_dk) {
        const v = parseInt(row.mak3_dk, 10);
        if (!isNaN(v)) kesimSureleri["MAK-3"] = v;
      }

      // Parse SKU: comma-separated string → array
      const skuArray = row.sku
        ? row.sku.split(",").map((s) => s.trim()).filter(Boolean)
        : null;

      if (row.plakalar_id) {
        const { error } = await supabase
          .from("plakalar")
          .upsert(
            {
              plakalar_id: row.plakalar_id,
              plaka_id: row.plaka_id,
              plaka_adi: row.plaka_adi,
              tipi: row.tipi || null,
              renk: row.renk || null,
              kesim_sureleri: kesimSureleri,
              sku: skuArray && skuArray.length > 0 ? skuArray : null,
              plaka_kategori: "MDF",
            },
            { onConflict: "plakalar_id" }
          );

        if (error) {
          return { success: false, error: `Satır ${row.plakalar_id}: ${error.message}` };
        }
      } else {
        // Generate next plakalar_id — atomic via next_id RPC
        const { data: plakalarId, error: idError } = await supabase.rpc("next_id", {
          p_prefix: "PL-",
          p_width: 4,
        });
        if (idError || !plakalarId) {
          return { success: false, error: "ID üretilemedi" };
        }

        const { error } = await supabase.from("plakalar").insert({
          plakalar_id: plakalarId,
          plaka_id: row.plaka_id,
          plaka_adi: row.plaka_adi,
          tipi: row.tipi || null,
          renk: row.renk || null,
          kesim_sureleri: kesimSureleri,
          sku: skuArray && skuArray.length > 0 ? skuArray : null,
          plaka_kategori: "MDF",
        });

        if (error) {
          return { success: false, error: `Yeni plaka: ${error.message}` };
        }
      }
      count++;
    }

    revalidateAll();
    return { success: true, count };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Tüm parçaları getir (parça seçici combobox için) */
export async function getAllPartsForSelect(): Promise<
  | { success: true; data: { part_id: string; part_adi: string }[] }
  | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("all_parts")
      .select("part_id, part_adi")
      .order("part_id");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as { part_id: string; part_adi: string }[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Tüm plakaları getir (plaka seçici için — pagination yok) */
export async function getAllPlakalar(): Promise<
  | { success: true; data: { plaka_id: string; plaka_adi: string; sku: string[] | null }[] }
  | { success: false; error: string }
> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("plakalar")
      .select("plaka_id, plaka_adi, sku")
      .order("plaka_id");

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as { plaka_id: string; plaka_adi: string; sku: string[] | null }[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── Ağaç görünümü: yeni / düzenle / sil ──────────────────────

type PartTypeValue = "YARIMAMUL" | "HAZIR" | "KUTU" | "KARTON";

/** Otomatik parça kodu önizlemesi (kaydetmeden önce dialogda gösterilir). */
export async function previewPartCode(
  prefix: string
): Promise<{ success: true; code: string } | { success: false; error: string }> {
  try {
    await requireAdmin();
    const p = prefix.trim();
    if (!p) return { success: false, error: "Önek boş" };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("next_part_code" as never, { p_prefix: p } as never);
    if (error || !data) return { success: false, error: error?.message ?? "Kod üretilemedi" };
    return { success: true, code: data as unknown as string };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Yeni parça: kod SQL tarafında (advisory lock altında) üretilir; plaka verilirse plakaya bağlanır. */
export async function addNewPart(input: {
  sku: string | null;
  plaka_id: string | null;
  part_adi: string;
  part_type: PartTypeValue;
  default_qty: number | null;
  prefix: string | null;
  tur: string | null;
  mdf_tipi: string | null;
  mdf_renk: string | null;
  kritik: number;
}): Promise<{ success: true; part_id: string } | { success: false; error: string }> {
  try {
    await requireAdmin();
    if (!input.part_adi.trim()) return { success: false, error: "Parça adı gereklidir" };
    if (!input.sku && !input.prefix?.trim()) {
      return { success: false, error: "Ürün (SKU) veya kod öneki gereklidir" };
    }
    if (input.default_qty != null && input.default_qty < 0) {
      return { success: false, error: "Miktar 0 veya üzeri olmalıdır" };
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "admin_parca_ekle" as never,
      {
        p_sku: input.sku,
        p_plaka_id: input.plaka_id,
        p_part_adi: input.part_adi.trim(),
        p_part_type: input.part_type,
        p_default_qty: input.default_qty,
        p_prefix: input.prefix?.trim() || null,
        p_tur: input.tur,
        p_mdf_tipi: input.mdf_tipi,
        p_mdf_renk: input.mdf_renk,
        p_kritik: Math.max(0, Math.round(input.kritik || 0)),
      } as never
    );
    if (error || !data) return { success: false, error: error?.message ?? "Parça eklenemedi" };
    revalidateAll();
    return { success: true, part_id: data as unknown as string };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Parça bilgilerini düzenle (kod değişmez). */
export async function updatePartInfo(
  partId: string,
  input: {
    part_adi: string;
    part_type: PartTypeValue;
    tur: string | null;
    mdf_tipi: string | null;
    mdf_renk: string | null;
    kritik: number;
  }
): Promise<ActionResult> {
  try {
    await requireAdmin();
    if (!input.part_adi.trim()) return { success: false, error: "Parça adı gereklidir" };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("all_parts")
      .update({
        part_adi: input.part_adi.trim(),
        part_type: input.part_type,
        tur: input.tur,
        mdf_tipi: input.mdf_tipi,
        mdf_renk: input.mdf_renk,
        hazir_eleman_kritik_stok: Math.max(0, Math.round(input.kritik || 0)),
      })
      .eq("part_id", partId)
      .select("part_id");
    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: "Güncellenemedi (yetki veya kayıt yok)" };
    revalidateAll();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Parçayı tamamen sil: plaka bağlantıları dahil. Reçete/kesim/stok hareketi varsa reddeder. */
export async function deletePartEverywhere(partId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const [bom, cut, stok] = await Promise.all([
      supabase.from("step_bom").select("step_bom_id").eq("part_id", partId).limit(1),
      supabase.from("cut_lines").select("cut_line_id").eq("part_id", partId).limit(1),
      supabase.from("yari_mamul_stok").select("part_id").eq("part_id", partId).limit(1),
    ]);
    if (bom.data && bom.data.length > 0) {
      return { success: false, error: "Bu parça bir montaj reçetesinde (BOM) kullanılıyor, silinemez" };
    }
    if (cut.data && cut.data.length > 0) {
      return { success: false, error: "Bu parça kesim kayıtlarında kullanılmış, silinemez" };
    }
    if (stok.data && stok.data.length > 0) {
      return { success: false, error: "Bu parçanın stok hareketi var, silinemez" };
    }

    await supabase.from("plaka_parts").delete().eq("part_id", partId);
    const { data, error } = await supabase
      .from("all_parts")
      .delete()
      .eq("part_id", partId)
      .select("part_id");
    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: "Silinemedi (yetki veya kayıt yok)" };

    revalidateAll();
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
