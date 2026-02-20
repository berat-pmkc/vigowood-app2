"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hazirElemanGirisSchema } from "@/lib/validations";
import { STOCK_ACCESS_ROLES } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

async function requireStockAccess() {
  const user = await getCurrentUser();
  if (!user || !STOCK_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── READ ACTIONS ───────────────────────────────────────────────

/** HAZIR, KUTU, KARTON parçaları getir (combobox için) */
export async function getHazirElemanParts() {
  try {
    await requireStockAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("all_parts")
      .select("part_id, part_adi, part_type, hazir_eleman_aktif_stok")
      .in("part_type", ["HAZIR", "KUTU", "KARTON"])
      .order("part_adi");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── MUTATION ACTIONS ───────────────────────────────────────────

/** Hazır eleman stok girişi */
export async function addHazirElemanStok(formData: {
  part_id: string;
  qty: number;
  not_text: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireStockAccess();

    const parsed = hazirElemanGirisSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Operatör bilgisi
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = authUser?.user_metadata?.selected_operator_id ?? user.user_id;

    // Parça kontrolü
    const { data: partData } = await supabase
      .from("all_parts")
      .select("part_id, hazir_eleman_aktif_stok")
      .eq("part_id", parsed.data.part_id)
      .single();

    const part = partData as { part_id: string; hazir_eleman_aktif_stok: number } | null;
    if (!part) return { success: false, error: "Parça bulunamadı" };

    // Generate hakis_id: HA-YYYYMMDD-HHMMSS
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let hakisId = `HA-${datePart}-${timePart}`;

    // Uniqueness check
    const { data: existing } = await supabase
      .from("hazir_eleman_akis")
      .select("hakis_id")
      .eq("hakis_id", hakisId)
      .limit(1);

    if (existing && existing.length > 0) {
      hakisId = `${hakisId}-${pad(now.getMilliseconds())}`;
    }

    // INSERT hazir_eleman_akis
    const { error: insertError } = await supabase.from("hazir_eleman_akis").insert({
      hakis_id: hakisId,
      tarih: now.toISOString(),
      part_id: parsed.data.part_id,
      qty: parsed.data.qty,
      operator: operatorId,
      not_text: parsed.data.not_text || null,
    });

    if (insertError) return { success: false, error: insertError.message };

    // UPDATE all_parts stok
    const newStok = (part.hazir_eleman_aktif_stok || 0) + parsed.data.qty;
    const { error: updateError } = await supabase
      .from("all_parts")
      .update({ hazir_eleman_aktif_stok: newStok })
      .eq("part_id", parsed.data.part_id);

    if (updateError) return { success: false, error: updateError.message };

    revalidatePath("/stok/hazir-eleman");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
