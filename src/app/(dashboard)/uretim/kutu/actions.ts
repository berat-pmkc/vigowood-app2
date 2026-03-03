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

/** Bir SKU'ya ait karton şablonları getir (plaka_parts + all_parts join) */
export async function getKartonSablonlarForSku(sku: string) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data: sablonlar, error } = await supabase
      .from("plakalar")
      .select("plakalar_id, plaka_id, renk, kesim_sureleri, en, boy")
      .eq("plaka_kategori", "KARTON")
      .contains("sku", [sku])
      .order("plakalar_id");

    if (error) return { success: false as const, error: error.message };

    // Get plaka_parts for each
    const plakaIds = (sablonlar ?? []).map((s) => s.plaka_id);
    let partInfoMap = new Map<string, { part_id: string; part_adi: string; stok: number; kritik: number }>();

    if (plakaIds.length > 0) {
      const { data: pparts } = await supabase
        .from("plaka_parts")
        .select("plaka_id, part_id")
        .in("plaka_id", plakaIds);

      if (pparts && pparts.length > 0) {
        const partIds = [...new Set(pparts.map((p) => p.part_id))];
        const { data: parts } = await supabase
          .from("all_parts")
          .select("part_id, part_adi, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok")
          .in("part_id", partIds);

        const partsMap = new Map(
          (parts ?? []).map((p) => [
            p.part_id,
            {
              part_adi: p.part_adi,
              stok: p.hazir_eleman_aktif_stok ?? 0,
              kritik: p.hazir_eleman_kritik_stok ?? 0,
            },
          ])
        );

        partInfoMap = new Map(
          pparts.map((pp) => {
            const info = partsMap.get(pp.part_id);
            return [
              pp.plaka_id,
              {
                part_id: pp.part_id,
                part_adi: info?.part_adi ?? pp.part_id,
                stok: info?.stok ?? 0,
                kritik: info?.kritik ?? 0,
              },
            ];
          })
        );
      }
    }

    const result = (sablonlar ?? []).map((s) => {
      const ks = (s.kesim_sureleri ?? {}) as Record<string, number>;
      const partInfo = partInfoMap.get(s.plaka_id);
      return {
        plaka_id: s.plaka_id,
        tur: s.renk as string | null,
        en: s.en,
        boy: s.boy,
        kutu_sure_dk: ks["KUTU"] ?? null,
        part_id: partInfo?.part_id ?? null,
        part_adi: partInfo?.part_adi ?? null,
        part_stok: partInfo?.stok ?? 0,
        part_kritik: partInfo?.kritik ?? 0,
      };
    });

    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Son 3 ayda en çok üretilen SKU'lar (ürün adıyla birlikte) */
export async function getTopKutuSkus(limit = 10) {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data, error } = await supabase
      .from("kutu_uretim")
      .select("sku")
      .not("sku", "is", null)
      .gte("created_at", threeMonthsAgo.toISOString())
      .eq("durum", "tamamlandi");

    if (error) return { success: false as const, error: error.message };

    // Group by SKU, count
    const skuCounts = new Map<string, number>();
    for (const row of data ?? []) {
      if (!row.sku) continue;
      skuCounts.set(row.sku, (skuCounts.get(row.sku) ?? 0) + 1);
    }

    const topSkus = [...skuCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([sku, count]) => ({ sku, count }));

    // Fetch product names
    const skuList = topSkus.map((s) => s.sku);
    const { data: products } = await supabase
      .from("products")
      .select("sku, urun_adi")
      .in("sku", skuList.length > 0 ? skuList : ["__none__"]);

    const productMap = new Map(
      (products ?? []).map((p) => [p.sku, p.urun_adi])
    );

    const result = topSkus.map((s) => ({
      ...s,
      urun_adi: productMap.get(s.sku) ?? s.sku,
    }));

    return { success: true as const, data: result };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

/** Kutu istasyonu operatörleri */
export async function getKutuOperators() {
  try {
    await requireProductionAccess();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("users")
      .select("user_id, full_name, station")
      .in("station", ["Kutu", "Kutu Hattı"])
      .eq("is_active", true)
      .order("full_name");

    if (error) return { success: false as const, error: error.message };
    return { success: true as const, data: data ?? [] };
  } catch (e) {
    return { success: false as const, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── MUTATION ACTIONS ───────────────────────────────────────────

/** Yeni kutu üretim seansı oluştur — auto-start "uretimde" */
export async function createKutuSession(formData: {
  plaka_id: string;
  sku: string;
  part_id: string;
  qty: number;
  not_text: string | null;
  operator_id?: string;
  operator_name?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireProductionAccess();

    const parsed = kutuSessionCreateSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = await createClient();

    // Operatör bilgisi — form'dan gelen veya auth'tan
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const operatorId = formData.operator_id ?? authUser?.user_metadata?.selected_operator_id ?? user.user_id;
    const operatorName = formData.operator_name ?? authUser?.user_metadata?.selected_operator_name ?? user.full_name;
    const email = authUser?.email ?? user.email;

    // Parça bilgisi
    const { data: partData } = await supabase
      .from("all_parts")
      .select("part_adi, part_type")
      .eq("part_id", parsed.data.part_id)
      .single();

    const part = partData as { part_adi: string; part_type: string } | null;
    if (!part) return { success: false, error: "Parça bulunamadı" };

    // Generate session_id: KUT-YYYYMMDD-HHMMSS
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    let sessionId = `KUT-${datePart}-${timePart}`;

    const { data: existing } = await supabase
      .from("kutu_uretim")
      .select("session_id")
      .eq("session_id", sessionId)
      .limit(1);

    if (existing && existing.length > 0) {
      sessionId = `${sessionId}-${pad(now.getMilliseconds())}`;
    }

    // INSERT — auto-start as "uretimde"
    const { error } = await supabase.from("kutu_uretim").insert({
      session_id: sessionId,
      email: email,
      tarih: now.toISOString(),
      part_id: parsed.data.part_id,
      part_adi: part.part_adi,
      part_type: part.part_type,
      qty: parsed.data.qty,
      not_text: parsed.data.not_text,
      durum: "uretimde",
      operator_id: operatorId,
      operator_name: operatorName,
      start_time: now.toISOString(),
      plaka_id: parsed.data.plaka_id,
      sku: parsed.data.sku,
    });

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
      revalidatePath("/uretim/kutu");
      return { success: true };
    }
    if (session.durum !== "uretimde") return { success: false, error: "Seans aktif değil" };

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("kutu_uretim")
      .update({
        durum: "tamamlandi",
        bitis_zamani: now,
      })
      .eq("session_id", sessionId);

    if (updateError) return { success: false, error: updateError.message };

    // Parça stok güncelleme
    if (session.part_id) {
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
