"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { plakaUpdateSchema, plakaCreateSchema, plakaPartSchema } from "@/lib/validations";
import type { Database } from "@/lib/supabase/types";

type ActionResult = { success: true } | { success: false; error: string };
type Plaka = Database["public"]["Tables"]["plakalar"]["Row"];

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

export async function createPlaka(
  formData: {
    plaka_id: string;
    plaka_adi: string;
    tipi: string | null;
    renk: string | null;
    kesim_sureleri: Record<string, number | null | undefined>;
    sku: string | null;
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

    // Generate next plakalar_id (PL-0001 format)
    const { data: lastPlaka } = await supabase
      .from("plakalar")
      .select("plakalar_id")
      .like("plakalar_id", "PL-%")
      .order("plakalar_id", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastPlaka && lastPlaka.length > 0) {
      const match = lastPlaka[0].plakalar_id.match(/PL-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const plakalarId = `PL-${String(nextNum).padStart(4, "0")}`;

    const { error } = await supabase.from("plakalar").insert({
      plakalar_id: plakalarId,
      plaka_id: parsed.data.plaka_id,
      plaka_adi: parsed.data.plaka_adi,
      tipi: parsed.data.tipi,
      renk: parsed.data.renk,
      kesim_sureleri: cleanKesimSureleri(parsed.data.kesim_sureleri),
      sku: parsed.data.sku,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/plakalar");
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
    sku: string | null;
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

    revalidatePath("/admin/plakalar");
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

    revalidatePath("/admin/plakalar");
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

    // Generate next ppart_id
    const { data: lastPpart } = await supabase
      .from("plaka_parts")
      .select("ppart_id")
      .order("ppart_id", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastPpart && lastPpart.length > 0) {
      const match = lastPpart[0].ppart_id.match(/PPart(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const ppartId = `PPart${String(nextNum).padStart(4, "0")}`;

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

    revalidatePath("/admin/plakalar");
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

    revalidatePath("/admin/plakalar");
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

    revalidatePath("/admin/plakalar");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Bir hata oluştu",
    };
  }
}

/** Export helper: flatten kesim_sureleri into separate columns */
interface ExportPlaka extends Omit<Plaka, "kesim_sureleri"> {
  buyuk_dk: number | null;
  kucuk_dk: number | null;
  kutu_dk: number | null;
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
      .order("plakalar_id");

    if (error) return { success: false, error: error.message };

    const exportData = ((data ?? []) as Plaka[]).map((p) => {
      const ks = (p.kesim_sureleri ?? {}) as Record<string, number>;
      const { kesim_sureleri: _ks, ...rest } = p;
      return {
        ...rest,
        buyuk_dk: ks["BÜYÜK"] ?? null,
        kucuk_dk: ks["KÜÇÜK"] ?? null,
        kutu_dk: ks["KUTU"] ?? null,
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
    buyuk_dk?: string;
    kucuk_dk?: string;
    kutu_dk?: string;
    sku?: string;
  }[]
): Promise<ActionResult & { count?: number }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    let count = 0;
    for (const row of rows) {
      if (!row.plaka_id || !row.plaka_adi) continue;

      // Build kesim_sureleri from 3 columns
      const kesimSureleri: Record<string, number> = {};
      if (row.buyuk_dk) {
        const v = parseInt(row.buyuk_dk, 10);
        if (!isNaN(v)) kesimSureleri["BÜYÜK"] = v;
      }
      if (row.kucuk_dk) {
        const v = parseInt(row.kucuk_dk, 10);
        if (!isNaN(v)) kesimSureleri["KÜÇÜK"] = v;
      }
      if (row.kutu_dk) {
        const v = parseInt(row.kutu_dk, 10);
        if (!isNaN(v)) kesimSureleri["KUTU"] = v;
      }

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
              sku: row.sku || null,
            },
            { onConflict: "plakalar_id" }
          );

        if (error) {
          return { success: false, error: `Satır ${row.plakalar_id}: ${error.message}` };
        }
      } else {
        const { data: lastPlaka } = await supabase
          .from("plakalar")
          .select("plakalar_id")
          .like("plakalar_id", "PL-%")
          .order("plakalar_id", { ascending: false })
          .limit(1);

        let nextNum = 1;
        if (lastPlaka && lastPlaka.length > 0) {
          const match = lastPlaka[0].plakalar_id.match(/PL-(\d+)/);
          if (match) nextNum = parseInt(match[1], 10) + 1;
        }
        const plakalarId = `PL-${String(nextNum).padStart(4, "0")}`;

        const { error } = await supabase.from("plakalar").insert({
          plakalar_id: plakalarId,
          plaka_id: row.plaka_id,
          plaka_adi: row.plaka_adi,
          tipi: row.tipi || null,
          renk: row.renk || null,
          kesim_sureleri: kesimSureleri,
          sku: row.sku || null,
        });

        if (error) {
          return { success: false, error: `Yeni plaka: ${error.message}` };
        }
      }
      count++;
    }

    revalidatePath("/admin/plakalar");
    return { success: true, count };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Tüm plakaları getir (plaka seçici için — pagination yok) */
export async function getAllPlakalar(): Promise<
  | { success: true; data: { plaka_id: string; plaka_adi: string; sku: string | null }[] }
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
    return { success: true, data: (data ?? []) as { plaka_id: string; plaka_adi: string; sku: string | null }[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
