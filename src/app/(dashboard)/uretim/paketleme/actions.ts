"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { packSessionCloseSchema } from "@/lib/validations";
import { PRODUCTION_ACCESS_ROLES, URETIM_ANALIZ_ROLES } from "@/lib/constants";

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
      .order("gunluk_satis", { ascending: false });

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
export async function getAnalytics(period: "today" | "week" | "month" | "last_month") {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    /**
     * Dönemler TAKVİM bazlı.
     *
     * Önce "ay" bugünden geriye 1 ay demekti; 17 Ağustos'ta bakınca
     * 17.07-17.08 aralığı çıkıyor ve Temmuz üretimi 12.872 yerine 10.305
     * görünüyordu. Üretim raporu takvim ayı bekler.
     */
    const now = new Date();
    let since: Date;
    let until: Date | null = null;
    if (period === "today") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      const gun = now.getDay() || 7; // pazartesi başlangıç
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - gun + 1);
    } else if (period === "last_month") {
      since = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      until = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    let query = supabase
      .from("pack_events")
      .select("session_id, qty, start_time, end_time, worker_count, workers, birim_paketleme_dk, duraklama_dk")
      .eq("durum", "tamamlandi")
      .gte("end_time", since.toISOString());
    if (until) query = query.lt("end_time", until.toISOString());

    const { data, error } = await query;
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

    // Toplam seans süresi (dk) — bekleme (duraklatma) düşülmüş net süre
    let totalMinutes = 0;
    sessions.forEach((s) => {
      if (s.start_time && s.end_time) {
        const diff = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
        totalMinutes += Math.max(0, diff / 60000 - Number(s.duraklama_dk ?? 0));
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

/** Günlük satış hızına göre en çok satan ürünler (hızlı seçim için) */
export async function getTopPackagedProducts(limit: number = 10) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("products")
      .select("sku, urun_adi, gunluk_satis")
      .eq("aktif_mi", true)
      .gt("gunluk_satis", 0)
      .order("gunluk_satis", { ascending: false })
      .limit(limit);

    if (error) return { success: false as const, error: error.message };

    const result = (data ?? []).map((p) => ({
      sku: p.sku,
      urun_adi: p.urun_adi ?? p.sku,
      totalQty: 0,
      sessionCount: 0,
    }));

    return { success: true as const, data: result };
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
  formData: { qty: number; depo_id: string; workers: { id: string; name: string }[] }
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
      .select("session_id, durum, sku, start_time, duraklama_dk, duraklatma_baslangic")
      .eq("session_id", sessionId)
      .single();

    const session = data as {
      session_id: string;
      durum: string;
      sku: string | null;
      start_time: string | null;
      duraklama_dk: number | null;
      duraklatma_baslangic: string | null;
    } | null;

    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "paketlemede") return { success: false, error: "Seans aktif değil" };

    const now = new Date();
    const endTime = now.toISOString();
    const { qty, workers, depo_id } = parsed.data;
    if (!depo_id) return { success: false, error: "Ürünün gireceği depoyu seçiniz" };

    // Toplam bekleme (duraklatma) süresi — kapanışta hâlâ duraklatılmışsa
    // son aralık da eklenir. Bu süre toplam seans süresinden düşülür.
    const oncekiDuraklama = Number(session.duraklama_dk ?? 0);
    const acikDuraklama = session.duraklatma_baslangic
      ? (now.getTime() - new Date(session.duraklatma_baslangic).getTime()) / 60000
      : 0;
    const toplamDuraklamaDk =
      Math.max(0, Math.round((oncekiDuraklama + acikDuraklama) * 100) / 100);

    // Birim paketleme süresi — bekleme düşülmüş net süre üzerinden
    let birimDk: number | null = null;
    if (session.start_time && qty > 0 && workers.length > 0) {
      const diffMs = now.getTime() - new Date(session.start_time).getTime();
      const netMinutes = Math.max(0, diffMs / 60000 - toplamDuraklamaDk);
      birimDk = Math.round((netMinutes / (qty * workers.length)) * 100) / 100;
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
        duraklama_dk: toplamDuraklamaDk,
        duraklatma_baslangic: null,
        depo_id,
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
      depo_id,
    });

    if (movError) return { success: false, error: movError.message };

    // products.stok_aktif güncelle — paketlenen adet kadar artır
    if (session.sku) {
      const { data: product } = await supabase
        .from("products")
        .select("stok_aktif")
        .eq("sku", session.sku)
        .single();

      if (product) {
        await supabase
          .from("products")
          .update({
            stok_aktif:
              ((product as { stok_aktif: number }).stok_aktif || 0) + qty,
          })
          .eq("sku", session.sku);
      }
    }

    revalidatePath("/uretim/paketleme");
    revalidatePath("/stok/mamul");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Devam eden seansı iptal et (sil) */
/**
 * Aktif seansı duraklat / devam ettir (toggle).
 * Duraklatınca duraklatma_baslangic=now yazılır; devam edince geçen bekleme
 * süresi duraklama_dk'ya eklenir. Bu bekleme kapanışta toplam süreden düşülür.
 */
export async function toggleDuraklat(sessionId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("pack_events")
      .select("durum, duraklama_dk, duraklatma_baslangic")
      .eq("session_id", sessionId)
      .single();
    const session = data as {
      durum: string;
      duraklama_dk: number | null;
      duraklatma_baslangic: string | null;
    } | null;

    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "paketlemede")
      return { success: false, error: "Seans aktif değil" };

    const now = new Date();
    let update: { duraklatma_baslangic: string | null; duraklama_dk?: number };
    if (session.duraklatma_baslangic) {
      // Devam et: geçen bekleme süresini biriktir
      const ekMs = now.getTime() - new Date(session.duraklatma_baslangic).getTime();
      const yeni = Number(session.duraklama_dk ?? 0) + Math.max(0, ekMs / 60000);
      update = { duraklatma_baslangic: null, duraklama_dk: Math.round(yeni * 100) / 100 };
    } else {
      // Duraklat
      update = { duraklatma_baslangic: now.toISOString() };
    }

    const { error } = await supabase
      .from("pack_events")
      .update(update)
      .eq("session_id", sessionId);
    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/paketleme");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

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
  formData: { qty: number; depo_id?: string; start_time?: string; workers: { id: string; name: string }[] }
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
      .select("session_id, durum, sku, start_time, end_time, qty, depo_id, duraklama_dk")
      .eq("session_id", sessionId)
      .single();

    const session = data as {
      session_id: string;
      durum: string;
      sku: string | null;
      start_time: string | null;
      end_time: string | null;
      qty: number;
      depo_id: string | null;
      duraklama_dk: number | null;
    } | null;

    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "tamamlandi") {
      return { success: false, error: "Sadece tamamlanan seanslar düzenlenebilir" };
    }

    const { qty, workers } = parsed.data;
    const oldQty = session.qty;
    // Operatör yanlış saatte başlatmış olabilir; verilmezse mevcut korunur
    const yeniBaslangic = formData.start_time || session.start_time;

    // Birim paketleme süresi yeniden hesapla — bekleme (duraklatma) düşülmüş net süre
    let birimDk: number | null = null;
    if (yeniBaslangic && session.end_time && qty > 0 && workers.length > 0) {
      const diffMs = new Date(session.end_time).getTime() - new Date(yeniBaslangic).getTime();
      const netMinutes = Math.max(0, diffMs / 60000 - Number(session.duraklama_dk ?? 0));
      birimDk = Math.round((netMinutes / (qty * workers.length)) * 100) / 100;
    }

    // Update pack_events
    const { error: updateError } = await supabase
      .from("pack_events")
      .update({
        qty: qty,
        worker_count: workers.length,
        workers: workers,
        birim_paketleme_dk: birimDk,
        // Depo değiştirilmediyse mevcut kalsın
        depo_id: parsed.data.depo_id ?? session.depo_id,
        start_time: yeniBaslangic,
      })
      .eq("session_id", sessionId);

    if (updateError) return { success: false, error: updateError.message };

    // stock_movements + products.stok_aktif güncelle (qty farkı)
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

      // products.stok_aktif farkı uygula
      const diff = qty - oldQty;
      if (diff !== 0) {
        const { data: product } = await supabase
          .from("products")
          .select("stok_aktif")
          .eq("sku", session.sku)
          .single();

        if (product) {
          await supabase
            .from("products")
            .update({
              stok_aktif:
                ((product as { stok_aktif: number }).stok_aktif || 0) + diff,
            })
            .eq("sku", session.sku);
        }
      }
    }

    revalidatePath("/uretim/paketleme");
    revalidatePath("/stok/mamul");
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
      .select("session_id, durum, sku, qty, operator_id, depo_id")
      .eq("session_id", sessionId)
      .single();

    const session = data as {
      session_id: string;
      durum: string;
      sku: string | null;
      qty: number;
      operator_id: string | null;
      depo_id: string | null;
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
      // Hızlı tamamlamada depo sorulmuyor; seansta kayıtlıysa o kullanılır
      depo_id: session.depo_id,
    });

    if (movError) return { success: false, error: movError.message };

    revalidatePath("/uretim/paketleme");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export interface DepoSecenegi {
  depo_id: string;
  ad: string;
  aciklama: string | null;
}

/** Paketleme kapatma ekranında gösterilecek aktif depolar */
export async function getDepolar(): Promise<DepoSecenegi[]> {
  await requireProductionAccess();
  const supabase = await createClient();
  const { data } = await supabase
    .from("depolar")
    .select("depo_id, ad, aciklama")
    .eq("aktif", true)
    .order("sira");
  return (data ?? []) as DepoSecenegi[];
}

/**
 * Tamamlanmış paketleme seansını siler.
 *
 * İş veritabanı fonksiyonunda (paketleme_seansi_sil) yapılıyor, burada
 * değil. İki sebep:
 *
 * 1) stock_movements'a DELETE yetkisi yalnızca yöneticide. Üretim rolü
 *    hareketi silemediği için silme işlemi yarıda kalıyordu. Yetkiyi
 *    herkese açmak yerine, sadece o seansa bağlı hareketleri silen
 *    yetkili bir fonksiyon kullanılıyor — etki alanı tek seans.
 * 2) Hareket silme, bakiye düzeltme ve seans silme tek işlemde oluyor;
 *    ortada hata olsa bile yarım kalmıyor.
 */
export async function deleteCompletedSession(sessionId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { error } = await supabase.rpc("paketleme_seansi_sil", {
      p_session_id: sessionId,
    });
    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/paketleme");
    revalidatePath("/stok/mamul");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

export interface ParetoSatiri {
  sku: string;
  adet: number;
  /** Toplam işçilik dakikası = geçen süre × kişi sayısı */
  iscilikDk: number;
  birimDk: number;
  seans: number;
  /** Bu ürüne kadarki kümülatif işçilik payı (%) */
  kumulatif: number;
}

export interface HaftaSatiri {
  hafta: string;
  etiket: string;
  adet: number;
  seans: number;
  /** Gerçekleşen işçilik (dk/adet), hacim ağırlıklı */
  gerceklesen: number;
  /** O haftanın ürün karışımına göre beklenen işçilik */
  beklenen: number;
  /** gerçekleşen / beklenen. 1 = normal, üstü kötü, altı iyi */
  oran: number;
}

export interface PotansiyelSatiri {
  grup: string;
  skuSayisi: number;
  adet: number;
  /** Mevcut ortalama işçilik (dk/adet) */
  ortalama: number;
  /** Kendi en iyi %20 diliminin ortalaması — zaten ulaşılmış hız */
  hedef: number;
  /** (ortalama - hedef) × adet, saate çevrilmiş */
  kazanilabilirSaat: number;
  /** ortalama - hedef; grafikte hedefin üstüne istiflenir */
  fark: number;
}

export interface AnalizVerisi {
  pareto: ParetoSatiri[];
  haftalik: HaftaSatiri[];
  potansiyel: PotansiyelSatiri[];
  /** Seçili dönemde paketleme yapılan farklı gün sayısı — kapasite çevrimi için */
  calisilanGun: number;
}

/**
 * Paketleme analizi. Ürün seçmeye gerek kalmadan tüm resmi verir.
 *
 * İşçilik dakikası bilerek "geçen süre × kişi" olarak hesaplanıyor;
 * birim süreyle adet çarpımı değil. İkincisi kişi sayısını iki kez
 * hesaba katardı çünkü birim süre zaten kişiye bölünmüş bir değer.
 */
export async function getPaketlemeAnaliz(
  donem: "month" | "last_month" | "all",
  kirilim: "sku" | "grup" = "sku",
) {
  try {
    /**
     * Arayüzde gizlemek yeterli değil — saha hesabı bu aksiyonu doğrudan
     * çağırabilir. Yetki burada da kontrol ediliyor.
     */
    const user = await getCurrentUser();
    if (!user || !URETIM_ANALIZ_ROLES.includes(user.role)) {
      return { success: false as const, error: "Bu analizi görme yetkiniz yok" };
    }
    const supabase = await createClient();

    const now = new Date();
    let query = supabase
      .from("pack_events")
      .select("sku, qty, start_time, end_time, worker_count, birim_paketleme_dk, personel, operator_name")
      .eq("durum", "tamamlandi")
      .not("end_time", "is", null)
      .not("sku", "is", null);

    if (donem === "month") {
      query = query.gte("tarih", new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    } else if (donem === "last_month") {
      query = query
        .gte("tarih", new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString())
        .lt("tarih", new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    }

    const { data, error } = await query;
    if (error) return { success: false as const, error: error.message };

    const seanslar = (data ?? []) as {
      sku: string | null; qty: number; start_time: string | null;
      end_time: string | null; worker_count: number | null;
      birim_paketleme_dk: number | null; personel: string | null;
      operator_name: string | null;
    }[];

    /**
     * Kırılım "grup" ise SKU yerine ürün grubu kullanılır. Grup boşsa
     * SKU'ya düşülür — ürün analizden kaybolmasın.
     */
    const grupHarita = new Map<string, string>();
    if (kirilim === "grup") {
      const skular = [...new Set(seanslar.map((x) => x.sku).filter(Boolean) as string[])];
      for (let i = 0; i < skular.length; i += 200) {
        const { data: urunler } = await supabase
          .from("products")
          .select("sku, urun_grubu")
          .in("sku", skular.slice(i, i + 200));
        for (const u of urunler ?? []) {
          if (u.urun_grubu) grupHarita.set(u.sku, u.urun_grubu);
        }
      }
    }
    const etiket = (sku: string) => grupHarita.get(sku) ?? sku;

    // Yalnız iki alana bakar; hem ana sorgu hem haftalık sorgu kullanabilsin
    const gecenDk = (s: { start_time: string | null; end_time: string | null }) =>
      s.start_time && s.end_time
        ? (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000
        : 0;

    // ── Ürün bazlı ──
    const urun = new Map<string, { adet: number; iscilik: number; birimTop: number; birimAdet: number; seans: number }>();
    for (const s of seanslar) {
      if (!s.sku) continue;
      const kisi = s.worker_count ?? 1;
      const anahtar = etiket(s.sku);
      const u = urun.get(anahtar) ?? { adet: 0, iscilik: 0, birimTop: 0, birimAdet: 0, seans: 0 };
      u.adet += s.qty ?? 0;
      u.iscilik += gecenDk(s) * kisi;
      if (s.birim_paketleme_dk != null) { u.birimTop += s.birim_paketleme_dk; u.birimAdet++; }
      u.seans++;
      urun.set(anahtar, u);
    }

    const sirali = [...urun.entries()].sort((a, b) => b[1].iscilik - a[1].iscilik);
    const toplamIscilik = sirali.reduce((t, [, u]) => t + u.iscilik, 0);
    let birikimli = 0;
    const pareto: ParetoSatiri[] = sirali.map(([sku, u]) => {
      birikimli += u.iscilik;
      return {
        sku,
        adet: Math.round(u.adet),
        iscilikDk: Math.round(u.iscilik),
        birimDk: u.birimAdet > 0 ? Number((u.birimTop / u.birimAdet).toFixed(3)) : 0,
        seans: u.seans,
        kumulatif: toplamIscilik > 0 ? Number(((birikimli / toplamIscilik) * 100).toFixed(1)) : 0,
      };
    });

    /**
     * ── Haftalık tempo ve verimlilik ──
     *
     * Ham işçilik/adet yanıltıcı: ürün karışımı değişince kendiliğinden
     * oynuyor. Veride 3,85'ten 8,33'e çıkmış görünüyor ama bunun tamamı
     * karışımdan; gerçek verimlilik sabit.
     *
     * Bu yüzden iki değer birlikte veriliyor:
     *   beklenen = o haftaki ürünlerin kendi normlarına göre olması
     *              gereken işçilik
     *   oran     = gerçekleşen / beklenen (1 = normal)
     * Oran karışımdan bağımsızdır; asıl izlenecek çizgi odur.
     *
     * Dönem filtresinden bağımsız: trend görmek için son 12 hafta.
     */
    const { data: haftaHam } = await supabase
      .from("pack_events")
      .select("tarih, sku, qty, start_time, end_time, worker_count")
      .eq("durum", "tamamlandi")
      .not("end_time", "is", null)
      .not("sku", "is", null)
      .gte("tarih", new Date(Date.now() - 84 * 24 * 3600 * 1000).toISOString());

    const hamSeans = (haftaHam ?? []) as {
      tarih: string | null; sku: string | null; qty: number;
      start_time: string | null; end_time: string | null; worker_count: number | null;
    }[];

    // Ürün normu: kendi tüm geçmişindeki hacim ağırlıklı işçilik
    const norm = new Map<string, { isc: number; adet: number }>();
    for (const s of hamSeans) {
      const k = s.worker_count ?? 0;
      if (!s.sku || !s.qty || k <= 0) continue;
      const isc = gecenDk(s) * k;
      if (!(isc > 0)) continue;
      const n = norm.get(s.sku) ?? { isc: 0, adet: 0 };
      n.isc += isc; n.adet += s.qty;
      norm.set(s.sku, n);
    }

    const haftaMap = new Map<string, { adet: number; seans: number; isc: number; bek: number }>();
    for (const s of hamSeans) {
      const k = s.worker_count ?? 0;
      if (!s.sku || !s.qty || k <= 0 || !s.tarih) continue;
      const isc = gecenDk(s) * k;
      if (!(isc > 0)) continue;
      const n = norm.get(s.sku);
      if (!n || n.adet <= 0) continue;

      // Pazartesi başlangıçlı hafta
      const d = new Date(s.tarih);
      const gun = d.getDay() || 7;
      const pzt = new Date(d.getFullYear(), d.getMonth(), d.getDate() - gun + 1);
      const anahtar = pzt.toISOString().slice(0, 10);

      const h = haftaMap.get(anahtar) ?? { adet: 0, seans: 0, isc: 0, bek: 0 };
      h.adet += s.qty;
      h.seans++;
      h.isc += isc;
      h.bek += (n.isc / n.adet) * s.qty;
      haftaMap.set(anahtar, h);
    }

    // "18–24 Ağu" gibi hafta aralığı. Sadece pazartesi tarihi (29/06)
    // hangi hafta olduğunu anlatmıyordu; aralık + ay adı net.
    const AY_KISA = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
    const haftaEtiket = (pztISO: string) => {
      const bas = new Date(pztISO + "T00:00:00");
      const bit = new Date(bas);
      bit.setDate(bit.getDate() + 6);
      const g = (d: Date) => d.getDate();
      if (bas.getMonth() === bit.getMonth()) {
        return `${g(bas)}–${g(bit)} ${AY_KISA[bas.getMonth()]}`;
      }
      return `${g(bas)} ${AY_KISA[bas.getMonth()]}–${g(bit)} ${AY_KISA[bit.getMonth()]}`;
    };

    const haftalik: HaftaSatiri[] = [...haftaMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hafta, h]) => ({
        hafta,
        etiket: haftaEtiket(hafta),
        adet: Math.round(h.adet),
        seans: h.seans,
        gerceklesen: Number((h.isc / h.adet).toFixed(2)),
        beklenen: Number((h.bek / h.adet).toFixed(2)),
        oran: Number((h.isc / h.bek).toFixed(2)),
      }));

    /**
     * ── İyileştirme potansiyeli ──
     *
     * ESKİ HESAP YANILTICIYDI. İki kaynaktan şişiyordu:
     *   1) "Şu an" = ham ORTALAMA idi; kapatılmayı unutan (>4 saat) ve öğle
     *      molasını kapsayan seanslar ortalamayı yukarı çekiyordu.
     *   2) "Ulaşılabilir" = tüm seansların en iyi %20'siydi; içinde tek bir
     *      uç-hızlı/hatalı kayıt (ör. 0,29 dk/adet) hedefi gerçekçi olmayan
     *      bir yere indiriyordu.
     * Sonuç: KÜÇÜK KOS'ta 2,54 → 0,52 gibi 5 kat sahte fark. Ölçüldü:
     * temiz seanslarla gerçek tablo 2,30 → 1,79 (yaklaşık %22).
     *
     * DÜZELTME — kıyaslama bölümüyle aynı temizlik:
     *   - 1 dk altı, 4 saat (MAX_SEANS_DK) üstü ve mola kapsayan seanslar atılır.
     *   - "Şu an" = MEDYAN (ortalama değil; uzun seans tek başına bozamasın).
     *   - "Ulaşılabilir" = temiz seansların P25'i (birkaç kez ulaşılmış iyi
     *     çeyrek; tek uç değer değil).
     * Hesap yine SKU seviyesinde, gruba hacim ağırlıklı toplanır.
     */
    const molaKapsar = (x: { start_time: string | null; end_time: string | null }) => {
      if (!x.start_time || !x.end_time) return false;
      return trSaat(x.start_time) < MOLA_BAS && trSaat(x.end_time) > MOLA_BIT;
    };
    const ceyrek = (sirali: number[], q: number) =>
      sirali[Math.min(sirali.length - 1, Math.max(0, Math.floor(sirali.length * q)))];

    const skuOlcum = new Map<string, { grup: string; adet: number; olcumler: number[] }>();
    for (const s of seanslar) {
      const kisi = s.worker_count ?? 0;
      if (!s.sku || !s.qty || kisi <= 0) continue;
      const gecen = gecenDk(s);
      if (gecen <= 1 || gecen > MAX_SEANS_DK) continue;   // uzun/kapatılmamış elenir
      if (molaKapsar(s)) continue;                        // mola kapsayan elenir
      const ia = (gecen * kisi) / s.qty;
      if (!(ia > 0)) continue;
      const k = skuOlcum.get(s.sku) ?? { grup: etiket(s.sku), adet: 0, olcumler: [] };
      k.adet += s.qty;
      k.olcumler.push(ia);
      skuOlcum.set(s.sku, k);
    }

    const grupTop = new Map<string, { sku: number; adet: number; ortTop: number; hedefTop: number }>();
    for (const [, k] of skuOlcum) {
      // P25 anlamlı olsun diye en az 4 temiz ölçüm
      if (k.olcumler.length < 4) continue;
      const sirali = [...k.olcumler].sort((a, b) => a - b);
      const suan = medyan(sirali);          // ortalama değil, medyan
      const hedef = ceyrek(sirali, 0.25);   // iyi çeyrek, tek uç değer değil
      if (!(suan > hedef)) continue;         // iyileştirilecek yer yoksa atla

      const g = grupTop.get(k.grup) ?? { sku: 0, adet: 0, ortTop: 0, hedefTop: 0 };
      g.sku++;
      g.adet += k.adet;
      g.ortTop += suan * k.adet;
      g.hedefTop += hedef * k.adet;
      grupTop.set(k.grup, g);
    }

    const potansiyel: PotansiyelSatiri[] = [...grupTop.entries()]
      .map(([grup, g]) => ({
        grup,
        skuSayisi: g.sku,
        adet: Math.round(g.adet),
        ortalama: Number((g.ortTop / g.adet).toFixed(2)),
        hedef: Number((g.hedefTop / g.adet).toFixed(2)),
        fark: Number(((g.ortTop - g.hedefTop) / g.adet).toFixed(2)),
        kazanilabilirSaat: Math.round((g.ortTop - g.hedefTop) / 60),
      }))
      .filter((x) => x.kazanilabilirSaat > 0)
      .sort((a, b) => b.kazanilabilirSaat - a.kazanilabilirSaat);

    // Kazanılan işçilik saatini "kaç kişilik kapasite" diye yorumlamak için
    // dönemdeki farklı çalışma günü sayısı gerekiyor.
    const gunSet = new Set<string>();
    for (const s of seanslar) {
      if (!s.start_time) continue;
      const d = new Date(s.start_time);
      gunSet.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`);
    }
    const calisilanGun = gunSet.size;

    return { success: true as const, data: { pareto, haftalik, potansiyel, calisilanGun } satisfies AnalizVerisi };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}


// ═══════════════════════════════════════════════════════════════
// PERSONEL & KIYASLAMA
//
// NEDEN KİŞİ BAZLI SIRALAMA YOK:
// Bu tesiste paketleme sabit ekiplerle yapılıyor. Ebrar/Gökçe/İrem 81
// seansta hep birlikte; Meryem/Vildan/Zeynep 63 seansta hep birlikte.
// Aynı seansta bulunan iki kişinin süresi, adedi ve ürünü aynı olduğu
// için kişisel bir endeks matematiksel olarak birbirinin kopyası çıkar —
// ölçtüğü şey kişi değil, ekip. Bu yüzden karşılaştırma birimi EKİP.
//
// Kişi tablosu yalnızca katılım/hacim ve çok yönlülük gösterir.
// ═══════════════════════════════════════════════════════════════

/** 4 saati aşan seans = kapatmayı unutma ihtimali yüksek */
const MAX_SEANS_DK = 240;
/** Öğle molası penceresi (Türkiye saati) */
const MOLA_BAS = 12.5;
const MOLA_BIT = 13.25;

interface HamSeans {
  sku: string | null; qty: number; start_time: string | null; end_time: string | null;
  worker_count: number | null; workers: unknown;
  operator_id: string | null; operator_name: string | null;
}

/** workers JSONB; eski kayıtlarda string olabilir. Boşsa seansı açan kişiye düşülür. */
function ekipCoz(s: HamSeans): { id: string; ad: string }[] {
  let w: unknown = s.workers;
  if (typeof w === "string") { try { w = JSON.parse(w); } catch { w = null; } }
  if (Array.isArray(w) && w.length > 0) {
    const liste = w.map((x) => {
      const o = x as { id?: unknown; name?: unknown };
      const id = o?.id != null ? String(o.id) : null;
      return id ? { id, ad: o?.name ? String(o.name) : id } : null;
    }).filter(Boolean) as { id: string; ad: string }[];
    if (liste.length > 0) return liste;
  }
  if (s.operator_id) return [{ id: String(s.operator_id), ad: s.operator_name ?? String(s.operator_id) }];
  return [];
}

const dkFarki = (s: HamSeans) =>
  s.start_time && s.end_time
    ? (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000
    : 0;

/** Türkiye saati ondalık (UTC+3, yaz saati uygulaması yok) */
const trSaat = (iso: string) => {
  const d = new Date(iso);
  return ((d.getUTCHours() + 3) % 24) + d.getUTCMinutes() / 60;
};

/**
 * Seans öğle molasını kapsıyor mu?
 * Kapsıyorsa geçen süreye mola da yazılmış demektir; hız karşılaştırmasında
 * bu seanslar dışlanıyor. Ölçüldü: B hattının %19'u, A hattının %3'ü mola
 * kapsıyordu — temizlenmeden yapılan karşılaştırma farkı olduğundan büyük
 * gösteriyordu.
 */
function molayiKapsiyor(s: HamSeans): boolean {
  if (!s.start_time || !s.end_time) return false;
  if (dkFarki(s) > 24 * 60) return false;
  return trSaat(s.start_time) < MOLA_BAS && trSaat(s.end_time) > MOLA_BIT;
}

async function seanslariGetir(donem: "month" | "last_month" | "all") {
  const supabase = await createClient();
  const now = new Date();
  let query = supabase
    .from("pack_events")
    .select("sku, qty, start_time, end_time, worker_count, workers, operator_id, operator_name")
    .eq("durum", "tamamlandi")
    .not("end_time", "is", null)
    .not("sku", "is", null);

  if (donem === "month") {
    query = query.gte("tarih", new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
  } else if (donem === "last_month") {
    query = query
      .gte("tarih", new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString())
      .lt("tarih", new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return { supabase, seanslar: (data ?? []) as HamSeans[] };
}

async function grupHaritasiKur(
  supabase: Awaited<ReturnType<typeof createClient>>,
  skular: string[],
) {
  const harita = new Map<string, string>();
  for (let i = 0; i < skular.length; i += 200) {
    const { data } = await supabase
      .from("products").select("sku, urun_grubu").in("sku", skular.slice(i, i + 200));
    for (const u of data ?? []) if (u.urun_grubu) harita.set(u.sku, u.urun_grubu);
  }
  return harita;
}

function medyan(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const o = Math.floor(s.length / 2);
  return s.length % 2 ? s[o] : (s[o - 1] + s[o]) / 2;
}

// ─── 1) Kişi tablosu + ekipler + matris ─────────────────────────

export interface PersonelSatiri {
  id: string;
  ad: string;
  seans: number;
  /** Ekip payına düşen adet — ham qty toplanırsa 3 kişilik seans 3 kez sayılır */
  adet: number;
  sureSaat: number;
  grupSayisi: number;
  ortEkip: number;
  /** En sık birlikte çalıştığı sabit ekip */
  ekip: string;
  /** Seanslarının yüzde kaçı o ekiple */
  ekipPayi: number;
  sonCalisma: string | null;
}

export interface EkipSatiri {
  /** Sıralı üye id'leri, "|" ile birleşik */
  anahtar: string;
  ad: string;
  kisi: number;
  seans: number;
  adet: number;
}

export interface PersonelAnalizi {
  satirlar: PersonelSatiri[];
  ekipler: EkipSatiri[];
  gruplar: string[];
  matris: Record<string, Record<string, number>>;
  toplamSeans: number;
}

export async function getPaketlemePersonelAnaliz(donem: "month" | "last_month" | "all") {
  try {
    const user = await getCurrentUser();
    if (!user || !URETIM_ANALIZ_ROLES.includes(user.role)) {
      return { success: false as const, error: "Bu analizi görme yetkiniz yok" };
    }
    const { supabase, seanslar: ham } = await seanslariGetir(donem);
    const seanslar = ham.filter((s) => s.sku && (s.qty ?? 0) > 0 && dkFarki(s) > 1);

    const grupHarita = await grupHaritasiKur(
      supabase, [...new Set(seanslar.map((x) => x.sku!))],
    );
    const grupAdi = (sku: string) => grupHarita.get(sku) ?? sku;

    type B = {
      ad: string; seans: number; adet: number; sureDk: number; ekipTop: number;
      gruplar: Set<string>; son: string | null; matris: Map<string, number>;
      ekipSayac: Map<string, number>;
    };
    const kisiler = new Map<string, B>();
    const ekipler = new Map<string, { adlar: string[]; seans: number; adet: number }>();

    for (const s of seanslar) {
      const ekip = ekipCoz(s);
      if (ekip.length === 0) continue;

      const sirali = [...ekip].sort((a, b) => a.id.localeCompare(b.id));
      const anahtar = sirali.map((x) => x.id).join("|");
      const e = ekipler.get(anahtar) ?? { adlar: sirali.map((x) => x.ad), seans: 0, adet: 0 };
      e.seans++; e.adet += s.qty;
      ekipler.set(anahtar, e);

      const gecen = dkFarki(s);
      const grup = grupAdi(s.sku!);

      for (const k of ekip) {
        const b = kisiler.get(k.id) ?? {
          ad: k.ad, seans: 0, adet: 0, sureDk: 0, ekipTop: 0,
          gruplar: new Set<string>(), son: null,
          matris: new Map<string, number>(), ekipSayac: new Map<string, number>(),
        };
        if (k.ad && k.ad !== k.id) b.ad = k.ad;
        b.seans++;
        const pay = s.qty / ekip.length;
        b.adet += pay;
        b.sureDk += gecen;          // kişinin kendi saati — kişiyle çarpılmaz
        b.ekipTop += ekip.length;
        b.gruplar.add(grup);
        b.matris.set(grup, (b.matris.get(grup) ?? 0) + pay);
        b.ekipSayac.set(anahtar, (b.ekipSayac.get(anahtar) ?? 0) + 1);
        if (!b.son || (s.end_time && s.end_time > b.son)) b.son = s.end_time;
        kisiler.set(k.id, b);
      }
    }

    const ekipAdi = (anahtar: string) =>
      (ekipler.get(anahtar)?.adlar ?? []).map((a) => a.split(" ")[0]).join(" + ");

    const satirlar: PersonelSatiri[] = [...kisiler.entries()].map(([id, b]) => {
      const [enSik, adet] = [...b.ekipSayac.entries()].sort((x, y) => y[1] - x[1])[0] ?? ["", 0];
      return {
        id, ad: b.ad, seans: b.seans, adet: Math.round(b.adet),
        sureSaat: Number((b.sureDk / 60).toFixed(1)),
        grupSayisi: b.gruplar.size,
        ortEkip: Number((b.ekipTop / b.seans).toFixed(1)),
        ekip: ekipAdi(enSik),
        ekipPayi: Math.round((adet / b.seans) * 100),
        sonCalisma: b.son,
      };
    }).sort((a, b) => b.adet - a.adet);

    const grupHacim = new Map<string, number>();
    for (const [, b] of kisiler) for (const [g, a] of b.matris) grupHacim.set(g, (grupHacim.get(g) ?? 0) + a);
    const gruplar = [...grupHacim.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([g]) => g);

    const matris: Record<string, Record<string, number>> = {};
    for (const s of satirlar) {
      const b = kisiler.get(s.id)!;
      matris[s.ad] = Object.fromEntries(gruplar.map((g) => [g, Math.round(b.matris.get(g) ?? 0)]));
    }

    const ekipListe: EkipSatiri[] = [...ekipler.entries()]
      .map(([anahtar, e]) => ({
        anahtar, ad: ekipAdi(anahtar), kisi: e.adlar.length,
        seans: e.seans, adet: Math.round(e.adet),
      }))
      .filter((e) => e.seans >= 3)
      .sort((a, b) => b.seans - a.seans);

    return {
      success: true as const,
      data: { satirlar, ekipler: ekipListe, gruplar, matris, toplamSeans: seanslar.length } satisfies PersonelAnalizi,
    };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── 2) Eşleştirilmiş kıyaslama ─────────────────────────────────

export interface KiyasSatiri {
  urun: string;
  n1: number; med1: number;
  n2: number; med2: number;
  /** (med2 - med1) / med1 × 100. Pozitif = 2. taraf daha yavaş. */
  farkYuzde: number;
  /** Karşılaştırılan toplam adet — ağırlık */
  adet: number;
}

export interface KiyasSonucu {
  taraf1: string;
  taraf2: string;
  satirlar: KiyasSatiri[];
  /** 1. taraf kaç üründe hızlı */
  kazanan1: number;
  kazanan2: number;
  berabere: number;
  /** Hacim ağırlıklı toplam fark (%) */
  agirlikliFark: number;
  /** Karşılaştırmaya giren / dışlanan seans sayıları */
  kullanilan: number;
  molaDisi: number;
  uzunDisi: number;
}

/**
 * İki tarafın AYNI ÜRÜNDEKİ hızını karşılaştırır.
 *
 * Neden global bir endeks değil de eşleştirme: endeks tüm ürünler için
 * standart olmasını gerektiriyor, bu veride ürünlerin yarısında yeterli
 * ölçüm yok — sonuçta kimse eşiği geçemiyordu. Eşleştirme yalnızca İKİ
 * TARAFIN DA çalıştığı ürünleri kullanır; ürün karışımı böylece tanım
 * gereği nötrlenir ve az veriyle de sonuç üretir.
 *
 * Taraf = bir kişinin katıldığı seanslar. Sabit ekipler yüzünden bu
 * pratikte "o kişinin hattı" demek; ekran da böyle etiketliyor.
 */
export async function getPaketlemeKiyaslama(
  donem: "month" | "last_month" | "all",
  taraf1Id: string,
  taraf2Id: string,
  kirilim: "sku" | "grup" = "sku",
) {
  try {
    const user = await getCurrentUser();
    if (!user || !URETIM_ANALIZ_ROLES.includes(user.role)) {
      return { success: false as const, error: "Bu analizi görme yetkiniz yok" };
    }
    if (!taraf1Id || !taraf2Id || taraf1Id === taraf2Id) {
      return { success: false as const, error: "İki farklı taraf seçin" };
    }

    const { supabase, seanslar: ham } = await seanslariGetir(donem);

    let molaDisi = 0, uzunDisi = 0;
    const temiz = ham.filter((s) => {
      if (!s.sku || (s.qty ?? 0) <= 0) return false;
      const dk = dkFarki(s);
      if (dk <= 1) return false;
      if (dk > MAX_SEANS_DK) { uzunDisi++; return false; }
      if (molayiKapsiyor(s)) { molaDisi++; return false; }
      return true;
    });

    const grupHarita = kirilim === "grup"
      ? await grupHaritasiKur(supabase, [...new Set(temiz.map((x) => x.sku!))])
      : new Map<string, string>();
    const etiket = (sku: string) => grupHarita.get(sku) ?? sku;

    const ad = new Map<string, string>();
    // urun -> taraf -> ölçümler
    const olcum = new Map<string, { a: number[]; b: number[]; adet: number }>();
    let kullanilan = 0;

    for (const s of temiz) {
      const ekip = ekipCoz(s);
      if (ekip.length === 0) continue;
      for (const k of ekip) if (k.ad !== k.id) ad.set(k.id, k.ad);

      const var1 = ekip.some((k) => k.id === taraf1Id);
      const var2 = ekip.some((k) => k.id === taraf2Id);
      // Her ikisinin de bulunduğu seans hiçbir tarafa yazılmaz — ayırt etmez
      if (var1 === var2) continue;

      const kisi = s.worker_count ?? ekip.length;
      if (kisi <= 0) continue;
      const isc = (dkFarki(s) * kisi) / s.qty;   // gerçek işçilik dk/adet
      if (!(isc > 0) || !Number.isFinite(isc)) continue;

      const u = etiket(s.sku!);
      const o = olcum.get(u) ?? { a: [], b: [], adet: 0 };
      (var1 ? o.a : o.b).push(isc);
      o.adet += s.qty;
      olcum.set(u, o);
      kullanilan++;
    }

    // Her iki tarafın da en az 2 ölçümü olan ürünler
    const satirlar: KiyasSatiri[] = [...olcum.entries()]
      .filter(([, o]) => o.a.length >= 2 && o.b.length >= 2)
      .map(([urun, o]) => {
        const m1 = medyan(o.a);
        const m2 = medyan(o.b);
        return {
          urun,
          n1: o.a.length, med1: Number(m1.toFixed(2)),
          n2: o.b.length, med2: Number(m2.toFixed(2)),
          farkYuzde: Math.round(((m2 - m1) / m1) * 100),
          adet: Math.round(o.adet),
        };
      })
      .sort((a, b) => (b.n1 + b.n2) - (a.n1 + a.n2));

    // ±%5 gürültü kabul ediliyor, altı berabere sayılır
    const kazanan1 = satirlar.filter((s) => s.farkYuzde > 5).length;
    const kazanan2 = satirlar.filter((s) => s.farkYuzde < -5).length;
    const berabere = satirlar.length - kazanan1 - kazanan2;

    const agirlikToplam = satirlar.reduce((t, s) => t + s.adet, 0);
    const agirlikliFark = agirlikToplam
      ? Math.round(satirlar.reduce((t, s) => t + s.farkYuzde * s.adet, 0) / agirlikToplam)
      : 0;

    return {
      success: true as const,
      data: {
        taraf1: ad.get(taraf1Id) ?? taraf1Id,
        taraf2: ad.get(taraf2Id) ?? taraf2Id,
        satirlar, kazanan1, kazanan2, berabere, agirlikliFark,
        kullanilan, molaDisi, uzunDisi,
      } satisfies KiyasSonucu,
    };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
