import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { bucketKey, bucketLabel, resolvePeriod, trDay, type ResolvedPeriod } from "@/lib/periods";
import { AnalizLayout } from "../_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "../_shared/analiz-chart";
import type { MetricChip } from "../_shared/metric-chips";
import { asamaRengi } from "@/lib/talimat/hat-renk";
import { StatCard } from "../_shared/stat-card";
import { SummaryChart, type SummaryItem } from "../_shared/summary-chart";
import { CompactList, type CompactColumn, type CompactRow } from "../_shared/compact-list";
import {
  distinctOptions,
  filterNote,
  hasActiveFilters,
  parseColumnFilters,
  pickByFilters,
} from "../_shared/column-filters";
import { resolveFocus, type FocusMap } from "../_shared/focus";
import { buildSeries, resolveGranularity } from "../_shared/series";
import { deltaPct, fmtNum, round } from "../_shared/utils";
import { periodQuery } from "../_shared/queries-d1";
import {
  addTo,
  aggregateKalite,
  getKaliteRows,
  getKesimDetay,
  kaliteContribution,
  resolveOrigin,
  safe,
  type DayMap,
  type KaliteAgg,
  type KaliteMetric,
  type KaliteRow,
  type KesimDetay,
} from "../_shared/queries-d2";

export const metadata: Metadata = { title: "Kesim | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "tumu", label: "Tümü" },
  { key: "plaka", label: "Plaka Adedi" },
  { key: "parca", label: "Parça Adedi" },
  { key: "sure", label: "Planlanan Süre" },
  { key: "uygunsuz", label: "Uygunsuz YM" },
  { key: "fire", label: "Fire" },
  { key: "donusum", label: "Dönüşüm" },
];

type SP = Record<string, string | string[] | undefined>;
const TIPLER = ["YARI_MAMUL", "PLAKA"];

interface Summary {
  plates: number;
  parts: number;
  plannedMin: number;
  plateByDay: DayMap;
  partByDay: DayMap;
  minByDay: DayMap;
  k: KaliteAgg;
}

function summarize(d: KesimDetay, kalite: KaliteRow[]): Summary {
  const plateByDay: DayMap = {};
  const partByDay: DayMap = {};
  const minByDay: DayMap = {};
  let plates = 0;
  let parts = 0;
  let plannedMin = 0;
  for (const b of d.batches) {
    plates += b.adet;
    parts += b.parts;
    plannedMin += b.plannedMin;
    addTo(plateByDay, b.day, b.adet);
    addTo(partByDay, b.day, b.parts);
    addTo(minByDay, b.day, b.plannedMin / 60);
  }
  return { plates, parts, plannedMin, plateByDay, partByDay, minByDay, k: aggregateKalite(kalite, "kesim", TIPLER) };
}

function buildChart(metric: string, period: ResolvedPeriod, sp: SP, d: Summary): AnalizChartProps & { title: string } {
  const { from, to } = period;
  const g = resolveGranularity(sp.g, from, to);
  const one = (title: string, map: DayMap, color: string, label: string, unit?: string) => ({
    title,
    type: "bar" as const,
    xKey: "label",
    unit,
    data: buildSeries(from, to, g, { v: map }),
    series: [{ key: "v", label, color }],
  });
  switch (metric) {
    case "parca":
      return one("Kesilen parça adedi", d.partByDay, "#5e5747", "Parça");
    case "sure":
      return one("Planlanan kesim süresi (saat)", d.minByDay, "#474237", "Süre", " sa");
    case "uygunsuz":
      return one("Uygunsuz yarı mamul (kesim)", d.k.byDay.uygunsuz, "#f28a19", "Uygunsuz");
    case "fire":
      return one("Fire (plaka + yarı mamul)", d.k.byDay.fire, "#ee7683", "Fire");
    case "donusum":
      return one("Dönüştürülen yarı mamul", d.k.byDay.donusum, "#70c1aa", "Dönüşüm");
    case "plaka":
    default:
      return one("Kesilen plaka adedi", d.plateByDay, asamaRengi("kesim"), "Plaka");
  }
}

const COLS: CompactColumn[] = [
  { key: "donem", label: "Dönem" },
  { key: "plaka", label: "Plaka" },
  { key: "makine", label: "Makine" },
  { key: "op", label: "Operatör" },
  { key: "part", label: "Parça Kodu" },
  { key: "plates", label: "Plaka Adedi", align: "right", format: "number" },
  { key: "parts", label: "Parça Adedi", align: "right", format: "number" },
  { key: "sure", label: "Planlanan Süre (sa)", align: "right", format: "number" },
  { key: "uygunsuz", label: "Uygunsuz", align: "right", format: "number" },
  { key: "fire", label: "Fire", align: "right", format: "number" },
  { key: "donusum", label: "Dönüşüm", align: "right", format: "number" },
];

const FOCUS: FocusMap = {
  defaultChip: "tumu",
  chips: {
    plaka: { cards: ["plaka"], cols: ["plates"] },
    parca: { cards: ["parca"], cols: ["parts"] },
    sure: { cards: ["sure"], cols: ["sure"] },
    uygunsuz: { cards: ["uygunsuz"], cols: ["uygunsuz"] },
    fire: { cards: ["fire"], cols: ["fire"] },
    donusum: { cards: ["donusum"], cols: ["donusum"] },
  },
  cols: {
    plates: { cards: ["plaka"], chip: "plaka" },
    parts: { cards: ["parca"], chip: "parca" },
    sure: { cards: ["sure"], chip: "sure" },
    uygunsuz: { cards: ["uygunsuz"], chip: "uygunsuz" },
    fire: { cards: ["fire"], chip: "fire" },
    donusum: { cards: ["donusum"], chip: "donusum" },
  },
};

type Gran = ReturnType<typeof resolveGranularity>;

interface Acc {
  bucket: string;
  plaka: string;
  makine: string;
  op: string;
  /** Kesim koduna bağlı olmayan kalite kayıtlarında yarı mamul (parça) kodu; kesim satırlarında "—" */
  part: string;
  plates: number;
  parts: number;
  plannedMin: number;
  m: Record<KaliteMetric, number>;
  /** Yalnızca yarı mamul kalite katkıları (kart: Uygunsuz YM / Dönüştürülen YM) */
  ym: Record<KaliteMetric, number>;
  fireByTip: { YARI_MAMUL: number; PLAKA: number };
  // filtre altında kart/grafik yeniden hesabı için gün kırılımı
  plateByDay: DayMap;
  partByDay: DayMap;
  minByDay: DayMap;
  kByDay: Record<KaliteMetric, DayMap>;
}

function buildAccs(d: KesimDetay, kalite: KaliteRow[], g: Gran): Acc[] {
  const acc = new Map<string, Acc>();
  const byCut = new Map<string, string>();
  const getAcc = (bucket: string, plaka: string, makine: string, op: string, part = "—") => {
    const key = `${bucket}|${plaka}|${makine}|${op}|${part}`;
    let a = acc.get(key);
    if (!a) {
      a = {
        bucket,
        plaka,
        makine,
        op,
        part,
        plates: 0,
        parts: 0,
        plannedMin: 0,
        m: { uygunsuz: 0, kontrol: 0, fire: 0, donusum: 0 },
        ym: { uygunsuz: 0, kontrol: 0, fire: 0, donusum: 0 },
        fireByTip: { YARI_MAMUL: 0, PLAKA: 0 },
        plateByDay: {},
        partByDay: {},
        minByDay: {},
        kByDay: { uygunsuz: {}, kontrol: {}, fire: {}, donusum: {} },
      };
      acc.set(key, a);
    }
    return a;
  };
  for (const b of d.batches) {
    const op = b.operator_id ? (d.operatorNames.get(b.operator_id) ?? b.operator_id) : "—";
    const a = getAcc(bucketKey(b.day, g), b.plaka_id ?? "—", b.makine_id ?? "—", op);
    a.plates += b.adet;
    a.parts += b.parts;
    a.plannedMin += b.plannedMin;
    addTo(a.plateByDay, b.day, b.adet);
    addTo(a.partByDay, b.day, b.parts);
    addTo(a.minByDay, b.day, b.plannedMin / 60);
    byCut.set(b.cut_id, `${bucketKey(b.day, g)}|${b.plaka_id ?? "—"}|${b.makine_id ?? "—"}|${op}|—`);
  }
  const byId = new Map(kalite.map((r) => [r.id, r]));
  for (const r of kalite) {
    if (!TIPLER.includes(r.item_tipi)) continue;
    const o = resolveOrigin(r, byId);
    if (o.origin !== "kesim") continue;
    const day = trDay(r.tarih);
    const key = o.sourceId ? byCut.get(o.sourceId) : undefined;
    let a = key ? acc.get(key) : undefined;
    if (!a) {
      // Kesim koduna bağlı olmayan (tablet butonlarından girilen) kalite kaydı: kendi liste satırını oluşturur
      if (!day) continue;
      const opName = r.operator_name ?? r.operator_id ?? "—";
      const isPlaka = r.item_tipi === "PLAKA";
      a = getAcc(bucketKey(day, g), isPlaka ? (r.item_id ?? "—") : "—", "—", opName, isPlaka ? "—" : (r.item_id ?? "—"));
    }
    for (const c of kaliteContribution(r)) {
      a.m[c.metric] += c.value;
      addTo(a.kByDay[c.metric], day, c.value);
      if (r.item_tipi === "YARI_MAMUL") a.ym[c.metric] += c.value;
      if (c.metric === "fire" && (r.item_tipi === "YARI_MAMUL" || r.item_tipi === "PLAKA")) {
        a.fireByTip[r.item_tipi] += c.value;
      }
    }
  }
  return [...acc.values()].sort((a, b) =>
    a.bucket < b.bucket ? 1 : a.bucket > b.bucket ? -1 : b.plates - a.plates,
  );
}

const toRow = (a: Acc, g: Gran): CompactRow => ({
  donem: bucketLabel(a.bucket, g),
  plaka: a.plaka,
  makine: a.makine,
  op: a.op,
  part: a.part,
  plates: round(a.plates, 1),
  parts: round(a.parts, 1),
  sure: round(a.plannedMin / 60, 1),
  uygunsuz: round(a.m.uygunsuz, 1),
  fire: round(a.m.fire, 1),
  donusum: round(a.m.donusum, 1),
});

/** Filtreyle eşleşen satırlardan kart/grafik özeti (filtre aktifken kullanılır). */
function summarizeAccs(accs: Acc[]): Summary & { ymUygunsuz: number; ymDonusum: number } {
  const plateByDay: DayMap = {};
  const partByDay: DayMap = {};
  const minByDay: DayMap = {};
  const k: KaliteAgg = {
    uygunsuz: 0,
    kontrol: 0,
    fire: 0,
    donusum: 0,
    fireByTip: { YARI_MAMUL: 0, PLAKA: 0, URUN: 0 },
    byDay: { uygunsuz: {}, kontrol: {}, fire: {}, donusum: {} },
  };
  let plates = 0;
  let parts = 0;
  let plannedMin = 0;
  let ymUygunsuz = 0;
  let ymDonusum = 0;
  for (const a of accs) {
    plates += a.plates;
    parts += a.parts;
    plannedMin += a.plannedMin;
    for (const [d, v] of Object.entries(a.plateByDay)) addTo(plateByDay, d, v);
    for (const [d, v] of Object.entries(a.partByDay)) addTo(partByDay, d, v);
    for (const [d, v] of Object.entries(a.minByDay)) addTo(minByDay, d, v);
    for (const mk of ["uygunsuz", "kontrol", "fire", "donusum"] as KaliteMetric[]) {
      k[mk] += a.m[mk];
      for (const [d, v] of Object.entries(a.kByDay[mk])) addTo(k.byDay[mk], d, v);
    }
    k.fireByTip.YARI_MAMUL += a.fireByTip.YARI_MAMUL;
    k.fireByTip.PLAKA += a.fireByTip.PLAKA;
    ymUygunsuz += a.ym.uygunsuz;
    ymDonusum += a.ym.donusum;
  }
  return { plates, parts, plannedMin, plateByDay, partByDay, minByDay, k, ymUygunsuz, ymDonusum };
}

const EMPTY_DETAY: KesimDetay = { batches: [], operatorNames: new Map() };

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
  const [detay, kalite, prevDetay, prevKalite] = await Promise.all([
    safe(getKesimDetay(from, to), EMPTY_DETAY),
    safe(getKaliteRows(from, to), [] as KaliteRow[]),
    hasPrev ? safe(getKesimDetay(period.prevFrom, period.prevTo), EMPTY_DETAY) : Promise.resolve(null),
    hasPrev ? safe(getKaliteRows(period.prevFrom, period.prevTo), [] as KaliteRow[]) : Promise.resolve(null),
  ]);

  // Kolon filtreleri: kart + grafik + liste eşleşen satırlardan türer
  const accs = buildAccs(detay, kalite, g);
  const colFilters = parseColumnFilters(sp, COLS);
  const filtActive = hasActiveFilters(colFilters);
  const focus = resolveFocus(FOCUS, metric, colFilters, COLS, CHIPS);
  const matched = pickByFilters(accs, (a) => toRow(a, g), colFilters);
  const options = distinctOptions(accs.map((a) => toRow(a, g)), COLS);
  const rows = matched.map((a) => toRow(a, g));
  const fsum = filtActive ? summarizeAccs(matched) : null;

  const cur: Summary = fsum ?? summarize(detay, kalite);
  // Önceki dönem kıyası filtreye uygulanamaz; filtre aktifken gizlenir
  const prev = !filtActive && prevDetay && prevKalite ? summarize(prevDetay, prevKalite) : null;
  const prevK = !filtActive ? prevKalite : null;
  const { title, ...chartProps } = buildChart(focus.chartMetric, period, sp, cur);

  // Uygunsuz YM: yalnızca yarı mamul; fire: plaka + yarı mamul
  const uyg = fsum ? fsum.ymUygunsuz : aggregateKalite(kalite, "kesim", ["YARI_MAMUL"]).uygunsuz;
  const uygPrev = prevK ? aggregateKalite(prevK, "kesim", ["YARI_MAMUL"]).uygunsuz : null;
  const donusum = fsum ? fsum.ymDonusum : aggregateKalite(kalite, "kesim", ["YARI_MAMUL"]).donusum;
  const donusumPrev = prevK ? aggregateKalite(prevK, "kesim", ["YARI_MAMUL"]).donusum : null;
  const fireYm = cur.k.fireByTip.YARI_MAMUL;
  const firePlaka = cur.k.fireByTip.PLAKA;
  const hours = cur.plannedMin / 60;

  const mk = (k: string) => !focus.showCard(k);
  const summaryItems: SummaryItem[] = [
    { key: "plaka", label: "Kesilen Plaka", short: "Plaka", unit: "adet", cur: cur.plates, prev: prev?.plates ?? null, muted: mk("plaka"), color: asamaRengi("kesim") },
    { key: "parca", label: "Kesilen Parça", short: "Parça", unit: "adet", cur: cur.parts, prev: prev?.parts ?? null, muted: mk("parca"), color: asamaRengi("kesim") },
    { key: "sure", label: "Planlanan Süre", short: "Süre", unit: "sa", cur: round(hours, 1), prev: prev ? round(prev.plannedMin / 60, 1) : null, muted: mk("sure"), color: asamaRengi("kesim") },
    { key: "uygunsuz", label: "Uygunsuz YM", short: "Uygunsuz", unit: "adet", lowerBetter: true, cur: uyg, prev: uygPrev, muted: mk("uygunsuz"), color: asamaRengi("kesim") },
    { key: "donusum", label: "Dönüştürülen YM", short: "Dönüşüm", unit: "adet", cur: donusum, prev: donusumPrev, muted: mk("donusum"), color: asamaRengi("kesim") },
    { key: "fire", label: "Fire", short: "Fire", unit: "adet", lowerBetter: true, cur: cur.k.fire, prev: prev?.k.fire ?? null, muted: mk("fire"), color: asamaRengi("fire") },
  ];
  const chartNode =
    focus.chartMetric === CHIPS[0].key ? (
      <SummaryChart title={`Kesim Özeti — ${period.label}`} items={summaryItems} hasPrev={!!prev} query={periodQuery(sp)} />
    ) : (
      <AnalizChart {...chartProps} title={title} />
    );

  const mut = (k: string, empty = false) => !focus.showCard(k) || (filtActive && empty);
  const cards = (
    <>
      <StatCard
        accent={asamaRengi("kesim")}
        title="Kesilen Plaka"
        empty={mut("plaka", cur.plates === 0)}
        value={fmtNum(cur.plates)}
        subtitle="Tamamlanan kesim adedi"
        delta={prev ? deltaPct(cur.plates, prev.plates) : null}
      />
      <StatCard
        accent={asamaRengi("kesim")}
        title="Kesilen Parça"
        empty={mut("parca", cur.parts === 0)}
        value={fmtNum(cur.parts)}
        subtitle="Kesim satırları toplamı"
        delta={prev ? deltaPct(cur.parts, prev.parts) : null}
      />
      <StatCard
        accent={asamaRengi("kesim")}
        title="Planlanan Kesim Süresi"
        empty={mut("sure", cur.plannedMin === 0)}
        value={`${fmtNum(hours, 1)} saat`}
        subtitle="Plaka adedi × plakanın makine kesim süresi"
        delta={prev ? deltaPct(cur.plannedMin, prev.plannedMin) : null}
      />
      <StatCard
        accent={asamaRengi("kesim")}
        title="Uygunsuz YM"
        empty={mut("uygunsuz", uyg === 0)}
        value={fmtNum(uyg)}
        subtitle="Kesimden uygunsuza giren yarı mamul"
        delta={uygPrev !== null ? deltaPct(uyg, uygPrev) : null}
        inverseDelta
      />
      <StatCard
        accent={asamaRengi("kesim")}
        title="Dönüştürülen YM"
        empty={mut("donusum", donusum === 0)}
        value={fmtNum(donusum)}
        subtitle="Dönüşüm kaynağı olarak çıkan adet"
        delta={donusumPrev !== null ? deltaPct(donusum, donusumPrev) : null}
      />
      <StatCard
        accent={asamaRengi("kesim")}
        title="Fire"
        empty={mut("fire", cur.k.fire === 0)}
        value={fmtNum(cur.k.fire)}
        subtitle={`Plaka ${fmtNum(firePlaka)} · Yarı mamul ${fmtNum(fireYm)}`}
        delta={prev ? deltaPct(cur.k.fire, prev.k.fire) : null}
        inverseDelta
      />
    </>
  );

  const list = (
    <div className="space-y-1">
      <CompactList
        title="Kesim Detayı"
        showGrouping
        activeGranularity={g}
        columns={COLS}
        rows={rows}
        filterOptions={options}
        visibleColumns={focus.visibleColumns}
      />
      <p className="px-1 text-[11px] text-muted-foreground">
        Planlanan süre gerçek ölçüm değil, plakanın tanımlı makine kesim süresine dayanır (kesimde gerçek süre kaydı
        yok). Kalite kayıtları kesim kodu (KES-…) ile eşleşir.
      </p>
    </div>
  );

  return (
    <AnalizLayout
      title="Kesim"
      backHref="/analiz"
      period={period}
      filterNote={filterNote(colFilters, COLS)}
      focus={focus.all ? null : { labels: focus.labels, clearKeys: focus.clearKeys }}
      chips={CHIPS}
      activeMetric={metric}
      chart={chartNode}
      cards={cards}
      list={list}
    />
  );
}
