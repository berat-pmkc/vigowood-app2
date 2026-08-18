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
      .select("session_id, qty, start_time, end_time, worker_count, workers, birim_paketleme_dk")
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
    const { qty, workers, depo_id } = parsed.data;
    if (!depo_id) return { success: false, error: "Ürünün gireceği depoyu seçiniz" };

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
      .select("session_id, durum, sku, start_time, end_time, qty, depo_id")
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
    } | null;

    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "tamamlandi") {
      return { success: false, error: "Sadece tamamlanan seanslar düzenlenebilir" };
    }

    const { qty, workers } = parsed.data;
    const oldQty = session.qty;
    // Operatör yanlış saatte başlatmış olabilir; verilmezse mevcut korunur
    const yeniBaslangic = formData.start_time || session.start_time;

    // Birim paketleme süresi yeniden hesapla
    let birimDk: number | null = null;
    if (yeniBaslangic && session.end_time && qty > 0 && workers.length > 0) {
      const diffMs = new Date(session.end_time).getTime() - new Date(yeniBaslangic).getTime();
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

export interface KisiSatiri {
  kisi: number;
  seans: number;
  adet: number;
  /** dk / (adet × kişi) — kişi arttıkça matematiksel olarak düşer */
  birimDk: number;
  /** dk / adet — duvar saati hızı, asıl ölçüt */
  gercekDk: number;
}

export interface EkipSatiri {
  ekip: string;
  kisi: number;
  seans: number;
  adet: number;
  /** (geçen süre × kişi) / adet — kişi sayısına göre adil ölçüt */
  iscilikAdet: number;
  /** Ürün ortalamasına oran. 1'in altı = ortalamadan verimli */
  endeks: number;
}

export interface AnalizVerisi {
  pareto: ParetoSatiri[];
  kisiEtkisi: KisiSatiri[];
  ekipler: EkipSatiri[];
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
    await requireProductionAccess();
    const supabase = await createClient();

    const now = new Date();
    let query = supabase
      .from("pack_events")
      .select("sku, qty, start_time, end_time, worker_count, birim_paketleme_dk, personel")
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
    }[];

    /**
     * Kırılım "grup" ise SKU yerine ürün grubu kullanılır. Grup boşsa
     * SKU'ya düşülür — ürün analizden kaybolmasın.
     */
    let grupHarita = new Map<string, string>();
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

    const gecenDk = (s: (typeof seanslar)[number]) =>
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

    // ── Kişi sayısı etkisi ──
    const kisi = new Map<number, { seans: number; adet: number; birimTop: number; birimAdet: number; gercekTop: number; gercekAdet: number }>();
    for (const s of seanslar) {
      const k = s.worker_count ?? 0;
      if (k <= 0 || !s.qty) continue;
      const g = kisi.get(k) ?? { seans: 0, adet: 0, birimTop: 0, birimAdet: 0, gercekTop: 0, gercekAdet: 0 };
      g.seans++;
      g.adet += s.qty;
      if (s.birim_paketleme_dk != null) { g.birimTop += s.birim_paketleme_dk; g.birimAdet++; }
      const gec = gecenDk(s);
      if (gec > 0) { g.gercekTop += gec / s.qty; g.gercekAdet++; }
      kisi.set(k, g);
    }

    const kisiEtkisi: KisiSatiri[] = [...kisi.entries()]
      .sort((a, b) => a[0] - b[0])
      // Tek tük seansla ortalama yanıltıcı olur
      .filter(([, g]) => g.seans >= 3)
      .map(([k, g]) => ({
        kisi: k,
        seans: g.seans,
        adet: Math.round(g.adet),
        birimDk: g.birimAdet > 0 ? Number((g.birimTop / g.birimAdet).toFixed(3)) : 0,
        gercekDk: g.gercekAdet > 0 ? Number((g.gercekTop / g.gercekAdet).toFixed(3)) : 0,
      }));

    /**
     * ── Ekip performansı ──
     *
     * Ölçüt: (geçen süre × kişi) / adet — yani adet başına harcanan
     * İŞÇİLİK dakikası.
     *
     * birim_paketleme_dk KULLANILMIYOR; o değer zaten kişi sayısına
     * bölünmüş olduğu için 3 kişilik ekipleri haksız yere avantajlı
     * gösteriyor. Veride 3. kişinin hıza katkısı olmadığı görüldüğünden
     * bölmek gerçek bir kazanç değil, aritmetik.
     *
     * Endeks, seansı kendi ürününün ortalamasına oranlar; böylece zor
     * ürün paketleyen ekip cezalandırılmaz.
     */
    const urunIscilikOrt = new Map<string, { top: number; n: number }>();
    for (const s of seanslar) {
      const kisi = s.worker_count ?? 0;
      if (!s.sku || !s.qty || kisi <= 0) continue;
      const ia = (gecenDk(s) * kisi) / s.qty;
      if (!(ia > 0)) continue;
      const a = etiket(s.sku);
      const u = urunIscilikOrt.get(a) ?? { top: 0, n: 0 };
      u.top += ia; u.n++;
      urunIscilikOrt.set(a, u);
    }

    const ekipMap = new Map<string, { kisi: number; seans: number; adet: number; iscilikTop: number; endeksTop: number; endeksN: number }>();
    for (const s of seanslar) {
      const kisi = s.worker_count ?? 0;
      const ekipAdi = (s as { personel?: string | null }).personel;
      if (!ekipAdi || !s.sku || !s.qty || kisi <= 0) continue;
      const ia = (gecenDk(s) * kisi) / s.qty;
      if (!(ia > 0)) continue;
      const uo = urunIscilikOrt.get(etiket(s.sku));
      // Tek seanslık ürünler ortalama oluşturmaz, endekse katılmaz
      if (!uo || uo.n < 3) continue;

      const g = ekipMap.get(ekipAdi) ?? { kisi, seans: 0, adet: 0, iscilikTop: 0, endeksTop: 0, endeksN: 0 };
      g.kisi = Math.max(g.kisi, kisi);
      g.seans++;
      g.adet += s.qty;
      g.iscilikTop += ia;
      g.endeksTop += ia / (uo.top / uo.n);
      g.endeksN++;
      ekipMap.set(ekipAdi, g);
    }

    const ekipler: EkipSatiri[] = [...ekipMap.entries()]
      // 4 seansın altında ortalama gürültülü
      .filter(([, g]) => g.seans >= 4 && g.endeksN > 0)
      .map(([ekip, g]) => ({
        ekip,
        kisi: g.kisi,
        seans: g.seans,
        adet: Math.round(g.adet),
        iscilikAdet: Number((g.iscilikTop / g.seans).toFixed(2)),
        endeks: Number((g.endeksTop / g.endeksN).toFixed(3)),
      }))
      .sort((a, b) => a.endeks - b.endeks);

    return { success: true as const, data: { pareto, kisiEtkisi, ekipler } satisfies AnalizVerisi };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
