import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { bucketKey, bucketLabel, resolvePeriod, type ResolvedPeriod } from "@/lib/periods";
import { AnalizLayout } from "../_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "../_shared/analiz-chart";
import type { MetricChip } from "../_shared/metric-chips";
import { StatCard } from "../_shared/stat-card";
import { CompactList, type CompactRow } from "../_shared/compact-list";
import { buildSeries, resolveGranularity } from "../_shared/series";
import { deltaPct, fmtNum, round } from "../_shared/utils";
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
      return one("Kesilen parça adedi", d.partByDay, "#f28a19", "Parça");
    case "sure":
      return one("Planlanan kesim süresi (saat)", d.minByDay, "#6f4c37", "Süre", " sa");
    case "uygunsuz":
      return one("Uygunsuz yarı mamul (kesim)", d.k.byDay.uygunsuz, "#f28a19", "Uygunsuz");
    case "fire":
      return one("Fire (plaka + yarı mamul)", d.k.byDay.fire, "#ee7683", "Fire");
    case "donusum":
      return one("Dönüştürülen yarı mamul", d.k.byDay.donusum, "#70c1aa", "Dönüşüm");
    case "plaka":
    default:
      return one("Kesilen plaka adedi", d.plateByDay, "#3368b1", "Plaka");
  }
}

interface Acc {
  bucket: string;
  plaka: string;
  makine: string;
  op: string;
  plates: number;
  parts: number;
  m: Record<KaliteMetric, number>;
}

function buildRows(d: KesimDetay, kalite: KaliteRow[], g: ReturnType<typeof resolveGranularity>): CompactRow[] {
  const acc = new Map<string, Acc>();
  const byCut = new Map<string, string>();
  const getAcc = (bucket: string, plaka: string, makine: string, op: string) => {
    const key = `${bucket}|${plaka}|${makine}|${op}`;
    let a = acc.get(key);
    if (!a) {
      a = { bucket, plaka, makine, op, plates: 0, parts: 0, m: { uygunsuz: 0, kontrol: 0, fire: 0, donusum: 0 } };
      acc.set(key, a);
    }
    return a;
  };
  for (const b of d.batches) {
    const op = b.operator_id ? (d.operatorNames.get(b.operator_id) ?? b.operator_id) : "—";
    const a = getAcc(bucketKey(b.day, g), b.plaka_id ?? "—", b.makine_id ?? "—", op);
    a.plates += b.adet;
    a.parts += b.parts;
    byCut.set(b.cut_id, `${bucketKey(b.day, g)}|${b.plaka_id ?? "—"}|${b.makine_id ?? "—"}|${op}`);
  }
  const byId = new Map(kalite.map((r) => [r.id, r]));
  for (const r of kalite) {
    if (!TIPLER.includes(r.item_tipi)) continue;
    const o = resolveOrigin(r, byId);
    if (o.origin !== "kesim" || !o.sourceId) continue;
    const key = byCut.get(o.sourceId);
    const a = key ? acc.get(key) : undefined;
    if (!a) continue;
    for (const c of kaliteContribution(r)) a.m[c.metric] += c.value;
  }
  return [...acc.values()]
    .sort((a, b) => (a.bucket < b.bucket ? 1 : a.bucket > b.bucket ? -1 : b.plates - a.plates))
    .map((a) => ({
      donem: bucketLabel(a.bucket, g),
      plaka: a.plaka,
      makine: a.makine,
      op: a.op,
      plates: round(a.plates, 1),
      parts: round(a.parts, 1),
      uygunsuz: round(a.m.uygunsuz, 1),
      fire: round(a.m.fire, 1),
      donusum: round(a.m.donusum, 1),
    }));
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

  const cur = summarize(detay, kalite);
  const prev = prevDetay && prevKalite ? summarize(prevDetay, prevKalite) : null;
  const { title, ...chartProps } = buildChart(metric, period, sp, cur);
  const rows = buildRows(detay, kalite, g);

  // Uygunsuz YM: yalnızca yarı mamul; fire: plaka + yarı mamul
  const uyg = aggregateKalite(kalite, "kesim", ["YARI_MAMUL"]).uygunsuz;
  const uygPrev = prevKalite ? aggregateKalite(prevKalite, "kesim", ["YARI_MAMUL"]).uygunsuz : null;
  const donusum = aggregateKalite(kalite, "kesim", ["YARI_MAMUL"]).donusum;
  const donusumPrev = prevKalite ? aggregateKalite(prevKalite, "kesim", ["YARI_MAMUL"]).donusum : null;
  const fireYm = cur.k.fireByTip.YARI_MAMUL;
  const firePlaka = cur.k.fireByTip.PLAKA;
  const hours = cur.plannedMin / 60;

  const cards = (
    <>
      <StatCard
        title="Kesilen Plaka"
        value={fmtNum(cur.plates)}
        subtitle="Tamamlanan kesim adedi"
        delta={prev ? deltaPct(cur.plates, prev.plates) : null}
      />
      <StatCard
        title="Kesilen Parça"
        value={fmtNum(cur.parts)}
        subtitle="Kesim satırları toplamı"
        delta={prev ? deltaPct(cur.parts, prev.parts) : null}
      />
      <StatCard
        title="Planlanan Kesim Süresi"
        value={`${fmtNum(hours, 1)} saat`}
        subtitle="Plaka adedi × plakanın makine kesim süresi"
        delta={prev ? deltaPct(cur.plannedMin, prev.plannedMin) : null}
      />
      <StatCard
        title="Uygunsuz YM"
        value={fmtNum(uyg)}
        subtitle="Kesimden uygunsuza giren yarı mamul"
        delta={uygPrev !== null ? deltaPct(uyg, uygPrev) : null}
        inverseDelta
      />
      <StatCard
        title="Dönüştürülen YM"
        value={fmtNum(donusum)}
        subtitle="Dönüşüm kaynağı olarak çıkan adet"
        delta={donusumPrev !== null ? deltaPct(donusum, donusumPrev) : null}
      />
      <StatCard
        title="Fire"
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
        columns={[
          { key: "donem", label: "Dönem" },
          { key: "plaka", label: "Plaka" },
          { key: "makine", label: "Makine" },
          { key: "op", label: "Operatör" },
          { key: "plates", label: "Plaka Adedi", align: "right", format: "number" },
          { key: "parts", label: "Parça Adedi", align: "right", format: "number" },
          { key: "uygunsuz", label: "Uygunsuz", align: "right", format: "number" },
          { key: "fire", label: "Fire", align: "right", format: "number" },
          { key: "donusum", label: "Dönüşüm", align: "right", format: "number" },
        ]}
        rows={rows}
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
      chips={CHIPS}
      activeMetric={metric}
      chart={<AnalizChart {...chartProps} title={title} />}
      cards={cards}
      list={list}
    />
  );
}
