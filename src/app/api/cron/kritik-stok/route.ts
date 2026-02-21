import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { KRITIK_STOK_DEFAULT_GUN, KRITIK_STOK_DEFAULT_LOOKBACK_DAYS } from "@/lib/constants";
import type { Database, Json } from "@/lib/supabase/types";

/**
 * Cron endpoint: Kritik stok hesaplama
 * Vercel Cron ile her gün 12:00 (Europe/Istanbul) tetiklenir.
 *
 * GET /api/cron/kritik-stok?secret=CRON_SECRET
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Parametreleri oku
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["kritik_stok_gun", "kritik_stok_lookback_days"]);

    const settingsMap = new Map<string, unknown>();
    for (const row of settingsData ?? []) {
      settingsMap.set(row.key, row.value);
    }

    const lookbackDays = Number(settingsMap.get("kritik_stok_lookback_days")) || KRITIK_STOK_DEFAULT_LOOKBACK_DAYS;
    const kritikGun = Number(settingsMap.get("kritik_stok_gun")) || KRITIK_STOK_DEFAULT_GUN;

    // 2. Son N günün satışlarını çek
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    const cutoffISO = cutoffDate.toISOString().split("T")[0];

    const { data: salesData, error: salesErr } = await supabase
      .from("stock_movements")
      .select("sku, qty")
      .eq("source", "Satis")
      .gte("tarih", cutoffISO);

    if (salesErr) {
      return NextResponse.json({ error: `Satış verileri okunamadı: ${salesErr.message}` }, { status: 500 });
    }

    // SKU bazında toplam satış
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

    // 3. Ürünleri güncelle
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("sku, aktif_mi")
      .eq("aktif_mi", true);

    if (prodErr) {
      return NextResponse.json({ error: `Ürünler okunamadı: ${prodErr.message}` }, { status: 500 });
    }

    let updatedProducts = 0;
    let productsWithSales = 0;
    let productsWithoutSales = 0;

    for (const prod of products ?? []) {
      const dailyRate = dailyRateMap.get(prod.sku) || 0;
      const kritikStok = dailyRate * kritikGun;

      if (dailyRate > 0) productsWithSales++;
      else productsWithoutSales++;

      const { error: upErr } = await supabase
        .from("products")
        .update({ gunluk_satis: dailyRate, mamul_stok_kritik: kritikStok })
        .eq("sku", prod.sku);

      if (!upErr) updatedProducts++;
    }

    // 4. BOM düzleştir (DAG traversal)
    const { data: steps } = await supabase
      .from("assembly_steps")
      .select("step_id, sku, seq_no");

    const { data: bomItems } = await supabase
      .from("step_bom")
      .select("step_bom_id, step_id, part_id, qty_per");

    const skuToSteps = new Map<string, string[]>();
    for (const step of steps ?? []) {
      if (step.sku) {
        const list = skuToSteps.get(step.sku) || [];
        list.push(step.step_id);
        skuToSteps.set(step.sku, list);
      }
    }

    const stepBomMap = new Map<string, { part_id: string; qty_per: number }[]>();
    for (const bom of bomItems ?? []) {
      const list = stepBomMap.get(bom.step_id) || [];
      list.push({ part_id: bom.part_id, qty_per: bom.qty_per });
      stepBomMap.set(bom.step_id, list);
    }

    function flattenBom(
      stepId: string,
      multiplier: number,
      visited: Set<string>,
      result: Map<string, number>
    ) {
      if (visited.has(stepId)) return;
      visited.add(stepId);

      const items = stepBomMap.get(stepId) || [];
      for (const item of items) {
        if (item.part_id.startsWith("ASM-")) {
          flattenBom(item.part_id, multiplier * item.qty_per, visited, result);
        } else {
          const prev = result.get(item.part_id) || 0;
          result.set(item.part_id, prev + multiplier * item.qty_per);
        }
      }

      visited.delete(stepId);
    }

    // 5. Parça kritik stokları hesapla
    const partKritikMap = new Map<string, number>();

    for (const prod of products ?? []) {
      const prodKritik = (dailyRateMap.get(prod.sku) || 0) * kritikGun;
      if (prodKritik === 0) continue;

      const stepIds = skuToSteps.get(prod.sku) || [];
      const flatBom = new Map<string, number>();
      for (const sid of stepIds) {
        flattenBom(sid, 1, new Set<string>(), flatBom);
      }

      for (const [partId, qtyPerUnit] of flatBom) {
        const prev = partKritikMap.get(partId) || 0;
        partKritikMap.set(partId, prev + Math.ceil(prodKritik * qtyPerUnit));
      }
    }

    // Tüm parçaları 0'a çek
    const { data: allParts } = await supabase
      .from("all_parts")
      .select("part_id");

    const totalParts = allParts?.length || 0;

    await supabase
      .from("all_parts")
      .update({ hazir_eleman_kritik_stok: 0 })
      .gte("hazir_eleman_kritik_stok", 0);

    // Hesaplanan değerleri yaz
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

    // 6. Özeti kaydet
    const summary = {
      total_products: products?.length || 0,
      updated_products: updatedProducts,
      products_with_sales: productsWithSales,
      products_without_sales: productsWithoutSales,
      total_parts: totalParts,
      updated_parts: updatedParts,
      duration_ms: Date.now() - startTime,
      calculated_at: new Date().toISOString(),
      calculated_by: "Cron (otomatik)",
    };

    await supabase
      .from("app_settings")
      .update({ value: new Date().toISOString() })
      .eq("key", "kritik_stok_last_calculated");

    await supabase
      .from("app_settings")
      .update({ value: summary as unknown as Json })
      .eq("key", "kritik_stok_last_summary");

    return NextResponse.json({ success: true, summary });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
