import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, trBugun, trDay, tsBounds } from "@/lib/periods";
import { fetchAll, parseWorkers, round } from "./utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Analiz modülü ortak veri çekicileri (sunucu tarafı).
 * Tüm fonksiyonlar (from, to) alır: YYYY-MM-DD, dahil; null = sınırsız.
 * Günlük kırılımlar TR yerel günüyle (Europe/Istanbul) anahtarlanır.
 */

export type DayMap = Record<string, number>;

async function sb(): Promise<any> {
  return await createClient();
}

function add(map: DayMap, key: string | null, v: number) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + v;
}

// ─── Üretim (paketleme) ─────────────────────────────────────────

export interface UretimData {
  total: number;
  byDay: DayMap;
  bySku: Record<string, number>;
}

export async function getUretim(from: string | null, to: string | null): Promise<UretimData> {
  const s = await sb();
  const rows = await fetchAll<{ tarih: string | null; qty: number | null; sku: string | null }>((lo, hi) => {
    let q = s.from("pack_events").select("tarih, qty, sku").eq("durum", "tamamlandi").order("session_id");
    if (from) q = q.gte("tarih", from);
    if (to) q = q.lte("tarih", to);
    return q.range(lo, hi);
  });
  const byDay: DayMap = {};
  const bySku: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const qty = Number(r.qty ?? 0);
    total += qty;
    add(byDay, trDay(r.tarih), qty);
    if (r.sku) bySku[r.sku] = (bySku[r.sku] ?? 0) + qty;
  }
  return { total, byDay, bySku };
}

// ─── Montaj ─────────────────────────────────────────────────────

export interface MontajData {
  /** Tüm adımların adet toplamı */
  total: number;
  /** Yalnızca son adım (is_final_step) adet toplamı */
  finalTotal: number;
  sessions: number;
  byDay: DayMap;
  byStep: Record<string, number>;
}

export async function getMontaj(from: string | null, to: string | null): Promise<MontajData> {
  const s = await sb();
  const b = tsBounds(from, to);
  const rows = await fetchAll<{
    qty: number | null;
    created_at: string | null;
    step_id: string;
    is_final_step: boolean | null;
  }>((lo, hi) => {
    let q = s
      .from("montaj_sessions")
      .select("qty, created_at, step_id, is_final_step")
      .eq("durum", "tamamlandi")
      .order("session_id");
    if (b.gte) q = q.gte("created_at", b.gte);
    if (b.lte) q = q.lte("created_at", b.lte);
    return q.range(lo, hi);
  });
  const byDay: DayMap = {};
  const byStep: Record<string, number> = {};
  let total = 0;
  let finalTotal = 0;
  for (const r of rows) {
    const qty = Number(r.qty ?? 0);
    total += qty;
    if (r.is_final_step) finalTotal += qty;
    add(byDay, trDay(r.created_at), qty);
    byStep[r.step_id] = (byStep[r.step_id] ?? 0) + qty;
  }
  return { total, finalTotal, sessions: rows.length, byDay, byStep };
}

// ─── Kesim ──────────────────────────────────────────────────────

export interface KesimData {
  plates: number;
  parts: number;
  platesByDay: DayMap;
  partsByDay: DayMap;
}

export async function getKesim(from: string | null, to: string | null): Promise<KesimData> {
  const s = await sb();
  const [batches, lines] = await Promise.all([
    fetchAll<{ tarih: string | null; adet: number | null }>((lo, hi) => {
      let q = s.from("cut_batches").select("tarih, adet").eq("durum", "tamamlandi").order("cut_id");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    }),
    fetchAll<{ tarih: string | null; adet: number | null }>((lo, hi) => {
      let q = s.from("cut_lines").select("tarih, adet").order("cut_line_id");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    }),
  ]);
  const platesByDay: DayMap = {};
  const partsByDay: DayMap = {};
  let plates = 0;
  let parts = 0;
  for (const r of batches) {
    const n = Number(r.adet ?? 0);
    plates += n;
    add(platesByDay, trDay(r.tarih), n);
  }
  for (const r of lines) {
    const n = Number(r.adet ?? 0);
    parts += n;
    add(partsByDay, trDay(r.tarih), n);
  }
  return { plates, parts, platesByDay, partsByDay };
}

// ─── Birim süre ─────────────────────────────────────────────────

export interface BirimSureData {
  /** Adet ağırlıklı ortalama kişi-dk / adet */
  montajAvg: number | null;
  paketlemeAvg: number | null;
  montajByDay: Record<string, number>;
  paketlemeByDay: Record<string, number>;
  byStep: { stepId: string; stepName: string | null; avgDk: number; qty: number }[];
}

const MIN_UNIT = 0.05;

function weighted(acc: Record<string, { w: number; s: number }>, key: string | null, v: number, w: number) {
  if (!key) return;
  const a = (acc[key] ??= { w: 0, s: 0 });
  a.w += w;
  a.s += v * w;
}

export async function getBirimSure(from: string | null, to: string | null): Promise<BirimSureData> {
  const s = await sb();
  const b = tsBounds(from, to);
  const [mRows, pRows] = await Promise.all([
    fetchAll<{
      birim_montaj_dk: number | null;
      qty: number | null;
      created_at: string | null;
      step_id: string;
      step_name: string | null;
    }>((lo, hi) => {
      let q = s
        .from("montaj_sessions")
        .select("birim_montaj_dk, qty, created_at, step_id, step_name")
        .eq("durum", "tamamlandi")
        .not("birim_montaj_dk", "is", null)
        .order("session_id");
      if (b.gte) q = q.gte("created_at", b.gte);
      if (b.lte) q = q.lte("created_at", b.lte);
      return q.range(lo, hi);
    }),
    fetchAll<{ birim_paketleme_dk: number | null; qty: number | null; tarih: string | null }>((lo, hi) => {
      let q = s
        .from("pack_events")
        .select("birim_paketleme_dk, qty, tarih")
        .eq("durum", "tamamlandi")
        .not("birim_paketleme_dk", "is", null)
        .order("session_id");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    }),
  ]);

  const mDay: Record<string, { w: number; s: number }> = {};
  const pDay: Record<string, { w: number; s: number }> = {};
  const stepAcc: Record<string, { w: number; s: number; name: string | null }> = {};
  let mW = 0;
  let mS = 0;
  let pW = 0;
  let pS = 0;

  for (const r of mRows) {
    const v = Number(r.birim_montaj_dk ?? 0);
    const w = Number(r.qty ?? 0);
    if (v < MIN_UNIT || w <= 0) continue;
    mW += w;
    mS += v * w;
    weighted(mDay, trDay(r.created_at), v, w);
    const a = (stepAcc[r.step_id] ??= { w: 0, s: 0, name: r.step_name });
    a.w += w;
    a.s += v * w;
  }
  for (const r of pRows) {
    const v = Number(r.birim_paketleme_dk ?? 0);
    const w = Number(r.qty ?? 0);
    if (v < MIN_UNIT || w <= 0) continue;
    pW += w;
    pS += v * w;
    weighted(pDay, trDay(r.tarih), v, w);
  }

  const fin = (acc: Record<string, { w: number; s: number }>) =>
    Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, round(a.s / a.w, 2)]));

  return {
    montajAvg: mW > 0 ? round(mS / mW, 2) : null,
    paketlemeAvg: pW > 0 ? round(pS / pW, 2) : null,
    montajByDay: fin(mDay),
    paketlemeByDay: fin(pDay),
    byStep: Object.entries(stepAcc)
      .map(([stepId, a]) => ({ stepId, stepName: a.name, avgDk: round(a.s / a.w, 2), qty: a.w }))
      .sort((x, y) => y.qty - x.qty),
  };
}

// ─── Stok çıkışı (satış vekili) ─────────────────────────────────

export interface StokCikisData {
  /** Pozitif adet toplamı */
  total: number;
  bySku: Record<string, number>;
  byDay: DayMap;
}

/** Transfer / uygunsuz / fire kaynaklı çıkışlar satış sayılmaz. */
export function isSalesSource(source: string | null | undefined): boolean {
  const x = (source ?? "").toLowerCase();
  if (x.includes("transfer")) return false;
  if (x.includes("uygunsuz")) return false;
  if (x.includes("fire")) return false;
  return true;
}

export async function getStokCikis(from: string | null, to: string | null): Promise<StokCikisData> {
  const s = await sb();
  const rows = await fetchAll<{ sku: string | null; qty: number | null; source: string | null; tarih: string | null }>(
    (lo, hi) => {
      let q = s.from("stock_movements").select("sku, qty, source, tarih").lt("qty", 0).order("id");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    },
  );
  const bySku: Record<string, number> = {};
  const byDay: DayMap = {};
  let total = 0;
  for (const r of rows) {
    if (!r.sku || !isSalesSource(r.source)) continue;
    const n = Math.abs(Number(r.qty ?? 0));
    total += n;
    bySku[r.sku] = (bySku[r.sku] ?? 0) + n;
    add(byDay, trDay(r.tarih), n);
  }
  return { total, bySku, byDay };
}

// ─── Stok verimliliği ───────────────────────────────────────────

export interface StokVerimlilikData {
  /** Dönem ortalaması (%) */
  overallPct: number | null;
  /** Gün → % (kritik ≤ stok ≤ 2×kritik olan ürün oranı) */
  byDay: Record<string, number>;
  activeCount: number;
  /** Bugünkü bant dışı ürünler */
  below: number;
  above: number;
}

/**
 * Aktif ve mamul_stok_kritik>0 ürünlerin kaçı [kritik, 2×kritik] bandında.
 * Geçmiş bakiye: güncel bakiye − sonraki hareketler.
 * Tümü seçilirse son 90 gün hesaplanır.
 */
export async function getStokVerimlilik(from: string | null, to: string | null): Promise<StokVerimlilikData> {
  const s = await sb();
  const today = trBugun();
  const dayTo = !to || to > today ? today : to;
  const dayFrom = from ?? addDays(today, -89);
  const empty: StokVerimlilikData = { overallPct: null, byDay: {}, activeCount: 0, below: 0, above: 0 };
  if (dayFrom > dayTo) return empty;

  const [{ data: prods }, { data: balRows }] = await Promise.all([
    s.from("products").select("sku, mamul_stok_kritik").eq("aktif_mi", true).gt("mamul_stok_kritik", 0),
    s.from("urun_toplam_stok").select("sku, miktar"),
  ]);
  const kritik = new Map<string, number>();
  for (const p of (prods ?? []) as { sku: string; mamul_stok_kritik: number }[]) {
    kritik.set(p.sku, Number(p.mamul_stok_kritik));
  }
  if (kritik.size === 0) return empty;

  const bal = new Map<string, number>();
  for (const k of kritik.keys()) bal.set(k, 0);
  for (const r of (balRows ?? []) as { sku: string | null; miktar: number | null }[]) {
    if (r.sku && bal.has(r.sku)) bal.set(r.sku, Number(r.miktar ?? 0));
  }

  const moves = await fetchAll<{ sku: string | null; qty: number | null; tarih: string | null }>((lo, hi) =>
    s.from("stock_movements").select("sku, qty, tarih").gte("tarih", dayFrom).order("id").range(lo, hi),
  );
  const net = new Map<string, Map<string, number>>(); // gün → sku → net
  for (const m of moves) {
    const d = trDay(m.tarih);
    if (!d || !m.sku || !kritik.has(m.sku)) continue;
    let dm = net.get(d);
    if (!dm) net.set(d, (dm = new Map()));
    dm.set(m.sku, (dm.get(m.sku) ?? 0) + Number(m.qty ?? 0));
  }

  const byDay: Record<string, number> = {};
  let below = 0;
  let above = 0;
  const n = kritik.size;
  for (let d = today, i = 0; d >= dayFrom && i < 4000; d = addDays(d, -1), i++) {
    if (d <= dayTo) {
      let inBand = 0;
      let lo = 0;
      let hi = 0;
      for (const [sku, k] of kritik) {
        const b = bal.get(sku) ?? 0;
        if (b < k) lo++;
        else if (b > 2 * k) hi++;
        else inBand++;
      }
      byDay[d] = round((inBand / n) * 100, 1);
      if (d === dayTo) {
        below = lo;
        above = hi;
      }
    }
    const dm = net.get(d);
    if (dm) for (const [sku, v] of dm) bal.set(sku, (bal.get(sku) ?? 0) - v);
  }

  const vals = Object.values(byDay);
  return {
    overallPct: vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length, 1) : null,
    byDay,
    activeCount: n,
    below,
    above,
  };
}

// ─── Kalite / fire ──────────────────────────────────────────────

export interface KaliteData {
  /** kalite_hareketleri tablosu okunabildi mi */
  available: boolean;
  fire: { urun: number; yariMamul: number; plaka: number; total: number };
}

/**
 * kalite_hareketleri (stok_turu='FIRE', item_tipi ile kırılım).
 * Tablo henüz yoksa / sütunlar beklenenden farklıysa sıfır döner.
 * Beklenen sütunlar: stok_turu, item_tipi, miktar (veya qty/adet), tarih (veya created_at).
 */
export async function getKalite(from: string | null, to: string | null): Promise<KaliteData> {
  const zero: KaliteData = { available: false, fire: { urun: 0, yariMamul: 0, plaka: 0, total: 0 } };
  try {
    const s = await sb();
    const rows = await fetchAll<Record<string, any>>((lo, hi) => {
      let q = s.from("kalite_hareketleri").select("*").eq("stok_turu", "FIRE");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    });
    const fire = { urun: 0, yariMamul: 0, plaka: 0, total: 0 };
    for (const r of rows) {
      const n = Math.abs(Number(r.qty ?? r.miktar ?? r.adet ?? 0));
      const t = String(r.item_tipi ?? "").toUpperCase();
      if (t.includes("PLAKA")) fire.plaka += n;
      else if (t.includes("YARI") || t.includes("PARCA") || t.includes("PARÇA")) fire.yariMamul += n;
      else fire.urun += n;
      fire.total += n;
    }
    return { available: true, fire };
  } catch {
    return zero;
  }
}

// ─── Ürün adları ────────────────────────────────────────────────

export async function getProductNames(): Promise<Map<string, string>> {
  const s = await sb();
  const rows = await fetchAll<{ sku: string; urun_adi: string | null }>((lo, hi) =>
    s.from("products").select("sku, urun_adi").order("sku").range(lo, hi),
  );
  return new Map(rows.map((r) => [r.sku, r.urun_adi ?? r.sku]));
}

export { parseWorkers };
