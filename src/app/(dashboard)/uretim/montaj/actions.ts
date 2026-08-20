"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { montajSessionCloseSchema } from "@/lib/validations";
import { PRODUCTION_ACCESS_ROLES, PRODUCTION_CANCEL_ROLES } from "@/lib/constants";
import { parseWorkers } from "./utils";

type ActionResult = { success: true } | { success: false; error: string };

async function requireProductionAccess() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_ACCESS_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

/** Seans iptali için daraltılmış kontrol — sadece ofis rolleri. */
async function requireCancelAccess() {
  const user = await getCurrentUser();
  if (!user || !PRODUCTION_CANCEL_ROLES.includes(user.role)) {
    throw new Error("Seans iptali için yetkiniz yok");
  }
  return user;
}

// ─── READ ACTIONS ───────────────────────────────────────────────

/** Montaj adımı olan aktif ürünleri getir */
export async function getActiveProductsWithSteps() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: products, error: pErr } = await supabase
      .from("products")
      .select("sku, urun_adi, kategori")
      .eq("aktif_mi", true)
      .order("gunluk_satis", { ascending: false });

    if (pErr) return { success: false as const, error: pErr.message };
    if (!products || products.length === 0) return { success: true as const, data: [] };

    /**
     * Burada tek bir .in() sorgusu vardı. PostgREST varsayılanı 1000 satır;
     * bugünkü veride (622 adım) sınır aşılmıyor, yani LS011'in görünmemesinin
     * sebebi BU DEĞİLDİ — o istemci tarafındaki bulanık aramaydı. Ancak ürün
     * başına ~9 adımla 110 ürünü geçtiğimizde liste sessizce kesilecekti:
     * hata vermeyen, fark edilmesi zor bir kesilme. Şimdiden parçalanıyor ve
     * limit açıkça veriliyor.
     */
    const skus = products.map((p) => p.sku);
    const skusWithSteps = new Set<string>();
    for (let i = 0; i < skus.length; i += 100) {
      const { data: steps, error: sErr } = await supabase
        .from("assembly_steps")
        .select("sku")
        .in("sku", skus.slice(i, i + 100))
        .limit(5000);
      if (sErr) return { success: false as const, error: sErr.message };
      for (const st of steps ?? []) if (st.sku) skusWithSteps.add(st.sku);
    }
    const filtered = products.filter((p) => skusWithSteps.has(p.sku));
    return { success: true as const, data: filtered };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/**
 * montaj_sessions.workers alanını çözer. JSONB ya da (eski kayıtlarda)
 * string olabilir; boşsa seansı açan operatöre düşülür.
 */
function parseSessionWorkers(
  ham: unknown,
  operatorId: string | null,
  operatorName: string | null,
): { id: string; name: string }[] {
  let w: unknown = ham;
  if (typeof w === "string") { try { w = JSON.parse(w); } catch { w = null; } }
  if (Array.isArray(w)) {
    const liste = w.map((x) => {
      const o = x as { id?: unknown; name?: unknown };
      const id = o?.id != null ? String(o.id) : null;
      return id ? { id, name: o?.name ? String(o.name) : id } : null;
    }).filter(Boolean) as { id: string; name: string }[];
    if (liste.length > 0) return liste;
  }
  if (operatorId) return [{ id: operatorId, name: operatorName ?? operatorId }];
  return [];
}

/** Bir ürünün montaj adımlarını getir (seq_no sıralı, bom_count ile) */
export async function getStepsForProduct(sku: string) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: steps, error } = await supabase
      .from("assembly_steps")
      .select("step_id, sku, step_name, seq_no, is_final_step")
      .eq("sku", sku)
      .neq("step_name", "PAKETLEME")
      .order("seq_no", { ascending: true });

    if (error) return { success: false as const, error: error.message };
    if (!steps || steps.length === 0) return { success: true as const, data: [] };

    // BOM count per step
    const stepIds = steps.map((s) => s.step_id);
    const { data: bomData } = await supabase
      .from("step_bom")
      .select("step_id")
      .in("step_id", stepIds);

    const bomCountMap = new Map<string, number>();
    for (const b of bomData ?? []) {
      bomCountMap.set(b.step_id, (bomCountMap.get(b.step_id) || 0) + 1);
    }

    const result = steps.map((s) => ({
      ...s,
      bom_count: bomCountMap.get(s.step_id) || 0,
    }));

    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Tek bir adımın BOM'u + stok durumu */
export async function getStepBomWithStock(stepId: string, qty: number = 1) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: bomItems, error } = await supabase
      .from("step_bom")
      .select("step_bom_id, step_id, part_id, qty_per, kodu")
      .eq("step_id", stepId);

    if (error) return { success: false as const, error: error.message };
    if (!bomItems || bomItems.length === 0) return { success: true as const, data: [] };

    // Part bilgileri
    const regularPartIds = [...new Set(bomItems.filter((b) => !b.part_id.startsWith("ASM-")).map((b) => b.part_id))];
    const asmPartIds = [...new Set(bomItems.filter((b) => b.part_id.startsWith("ASM-")).map((b) => b.part_id))];

    const partInfoMap = new Map<string, { name: string; type: string | null }>();

    if (regularPartIds.length > 0) {
      const { data: parts } = await supabase
        .from("all_parts")
        .select("part_id, part_adi, part_type")
        .in("part_id", regularPartIds);

      for (const p of parts ?? []) {
        partInfoMap.set(p.part_id, { name: p.part_adi || "—", type: p.part_type });
      }
    }

    if (asmPartIds.length > 0) {
      const { data: asmSteps } = await supabase
        .from("assembly_steps")
        .select("step_id, step_name")
        .in("step_id", asmPartIds);

      for (const s of asmSteps ?? []) {
        partInfoMap.set(s.step_id, { name: s.step_name || s.step_id, type: null });
      }
    }

    // Stok bilgileri
    const yarimamulIds = regularPartIds.filter((id) => partInfoMap.get(id)?.type === "YARIMAMUL");
    const hazirIds = regularPartIds.filter((id) => {
      const t = partInfoMap.get(id)?.type;
      return t && t !== "YARIMAMUL";
    });

    const stockMap: Record<string, number> = {};

    if (yarimamulIds.length > 0) {
      const { data: ymsIn } = await supabase
        .from("yari_mamul_stok")
        .select("part_id, qty")
        .in("part_id", yarimamulIds)
        .eq("direction", "IN");

      const { data: ymsOut } = await supabase
        .from("yari_mamul_stok")
        .select("part_id, qty")
        .in("part_id", yarimamulIds)
        .eq("direction", "OUT");

      const inMap: Record<string, number> = {};
      for (const r of ymsIn ?? []) {
        if (r.part_id) inMap[r.part_id] = (inMap[r.part_id] || 0) + r.qty;
      }
      const outMap: Record<string, number> = {};
      for (const r of ymsOut ?? []) {
        if (r.part_id) outMap[r.part_id] = (outMap[r.part_id] || 0) + r.qty;
      }

      for (const id of yarimamulIds) {
        stockMap[id] = (inMap[id] || 0) - (outMap[id] || 0);
      }
    }

    if (hazirIds.length > 0) {
      const { data: hazirParts } = await supabase
        .from("all_parts")
        .select("part_id, hazir_eleman_aktif_stok")
        .in("part_id", hazirIds);

      for (const p of hazirParts ?? []) {
        stockMap[p.part_id] = p.hazir_eleman_aktif_stok;
      }
    }

    const enriched = bomItems.map((b) => {
      const info = partInfoMap.get(b.part_id);
      const isAsm = b.part_id.startsWith("ASM-");
      return {
        step_bom_id: b.step_bom_id,
        step_id: b.step_id,
        part_id: b.part_id,
        part_name: info?.name || b.part_id,
        part_type: info?.type || null,
        is_asm_reference: isAsm,
        qty_per: b.qty_per,
        qty_needed: b.qty_per * qty,
        stock_available: isAsm ? null : (stockMap[b.part_id] ?? 0),
        is_sufficient: isAsm ? true : (stockMap[b.part_id] ?? 0) >= b.qty_per * qty,
      };
    });

    return { success: true as const, data: enriched };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Montaj istasyonu operatörlerini getir */
export async function getMontajOperators() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("users")
      .select("user_id, full_name, role")
      .eq("is_active", true)
      .eq("station", "Montaj")
      .order("full_name");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** KPI analiz verisi */
export async function getMontajAnalytics(period: "today" | "week" | "month" | "lastMonth") {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const now = new Date();
    let since: Date;
    let until: Date | null = null;
    if (period === "today") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    } else if (period === "lastMonth") {
      since = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      until = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      since = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    }

    let query = supabase
      .from("montaj_sessions")
      .select("session_id, qty, start_time, end_time, worker_count, workers, birim_montaj_dk")
      .eq("durum", "tamamlandi")
      .gte("end_time", since.toISOString());

    if (until) {
      query = query.lt("end_time", until.toISOString());
    }

    const { data, error } = await query;

    if (error) return { success: false as const, error: error.message };

    const sessions = data ?? [];
    const totalQty = sessions.reduce((sum, s) => sum + (Number(s.qty) || 0), 0);

    const workerIds = new Set<string>();
    sessions.forEach((s) => {
      const workers = parseWorkers(s.workers);
      if (workers) {
        workers.forEach((w) => workerIds.add(w.id));
      }
    });

    let totalMinutes = 0;
    sessions.forEach((s) => {
      if (s.start_time && s.end_time) {
        const diff = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
        totalMinutes += diff / 60000;
      }
    });

    const withBirim = sessions.filter((s) => s.birim_montaj_dk && Number(s.birim_montaj_dk) > 0);
    const avgBirimDk = withBirim.length > 0
      ? withBirim.reduce((sum, s) => sum + Number(s.birim_montaj_dk), 0) / withBirim.length
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

/** Günlük trend verisi (ürün bazlı) */
export async function getStepTrend(sku: string, days: number = 30) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from("montaj_sessions")
      .select("session_id, end_time, qty, birim_montaj_dk, worker_count, step_name")
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

/** Günlük satış hızına göre en çok satan ürünler — montaj adımı olanlar (quick-select) */
export async function getTopMontajProducts(limit: number = 10) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    // Over-fetch: montaj adımı olmayanlar filtrelenecek
    const { data, error } = await supabase
      .from("products")
      .select("sku, urun_adi, gunluk_satis")
      .eq("aktif_mi", true)
      .gt("gunluk_satis", 0)
      .order("gunluk_satis", { ascending: false })
      .limit(50);

    if (error) return { success: false as const, error: error.message };
    if (!data || data.length === 0) return { success: true as const, data: [] };

    // Sadece montaj adımı olan ürünleri filtrele
    const skus = data.map((p) => p.sku);
    const { data: stepsData } = await supabase
      .from("assembly_steps")
      .select("sku")
      .in("sku", skus);

    const skusWithSteps = new Set((stepsData ?? []).map((s) => s.sku));

    const result = data
      .filter((p) => skusWithSteps.has(p.sku))
      .slice(0, limit)
      .map((p) => ({
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

/** Paketlemeye hazır stok — son adım tamamlanan - paketlenen = bekleyen */
export async function getPackageReadyStock() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    // Son adım tamamlanan seanslar (is_final_step=true, durum=tamamlandi)
    const { data: finalSessions } = await supabase
      .from("montaj_sessions")
      .select("sku, qty")
      .eq("is_final_step", true)
      .eq("durum", "tamamlandi");

    // Paketlenen toplam (pack_events, tamamlandi)
    const { data: packEvents } = await supabase
      .from("pack_events")
      .select("sku, qty")
      .eq("durum", "tamamlandi");

    // SKU bazlı toplam
    const montajMap = new Map<string, number>();
    for (const r of finalSessions ?? []) {
      if (!r.sku) continue;
      montajMap.set(r.sku, (montajMap.get(r.sku) || 0) + (Number(r.qty) || 0));
    }

    const paketMap = new Map<string, number>();
    for (const r of packEvents ?? []) {
      if (!r.sku) continue;
      paketMap.set(r.sku, (paketMap.get(r.sku) || 0) + (Number(r.qty) || 0));
    }

    // Sadece bekleyen > 0 olanları al
    const skusWithPending: string[] = [];
    const results: Array<{ sku: string; montajTotal: number; paketTotal: number; bekleyen: number }> = [];

    for (const [sku, montajTotal] of montajMap) {
      const paketTotal = paketMap.get(sku) || 0;
      const bekleyen = montajTotal - paketTotal;
      if (bekleyen > 0) {
        skusWithPending.push(sku);
        results.push({ sku, montajTotal, paketTotal, bekleyen });
      }
    }

    if (skusWithPending.length === 0) return { success: true as const, data: [] };

    // Ürün isimleri
    const { data: products } = await supabase
      .from("products")
      .select("sku, urun_adi")
      .in("sku", skusWithPending);

    const productMap = new Map<string, string>();
    for (const p of products ?? []) {
      productMap.set(p.sku, p.urun_adi ?? p.sku);
    }

    const enriched = results
      .map((r) => ({ ...r, urun_adi: productMap.get(r.sku) ?? r.sku }))
      .sort((a, b) => b.bekleyen - a.bekleyen);

    return { success: true as const, data: enriched };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Adım bazlı ortalama birim süre (performans grafiği için) */
export async function getStepPerformance(sku: string) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("montaj_sessions")
      .select("step_id, step_name, seq_no, birim_montaj_dk")
      .eq("sku", sku)
      .eq("durum", "tamamlandi")
      .not("birim_montaj_dk", "is", null);

    if (error) return { success: false as const, error: error.message };

    // Step bazlı ortalama hesapla
    const stepMap = new Map<string, {
      step_name: string;
      seq_no: number;
      total: number;
      count: number;
    }>();

    for (const r of data ?? []) {
      const existing = stepMap.get(r.step_id);
      const val = Number(r.birim_montaj_dk) || 0;
      if (existing) {
        existing.total += val;
        existing.count += 1;
      } else {
        stepMap.set(r.step_id, {
          step_name: r.step_name || r.step_id,
          seq_no: r.seq_no || 0,
          total: val,
          count: 1,
        });
      }
    }

    const result = Array.from(stepMap.values())
      .map((s) => ({
        step_name: s.step_name,
        seq_no: s.seq_no,
        avgBirimDk: Math.round((s.total / s.count) * 100) / 100,
        sessionCount: s.count,
      }))
      .sort((a, b) => a.seq_no - b.seq_no);

    // Paketleme birim süresini pack_events'ten ekle
    const { data: packData } = await supabase
      .from("pack_events")
      .select("birim_paketleme_dk")
      .eq("sku", sku)
      .eq("status", "Closed")
      .not("birim_paketleme_dk", "is", null);

    if (packData && packData.length > 0) {
      const avgPaket = packData.reduce((sum, p) => sum + (Number(p.birim_paketleme_dk) || 0), 0) / packData.length;
      const maxSeq = result.length > 0 ? Math.max(...result.map(r => r.seq_no)) : 0;
      result.push({
        step_name: "PAKETLEME",
        seq_no: maxSeq + 1,
        avgBirimDk: Math.round(avgPaket * 100) / 100,
        sessionCount: packData.length,
      });
    }

    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Tamamlanan seanslar — filtreleme + sayfalama */
export async function getCompletedSessions(params: {
  period?: "today" | "week" | "month" | "all";
  sku?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const page = params.page || 1;
    const pageSize = params.pageSize || 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("montaj_sessions")
      .select("session_id, sku, step_name, seq_no, is_final_step, qty, start_time, end_time, durum, worker_count, workers, birim_montaj_dk, operator_name", { count: "exact" })
      .eq("durum", "tamamlandi")
      .order("end_time", { ascending: false });

    // Period filter
    if (params.period && params.period !== "all") {
      const now = new Date();
      let since: Date;
      if (params.period === "today") {
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (params.period === "week") {
        since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      } else {
        since = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      }
      query = query.gte("end_time", since.toISOString());
    }

    // Date range filter
    if (params.dateFrom) {
      query = query.gte("end_time", `${params.dateFrom}T00:00:00`);
    }
    if (params.dateTo) {
      query = query.lte("end_time", `${params.dateTo}T23:59:59`);
    }

    // SKU filter
    if (params.sku) {
      query = query.eq("sku", params.sku);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) return { success: false as const, error: error.message };

    // Ürün isimleri
    const skus = [...new Set((data ?? []).map((s) => s.sku).filter(Boolean) as string[])];
    let productMap = new Map<string, string>();
    if (skus.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("sku, urun_adi")
        .in("sku", skus);
      productMap = new Map((products ?? []).map((p) => [p.sku, p.urun_adi ?? ""]));
    }

    const enriched = (data ?? []).map((s) => ({
      ...s,
      workers: s.workers as Array<{ id: string; name: string }> | null,
      birim_montaj_dk: s.birim_montaj_dk ? Number(s.birim_montaj_dk) : null,
      qty: Number(s.qty) || 0,
      urun_adi: s.sku ? productMap.get(s.sku) ?? undefined : undefined,
    }));

    return {
      success: true as const,
      data: enriched,
      total: count ?? 0,
      page,
      pageSize,
    };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── MUTATION ACTIONS ───────────────────────────────────────────

/** Yeni montaj seansı oluştur */
export async function createMontajSession(
  sku: string,
  stepId: string,
  workers?: Array<{ id: string; name: string }>
): Promise<ActionResult> {
  try {
    const user = await requireProductionAccess();

    if (!sku || !stepId) {
      return { success: false, error: "Ürün ve adım seçimi gereklidir" };
    }

    const supabase = await createClient();

    // Adım bilgisi
    const { data: step } = await supabase
      .from("assembly_steps")
      .select("step_id, step_name, seq_no, is_final_step, sku")
      .eq("step_id", stepId)
      .single();

    if (!step) return { success: false, error: "Montaj adımı bulunamadı" };
    if (step.sku !== sku) return { success: false, error: "Adım bu ürüne ait değil" };

    // Operatör bilgisi
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = authUser?.user_metadata?.selected_operator_id ?? user.user_id;
    const operatorName = authUser?.user_metadata?.selected_operator_name ?? user.full_name;
    const email = authUser?.email ?? user.email;

    // Generate session_id: MNT-YYYYMMDD-HHMMSS
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let sessionId = `MNT-${datePart}-${timePart}`;

    // Check uniqueness
    const { data: existing } = await supabase
      .from("montaj_sessions")
      .select("session_id")
      .eq("session_id", sessionId)
      .limit(1);

    if (existing && existing.length > 0) {
      sessionId = `${sessionId}-${String(now.getMilliseconds()).padStart(3, "0")}`;
    }

    // Workers: seans açılışında seçilenler veya sadece aktif operatör
    const sessionWorkers = workers && workers.length > 0
      ? workers
      : [{ id: operatorId, name: operatorName }];

    // INSERT
    const { error } = await supabase.from("montaj_sessions").insert({
      session_id: sessionId,
      sku,
      step_id: stepId,
      step_name: step.step_name,
      seq_no: step.seq_no,
      is_final_step: step.is_final_step ?? false,
      durum: "montajda",
      email,
      operator_id: operatorId,
      operator_name: operatorName,
      start_time: now.toISOString(),
      qty: 0,
      worker_count: sessionWorkers.length,
      workers: JSON.stringify(sessionWorkers),
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/montaj");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Seans kapat: montajda → tamamlandi + stok düşümü */
export async function closeMontajSession(
  sessionId: string,
  formData: { qty: number; workers?: { id: string; name: string }[] }
): Promise<ActionResult> {
  try {
    await requireProductionAccess();

    const supabase = await createClient();

    // Seans bilgileri
    const { data } = await supabase
      .from("montaj_sessions")
      .select("session_id, durum, sku, step_id, start_time, operator_id, operator_name, workers")
      .eq("session_id", sessionId)
      .single();

    const session = data as {
      session_id: string;
      durum: string;
      sku: string;
      step_id: string;
      start_time: string | null;
      operator_id: string | null;
      operator_name: string | null;
      workers: unknown;
    } | null;

    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "montajda") return { success: false, error: "Seans aktif değil" };

    const now = new Date();
    const endTime = now.toISOString();

    const qty = Number(formData.qty);
    if (!Number.isFinite(qty) || qty < 1 || qty > 99999) {
      return { success: false, error: "Geçerli bir adet giriniz" };
    }

    /**
     * Çalışanlar seans AÇILIŞINDA seçiliyor; kapanışta tekrar sorulmuyor.
     * İki kez seçtirmek hem gereksiz hem de iki listenin çelişme riski
     * taşıyordu. Kapanışta liste gelirse (eski istemci) o kullanılır.
     */
    const workers = (formData.workers && formData.workers.length > 0)
      ? formData.workers
      : parseSessionWorkers(session.workers, session.operator_id, session.operator_name);

    if (workers.length === 0) {
      return { success: false, error: "Seansta kayıtlı çalışan bulunamadı" };
    }

    // Birim montaj süresi — molalar düşülmüş net süreden hesaplanır.
    // Seans bir çay veya öğle molasını kapsıyorsa o dakikalar işçilik
    // sayılmamalı; standart süre analizinde bu fark birikiyor.
    let birimDk: number | null = null;
    let brutDk: number | null = null;
    let molaDk: number | null = null;
    let netDk: number | null = null;

    if (session.start_time) {
      const { data: sureData } = await supabase.rpc("montaj_sure_hesapla", {
        p_bas: session.start_time,
        p_bit: endTime,
        p_operator_id: session.operator_id,
      });

      const sure = Array.isArray(sureData) ? sureData[0] : sureData;
      if (sure) {
        brutDk = Number(sure.brut);
        molaDk = Number(sure.mola);
        netDk = Number(sure.net);
      } else {
        // Fonksiyon bir sebeple dönmezse brüt süreye düş
        brutDk = Math.round(((now.getTime() - new Date(session.start_time).getTime()) / 60000) * 100) / 100;
        molaDk = 0;
        netDk = brutDk;
      }

      if (qty > 0 && workers.length > 0 && netDk !== null) {
        birimDk = Math.round((netDk / (qty * workers.length)) * 100) / 100;
      }
    }

    // Update montaj_sessions
    const { error: updateError } = await supabase
      .from("montaj_sessions")
      .update({
        durum: "tamamlandi",
        end_time: endTime,
        qty,
        worker_count: workers.length,
        workers,
        birim_montaj_dk: birimDk,
        brut_sure_dk: brutDk,
        mola_dk: molaDk,
        net_sure_dk: netDk,
      })
      .eq("session_id", sessionId);

    if (updateError) return { success: false, error: updateError.message };

    // ─── Stok Düşümü ───
    const stockResult = await deductStockForSession(supabase, session.step_id, sessionId, session.sku, qty, session.operator_id);
    if (!stockResult.success) {
      return { success: false, error: stockResult.error };
    }

    revalidatePath("/uretim/montaj");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Aktif seansı iptal et (sil) */
export async function cancelMontajSession(sessionId: string): Promise<ActionResult> {
  try {
    await requireCancelAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("montaj_sessions")
      .select("durum")
      .eq("session_id", sessionId)
      .single();

    const session = data as { durum: string } | null;
    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "montajda") {
      return { success: false, error: "Sadece devam eden seans iptal edilebilir" };
    }

    // .select() şart: RLS bir DELETE'i engellediğinde hata DÖNMEZ, sadece
    // 0 satır etkilenir. Dönen satırları saymazsak silinmemiş bir seans için
    // success:true döner ve arayüz kullanıcıya yalan söyler.
    const { data: deleted, error } = await supabase
      .from("montaj_sessions")
      .delete()
      .eq("session_id", sessionId)
      .eq("durum", "montajda")
      .select("session_id");

    if (error) return { success: false, error: error.message };

    if (!deleted || deleted.length === 0) {
      return {
        success: false,
        error:
          "Seans silinemedi. Bu işlem için veritabanı yetkiniz olmayabilir; " +
          "sorun sürerse yöneticinize bildirin.",
      };
    }

    revalidatePath("/uretim/montaj");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Tamamlanan seansı düzenle (qty, workers) + stok güncelle */
export async function updateCompletedMontajSession(
  sessionId: string,
  formData: {
    qty: number;
    start_time?: string;
    end_time?: string;
    workers: { id: string; name: string }[];
  }
): Promise<ActionResult> {
  try {
    await requireProductionAccess();

    const parsed = montajSessionCloseSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    const { data } = await supabase
      .from("montaj_sessions")
      .select("session_id, durum, sku, step_id, start_time, end_time, qty, operator_id")
      .eq("session_id", sessionId)
      .single();

    const session = data as {
      session_id: string;
      durum: string;
      sku: string;
      step_id: string;
      start_time: string | null;
      end_time: string | null;
      qty: number;
      operator_id: string | null;
    } | null;

    if (!session) return { success: false, error: "Seans bulunamadı" };
    if (session.durum !== "tamamlandi") {
      return { success: false, error: "Sadece tamamlanan seanslar düzenlenebilir" };
    }

    const { qty, workers } = parsed.data;
    const oldQty = Number(session.qty) || 0;

    /**
     * Gecikmeli kapatma / geç başlatma düzeltmesi: hem başlangıç hem bitiş
     * elle değiştirilebiliyor. Verilmeyen taraf mevcut değerini korur.
     */
    const yeniBas = formData.start_time ?? session.start_time;
    const yeniBit = formData.end_time ?? session.end_time;

    if (yeniBas && yeniBit && new Date(yeniBit) <= new Date(yeniBas)) {
      return { success: false, error: "Bitiş saati başlangıçtan sonra olmalı" };
    }
    if (yeniBit && new Date(yeniBit).getTime() > Date.now() + 60_000) {
      return { success: false, error: "Bitiş saati gelecekte olamaz" };
    }

    /**
     * Süre, seans kapanışıyla AYNI yoldan hesaplanıyor: molalar düşülmüş net
     * süre. Burada ham fark kullanılsaydı elle düzeltilen bir seans, normal
     * kapatılan seanslarla kıyaslanamaz hale gelirdi.
     */
    let birimDk: number | null = null;
    let brutDk: number | null = null;
    let molaDk: number | null = null;
    let netDk: number | null = null;

    if (yeniBas && yeniBit) {
      const { data: sureData } = await supabase.rpc("montaj_sure_hesapla", {
        p_bas: yeniBas,
        p_bit: yeniBit,
        p_operator_id: session.operator_id,
      });
      const sure = Array.isArray(sureData) ? sureData[0] : sureData;
      if (sure) {
        brutDk = Number(sure.brut);
        molaDk = Number(sure.mola);
        netDk = Number(sure.net);
      } else {
        brutDk = Math.round(((new Date(yeniBit).getTime() - new Date(yeniBas).getTime()) / 60000) * 100) / 100;
        molaDk = 0;
        netDk = brutDk;
      }
      if (qty > 0 && workers.length > 0 && netDk !== null) {
        birimDk = Math.round((netDk / (qty * workers.length)) * 100) / 100;
      }
    }

    // Update montaj_sessions
    const { error: updateError } = await supabase
      .from("montaj_sessions")
      .update({
        qty,
        worker_count: workers.length,
        workers,
        birim_montaj_dk: birimDk,
        brut_sure_dk: brutDk,
        mola_dk: molaDk,
        net_sure_dk: netDk,
        // Operatör yanlış saatte başlatmış/kapatmış olabilir
        ...(formData.start_time ? { start_time: formData.start_time } : {}),
        ...(formData.end_time ? { end_time: formData.end_time } : {}),
      })
      .eq("session_id", sessionId);

    if (updateError) return { success: false, error: updateError.message };

    // Stok güncelle (eğer qty değiştiyse)
    if (qty !== oldQty) {
      // Eski OUT kayıtlarını sil
      await supabase
        .from("yari_mamul_stok")
        .delete()
        .eq("source_id", sessionId);

      // Hazır eleman stokunu eski değeri geri ekle
      await reverseHazirStockForSession(supabase, session.step_id, oldQty);

      // Yeni değerle stok düş
      const stockResult = await deductStockForSession(supabase, session.step_id, sessionId, session.sku, qty, session.operator_id);
      if (!stockResult.success) {
        return { success: false, error: stockResult.error };
      }
    }

    revalidatePath("/uretim/montaj");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── STOK HELPER FONKSİYONLARI ─────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function deductStockForSession(
  supabase: SupabaseClient,
  stepId: string,
  sessionId: string,
  sku: string,
  qty: number,
  operatorId: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  // Idempotency: mevcut kayıt kontrolü
  const { data: existingYms } = await supabase
    .from("yari_mamul_stok")
    .select("source_id")
    .eq("source_id", sessionId)
    .limit(1);

  if (existingYms && existingYms.length > 0) {
    return { success: true };
  }

  // BOM al
  const { data: bomItems } = await supabase
    .from("step_bom")
    .select("step_bom_id, step_id, part_id, qty_per")
    .eq("step_id", stepId);

  if (!bomItems || bomItems.length === 0) return { success: true };

  // Part bilgileri
  const regularPartIds = [...new Set(bomItems.filter((b) => !b.part_id.startsWith("ASM-")).map((b) => b.part_id))];
  if (regularPartIds.length === 0) return { success: true };

  const { data: parts } = await supabase
    .from("all_parts")
    .select("part_id, part_adi, part_type")
    .in("part_id", regularPartIds);

  const partMap = new Map((parts ?? []).map((p) => [p.part_id, p]));
  const yarimamulParts = new Set(
    (parts ?? []).filter((p) => p.part_type === "YARIMAMUL").map((p) => p.part_id)
  );
  const hazirParts = (parts ?? []).filter((p) => p.part_type && p.part_type !== "YARIMAMUL");

  // YARIMAMUL → yari_mamul_stok INSERT direction='OUT'
  if (yarimamulParts.size > 0) {
    const { data: lastYms } = await supabase
      .from("yari_mamul_stok")
      .select("yms_id")
      .like("yms_id", "YMS-%")
      .order("yms_id", { ascending: false })
      .limit(1);

    let ymsNum = 1;
    if (lastYms && lastYms.length > 0) {
      const match = lastYms[0].yms_id.match(/YMS-(\d+)/);
      if (match) ymsNum = parseInt(match[1], 10) + 1;
    }

    const now = new Date().toISOString();
    const ymsInserts = bomItems
      .filter((b) => yarimamulParts.has(b.part_id))
      .map((b) => {
        const ymsId = `YMS-${String(ymsNum).padStart(6, "0")}`;
        ymsNum++;
        const partInfo = partMap.get(b.part_id);
        return {
          yms_id: ymsId,
          tarih: now,
          part_id: b.part_id,
          part_adi: partInfo?.part_adi ?? null,
          sku,
          qty: b.qty_per * qty,
          direction: "OUT",
          source: "Montaj",
          source_id: sessionId,
          operator: operatorId,
        };
      });

    if (ymsInserts.length > 0) {
      const { error: ymsError } = await supabase.from("yari_mamul_stok").insert(ymsInserts);
      if (ymsError) return { success: false, error: ymsError.message };
    }
  }

  // HAZIR/KUTU/KARTON → all_parts hazir_eleman_aktif_stok -= qty
  for (const part of hazirParts) {
    const bomForPart = bomItems.filter((b) => b.part_id === part.part_id);
    const totalQtyPer = bomForPart.reduce((sum, b) => sum + b.qty_per, 0);
    const deductAmount = totalQtyPer * qty;

    if (deductAmount > 0) {
      // Read current stock, then update
      const { data: currentPart } = await supabase
        .from("all_parts")
        .select("hazir_eleman_aktif_stok")
        .eq("part_id", part.part_id)
        .single();

      if (currentPart) {
        const newStock = (currentPart.hazir_eleman_aktif_stok || 0) - deductAmount;
        await supabase
          .from("all_parts")
          .update({ hazir_eleman_aktif_stok: newStock })
          .eq("part_id", part.part_id);
      }
    }
  }

  return { success: true };
}

async function reverseHazirStockForSession(
  supabase: SupabaseClient,
  stepId: string,
  oldQty: number
): Promise<void> {
  const { data: bomItems } = await supabase
    .from("step_bom")
    .select("part_id, qty_per")
    .eq("step_id", stepId);

  if (!bomItems || bomItems.length === 0) return;

  const regularPartIds = [...new Set(bomItems.filter((b) => !b.part_id.startsWith("ASM-")).map((b) => b.part_id))];
  if (regularPartIds.length === 0) return;

  const { data: parts } = await supabase
    .from("all_parts")
    .select("part_id, part_type, hazir_eleman_aktif_stok")
    .in("part_id", regularPartIds);

  const hazirParts = (parts ?? []).filter((p) => p.part_type && p.part_type !== "YARIMAMUL");

  for (const part of hazirParts) {
    const bomForPart = bomItems.filter((b) => b.part_id === part.part_id);
    const totalQtyPer = bomForPart.reduce((sum, b) => sum + b.qty_per, 0);
    const restoreAmount = totalQtyPer * oldQty;

    if (restoreAmount > 0) {
      const newStock = (part.hazir_eleman_aktif_stok || 0) + restoreAmount;
      await supabase
        .from("all_parts")
        .update({ hazir_eleman_aktif_stok: newStock })
        .eq("part_id", part.part_id);
    }
  }
}

/**
 * Tamamlanmış montaj seansını siler.
 *
 * İş veritabanı fonksiyonunda (montaj_seansi_sil). Sebebi paketlemedekiyle
 * aynı: yari_mamul_stok ve all_parts üzerinde dar yetki var, üretim rolü
 * doğrudan silemiyor. Tabloya geniş yetki açmak yerine yalnızca o seansa
 * bağlı kayıtları temizleyen yetkili fonksiyon kullanılıyor.
 *
 * Fonksiyon kapanışın simetriğini yapar: hazır eleman bakiyeleri reçeteye
 * göre geri eklenir, yarı mamül defter kayıtları silinir, sonra seans.
 * Hepsi tek işlemde — yarım kalmaz.
 */
export async function deleteCompletedMontajSession(sessionId: string): Promise<ActionResult> {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { error } = await supabase.rpc("montaj_seansi_sil", {
      p_session_id: sessionId,
    });
    if (error) return { success: false, error: error.message };

    revalidatePath("/uretim/montaj");
    revalidatePath("/stok/yari-mamul");
    revalidatePath("/stok/hazir-eleman");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
