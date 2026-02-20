"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { kutuSessionCreateSchema } from "@/lib/validations";
import { PRODUCTION_ACCESS_ROLES } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

async function requireProductionAccess() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── READ ACTIONS ───────────────────────────────────────────────

/** Aktif KUTU ve KARTON parçaları getir */
export async function getActiveKutuParts() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: parts, error } = await supabase
      .from("all_parts")
      .select("part_id, part_adi, part_type, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok")
      .in("part_type", ["KUTU", "KARTON"])
      .order("part_adi");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: parts ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── MUTATION ACTIONS ───────────────────────────────────────────

/** Yeni kutu üretim seansı oluştur */
export async function createKutuSession(formData: {
  part_id: string;
  qty: number;
  not_text: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireProductionAccess();

    const parsed = kutuSessionCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Operatör bilgisi
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = authUser?.user_metadata?.selected_operator_id ?? user.user_id;
    const operatorName = authUser?.user_metadata?.selected_operator_name ?? user.full_name;
    const email = authUser?.email ?? user.email;

    // Parça bilgisi
    const { data: partData } = await supabase
      .from("all_parts")
      .select("part_adi, part_type")
      .eq("part_id", parsed.data.part_id)
      .single();

    const part = partData as { part_adi: string; part_type: string } | null;
    if (!part) return { success: false, error: "Parça bulunamadı" };

    // Generate session_id: KUT-YYYYMMDD-HHMMSS format
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let sessionId = `KUT-${datePart}-${timePart}`;

    // Check uniqueness
    const { data: existing } = await supabase
      .from("kutu_uretim")
      .select("session_id")
      .eq("session_id", sessionId)
      .limit(1);

    if (existing && existing.length > 0) {
      sessionId = `${sessionId}-${pad(now.getMilliseconds())}`;
    }

    // INSERT
    const { error } = await supabase.from("kutu_uretim").insert({
      session_id: sessionId,
      email: email,
      tarih: now.toISOString(),
      part_id: parsed.data.part_id,
      part_adi: part.part_adi,
      part_type: part.part_type,
      qty: parsed.data.qty,
      not_text: parsed.data.not_text,
      durum: "bekliyor",
      operator_id: operatorId,
      operator_name: operatorName,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/kutu");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Kutu üretimi başlat: bekliyor → uretimde */
export async function startKutu(sessionId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("kutu_uretim")
      .select("durum")
      .eq("session_id", sessionId)
      .single();

    const session = data as { durum: string } | null;
    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "bekliyor") return { success: false, error: "Bu seans zaten başlatılmış" };

    const { error } = await supabase
      .from("kutu_uretim")
      .update({
        durum: "uretimde",
        start_time: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/kutu");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Kutu üretimi tamamla: uretimde → tamamlandi + hazir_eleman_aktif_stok += qty */
export async function completeKutu(sessionId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    // Seans bilgileri
    const { data } = await supabase
      .from("kutu_uretim")
      .select("session_id, durum, part_id, qty")
      .eq("session_id", sessionId)
      .single();

    const session = data as {
      session_id: string;
      durum: string;
      part_id: string | null;
      qty: number;
    } | null;

    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum === "tamamlandi") {
      // Idempotent: zaten tamamlandıysa skip
      revalidatePath("/uretim/kutu");
      return { success: true };
    }
    if (session.durum !== "uretimde") return { success: false, error: "Seans aktif değil" };

    const now = new Date().toISOString();

    // Update durum
    const { error: updateError } = await supabase
      .from("kutu_uretim")
      .update({
        durum: "tamamlandi",
        bitis_zamani: now,
      })
      .eq("session_id", sessionId);

    if (updateError) return { success: false, error: updateError.message };

    // Parça stok güncelleme: hazir_eleman_aktif_stok += qty
    if (session.part_id) {
      // Mevcut stoku oku
      const { data: partData } = await supabase
        .from("all_parts")
        .select("hazir_eleman_aktif_stok")
        .eq("part_id", session.part_id)
        .single();

      const currentStock = (partData as { hazir_eleman_aktif_stok: number } | null)?.hazir_eleman_aktif_stok ?? 0;

      const { error: stockError } = await supabase
        .from("all_parts")
        .update({
          hazir_eleman_aktif_stok: currentStock + session.qty,
        })
        .eq("part_id", session.part_id);

      if (stockError) return { success: false, error: stockError.message };
    }

    revalidatePath("/uretim/kutu");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Kutu üretimi iptal et: uretimde → bekliyor */
export async function cancelKutu(sessionId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("kutu_uretim")
      .select("durum")
      .eq("session_id", sessionId)
      .single();

    const session = data as { durum: string } | null;
    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "uretimde") return { success: false, error: "Sadece üretimde durumundaki seans iptal edilebilir" };

    const { error } = await supabase
      .from("kutu_uretim")
      .update({
        durum: "bekliyor",
        start_time: null,
      })
      .eq("session_id", sessionId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/kutu");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
