import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { bucketKey, bucketLabel, resolvePeriod, trDay, type ResolvedPeriod } from "@/lib/periods";
import { AnalizLayout } from "../_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "../_shared/analiz-chart";
import type { MetricChip } from "../_shared/metric-chips";
import { StatCard } from "../_shared/stat-card";
import { CompactList, type CompactColumn, type CompactRow } from "../_shared/compact-list";
import {
  distinctOptions,
  filterNote,
  hasActiveFilters,
  parseColumnFilters,
  pickByFilters,
} from "../_shared/column-filters";
import { buildSeries, resolveGranularity } from "../_shared/series";
import { deltaPct, fmtNum, round } from "../_shared/utils";
import {
  addTo,
  aggregateKalite,
  getKaliteRows,
  getMontajSessions,
  kaliteContribution,
  ratioSeries,
  resolveOrigin,
  safe,
  type DayMap,
  type KaliteMetric,
  type KaliteRow,
  type MontajSessionRow,
} from "../_shared/queries-d2";

export const metadata: Metadata = { title: "Montaj | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "adet", label: "İş Adımı Adedi" },
  { key: "birim-sure", label: "Birim Süre" },
  { key: "calisan", label: "Çalışan Sayısı" },
  { key: "uygunsuz", label: "Uygunsuz YM" },
  { key: "fire", label: "Fire YM" },
];

type SP = Record<string, string | string[] | undefined>;
const TIPLER = ["YARI_MAMUL"];

interface Summary {
  qty: number;
  sessions: number;
  birim: number | null;
  avgWorkers: number | null;
  uygunsuz: number;
  kontrol: number;
  fire: number;
  qtyByDay: DayMap;
  birimNum: DayMap;
  birimDen: DayMap;
  workersByDay: DayMap;
  uygunsuzByDay: DayMap;
  fireByDay: DayMap;
}

function summarize(sessions: MontajSessionRow[], kalite: KaliteRow[]): Summary {
  const qtyByDay: DayMap = {};
  const birimNum: DayMap = {};
  const birimDen: DayMap = {};
  const dayWorkers = new Map<string, Set<string>>();
  let qty = 0;
  let num = 0;
  let den = 0;
  for (const r of sessions) {
    qty += r.qty;
    addTo(qtyByDay, r.day, r.qty);
    if (r.birim !== null && r.birim >= 0.05 && r.qty > 0) {
      num += r.birim * r.qty;
      den += r.qty;
      addTo(birimNum, r.day, r.birim * r.qty);
      addTo(birimDen, r.day, r.qty);
    }
    const set = dayWorkers.get(r.day) ?? new Set<string>();
    for (const w of r.workers) set.add(w.id);
    dayWorkers.set(r.day, set);
  }
  const workersByDay: DayMap = {};
  for (const [d, set] of dayWorkers) workersByDay[d] = set.size;
  const wv = Object.values(workersByDay);
  const k = aggregateKalite(kalite, "montaj", TIPLER);
  return {
    qty,
    sessions: sessions.length,
    birim: den > 0 ? round(num / den, 2) : null,
    avgWorkers: wv.length ? round(wv.reduce((a, b) => a + b, 0) / wv.length, 1) : null,
    uygunsuz: k.uygunsuz,
    kontrol: k.kontrol,
    fire: k.fire,
    qtyByDay,
    birimNum,
    birimDen,
    workersByDay,
    uygunsuzByDay: k.byDay.uygunsuz,
    fireByDay: k.byDay.fire,
  };
}

const EMPTY: Summary = {
  qty: 0,
  sessions: 0,
  birim: null,
  avgWorkers: null,
  uygunsuz: 0,
  kontrol: 0,
  fire: 0,
  qtyByDay: {},
  birimNum: {},
  birimDen: {},
  workersByDay: {},
  uygunsuzByDay: {},
  fireByDay: {},
};

function buildChart(metric: string, period: ResolvedPeriod, sp: SP, d: Summary): AnalizChartProps & { title: string } {
  const { from, to } = period;
  const g = resolveGranularity(sp.g, from, to);
  switch (metric) {
    case "birim-sure":
      return {
        title: "Birim süre (dk / adet, adet ağırlıklı)",
        type: "line",
        xKey: "label",
        unit: " dk",
        data: ratioSeries(from, to, g, { v: { num: d.birimNum, den: d.birimDen } }),
        series: [{ key: "v", label: "Birim süre", color: "#8d9d70" }],
      };
    case "calisan":
      return {
        title: "Çalışan sayısı (çalışılan gün başına ortalama)",
        type: "line",
        xKey: "label",
        data: buildSeries(from, to, g, { v: d.workersByDay }, "avg"),
        series: [{ key: "v", label: "Çalışan", color: "#3368b1" }],
      };
    case "uygunsuz":
      return {
        title: "Uygunsuz yarı mamul (adet)",
        type: "bar",
        xKey: "label",
        data: buildSeries(from, to, g, { v: d.uygunsuzByDay }),
        series: [{ key: "v", label: "Uygunsuz YM", color: "#f28a19" }],
      };
    case "fire":
      return {
        title: "Fire yarı mamul (adet)",
        type: "bar",
        xKey: "label",
        data: buildSeries(from, to, g, { v: d.fireByDay }),
        series: [{ key: "v", label: "Fire YM", color: "#ee7683" }],
      };
    case "adet":
    default:
      return {
        title: "İş adımı adedi",
        type: "bar",
        xKey: "label",
        data: buildSeries(from, to, g, { v: d.qtyByDay }),
        series: [{ key: "v", label: "Adet", color: "#8d9d70" }],
      };
  }
}

const COLS: CompactColumn[] = [
  { key: "donem", label: "Dönem" },
  { key: "sku", label: "Ürün Kodu" },
  { key: "adim", label: "İş Adımı Kodu" },
  { key: "kisi", label: "Personel Adı Soyadı" },
  { key: "adet", label: "İş Adımı Adedi", align: "right", format: "number" },
  { key: "uygunsuz", label: "Uygunsuz YM", align: "right", format: "number" },
  { key: "kontrol", label: "Kontrol Edilen Uygunsuz YM", align: "right", format: "number" },
  { key: "fire", label: "Fire", align: "right", format: "number" },
  { key: "birim", label: "Birim Süre", align: "right", format: "dk" },
];

type Gran = ReturnType<typeof resolveGranularity>;

interface Acc {
  bucket: string;
  sku: string;
  stepId: string;
  stepName: string | null;
  personId: string;
  person: string;
  qty: number;
  num: number;
  den: number;
  m: Record<KaliteMetric, number>;
  // filtre altında kart/grafik yeniden hesabı için gün kırılımı
  qtyByDay: DayMap;
  numByDay: DayMap;
  denByDay: DayMap;
  kByDay: Record<KaliteMetric, DayMap>;
  sessionIds: Set<string>;
}

function buildAccs(sessions: MontajSessionRow[], kalite: KaliteRow[], g: Gran): Acc[] {
  const acc = new Map<string, Acc>();
  const bySession = new Map<string, MontajSessionRow>();
  const getAcc = (s: MontajSessionRow, pid: string, pname: string) => {
    const bk = bucketKey(s.day, g);
    const key = `${bk}|${s.sku}|${s.step_id}|${pid}`;
    let a = acc.get(key);
    if (!a) {
      a = {
        bucket: bk,
        sku: s.sku,
        stepId: s.step_id,
        stepName: s.step_name,
        personId: pid,
        person: pname,
        qty: 0,
        num: 0,
        den: 0,
        m: { uygunsuz: 0, kontrol: 0, fire: 0, donusum: 0 },
        qtyByDay: {},
        numByDay: {},
        denByDay: {},
        kByDay: { uygunsuz: {}, kontrol: {}, fire: {}, donusum: {} },
        sessionIds: new Set(),
      };
      acc.set(key, a);
    }
    return a;
  };

  for (const s of sessions) {
    bySession.set(s.session_id, s);
    const n = s.worker_count;
    for (const w of s.workers) {
      const a = getAcc(s, w.id, w.name);
      const credit = s.qty / n;
      a.qty += credit;
      addTo(a.qtyByDay, s.day, credit);
      a.sessionIds.add(s.session_id);
      if (s.birim !== null && s.birim >= 0.05 && credit > 0) {
        a.num += s.birim * credit;
        a.den += credit;
        addTo(a.numByDay, s.day, s.birim * credit);
        addTo(a.denByDay, s.day, credit);
      }
    }
  }

  const byId = new Map(kalite.map((r) => [r.id, r]));
  for (const r of kalite) {
    if (!TIPLER.includes(r.item_tipi)) continue;
    const o = resolveOrigin(r, byId);
    if (o.origin !== "montaj" || !o.sourceId) continue;
    const s = bySession.get(o.sourceId);
    if (!s || s.workers.length === 0) continue;
    const day = trDay(r.tarih);
    for (const c of kaliteContribution(r)) {
      // Uygunsuz giriş ve fire: kaydı giren kişi seans çalışanıysa ona, değilse eşit pay
      const direct =
        (c.metric === "uygunsuz" || c.metric === "fire") && r.operator_id
          ? s.workers.find((w) => w.id === r.operator_id)
          : undefined;
      if (direct) {
        const a = getAcc(s, direct.id, direct.name);
        a.m[c.metric] += c.value;
        addTo(a.kByDay[c.metric], day, c.value);
      } else {
        for (const w of s.workers) {
          const a = getAcc(s, w.id, w.name);
          const v = c.value / s.workers.length;
          a.m[c.metric] += v;
          addTo(a.kByDay[c.metric], day, v);
        }
      }
    }
  }

  return [...acc.values()].sort((a, b) =>
    a.bucket < b.bucket ? 1 : a.bucket > b.bucket ? -1 : b.qty - a.qty,
  );
}

const toRow = (a: Acc, g: Gran): CompactRow => ({
  donem: bucketLabel(a.bucket, g),
  sku: a.sku,
  adim: a.stepName ? `${a.stepId} · ${a.stepName}` : a.stepId,
  kisi: a.person,
  adet: round(a.qty, 1),
  uygunsuz: round(a.m.uygunsuz, 1),
  kontrol: round(a.m.kontrol, 1),
  fire: round(a.m.fire, 1),
  birim: a.den > 0 ? round(a.num / a.den, 2) : null,
});

/** Filtreyle eşleşen satırlardan kart/grafik özeti (filtre aktifken kullanılır). */
function summarizeAccs(accs: Acc[]): Summary {
  const qtyByDay: DayMap = {};
  const birimNum: DayMap = {};
  const birimDen: DayMap = {};
  const uygunsuzByDay: DayMap = {};
  const fireByDay: DayMap = {};
  const dayWorkers = new Map<string, Set<string>>();
  const sessionIds = new Set<string>();
  let qty = 0;
  let num = 0;
  let den = 0;
  let uygunsuz = 0;
  let kontrol = 0;
  let fire = 0;
  for (const a of accs) {
    qty += a.qty;
    num += a.num;
    den += a.den;
    uygunsuz += a.m.uygunsuz;
    kontrol += a.m.kontrol;
    fire += a.m.fire;
    a.sessionIds.forEach((id) => sessionIds.add(id));
    for (const [d, v] of Object.entries(a.qtyByDay)) {
      addTo(qtyByDay, d, v);
      const set = dayWorkers.get(d) ?? new Set<string>();
      set.add(a.personId);
      dayWorkers.set(d, set);
    }
    for (const [d, v] of Object.entries(a.numByDay)) addTo(birimNum, d, v);
    for (const [d, v] of Object.entries(a.denByDay)) addTo(birimDen, d, v);
    for (const [d, v] of Object.entries(a.kByDay.uygunsuz)) addTo(uygunsuzByDay, d, v);
    for (const [d, v] of Object.entries(a.kByDay.fire)) addTo(fireByDay, d, v);
  }
  const workersByDay: DayMap = {};
  for (const [d, set] of dayWorkers) workersByDay[d] = set.size;
  const wv = Object.values(workersByDay);
  return {
    qty,
    sessions: sessionIds.size,
    birim: den > 0 ? round(num / den, 2) : null,
    avgWorkers: wv.length ? round(wv.reduce((x, y) => x + y, 0) / wv.length, 1) : null,
    uygunsuz,
    kontrol,
    fire,
    qtyByDay,
    birimNum,
    birimDen,
    workersByDay,
    uygunsuzByDay,
    fireByDay,
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (![...ADMIN_ROLES, ...OFFICE_ROLES].includes(user.role)) redirect("/");

  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const { from, to } = period;
  const metricRaw = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const metric = CHIPS.some((c) => c.key === metricRaw) ? (metricRaw as string) : CHIPS[0].key;
  const g = resolveGranularity(sp.g, from, to);

  const hasPrev = !!(period.prevFrom && period.prevTo);
  const [sessions, kalite, prevSessions, prevKalite] = await Promise.all([
    safe(getMontajSessions(from, to), [] as MontajSessionRow[]),
    safe(getKaliteRows(from, to), [] as KaliteRow[]),
    hasPrev ? safe(getMontajSessions(period.prevFrom, period.prevTo), [] as MontajSessionRow[]) : Promise.resolve(null),
    hasPrev ? safe(getKaliteRows(period.prevFrom, period.prevTo), [] as KaliteRow[]) : Promise.resolve(null),
  ]);

  // Kolon filtreleri: kart + grafik + liste eşleşen satırlardan türer
  const accs = buildAccs(sessions, kalite, g);
  const colFilters = parseColumnFilters(sp, COLS);
  const filtActive = hasActiveFilters(colFilters);
  const matched = pickByFilters(accs, (a) => toRow(a, g), colFilters);
  const options = distinctOptions(accs.map((a) => toRow(a, g)), COLS);
  const rows = matched.map((a) => toRow(a, g));

  const cur = filtActive ? summarizeAccs(matched) : summarize(sessions, kalite);
  // Önceki dönem kıyası filtreye uygulanamaz; filtre aktifken gizlenir
  const prev = !filtActive && prevSessions && prevKalite ? summarize(prevSessions, prevKalite) : null;
  void EMPTY;

  const { title, ...chartProps } = buildChart(metric, period, sp, cur);

  const hide = (empty: boolean) => filtActive && empty;
  const cards = (
    <>
      {!hide(cur.qty === 0) && (
        <StatCard
          title="Toplam İş Adımı Adedi"
          value={fmtNum(cur.qty)}
          subtitle={`${fmtNum(cur.sessions)} seans`}
          delta={prev ? deltaPct(cur.qty, prev.qty) : null}
        />
      )}
      {!hide(cur.avgWorkers === null) && (
        <StatCard
          title="Ortalama Çalışan Sayısı"
          value={cur.avgWorkers === null ? "—" : cur.avgWorkers.toLocaleString("tr-TR")}
          subtitle="Çalışılan gün başına farklı kişi"
          delta={prev && cur.avgWorkers !== null ? deltaPct(cur.avgWorkers, prev.avgWorkers) : null}
        />
      )}
      {!hide(cur.birim === null) && (
        <StatCard
          title="Birim Süre"
          value={cur.birim === null ? "—" : `${cur.birim.toLocaleString("tr-TR")} dk`}
          subtitle="dk / adet, adet ağırlıklı"
          delta={prev && cur.birim !== null ? deltaPct(cur.birim, prev.birim) : null}
          inverseDelta
        />
      )}
      {!hide(cur.uygunsuz === 0) && (
        <StatCard
          title="Toplam Uygunsuz Yarı Mamul"
          value={fmtNum(cur.uygunsuz)}
          subtitle="Montajdan uygunsuza giren"
          delta={prev ? deltaPct(cur.uygunsuz, prev.uygunsuz) : null}
          inverseDelta
        />
      )}
      {!hide(cur.kontrol === 0) && (
        <StatCard
          title="Kontrol Edilen Uygunsuz YM"
          value={fmtNum(cur.kontrol)}
          subtitle="Kontrol kararı verilen adet"
          delta={prev ? deltaPct(cur.kontrol, prev.kontrol) : null}
        />
      )}
      {!hide(cur.fire === 0) && (
        <StatCard
          title="Fire Yarı Mamul"
          value={fmtNum(cur.fire)}
          subtitle="Montaj kaynaklı fire"
          delta={prev ? deltaPct(cur.fire, prev.fire) : null}
          inverseDelta
        />
      )}
    </>
  );

  const list = (
    <div className="space-y-1">
      <CompactList
        title="Montaj Detayı"
        showGrouping
        activeGranularity={g}
        columns={COLS}
        rows={rows}
        filterOptions={options}
      />
      <p className="px-1 text-[11px] text-muted-foreground">
        Ekip seanslarında adet, çalışan sayısına eşit bölünerek her kişiye yazılır. Uygunsuz/fire kayıtları seans
        koduyla eşleşir; kaydı giren kişi seans çalışanıysa ona, değilse çalışanlara eşit paylaştırılır.
      </p>
    </div>
  );

  return (
    <AnalizLayout
      title="Montaj"
      backHref="/analiz"
      period={period}
      filterNote={filterNote(colFilters, COLS)}
      chips={CHIPS}
      activeMetric={metric}
      chart={<AnalizChart {...chartProps} title={title} />}
      cards={cards}
      list={list}
    />
  );
}
