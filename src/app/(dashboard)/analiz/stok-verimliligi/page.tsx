import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { resolvePeriod } from "@/lib/periods";
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
import { resolveFocus, type FocusMap } from "../_shared/focus";
import { buildSeries, resolveGranularity } from "../_shared/series";
import { round } from "../_shared/utils";
import {
  getStokVerimlilikDetay,
  safe,
  type StokProductRow,
  type StokVerimlilikDetay,
} from "../_shared/queries-d2";

export const metadata: Metadata = { title: "Stok Verimliliği | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "tumu", label: "Tümü" },
  { key: "genel", label: "Genel" },
  { key: "kritik-alti", label: "Kritik Altı" },
  { key: "asiri", label: "Aşırı Stok" },
  { key: "urun", label: "Ürün Bazlı" },
];

type SP = Record<string, string | string[] | undefined>;

const COLS: CompactColumn[] = [
  { key: "sku", label: "Ürün Kodu" },
  { key: "ad", label: "Ürün Adı" },
  { key: "kritik", label: "Kritik", align: "right", format: "number" },
  { key: "guncel", label: "Güncel Stok", align: "right", format: "number" },
  { key: "ort", label: "Ort. Stok", align: "right", format: "number" },
  { key: "alt", label: "Kritik Altı Gün", align: "right", format: "number" },
  { key: "ust", label: "Aşırı Gün", align: "right", format: "number" },
  { key: "verim", label: "Verim %", align: "right", format: "percent" },
];

const FOCUS: FocusMap = {
  defaultChip: "tumu",
  chips: {
    genel: { cards: ["genel"], cols: ["verim"] },
    "kritik-alti": { cards: ["altgun", "simdi"], cols: ["kritik", "guncel", "alt"] },
    asiri: { cards: ["ustgun"], cols: ["kritik", "ort", "ust"] },
    urun: { cards: ["genel"], cols: ["verim"] },
  },
  cols: {
    kritik: { cards: [] },
    guncel: { cards: ["simdi"] },
    ort: { cards: [] },
    alt: { cards: ["altgun"], chip: "kritik-alti" },
    ust: { cards: ["ustgun"], chip: "asiri" },
    verim: { cards: ["genel"], chip: "genel" },
  },
};

const toRow = (p: StokProductRow): CompactRow => ({
  sku: p.sku,
  ad: p.name,
  kritik: p.kritik,
  guncel: p.current,
  ort: p.avg,
  alt: p.belowDays,
  ust: p.aboveDays,
  verim: p.score,
});

const EMPTY: StokVerimlilikDetay = {
  overallPct: null,
  scoreByDay: {},
  belowByDay: {},
  aboveByDay: {},
  belowDayPct: null,
  aboveDayPct: null,
  currentBelow: 0,
  activeCount: 0,
  products: [],
  altPct: 0,
  ustPct: 100,
};

const pct = (v: number | null) => (v === null ? "—" : `%${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`);
const trunc = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

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

  const d = await safe(getStokVerimlilikDetay(from, to), EMPTY);

  // Kolon filtreleri: kart + grafik + liste eşleşen ürünlerden türer
  const colFilters = parseColumnFilters(sp, COLS);
  const filtActive = hasActiveFilters(colFilters);
  const focus = resolveFocus(FOCUS, metric, colFilters, COLS, CHIPS);
  const sortedAll = [...d.products].sort((a, b) => a.score - b.score);
  const matched = pickByFilters(sortedAll, toRow, colFilters);
  const options = distinctOptions(sortedAll.map(toRow), COLS);
  const mAvg = (f: (p: StokProductRow) => number) =>
    matched.length ? round(matched.reduce((a, p) => a + f(p), 0) / matched.length, 1) : null;
  const dayTotal = matched.reduce((a, p) => a + p.days, 0);
  const overallPct = filtActive ? mAvg((p) => p.score) : d.overallPct;
  const belowDayPct = filtActive
    ? dayTotal > 0
      ? round((matched.reduce((a, p) => a + p.belowDays, 0) / dayTotal) * 100, 1)
      : null
    : d.belowDayPct;
  const aboveDayPct = filtActive
    ? dayTotal > 0
      ? round((matched.reduce((a, p) => a + p.aboveDays, 0) / dayTotal) * 100, 1)
      : null
    : d.aboveDayPct;
  const currentBelow = filtActive ? matched.filter((p) => p.current < p.kritik * (1 - d.altPct / 100)).length : d.currentBelow;
  const activeCount = filtActive ? matched.length : d.activeCount;

  let chart: AnalizChartProps & { title: string };
  if (filtActive) {
    // Gün bazlı seriler ürün kırılımı içermez; filtre altında eşleşen ürünler gösterilir
    const share = (p: StokProductRow, days: number) => (p.days > 0 ? round((days / p.days) * 100, 1) : 0);
    const byMetric: Record<string, { title: string; color: string; v: (p: StokProductRow) => number; order: 1 | -1 }> = {
      "kritik-alti": {
        title: "Filtreye uyan ürünler — kritik altında geçen gün oranı (%, ilk 10)",
        color: "#ee7683",
        v: (p) => share(p, p.belowDays),
        order: -1,
      },
      asiri: {
        title: "Filtreye uyan ürünler — aşırı stokta geçen gün oranı (%, ilk 10)",
        color: "#f28a19",
        v: (p) => share(p, p.aboveDays),
        order: -1,
      },
    };
    const m = byMetric[focus.chartMetric] ?? {
      title: "Filtreye uyan ürünler — en düşük verim (%, ilk 10)",
      color: "#70c1aa",
      v: (p: StokProductRow) => p.score,
      order: 1 as const,
    };
    chart = {
      title: m.title,
      type: "bar",
      layout: "vertical",
      xKey: "label",
      unit: "%",
      data: [...matched]
        .sort((a, b) => (m.v(a) - m.v(b)) * m.order)
        .slice(0, 10)
        .map((p) => ({ label: trunc(`${p.sku} ${p.name}`), v: m.v(p) })),
      series: [{ key: "v", label: "Oran", color: m.color }],
    };
  } else
  switch (focus.chartMetric) {
    case "kritik-alti":
      chart = {
        title: "Kritik altındaki ürün oranı (%)",
        type: "area",
        xKey: "label",
        unit: "%",
        data: buildSeries(from, to, g, { v: d.belowByDay }, "avg"),
        series: [{ key: "v", label: "Kritik altı", color: "#ee7683" }],
      };
      break;
    case "asiri":
      chart = {
        title: "Aşırı stoktaki ürün oranı (%)",
        type: "area",
        xKey: "label",
        unit: "%",
        data: buildSeries(from, to, g, { v: d.aboveByDay }, "avg"),
        series: [{ key: "v", label: "Aşırı stok", color: "#f28a19" }],
      };
      break;
    case "urun":
      chart = {
        title: "En düşük verimli 10 ürün (%)",
        type: "bar",
        layout: "vertical",
        xKey: "label",
        unit: "%",
        data: d.products.slice(0, 10).map((p) => ({ label: trunc(`${p.sku} ${p.name}`), v: p.score })),
        series: [{ key: "v", label: "Verim", color: "#70c1aa" }],
      };
      break;
    default:
      chart = {
        title: "Genel stok verimliliği (%)",
        type: "area",
        xKey: "label",
        unit: "%",
        data: buildSeries(from, to, g, { v: d.scoreByDay }, "avg"),
        series: [{ key: "v", label: "Verim", color: "#70c1aa" }],
      };
  }
  const { title, ...chartProps } = chart;

  const rows: CompactRow[] = matched.map(toRow);

  // Odak dışı / eşleşen ürün yoksa kartlar boş görünür
  const noMatch = filtActive && matched.length === 0;
  const mut = (k: string) => noMatch || !focus.showCard(k);
  const cards = (
    <>
      <StatCard title="Genel Verim" empty={mut("genel")} value={pct(overallPct)} subtitle={`${activeCount} ürün, gün skoru ortalaması`} />
      <StatCard title="Kritik Altında Geçen Gün Oranı" empty={mut("altgun")} value={pct(belowDayPct)} subtitle="Ürün-gün bazında" />
      <StatCard title="Aşırı Stokta Geçen Gün Oranı" empty={mut("ustgun")} value={pct(aboveDayPct)} subtitle="Ürün-gün bazında" />
      <StatCard
        title="Şu An Kritik Altı Ürün"
        empty={mut("simdi")}
        value={currentBelow.toLocaleString("tr-TR")}
        subtitle={`${activeCount} ürün içinde`}
      />
    </>
  );

  const list = (
    <CompactList
      title="Ürün Bazlı Stok Verimliliği"
      columns={COLS}
      rows={rows}
      filterOptions={options}
      visibleColumns={focus.visibleColumns}
    />
  );

  const note = (
    <div className="rounded-xl border border-[#a99c7d]/30 bg-[#f0ede1]/60 p-4 text-xs text-[#5e5747]">
      <h3 className="mb-1.5 text-sm font-semibold text-[#474237]">Hesaplama Notu</h3>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          Her aktif ve kritik stok seviyesi tanımlı ürün için günlük bakiye, güncel stoktan geriye doğru stok
          hareketleri çıkarılarak yeniden kurulur. Gün skoru: stok {`[kritik, kritik × ${1 + d.ustPct / 100}]`}{" "}
          bandındaysa 100; kritiğin altındaysa bakiye ÷ kritik × 100 (en az 0); üst sınırın üstündeyse üst sınır ÷
          bakiye × 100.
        </li>
        <li>Ürün skoru, dönemdeki gün skorlarının ortalamasıdır; genel verim ürün skorlarının ortalamasıdır.</li>
        <li>
          Toleranslar ayarlanabilir: şu an alt tolerans %{d.altPct}, üst tolerans %{d.ustPct} (varsayılan: 0 / 100;
          ayar anahtarı <code>stok_verimlilik</code>). Daha sonra bu değerler ayarlardan değiştirilebilecek.
        </li>
        <li>
          Kritik stok seviyesinin geçmişi saklanmadığı için tüm günlerde ürünün güncel kritik değeri kullanılır.
          &ldquo;Tümü&rdquo; dönemi son 90 günü kapsar.
        </li>
      </ul>
    </div>
  );

  return (
    <AnalizLayout
      title="Stok Verimliliği"
      backHref="/analiz"
      period={period}
      filterNote={filterNote(colFilters, COLS)}
      focus={focus.all ? null : { labels: focus.labels, clearKeys: focus.clearKeys }}
      chips={CHIPS}
      activeMetric={metric}
      chart={<AnalizChart {...chartProps} title={title} />}
      cards={cards}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      list={
        <div className="space-y-4">
          {list}
          {note}
        </div>
      }
    />
  );
}
