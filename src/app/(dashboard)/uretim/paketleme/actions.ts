"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { packSessionCloseSchema } from "@/lib/validations";
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

/** Paketleme operatörlerini getir (sadece Paketleme istasyonu çalışanları) */
export async function getPackOperators() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("users")
      .select("user_id, full_name, role")
      .eq("is_active", true)
      .in("station", ["Paketleme", "Paketleme Hattı"])
      .order("full_name");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Analiz verisi */
export async function getAnalytics(period: "today" | "week" | "month") {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const now = new Date();
    let since: Date;
    if (period === "today") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    } else {
      since = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }

    const { data, error } = await supabase
      .from("pack_events")
      .select("session_id, qty, start_time, end_time, worker_count, workers, birim_paketleme_dk")
      .eq("durum", "tamamlandi")
      .gte("end_time", since.toISOString());

    if (error) return { success: false as const, error: error.message };

    const sessions = data ?? [];
    const totalQty = sessions.reduce((sum, s) => sum + (s.qty || 0), 0);

    // Benzersiz çalışan sayısı (workers jsonb'den)
    const workerIds = new Set<string>();
    sessions.forEach((s) => {
      const workers = s.workers as Array<{ id: string; name: string }> | null;
      if (workers && Array.isArray(workers)) {
        workers.forEach((w) => workerIds.add(w.id));
      }
    });

    // Toplam seans süresi (dk)
    let totalMinutes = 0;
    sessions.forEach((s) => {
      if (s.start_time && s.end_time) {
        const diff = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
        totalMinutes += diff / 60000;
      }
    });

    const avgBirimDk =
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + (s.birim_paketleme_dk || 0), 0) / sessions.filter((s) => s.birim_paketleme_dk).length || 0
        : 0;

    return {
      success: true as const,
      data: {
        totalQty,
        uniqueWorkers: workerIds.size,
        totalMinutes: Math.round(totalMinutes),
        sessionCount: sessions.length,
        avgBirimDk: Math.round(avgBirimDk * 100) / 100,
      },
    };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Ürün bazlı trend verisi */
export async function getProductTrend(sku: string, days: number = 30) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from("pack_events")
      .select("session_id, end_time, qty, birim_paketleme_dk, worker_count")
      .eq("durum", "tamamlandi")
      .eq("sku", sku)
      .gte("end_time", since.toISOString())
      .order("end_time", { ascending: true });

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── MUTATION ACTIONS ───────────────────────────────────────────

/** Yeni paketleme seansı oluştur (sadece SKU, qty yok) */
export async function createPackSession(sku: string): Promise<ActionResult> {
  try {
    const user = await requireProductionAccess();

    if (!sku || sku.trim().length === 0) {
      return { success: false, error: "Ürün seçimi gereklidir" };
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
      sessionId = `${sessionId}-${String(now.getMilliseconds()).padStart(3, "0")}`;
    }

    // INSERT — doğrudan "paketlemede" olarak başlat, qty=0
    const { error } = await supabase.from("pack_events").insert({
      session_id: sessionId,
      email: email,
      tarih: now.toISOString(),
      sku: sku,
      personel: operatorId,
      qty: 0,
      status: "Open",
      durum: "paketlemede",
      start_time: now.toISOString(),
      operator_id: operatorId,
      operator_name: operatorName,
      worker_count: 1,
      workers: JSON.stringify([]),
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/paketleme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Seansı kapat: paketlemede → tamamlandi + stock_movements IN */
export async function closePackSession(
  sessionId: string,
  formData: { qty: number; workers: { id: string; name: string }[] }
): Promise<ActionResult> {
  try {
    await requireProductionAccess();

    const parsed = packSessionCloseSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Seans bilgileri
    const { data } = await supabase
      .from("pack_events")
      .select("session_id, durum, sku, start_time")
      .eq("session_id", sessionId)
      .single();

    const session = data as {
      session_id: string;
      durum: string;
      sku: string | null;
      start_time: string | null;
    } | null;

    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "paketlemede") return { success: false, error: "Seans aktif değil" };

    const now = new Date();
    const endTime = now.toISOString();
    const { qty, workers } = parsed.data;

    // Birim paketleme süresi hesapla
    let birimDk: number | null = null;
    if (session.start_time && qty > 0 && workers.length > 0) {
      const diffMs = now.getTime() - new Date(session.start_time).getTime();
      const totalMinutes = diffMs / 60000;
      birimDk = Math.round((totalMinutes / (qty * workers.length)) * 100) / 100;
    }

    // Update pack_events
    const { error: updateError } = await supabase
      .from("pack_events")
      .update({
        durum: "tamamlandi",
        status: "Closed",
        end_time: endTime,
        qty: qty,
        worker_count: workers.length,
        workers: workers,
        birim_paketleme_dk: birimDk,
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
      tarih: endTime,
      sku: session.sku,
      qty: qty,
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

/** Devam eden seansı iptal et (sil) */
export async function cancelSession(sessionId: string): Promise<ActionResult> {
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
    if (session.durum !== "paketlemede") {
      return { success: false, error: "Sadece devam eden seans iptal edilebilir" };
    }

    const { error } = await supabase
      .from("pack_events")
      .delete()
      .eq("session_id", sessionId)
      .eq("durum", "paketlemede");

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/paketleme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Tamamlanmış seansı düzenle (qty, workers) */
export async function updateCompletedSession(
  sessionId: string,
  formData: { qty: number; workers: { id: string; name: string }[] }
): Promise<ActionResult> {
  try {
    await requireProductionAccess();

    const parsed = packSessionCloseSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Seans bilgileri
    const { data } = await supabase
      .from("pack_events")
      .select("session_id, durum, sku, start_time, end_time, qty")
      .eq("session_id", sessionId)
      .single();

    const session = data as {
      session_id: string;
      durum: string;
      sku: string | null;
      start_time: string | null;
      end_time: string | null;
      qty: number;
    } | null;

    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "tamamlandi") {
      return { success: false, error: "Sadece tamamlanan seanslar düzenlenebilir" };
    }

    const { qty, workers } = parsed.data;
    const oldQty = session.qty;

    // Birim paketleme süresi yeniden hesapla
    let birimDk: number | null = null;
    if (session.start_time && session.end_time && qty > 0 && workers.length > 0) {
      const diffMs = new Date(session.end_time).getTime() - new Date(session.start_time).getTime();
      const totalMinutes = diffMs / 60000;
      birimDk = Math.round((totalMinutes / (qty * workers.length)) * 100) / 100;
    }

    // Update pack_events
    const { error: updateError } = await supabase
      .from("pack_events")
      .update({
        qty: qty,
        worker_count: workers.length,
        workers: workers,
        birim_paketleme_dk: birimDk,
      })
      .eq("session_id", sessionId);

    if (updateError) return { success: false, error: updateError.message };

    // stock_movements güncelle (qty farkı)
    if (qty !== oldQty && session.sku) {
      const { data: existingMov } = await supabase
        .from("stock_movements")
        .select("id, mov_id")
        .eq("source_row_id", sessionId)
        .limit(1);

      if (existingMov && existingMov.length > 0) {
        await supabase
          .from("stock_movements")
          .update({ qty: qty })
          .eq("id", existingMov[0].id);
      }
    }

    revalidatePath("/uretim/paketleme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── LEGACY ACTIONS (eski verilerle uyumluluk) ─────────────────

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

/** Paketlemeyi tamamla (legacy): paketlemede → tamamlandi + stock_movements IN */
export async function completePack(sessionId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

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

    const { error: updateError } = await supabase
      .from("pack_events")
      .update({
        durum: "tamamlandi",
        status: "Closed",
        end_time: now,
      })
      .eq("session_id", sessionId);

    if (updateError) return { success: false, error: updateError.message };

    // Idempotency
    const { data: existingMov } = await supabase
      .from("stock_movements")
      .select("id")
      .eq("source_row_id", sessionId)
      .limit(1);

    if (existingMov && existingMov.length > 0) {
      revalidatePath("/uretim/paketleme");
      return { success: true };
    }

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

    const { error: movError } = await supabase.from("stock_movements").insert({
      mov_id: movId,
      tarih: now,
      sku: session.sku,
      qty: session.qty,
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
