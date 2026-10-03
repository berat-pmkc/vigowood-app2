import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  bucketKey,
  bucketKeys,
  bucketLabel,
  trBugun,
  trDay,
  tsBounds,
  type Granularity,
} from "@/lib/periods";
import { fetchAll, parseWorkers, round } from "./utils";
import type { ChartRow } from "./series";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Phase D2 (montaj / kesim / birim süre / stok verimliliği / personel) veri çekicileri. */

async function sb(): Promise<any> {
  return await createClient();
}

export async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    console.error("[analiz-d2]", e);
    return fallback;
  }
}

// ─── Ortak yardımcılar ──────────────────────────────────────────

export type DayMap = Record<string, number>;

export function addTo(map: DayMap, key: string | null, v: number) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + v;
}

/** Pay / payda gün haritalarından kova bazlı oran serisi (ağırlıklı ortalama). */
export function ratioSeries(
  from: string | null,
  to: string | null,
  g: Granularity,
  series: Record<string, { num: DayMap; den: DayMap }>,
  digits = 2,
): ChartRow[] {
  const days = Object.values(series)
    .flatMap((s) => [...Object.keys(s.num), ...Object.keys(s.den)])
    .sort();
  const f = from ?? days[0];
  const t = to ?? days[days.length - 1];
  if (!f || !t) return [];
  const keys = bucketKeys(f, t, g);
  const acc: Record<string, Record<string, { n: number; d: number }>> = {};
  for (const [name, s] of Object.entries(series)) {
    acc[name] = {};
    for (const [day, v] of Object.entries(s.num)) (acc[name][bucketKey(day, g)] ??= { n: 0, d: 0 }).n += v;
    for (const [day, v] of Object.entries(s.den)) (acc[name][bucketKey(day, g)] ??= { n: 0, d: 0 }).d += v;
  }
  return keys.map((k) => {
    const row: ChartRow = { label: bucketLabel(k, g), key: k };
    for (const name of Object.keys(series)) {
      const a = acc[name][k];
      row[name] = a && a.d > 0 ? round(a.n / a.d, digits) : null;
    }
    return row;
  });
}

// ─── Kalite defteri ─────────────────────────────────────────────

export interface KaliteRow {
  id: string;
  tarih: string;
  item_tipi: string;
  item_id: string | null;
  stok_turu: string;
  qty: number;
  islem: string;
  kaynak: string | null;
  source_id: string | null;
  parent_id: string | null;
  operator_id: string | null;
  operator_name: string | null;
}

/** Tablo yoksa / hata varsa boş döner. */
export async function getKaliteRows(from: string | null, to: string | null): Promise<KaliteRow[]> {
  try {
    const s = await sb();
    const rows = await fetchAll<any>((lo, hi) => {
      let q = s
        .from("kalite_hareketleri")
        .select(
          "id, tarih, item_tipi, item_id, stok_turu, qty, islem, kaynak, source_id, parent_id, operator_id, operator_name",
        )
        .order("id");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    });
    return rows.map((r: any) => ({ ...r, qty: Number(r.qty ?? 0) }));
  } catch {
    return [];
  }
}

export type Origin = "montaj" | "kesim" | "diger";

function originOf(kaynak: string | null, sourceId: string | null): Origin {
  if (kaynak === "montaj") return "montaj";
  if (kaynak === "kesim") return "kesim";
  const sid = sourceId ?? "";
  if (sid.startsWith("MNT-")) return "montaj";
  if (sid.startsWith("KES-")) return "kesim";
  return "diger";
}

/**
 * Satırın kökeni: kaynak montaj/kesim ise kendisi; kontrol satırlarında
 * source_id öneki (MNT-/KES-) veya parent satırın kaynağı kullanılır.
 */
export function resolveOrigin(
  r: KaliteRow,
  byId: Map<string, KaliteRow>,
): { origin: Origin; sourceId: string | null } {
  const o = originOf(r.kaynak, r.source_id);
  if (o !== "diger") return { origin: o, sourceId: r.source_id };
  const p = r.parent_id ? byId.get(r.parent_id) : undefined;
  if (p) {
    const po = originOf(p.kaynak, p.source_id);
    if (po !== "diger") return { origin: po, sourceId: p.source_id };
  }
  return { origin: "diger", sourceId: r.source_id };
}

export type KaliteMetric = "uygunsuz" | "kontrol" | "fire" | "donusum";

/** Bir satırın kalite metriklerine katkısı (tanımlar: görev notu). */
export function kaliteContribution(r: KaliteRow): { metric: KaliteMetric; value: number }[] {
  const out: { metric: KaliteMetric; value: number }[] = [];
  if (r.stok_turu === "UYGUNSUZ") {
    if (r.islem === "giris") out.push({ metric: "uygunsuz", value: r.qty });
    if (r.qty < 0) out.push({ metric: "kontrol", value: Math.abs(r.qty) });
    if (r.islem === "donusum_kaynak") out.push({ metric: "donusum", value: Math.abs(r.qty) });
  } else if (r.stok_turu === "FIRE") {
    out.push({ metric: "fire", value: r.qty });
  }
  return out;
}

export interface KaliteAgg {
  uygunsuz: number;
  kontrol: number;
  fire: number;
  donusum: number;
  fireByTip: { YARI_MAMUL: number; PLAKA: number; URUN: number };
  byDay: Record<KaliteMetric, DayMap>;
}

export function aggregateKalite(rows: KaliteRow[], origin: Origin, tipler: string[]): KaliteAgg {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const agg: KaliteAgg = {
    uygunsuz: 0,
    kontrol: 0,
    fire: 0,
    donusum: 0,
    fireByTip: { YARI_MAMUL: 0, PLAKA: 0, URUN: 0 },
    byDay: { uygunsuz: {}, kontrol: {}, fire: {}, donusum: {} },
  };
  for (const r of rows) {
    if (!tipler.includes(r.item_tipi)) continue;
    if (resolveOrigin(r, byId).origin !== origin) continue;
    for (const c of kaliteContribution(r)) {
      agg[c.metric] += c.value;
      addTo(agg.byDay[c.metric], trDay(r.tarih), c.value);
      if (c.metric === "fire" && r.item_tipi in agg.fireByTip) {
        agg.fireByTip[r.item_tipi as keyof KaliteAgg["fireByTip"]] += c.value;
      }
    }
  }
  return agg;
}

// ─── Montaj ─────────────────────────────────────────────────────

export interface MontajSessionRow {
  session_id: string;
  sku: string;
  step_id: string;
  step_name: string | null;
  qty: number;
  net_sure_dk: number | null;
  worker_count: number;
  workers: { id: string; name: string }[];
  birim: number | null;
  day: string;
}

export async function getMontajSessions(from: string | null, to: string | null): Promise<MontajSessionRow[]> {
  const s = await sb();
  const b = tsBounds(from, to);
  const rows = await fetchAll<any>((lo, hi) => {
    let q = s
      .from("montaj_sessions")
      .select(
        "session_id, sku, step_id, step_name, qty, net_sure_dk, worker_count, workers, operator_id, operator_name, birim_montaj_dk, created_at",
      )
      .eq("durum", "tamamlandi")
      .order("session_id");
    if (b.gte) q = q.gte("created_at", b.gte);
    if (b.lte) q = q.lte("created_at", b.lte);
    return q.range(lo, hi);
  });
  const out: MontajSessionRow[] = [];
  for (const r of rows) {
    const day = trDay(r.created_at);
    if (!day) continue;
    let ws = parseWorkers(r.workers);
    if (ws.length === 0 && (r.operator_id || r.operator_name)) {
      ws = [{ id: r.operator_id ?? r.operator_name, name: r.operator_name ?? r.operator_id }];
    }
    out.push({
      session_id: r.session_id,
      sku: r.sku,
      step_id: r.step_id,
      step_name: r.step_name,
      qty: Number(r.qty ?? 0),
      net_sure_dk: r.net_sure_dk === null || r.net_sure_dk === undefined ? null : Number(r.net_sure_dk),
      worker_count: Math.max(Number(r.worker_count ?? 0), ws.length, 1),
      workers: ws,
      birim: r.birim_montaj_dk === null || r.birim_montaj_dk === undefined ? null : Number(r.birim_montaj_dk),
      day,
    });
  }
  return out;
}

// ─── Kesim ──────────────────────────────────────────────────────

export interface KesimBatchRow {
  cut_id: string;
  day: string;
  plaka_id: string | null;
  makine_id: string | null;
  adet: number;
  operator_id: string | null;
  parts: number;
  /** Planlanan süre (dk) = adet × plakalar.kesim_sureleri[makine] */
  plannedMin: number;
}

export interface KesimDetay {
  batches: KesimBatchRow[];
  operatorNames: Map<string, string>;
}

export async function getKesimDetay(from: string | null, to: string | null): Promise<KesimDetay> {
  const s = await sb();
  const [batches, lines, plakalar, users] = await Promise.all([
    fetchAll<any>((lo, hi) => {
      let q = s
        .from("cut_batches")
        .select("cut_id, tarih, plaka_id, makine_id, adet, operator_id")
        .eq("durum", "tamamlandi")
        .order("cut_id");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    }),
    fetchAll<any>((lo, hi) => {
      let q = s.from("cut_lines").select("cut_id, adet").order("cut_line_id");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    }),
    fetchAll<any>((lo, hi) => s.from("plakalar").select("plaka_id, kesim_sureleri").order("plakalar_id").range(lo, hi)),
    fetchAll<any>((lo, hi) => s.from("users").select("user_id, full_name").order("user_id").range(lo, hi)),
  ]);

  const partsByCut = new Map<string, number>();
  for (const l of lines) partsByCut.set(l.cut_id, (partsByCut.get(l.cut_id) ?? 0) + Number(l.adet ?? 0));
  const sure = new Map<string, Record<string, number>>();
  for (const p of plakalar) {
    if (p.kesim_sureleri && typeof p.kesim_sureleri === "object") sure.set(p.plaka_id, p.kesim_sureleri);
  }

  const out: KesimBatchRow[] = [];
  for (const b of batches) {
    const day = trDay(b.tarih);
    if (!day) continue;
    const adet = Number(b.adet ?? 0);
    const per = Number(sure.get(b.plaka_id)?.[b.makine_id] ?? 0);
    out.push({
      cut_id: b.cut_id,
      day,
      plaka_id: b.plaka_id,
      makine_id: b.makine_id,
      adet,
      operator_id: b.operator_id,
      parts: partsByCut.get(b.cut_id) ?? 0,
      plannedMin: adet * (isFinite(per) ? per : 0),
    });
  }
  return { batches: out, operatorNames: new Map(users.map((u: any) => [u.user_id, u.full_name])) };
}

// ─── Paketleme birim süre (ürün bazlı) ──────────────────────────

export async function getPaketlemeBySku(
  from: string | null,
  to: string | null,
): Promise<{ sku: string; qty: number; avgDk: number }[]> {
  const s = await sb();
  const rows = await fetchAll<any>((lo, hi) => {
    let q = s
      .from("pack_events")
      .select("sku, qty, birim_paketleme_dk")
      .eq("durum", "tamamlandi")
      .not("birim_paketleme_dk", "is", null)
      .order("session_id");
    if (from) q = q.gte("tarih", from);
    if (to) q = q.lte("tarih", to);
    return q.range(lo, hi);
  });
  const acc = new Map<string, { w: number; s: number }>();
  for (const r of rows) {
    const v = Number(r.birim_paketleme_dk ?? 0);
    const w = Number(r.qty ?? 0);
    if (!r.sku || v < 0.05 || w <= 0) continue;
    const a = acc.get(r.sku) ?? { w: 0, s: 0 };
    a.w += w;
    a.s += v * w;
    acc.set(r.sku, a);
  }
  return [...acc].map(([sku, a]) => ({ sku, qty: a.w, avgDk: round(a.s / a.w, 2) }));
}

// ─── Personel: kişi × adım ──────────────────────────────────────

export interface PersonStepStat {
  stepId: string;
  stepName: string | null;
  /** Kişiye düşen adet (qty / çalışan sayısı) */
  qty: number;
  /** Harcanan dakika (net seans süresi) */
  minutes: number;
  /** dk / adet = minutes / qty */
  unitDk: number;
}

/** Kişi → adım bazlı istatistik (yalnızca montaj; net_sure_dk > 0 olan seanslar). */
export async function getPersonStepStats(
  from: string | null,
  to: string | null,
): Promise<Map<string, PersonStepStat[]>> {
  const sessions = await getMontajSessions(from, to);
  const acc = new Map<string, Map<string, { name: string | null; qty: number; minutes: number }>>();
  for (const r of sessions) {
    const net = r.net_sure_dk ?? 0;
    if (r.qty <= 0 || net <= 0) continue;
    for (const w of r.workers) {
      let steps = acc.get(w.id);
      if (!steps) acc.set(w.id, (steps = new Map()));
      const a = steps.get(r.step_id) ?? { name: r.step_name, qty: 0, minutes: 0 };
      a.qty += r.qty / r.worker_count;
      a.minutes += net;
      steps.set(r.step_id, a);
    }
  }
  const out = new Map<string, PersonStepStat[]>();
  for (const [pid, steps] of acc) {
    out.set(
      pid,
      [...steps].map(([stepId, a]) => ({
        stepId,
        stepName: a.name,
        qty: round(a.qty, 1),
        minutes: round(a.minutes, 1),
        unitDk: a.qty > 0 ? round(a.minutes / a.qty, 2) : 0,
      })),
    );
  }
  return out;
}

// ─── Stok verimliliği (ayrıntılı) ───────────────────────────────

export interface StokProductRow {
  sku: string;
  name: string;
  kritik: number;
  current: number;
  avg: number;
  belowDays: number;
  aboveDays: number;
  days: number;
  score: number;
}

export interface StokVerimlilikDetay {
  overallPct: number | null;
  /** Gün → ürünlerin ortalama gün skoru (%) */
  scoreByDay: DayMap;
  /** Gün → kritik altı ürün oranı (%) */
  belowByDay: DayMap;
  /** Gün → aşırı stoktaki ürün oranı (%) */
  aboveByDay: DayMap;
  belowDayPct: number | null;
  aboveDayPct: number | null;
  currentBelow: number;
  activeCount: number;
  /** Skora göre artan */
  products: StokProductRow[];
  altPct: number;
  ustPct: number;
}

export async function getStokVerimlilikDetay(from: string | null, to: string | null): Promise<StokVerimlilikDetay> {
  const s = await sb();
  const today = trBugun();
  const dayTo = !to || to > today ? today : to;
  const dayFrom = from ?? addDays(today, -89);

  let altPct = 0;
  let ustPct = 100;
  try {
    const { data } = await s.from("app_settings").select("value").eq("key", "stok_verimlilik").maybeSingle();
    const v = data?.value as { alt_tolerans_pct?: number; ust_tolerans_pct?: number } | undefined;
    if (v && v.alt_tolerans_pct !== undefined && isFinite(Number(v.alt_tolerans_pct))) {
      altPct = Math.min(100, Math.max(0, Number(v.alt_tolerans_pct)));
    }
    if (v && v.ust_tolerans_pct !== undefined && isFinite(Number(v.ust_tolerans_pct))) {
      ustPct = Math.max(0, Number(v.ust_tolerans_pct));
    }
  } catch {
    /* varsayılanlar */
  }

  const empty: StokVerimlilikDetay = {
    overallPct: null,
    scoreByDay: {},
    belowByDay: {},
    aboveByDay: {},
    belowDayPct: null,
    aboveDayPct: null,
    currentBelow: 0,
    activeCount: 0,
    products: [],
    altPct,
    ustPct,
  };
  if (dayFrom > dayTo) return empty;

  const [{ data: prods }, { data: balRows }] = await Promise.all([
    s.from("products").select("sku, urun_adi, mamul_stok_kritik").eq("aktif_mi", true).gt("mamul_stok_kritik", 0),
    s.from("urun_toplam_stok").select("sku, miktar"),
  ]);
  const info = new Map<string, { name: string; kritik: number }>();
  for (const p of (prods ?? []) as any[]) {
    info.set(p.sku, { name: p.urun_adi ?? p.sku, kritik: Number(p.mamul_stok_kritik) });
  }
  if (info.size === 0) return empty;

  const bal = new Map<string, number>();
  for (const k of info.keys()) bal.set(k, 0);
  for (const r of (balRows ?? []) as any[]) if (r.sku && bal.has(r.sku)) bal.set(r.sku, Number(r.miktar ?? 0));
  const current = new Map(bal);

  const moves = await fetchAll<any>((lo, hi) =>
    s.from("stock_movements").select("sku, qty, tarih").gte("tarih", dayFrom).order("id").range(lo, hi),
  );
  const net = new Map<string, Map<string, number>>();
  for (const m of moves) {
    const d = trDay(m.tarih);
    if (!d || !m.sku || !info.has(m.sku)) continue;
    let dm = net.get(d);
    if (!dm) net.set(d, (dm = new Map()));
    dm.set(m.sku, (dm.get(m.sku) ?? 0) + Number(m.qty ?? 0));
  }

  const stat = new Map<string, { sumScore: number; sumBal: number; below: number; above: number; n: number }>();
  for (const k of info.keys()) stat.set(k, { sumScore: 0, sumBal: 0, below: 0, above: 0, n: 0 });
  const scoreByDay: DayMap = {};
  const belowByDay: DayMap = {};
  const aboveByDay: DayMap = {};
  const N = info.size;

  for (let d = today, i = 0; d >= dayFrom && i < 4000; d = addDays(d, -1), i++) {
    if (d <= dayTo) {
      let ds = 0;
      let lo = 0;
      let hi = 0;
      for (const [sku, { kritik }] of info) {
        const b = bal.get(sku) ?? 0;
        const lower = kritik * (1 - altPct / 100);
        const upper = kritik * (1 + ustPct / 100);
        const st = stat.get(sku)!;
        let sc = 100;
        if (b < lower) {
          sc = lower > 0 ? Math.max(0, (b / lower) * 100) : 0;
          st.below++;
          lo++;
        } else if (b > upper) {
          sc = b > 0 ? (upper / b) * 100 : 0;
          st.above++;
          hi++;
        }
        st.sumScore += sc;
        st.sumBal += b;
        st.n++;
        ds += sc;
      }
      scoreByDay[d] = round(ds / N, 1);
      belowByDay[d] = round((lo / N) * 100, 1);
      aboveByDay[d] = round((hi / N) * 100, 1);
    }
    const dm = net.get(d);
    if (dm) for (const [sku, v] of dm) bal.set(sku, (bal.get(sku) ?? 0) - v);
  }

  const products: StokProductRow[] = [];
  let sumScores = 0;
  let sumBelow = 0;
  let sumAbove = 0;
  let sumDays = 0;
  let currentBelow = 0;
  for (const [sku, { name, kritik }] of info) {
    const st = stat.get(sku)!;
    if (st.n === 0) continue;
    const score = st.sumScore / st.n;
    sumScores += score;
    sumBelow += st.below;
    sumAbove += st.above;
    sumDays += st.n;
    const cur = current.get(sku) ?? 0;
    if (cur < kritik * (1 - altPct / 100)) currentBelow++;
    products.push({
      sku,
      name,
      kritik,
      current: cur,
      avg: round(st.sumBal / st.n, 1),
      belowDays: st.below,
      aboveDays: st.above,
      days: st.n,
      score: round(score, 1),
    });
  }
  products.sort((a, b) => a.score - b.score);

  return {
    overallPct: products.length ? round(sumScores / products.length, 1) : null,
    scoreByDay,
    belowByDay,
    aboveByDay,
    belowDayPct: sumDays ? round((sumBelow / sumDays) * 100, 1) : null,
    aboveDayPct: sumDays ? round((sumAbove / sumDays) * 100, 1) : null,
    currentBelow,
    activeCount: N,
    products,
    altPct,
    ustPct,
  };
}
