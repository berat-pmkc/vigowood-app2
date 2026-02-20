"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { plakaUpdateSchema, plakaPartSchema } from "@/lib/validations";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

export async function updatePlaka(
  plakaларId: string,
  formData: {
    plaka_adi: string;
    tipi: string | null;
    renk: string | null;
    makine_id: string;
    std_kesim_suresi_dk: number | null;
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
        makine_id: parsed.data.makine_id,
        std_kesim_suresi_dk: parsed.data.std_kesim_suresi_dk,
        sku: parsed.data.sku,
      })
      .eq("plakalar_id", plakaларId);

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
