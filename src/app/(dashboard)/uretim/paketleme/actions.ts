"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { packSessionCreateSchema } from "@/lib/validations";
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

/** Aktif ürünleri getir (paketleme seçimi için) */
export async function getActiveProducts() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: products, error } = await supabase
      .from("products")
      .select("sku, urun_adi, kategori")
      .eq("aktif_mi", true)
      .order("urun_adi");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: products ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── MUTATION ACTIONS ───────────────────────────────────────────

/** Yeni paketleme seansı oluştur */
export async function createPackSession(formData: {
  sku: string;
  qty: number;
  not_text: string | null;
}): Promise<ActionResult> {
  try {
    const user = await requireProductionAccess();

    const parsed = packSessionCreateSchema.safeParse(formData);
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

    // Generate session_id: PKT-YYYYMMDD-HHMMSS format
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let sessionId = `PKT-${datePart}-${timePart}`;

    // Check uniqueness — if exists, add milliseconds
    const { data: existing } = await supabase
      .from("pack_events")
      .select("session_id")
      .eq("session_id", sessionId)
      .limit(1);

    if (existing && existing.length > 0) {
      sessionId = `${sessionId}-${pad(now.getMilliseconds())}`;
    }

    // INSERT
    const { error } = await supabase.from("pack_events").insert({
      session_id: sessionId,
      email: email,
      tarih: now.toISOString(),
      sku: parsed.data.sku,
      personel: operatorId,
      qty: parsed.data.qty,
      not_text: parsed.data.not_text,
      status: "Open",
      durum: "bekliyor",
      operator_id: operatorId,
      operator_name: operatorName,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/paketleme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Paketlemeyi başlat: bekliyor → paketlemede */
export async function startPack(sessionId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("pack_events")
      .select("durum")
      .eq("session_id", sessionId)
      .single();

    const session = data as { durum: string } | null;
    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "bekliyor") return { success: false, error: "Bu seans zaten başlatılmış" };

    const { error } = await supabase
      .from("pack_events")
      .update({
        durum: "paketlemede",
        start_time: new Date().toISOString(),
      })
      .eq("session_id", sessionId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/paketleme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Paketlemeyi tamamla: paketlemede → tamamlandi + stock_movements IN */
export async function completePack(sessionId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    // Seans bilgileri
    const { data } = await supabase
      .from("pack_events")
      .select("session_id, durum, sku, qty, operator_id")
      .eq("session_id", sessionId)
      .single();

    const session = data as {
      session_id: string;
      durum: string;
      sku: string | null;
      qty: number;
      operator_id: string | null;
    } | null;

    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "paketlemede") return { success: false, error: "Seans aktif değil" };

    const now = new Date().toISOString();

    // Update durum
    const { error: updateError } = await supabase
      .from("pack_events")
      .update({
        durum: "tamamlandi",
        status: "Closed",
        end_time: now,
      })
      .eq("session_id", sessionId);

    if (updateError) return { success: false, error: updateError.message };

    // Idempotency: stock_movements'da bu session_id var mı?
    const { data: existingMov } = await supabase
      .from("stock_movements")
      .select("id")
      .eq("source_row_id", sessionId)
      .limit(1);

    if (existingMov && existingMov.length > 0) {
      // Zaten kayıt var
      revalidatePath("/uretim/paketleme");
      return { success: true };
    }

    // Generate mov_id: SM-XXXXXX
    const { data: lastMov } = await supabase
      .from("stock_movements")
      .select("mov_id")
      .like("mov_id", "SM-%")
      .order("mov_id", { ascending: false })
      .limit(1);

    let movNum = 1;
    if (lastMov && lastMov.length > 0) {
      const match = lastMov[0].mov_id?.match(/SM-(\d+)/);
      if (match) movNum = parseInt(match[1], 10) + 1;
    }
    const movId = `SM-${String(movNum).padStart(6, "0")}`;

    // stock_movements INSERT — mamül stok IN
    const { error: movError } = await supabase.from("stock_movements").insert({
      mov_id: movId,
      tarih: now,
      sku: session.sku,
      qty: session.qty, // positive = production in
      source: "Paketleme",
      source_row_id: sessionId,
      batch_id: sessionId,
    });

    if (movError) return { success: false, error: movError.message };

    revalidatePath("/uretim/paketleme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Paketlemeyi iptal et: paketlemede → bekliyor */
export async function cancelPack(sessionId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("pack_events")
      .select("durum")
      .eq("session_id", sessionId)
      .single();

    const session = data as { durum: string } | null;
    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "paketlemede") return { success: false, error: "Sadece paketlemede durumundaki seans iptal edilebilir" };

    const { error } = await supabase
      .from("pack_events")
      .update({
        durum: "bekliyor",
        start_time: null,
      })
      .eq("session_id", sessionId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/paketleme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
