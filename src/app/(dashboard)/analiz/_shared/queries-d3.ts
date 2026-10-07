import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "./utils";
import { getProdRows } from "./queries-d1";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface HazirPart {
  partId: string;
  adi: string;
  stok: number;
  kritik: number;
}

export interface YanRow {
  day: string;
  partId: string;
  sku: string;
  stepId: string;
  /** teorik kullanım = seans adedi × reçete miktarı */
  qty: number;
}

export interface YanMalzemeData {
  parts: Map<string, HazirPart>;
  rows: YanRow[];
}

/** Hazır eleman (all_parts.part_type = HAZIR) tanımları + güncel/kritik stok. */
export async function getHazirParts(): Promise<Map<string, HazirPart>> {
  const s: any = await createClient();
  const data = await fetchAll<any>((lo, hi) =>
    s
      .from("all_parts")
      .select("part_id, part_adi, hazir_eleman_aktif_stok, hazir_eleman_kritik_stok")
      .eq("part_type", "HAZIR")
      .order("part_id")
      .range(lo, hi),
  );
  const m = new Map<string, HazirPart>();
  for (const r of data) {
    m.set(r.part_id, {
      partId: r.part_id,
      adi: r.part_adi ?? r.part_id,
      stok: Number(r.hazir_eleman_aktif_stok ?? 0),
      kritik: Number(r.hazir_eleman_kritik_stok ?? 0),
    });
  }
  return m;
}

/**
 * Yan malzeme (hazır eleman) teorik kullanımı: dönemdeki tamamlanan montaj seansları ×
 * adımın reçetesindeki HAZIR parçalar (montaj stok düşümüyle aynı mantık: ASM- referansları hariç).
 */
export async function getYanMalzeme(from: string | null, to: string | null): Promise<YanMalzemeData> {
  const s: any = await createClient();
  const [prod, parts] = await Promise.all([getProdRows(from, to), getHazirParts()]);
  const stepIds = [...new Set(prod.montaj.map((r) => r.stepId).filter(Boolean))];
  const bomByStep = new Map<string, { partId: string; per: number }[]>();
  if (stepIds.length > 0 && parts.size > 0) {
    const bom = await fetchAll<any>((lo, hi) =>
      s.from("step_bom").select("step_bom_id, step_id, part_id, qty_per").order("step_bom_id").range(lo, hi),
    );
    const want = new Set(stepIds);
    for (const b of bom) {
      if (!want.has(b.step_id) || String(b.part_id).startsWith("ASM-") || !parts.has(b.part_id)) continue;
      const arr = bomByStep.get(b.step_id) ?? [];
      arr.push({ partId: b.part_id, per: Number(b.qty_per ?? 0) });
      bomByStep.set(b.step_id, arr);
    }
  }
  const rows: YanRow[] = [];
  for (const m of prod.montaj) {
    const lines = bomByStep.get(m.stepId);
    if (!lines || m.qty <= 0) continue;
    for (const l of lines) {
      const q = m.qty * l.per;
      if (q > 0) rows.push({ day: m.day, partId: l.partId, sku: m.sku, stepId: m.stepId, qty: q });
    }
  }
  return { parts, rows };
}
