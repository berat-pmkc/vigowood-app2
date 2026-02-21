"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, ADMIN_ROLES } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { appSettingSchema } from "@/lib/validations";
import { KRITIK_STOK_DEFAULT_GUN, KRITIK_STOK_DEFAULT_LOOKBACK_DAYS } from "@/lib/constants";

type ActionResult = { success: true } | { success: false; error: string };

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    throw new Error("Yetkisiz erişim");
  }
  return user;
}

// ─── Ayarları Oku ───────────────────────────────────────────────

export interface AppSettings {
  kritik_stok_gun: number;
  kritik_stok_lookback_days: number;
  kritik_stok_last_calculated: string | null;
  kritik_stok_last_summary: KritikStokSummary | null;
}

export interface KritikStokSummary {
  total_products: number;
  updated_products: number;
  products_with_sales: number;
  products_without_sales: number;
  total_parts: number;
  updated_parts: number;
  duration_ms: number;
  calculated_at: string;
  calculated_by: string;
}

export async function getSettings(): Promise<AppSettings> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [
      "kritik_stok_gun",
      "kritik_stok_lookback_days",
      "kritik_stok_last_calculated",
      "kritik_stok_last_summary",
    ]);

  const settingsMap = new Map<string, unknown>();
  for (const row of data ?? []) {
    settingsMap.set(row.key, row.value);
  }

  return {
    kritik_stok_gun: Number(settingsMap.get("kritik_stok_gun")) || KRITIK_STOK_DEFAULT_GUN,
    kritik_stok_lookback_days:
      Number(settingsMap.get("kritik_stok_lookback_days")) || KRITIK_STOK_DEFAULT_LOOKBACK_DAYS,
    kritik_stok_last_calculated: settingsMap.get("kritik_stok_last_calculated") as string | null,
    kritik_stok_last_summary: settingsMap.get("kritik_stok_last_summary") as KritikStokSummary | null,
  };
}

// ─── Ayarları Güncelle ──────────────────────────────────────────

export async function updateSettings(
  formData: { kritik_stok_gun: number; kritik_stok_lookback_days: number }
): Promise<ActionResult> {
  try {
    await requireAdmin();

    const parsed = appSettingSchema.safeParse(formData);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Geçersiz veri";
      return { success: false, error: firstError };
    }

    const supabase = createAdminClient();

    // Update her iki ayarı
    const { error: e1 } = await supabase
      .from("app_settings")
      .update({ value: parsed.data.kritik_stok_gun })
      .eq("key", "kritik_stok_gun");

    if (e1) return { success: false, error: e1.message };

    const { error: e2 } = await supabase
      .from("app_settings")
      .update({ value: parsed.data.kritik_stok_lookback_days })
      .eq("key", "kritik_stok_lookback_days");

    if (e2) return { success: false, error: e2.message };

    revalidatePath("/admin/ayarlar");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}

// ─── Kritik Stok Hesapla ────────────────────────────────────────

export async function calculateCriticalStock(): Promise<
  { success: true; summary: KritikStokSummary } | { success: false; error: string }
> {
  const startTime = Date.now();

  try {
    const user = await requireAdmin();
    const supabase = createAdminClient();

    // ── Adım 1: Parametreleri oku ──
    const settings = await getSettings();
    const lookbackDays = settings.kritik_stok_lookback_days;
    const kritikGun = settings.kritik_stok_gun;

    // ── Adım 2: Son N günün satışlarını çek ──
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    const cutoffISO = cutoffDate.toISOString().split("T")[0]; // YYYY-MM-DD

    // stock_movements: source='Satis' olan kayıtlar, qty negatif (satış = stoktan çıkış)
    const { data: salesData, error: salesErr } = await supabase
      .from("stock_movements")
      .select("sku, qty")
      .eq("source", "Satis")
      .gte("tarih", cutoffISO);

    if (salesErr) return { success: false, error: `Satış verileri okunamadı: ${salesErr.message}` };

    // SKU bazında toplam satış miktarı (qty negatif olabilir, mutlak değer al)
    const salesMap = new Map<string, number>();
    for (const row of salesData ?? []) {
      if (!row.sku) continue;
      const prev = salesMap.get(row.sku) || 0;
      salesMap.set(row.sku, prev + Math.abs(row.qty));
    }

    // Günlük satış oranı
    const dailyRateMap = new Map<string, number>();
    for (const [sku, total] of salesMap) {
      dailyRateMap.set(sku, Math.ceil(total / lookbackDays));
    }

    // ── Adım 3: Ürünleri güncelle ──
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("sku, aktif_mi")
      .eq("aktif_mi", true);

    if (prodErr) return { success: false, error: `Ürünler okunamadı: ${prodErr.message}` };

    let updatedProducts = 0;
    let productsWithSales = 0;
    let productsWithoutSales = 0;

    for (const prod of products ?? []) {
      const dailyRate = dailyRateMap.get(prod.sku) || 0;
      const kritikStok = dailyRate * kritikGun;

      if (dailyRate > 0) {
        productsWithSales++;
      } else {
        productsWithoutSales++;
      }

      const { error: upErr } = await supabase
        .from("products")
        .update({
          gunluk_satis: dailyRate,
          mamul_stok_kritik: kritikStok,
        })
        .eq("sku", prod.sku);

      if (!upErr) updatedProducts++;
    }

    // ── Adım 4: BOM'u düzleştir (DAG traversal) ──
    const { data: steps } = await supabase
      .from("assembly_steps")
      .select("step_id, sku, seq_no");

    const { data: bomItems } = await supabase
      .from("step_bom")
      .select("step_bom_id, step_id, part_id, qty_per");

    // step_id → sku mapping
    const stepToSku = new Map<string, string>();
    // sku → step_id listesi
    const skuToSteps = new Map<string, string[]>();
    for (const step of steps ?? []) {
      if (step.sku) {
        stepToSku.set(step.step_id, step.sku);
        const list = skuToSteps.get(step.sku) || [];
        list.push(step.step_id);
        skuToSteps.set(step.sku, list);
      }
    }

    // step_id → bom items
    const stepBomMap = new Map<string, { part_id: string; qty_per: number }[]>();
    for (const bom of bomItems ?? []) {
      const list = stepBomMap.get(bom.step_id) || [];
      list.push({ part_id: bom.part_id, qty_per: bom.qty_per });
      stepBomMap.set(bom.step_id, list);
    }

    // step_id → step_id mapping (ASM referansları): hangi step_id'ler ASM olarak kullanılıyor
    const asmStepIds = new Set<string>();
    for (const bom of bomItems ?? []) {
      if (bom.part_id.startsWith("ASM-")) {
        asmStepIds.add(bom.part_id);
      }
    }

    // Recursive BOM düzleştirme
    function flattenBom(
      stepId: string,
      multiplier: number,
      visited: Set<string>,
      result: Map<string, number>
    ) {
      if (visited.has(stepId)) return; // DAG döngü koruması
      visited.add(stepId);

      const items = stepBomMap.get(stepId) || [];
      for (const item of items) {
        if (item.part_id.startsWith("ASM-")) {
          // ASM referansı → recursive olarak çöz
          flattenBom(item.part_id, multiplier * item.qty_per, visited, result);
        } else {
          // Fiziksel parça
          const prev = result.get(item.part_id) || 0;
          result.set(item.part_id, prev + multiplier * item.qty_per);
        }
      }

      visited.delete(stepId); // Farklı path'lerden aynı step'e erişilebilir
    }

    // ── Adım 5: Parça kritik stokları hesapla ──
    // Her ürün için BOM'u düzleştir, ürünün kritik stoğu ile çarp
    const partKritikMap = new Map<string, number>();

    for (const prod of products ?? []) {
      const prodKritik = (dailyRateMap.get(prod.sku) || 0) * kritikGun;
      if (prodKritik === 0) continue; // Satışı olmayan ürünlerin parçalara katkısı yok

      const stepIds = skuToSteps.get(prod.sku) || [];
      // Bu ürünün tüm adımlarını düzleştir
      const flatBom = new Map<string, number>();
      for (const sid of stepIds) {
        flattenBom(sid, 1, new Set<string>(), flatBom);
      }

      // Her parça için: ürün kritik stoğu × o üründeki parça adedi
      for (const [partId, qtyPerUnit] of flatBom) {
        const prev = partKritikMap.get(partId) || 0;
        partKritikMap.set(partId, prev + Math.ceil(prodKritik * qtyPerUnit));
      }
    }

    // Tüm parçaların kritik stokunu 0'a çek
    const { data: allParts } = await supabase
      .from("all_parts")
      .select("part_id");

    const totalParts = allParts?.length || 0;

    // Batch: önce hepsini 0'a çek
    const { error: resetErr } = await supabase
      .from("all_parts")
      .update({ hazir_eleman_kritik_stok: 0 })
      .gte("hazir_eleman_kritik_stok", 0); // tüm satırları etkile

    if (resetErr) return { success: false, error: `Parça reset hatası: ${resetErr.message}` };

    // Hesaplanan değerleri yaz (batch 50)
    let updatedParts = 0;
    const partEntries = Array.from(partKritikMap.entries());
    for (let i = 0; i < partEntries.length; i += 50) {
      const batch = partEntries.slice(i, i + 50);
      for (const [partId, kritik] of batch) {
        const { error: partErr } = await supabase
          .from("all_parts")
          .update({ hazir_eleman_kritik_stok: kritik })
          .eq("part_id", partId);

        if (!partErr) updatedParts++;
      }
    }

    // ── Adım 6: Özeti kaydet ──
    const summary: KritikStokSummary = {
      total_products: products?.length || 0,
      updated_products: updatedProducts,
      products_with_sales: productsWithSales,
      products_without_sales: productsWithoutSales,
      total_parts: totalParts,
      updated_parts: updatedParts,
      duration_ms: Date.now() - startTime,
      calculated_at: new Date().toISOString(),
      calculated_by: user.full_name,
    };

    await supabase
      .from("app_settings")
      .update({ value: new Date().toISOString() })
      .eq("key", "kritik_stok_last_calculated");

    await supabase
      .from("app_settings")
      .update({ value: summary as unknown as Json })
      .eq("key", "kritik_stok_last_summary");

    // Stok sayfalarını revalidate et
    revalidatePath("/admin/ayarlar");
    revalidatePath("/stok/mamul");
    revalidatePath("/stok/yari-mamul");
    revalidatePath("/stok/hazir-eleman");

    return { success: true, summary };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Bir hata oluştu" };
  }
}
