import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, trBugun, tsBounds } from "@/lib/periods";
import { fetchAll, median, parseWorkers, percentile, round } from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Personel verimliliği.
 *
 * Standart süre T (kişi-dk / adet): son 180 gündeki tamamlanan seansların
 * birim sürelerinin medyanı (<0.05 ve >p95 hariç). Montaj için adım (step_id)
 * bazında, paketleme için SKU bazında.
 *
 * birim_montaj_dk = net_sure / (qty × worker_count) → kişi-dk / adet.
 * Seans başına kişi payı:
 *   kazanılan = qty × T / worker_count
 *   harcanan  = net_sure_dk          (her çalışan seans süresi kadar çalışmıştır)
 * Performans % = Σkazanılan / Σharcanan × 100
 */

export interface StandardTimes {
  montaj: Map<string, number>;
  paketleme: Map<string, number>;
}

let stdCache: { at: number; value: StandardTimes } | null = null;
const STD_TTL = 10 * 60 * 1000;

function robustMedian(values: number[]): number | null {
  const v = values.filter((x) => x >= 0.05).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const cut = percentile(v, 0.95);
  const kept = v.filter((x) => x <= cut);
  return kept.length ? median(kept) : null;
}

export async function getStandardTimes(): Promise<StandardTimes> {
  if (stdCache && Date.now() - stdCache.at < STD_TTL) return stdCache.value;
  const s: any = await createClient();
  const since = addDays(trBugun(), -180);
  const b = tsBounds(since, null);

  const [m, p] = await Promise.all([
    fetchAll<{ step_id: string; birim_montaj_dk: number | null }>((lo, hi) =>
      s
        .from("montaj_sessions")
        .select("step_id, birim_montaj_dk")
        .eq("durum", "tamamlandi")
        .not("birim_montaj_dk", "is", null)
        .gte("created_at", b.gte)
        .order("session_id")
        .range(lo, hi),
    ),
    fetchAll<{ sku: string | null; birim_paketleme_dk: number | null }>((lo, hi) =>
      s
        .from("pack_events")
        .select("sku, birim_paketleme_dk")
        .eq("durum", "tamamlandi")
        .not("birim_paketleme_dk", "is", null)
        .gte("tarih", since)
        .order("session_id")
        .range(lo, hi),
    ),
  ]);

  const mg = new Map<string, number[]>();
  for (const r of m) {
    const arr = mg.get(r.step_id) ?? [];
    arr.push(Number(r.birim_montaj_dk));
    mg.set(r.step_id, arr);
  }
  const pg = new Map<string, number[]>();
  for (const r of p) {
    if (!r.sku) continue;
    const arr = pg.get(r.sku) ?? [];
    arr.push(Number(r.birim_paketleme_dk));
    pg.set(r.sku, arr);
  }

  const value: StandardTimes = { montaj: new Map(), paketleme: new Map() };
  for (const [k, v] of mg) {
    const t = robustMedian(v);
    if (t) value.montaj.set(k, t);
  }
  for (const [k, v] of pg) {
    const t = robustMedian(v);
    if (t) value.paketleme.set(k, t);
  }
  stdCache = { at: Date.now(), value };
  return value;
}

export interface PersonPerformance {
  id: string;
  name: string;
  /** Kazanılan standart dakika */
  earned: number;
  /** Harcanan çalışma dakikası */
  actual: number;
  /** earned / actual × 100 */
  pct: number;
  sessions: number;
  montajQty: number;
  paketlemeQty: number;
}

export interface PerformanceData {
  overallPct: number | null;
  people: PersonPerformance[];
  /** Montaj adım standart süreleri (dk / adet), kullanım sırasıyla */
  stepStandards: { stepId: string; stepName: string | null; stdDk: number }[];
}

export async function computePerformance(from: string | null, to: string | null): Promise<PerformanceData> {
  const s: any = await createClient();
  const std = await getStandardTimes();
  const b = tsBounds(from, to);

  const [mRows, pRows] = await Promise.all([
    fetchAll<{
      step_id: string;
      step_name: string | null;
      qty: number | null;
      net_sure_dk: number | null;
      worker_count: number | null;
      workers: unknown;
      operator_id: string | null;
      operator_name: string | null;
    }>((lo, hi) => {
      let q = s
        .from("montaj_sessions")
        .select("step_id, step_name, qty, net_sure_dk, worker_count, workers, operator_id, operator_name")
        .eq("durum", "tamamlandi")
        .order("session_id");
      if (b.gte) q = q.gte("created_at", b.gte);
      if (b.lte) q = q.lte("created_at", b.lte);
      return q.range(lo, hi);
    }),
    fetchAll<{
      sku: string | null;
      qty: number | null;
      start_time: string | null;
      end_time: string | null;
      duraklama_dk: number | null;
      worker_count: number | null;
      workers: unknown;
      operator_id: string | null;
      operator_name: string | null;
    }>((lo, hi) => {
      let q = s
        .from("pack_events")
        .select("sku, qty, start_time, end_time, duraklama_dk, worker_count, workers, operator_id, operator_name")
        .eq("durum", "tamamlandi")
        .order("session_id");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    }),
  ]);

  const acc = new Map<string, PersonPerformance>();
  const person = (id: string, name: string) => {
    let p = acc.get(id);
    if (!p) {
      p = { id, name, earned: 0, actual: 0, pct: 0, sessions: 0, montajQty: 0, paketlemeQty: 0 };
      acc.set(id, p);
    }
    return p;
  };

  const stepNames = new Map<string, string | null>();

  for (const r of mRows) {
    stepNames.set(r.step_id, r.step_name);
    const T = std.montaj.get(r.step_id);
    const qty = Number(r.qty ?? 0);
    const net = Number(r.net_sure_dk ?? 0);
    if (!T || qty <= 0 || net <= 0) continue;
    let ws = parseWorkers(r.workers);
    if (ws.length === 0 && (r.operator_id || r.operator_name)) {
      ws = [{ id: r.operator_id ?? r.operator_name!, name: r.operator_name ?? r.operator_id! }];
    }
    if (ws.length === 0) continue;
    const n = Math.max(Number(r.worker_count ?? 0), ws.length, 1);
    for (const w of ws) {
      const p = person(w.id, w.name);
      p.earned += (qty * T) / n;
      p.actual += net;
      p.sessions += 1;
      p.montajQty += qty / n;
    }
  }

  for (const r of pRows) {
    if (!r.sku) continue;
    const T = std.paketleme.get(r.sku);
    const qty = Number(r.qty ?? 0);
    if (!T || qty <= 0 || !r.start_time || !r.end_time) continue;
    const mins =
      (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000 - Number(r.duraklama_dk ?? 0);
    if (!(mins > 0)) continue;
    let ws = parseWorkers(r.workers);
    if (ws.length === 0 && (r.operator_id || r.operator_name)) {
      ws = [{ id: r.operator_id ?? r.operator_name!, name: r.operator_name ?? r.operator_id! }];
    }
    if (ws.length === 0) continue;
    const n = Math.max(Number(r.worker_count ?? 0), ws.length, 1);
    for (const w of ws) {
      const p = person(w.id, w.name);
      p.earned += (qty * T) / n;
      p.actual += mins;
      p.sessions += 1;
      p.paketlemeQty += qty / n;
    }
  }

  let E = 0;
  let A = 0;
  const people: PersonPerformance[] = [];
  for (const p of acc.values()) {
    if (p.actual <= 0) continue;
    E += p.earned;
    A += p.actual;
    people.push({
      ...p,
      earned: round(p.earned, 1),
      actual: round(p.actual, 1),
      pct: round((p.earned / p.actual) * 100, 1),
      montajQty: round(p.montajQty, 1),
      paketlemeQty: round(p.paketlemeQty, 1),
    });
  }
  people.sort((a, b) => b.pct - a.pct);

  const used = new Set(mRows.map((r) => r.step_id));
  const stepStandards = [...used]
    .filter((id) => std.montaj.has(id))
    .map((id) => ({ stepId: id, stepName: stepNames.get(id) ?? null, stdDk: round(std.montaj.get(id)!, 2) }))
    .sort((a, b) => a.stepId.localeCompare(b.stepId));

  return { overallPct: A > 0 ? round((E / A) * 100, 1) : null, people, stepStandards };
}
