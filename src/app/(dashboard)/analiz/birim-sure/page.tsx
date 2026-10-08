import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { resolvePeriod } from "@/lib/periods";
import { AnalizLayout } from "../_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "../_shared/analiz-chart";
import type { MetricChip } from "../_shared/metric-chips";
import { SummaryChart, type SummaryItem } from "../_shared/summary-chart";
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
import { resolveGranularity, buildSeries } from "../_shared/series";
import { fmtNum, round } from "../_shared/utils";
import { getBirimSure, getProductNames, type BirimSureData } from "../_shared/queries";
import { asamaRengi } from "@/lib/talimat/hat-renk";
import { getAnalizHatlar } from "../_shared/hat-data";
import { getStandardTimes, type StandardTimes } from "../_shared/performance";
import { getPaketlemeBySku, safe } from "../_shared/queries-d2";
import { periodQuery } from "../_shared/queries-d1";

export const metadata: Metadata = { title: "Çalışma Birim Süresi | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "tumu", label: "Tümü" },
  { key: "montaj", label: "Montaj" },
  { key: "paketleme", label: "Paketleme" },
  { key: "adim", label: "Adım Bazlı" },
  { key: "urun", label: "Ürün Bazlı" },
];

type SP = Record<string, string | string[] | undefined>;

const COLS: CompactColumn[] = [
  { key: "ad", label: "Adım" },
  { key: "adet", label: "Adet", align: "right", format: "number" },
  { key: "avg", label: "Birim Süre", align: "right", format: "dk" },
  { key: "std", label: "Standart Süre", align: "right", format: "dk" },
  { key: "fark", label: "Fark %", align: "right", format: "percent" },
];

const EMPTY_BIRIM: BirimSureData = {
  montajAvg: null,
  paketlemeAvg: null,
  montajByDay: {},
  paketlemeByDay: {},
  byStep: [],
};
const EMPTY_STD: StandardTimes = { montaj: new Map(), paketleme: new Map() };

const trunc = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const dk = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} dk`);
const farkPct = (avg: number, std: number | undefined) => (std ? round(((avg - std) / std) * 100, 1) : null);

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

  const hasPrev = !!period.prevFrom && !!period.prevTo;
  const needPrev = hasPrev && metric === CHIPS[0].key && !hasActiveFilters(parseColumnFilters(sp, COLS));
  const [hatlar, birim, std, pack, names, birimPrev] = await Promise.all([
    getAnalizHatlar(),
    safe(getBirimSure(from, to), EMPTY_BIRIM),
    safe(getStandardTimes(), EMPTY_STD),
    safe(getPaketlemeBySku(from, to), [] as { sku: string; qty: number; avgDk: number }[]),
    safe(getProductNames(), new Map<string, string>()),
    needPrev ? safe(getBirimSure(period.prevFrom, period.prevTo), EMPTY_BIRIM) : Promise.resolve(null),
  ]);

  const montajColor = asamaRengi("montaj", hatlar);
  const paketColor = asamaRengi("paketleme", hatlar);

  // Adım ve ürün satırları (standart + fark)
  const stepRows = birim.byStep.map((s) => {
    const sd = std.montaj.get(s.stepId);
    return {
      label: s.stepName ? `${s.stepId} · ${s.stepName}` : s.stepId,
      qty: s.qty,
      avg: s.avgDk,
      std: sd ?? null,
      fark: farkPct(s.avgDk, sd),
    };
  });
  const urunRows = pack.map((p) => {
    const sd = std.paketleme.get(p.sku);
    return {
      label: `${p.sku} · ${names.get(p.sku) ?? ""}`.replace(/ · $/, ""),
      qty: p.qty,
      avg: p.avgDk,
      std: sd ?? null,
      fark: farkPct(p.avgDk, sd),
    };
  });

  // Kolon filtreleri yalnızca görünen listeye (adım / ürün) uygulanır; kart + grafik eşleşen kalemlerden türer
  const listIsUrun = metric === "urun" || metric === "paketleme";
  type Item = (typeof stepRows)[number];
  const toRow = (r: Item): CompactRow => ({ ad: r.label, adet: round(r.qty, 0), avg: r.avg, std: r.std, fark: r.fark });
  const colFilters = parseColumnFilters(sp, COLS);
  const filtActive = hasActiveFilters(colFilters);
  const TIMES = ["avg", "std", "fark"];
  const focusMap: FocusMap = {
    defaultChip: "tumu",
    chips: {
      montaj: { cards: ["montaj"], cols: TIMES },
      paketleme: { cards: ["paketleme"], cols: TIMES },
      adim: { cards: ["yavas", "hizli"], cols: TIMES },
      urun: { cards: ["paketleme"], cols: TIMES },
    },
    cols: {
      avg: { cards: listIsUrun ? ["paketleme"] : ["montaj", "yavas", "hizli"], chip: listIsUrun ? "paketleme" : "montaj" },
      std: { cards: listIsUrun ? [] : ["yavas", "hizli"] },
      fark: { cards: listIsUrun ? [] : ["yavas", "hizli"], chip: listIsUrun ? undefined : "adim" },
    },
  };
  const focus = resolveFocus(focusMap, metric, colFilters, COLS, CHIPS);
  const listAll: Item[] = [...(listIsUrun ? urunRows : stepRows)].sort((a, b) => b.qty - a.qty);
  const matched = pickByFilters(listAll, toRow, colFilters);
  const options = distinctOptions(listAll.map(toRow), COLS);
  const stepsF: Item[] = filtActive && !listIsUrun ? matched : stepRows;
  const urunF: Item[] = filtActive && listIsUrun ? matched : urunRows;
  const wavg = (items: Item[]) => {
    const q = items.reduce((a, r) => a + r.qty, 0);
    return q > 0 ? round(items.reduce((a, r) => a + r.avg * r.qty, 0) / q, 2) : null;
  };
  const montajAvg = filtActive ? (listIsUrun ? null : wavg(stepsF)) : birim.montajAvg;
  const paketlemeAvg = filtActive ? (listIsUrun ? wavg(urunF) : null) : birim.paketlemeAvg;

  // Kartlar: en yavaş / en hızlı adım (kendi standardına göre fark %)
  const comparable = stepsF.filter((r) => r.fark !== null && r.qty >= 5);
  const pool = comparable.length ? comparable : stepsF.filter((r) => r.fark !== null);
  const prevStepRows = birimPrev
    ? birimPrev.byStep.map((s) => ({ avg: s.avgDk, qty: s.qty, fark: farkPct(s.avgDk, std.montaj.get(s.stepId)) }))
    : null;
  const prevPool = prevStepRows
    ? (() => {
        const c = prevStepRows.filter((r) => r.fark !== null && r.qty >= 5);
        return c.length ? c : prevStepRows.filter((r) => r.fark !== null);
      })()
    : null;
  const prevSlowest = prevPool ? [...prevPool].sort((a, b) => (b.fark ?? 0) - (a.fark ?? 0))[0] : undefined;
  const prevFastest = prevPool ? [...prevPool].sort((a, b) => (a.fark ?? 0) - (b.fark ?? 0))[0] : undefined;
  const slowest = [...pool].sort((a, b) => (b.fark ?? 0) - (a.fark ?? 0))[0];
  const fastest = [...pool].sort((a, b) => (a.fark ?? 0) - (b.fark ?? 0))[0];
  const stepCard = (r: typeof slowest | undefined) =>
    r
      ? {
          value: dk(r.avg),
          subtitle: (
            <>
              <span className="font-medium text-[#474237]">{trunc(r.label, 40)}</span>
              <br />
              Standart {dk(r.std)} · fark {(r.fark ?? 0) > 0 ? "+" : ""}%{(r.fark ?? 0).toLocaleString("tr-TR")}
            </>
          ),
        }
      : { value: "—", subtitle: "Standart süresi olan adım yok" };
  const slowCard = stepCard(slowest);
  const fastCard = stepCard(fastest);

  // Grafik
  let chart: AnalizChartProps & { title: string };
  if (filtActive && (metric === "montaj" || metric === "paketleme")) {
    // Gün bazlı seri kalem kırılımı içermez; filtre altında eşleşen kalemlerin birim süresi gösterilir
    const isP = metric === "paketleme";
    chart = {
      title: isP
        ? "Filtreye uyan ürünler — paketleme birim süresi (dk / adet, ilk 10)"
        : "Filtreye uyan adımlar — montaj birim süresi (dk / adet, ilk 10)",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      unit: " dk",
      data: [...matched]
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10)
        .map((r) => ({ label: trunc(r.label), avg: r.avg, std: r.std })),
      series: [
        { key: "avg", label: "Ortalama", color: isP ? paketColor : montajColor },
        { key: "std", label: "Standart", color: "#adb5be" },
      ],
    };
  } else if (focus.chartMetric === "paketleme") {
    chart = {
      title: "Paketleme birim süresi (dk / adet)",
      type: "line",
      xKey: "label",
      unit: " dk",
      data: buildSeries(from, to, g, { v: birim.paketlemeByDay }, "avg"),
      series: [{ key: "v", label: "Paketleme", color: paketColor }],
    };
  } else if (focus.chartMetric === "adim") {
    chart = {
      title: "En yavaş 10 adım (dk / adet) ve standartları",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      unit: " dk",
      data: [...stepsF]
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10)
        .map((r) => ({ label: trunc(r.label), avg: r.avg, std: r.std })),
      series: [
        { key: "avg", label: "Ortalama", color: montajColor },
        { key: "std", label: "Standart", color: "#adb5be" },
      ],
    };
  } else if (focus.chartMetric === "urun") {
    chart = {
      title: "En yavaş 10 ürün — paketleme (dk / adet) ve standartları",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      unit: " dk",
      data: [...urunF]
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10)
        .map((r) => ({ label: trunc(r.label), avg: r.avg, std: r.std })),
      series: [
        { key: "avg", label: "Ortalama", color: paketColor },
        { key: "std", label: "Standart", color: "#adb5be" },
      ],
    };
  } else {
    chart = {
      title: "Montaj birim süresi (dk / adet)",
      type: "line",
      xKey: "label",
      unit: " dk",
      data: buildSeries(from, to, g, { v: birim.montajByDay }, "avg"),
      series: [{ key: "v", label: "Montaj", color: montajColor }],
    };
  }
  const { title, ...chartProps } = chart;

  const mk = (k: string) => !focus.showCard(k);
  const summaryItems: SummaryItem[] = [
    { key: "montaj", label: "Montaj", short: "Montaj", unit: "dk", lowerBetter: true, cur: montajAvg, prev: birimPrev?.montajAvg ?? null, muted: mk("montaj"), color: montajColor },
    { key: "paketleme", label: "Paketleme", short: "Paketl.", unit: "dk", lowerBetter: true, cur: paketlemeAvg, prev: birimPrev?.paketlemeAvg ?? null, muted: mk("paketleme"), color: paketColor },
    { key: "yavas", label: "En Yavaş Adım", short: "Yavaş", unit: "dk", lowerBetter: true, cur: listIsUrun ? null : (slowest?.avg ?? null), prev: prevSlowest?.avg ?? null, muted: mk("yavas") || listIsUrun },
    { key: "hizli", label: "En Hızlı Adım", short: "Hızlı", unit: "dk", lowerBetter: true, cur: listIsUrun ? null : (fastest?.avg ?? null), prev: prevFastest?.avg ?? null, muted: mk("hizli") || listIsUrun },
  ];
  const chartNode =
    focus.chartMetric === CHIPS[0].key ? (
      <SummaryChart title={`Birim Süre Özeti — ${period.label}`} items={summaryItems} hasPrev={!!birimPrev} query={periodQuery(sp)} />
    ) : (
      <AnalizChart {...chartProps} title={title} />
    );

  const listRows: CompactRow[] = matched.map(toRow);

  // Odak dışı / filtre altında verisi olmayan kartlar boş görünür
  const mut = (k: string, empty = false) => !focus.showCard(k) || (filtActive && empty);
  const cards = (
    <>
      <StatCard
        title="Montaj Birim Süre"
        accent={montajColor}
        empty={mut("montaj", montajAvg === null)}
        value={dk(montajAvg)}
        subtitle="dk / adet, adet ağırlıklı"
      />
      <StatCard
        title="Paketleme Birim Süre"
        accent={paketColor}
        empty={mut("paketleme", paketlemeAvg === null)}
        value={dk(paketlemeAvg)}
        subtitle="dk / adet, adet ağırlıklı"
      />
      <StatCard title="En Yavaş Adım" accent={montajColor} empty={mut("yavas", listIsUrun || !slowest)} value={slowCard.value} subtitle={slowCard.subtitle} />
      <StatCard title="En Hızlı Adım" accent={montajColor} empty={mut("hizli", listIsUrun || !fastest)} value={fastCard.value} subtitle={fastCard.subtitle} />
    </>
  );

  const list = (
    <div className="space-y-1">
      <CompactList
        title={listIsUrun ? "Ürün Bazlı Birim Süre (Paketleme)" : "Adım Bazlı Birim Süre (Montaj)"}
        columns={COLS.map((c) => (c.key === "ad" ? { ...c, label: listIsUrun ? "Ürün" : "Adım" } : c))}
        rows={listRows}
        filterOptions={options}
        visibleColumns={focus.visibleColumns}
      />
      <p className="px-1 text-[11px] text-muted-foreground">
        Standart süre: son 180 gündeki tüm seansların birim süre medyanı. En yavaş/en hızlı adım, en az 5 adet
        yapılmış adımlar arasında kendi standardına göre farkı en büyük/en küçük olandır ({fmtNum(stepRows.length)}{" "}
        adım).
      </p>
    </div>
  );

  return (
    <AnalizLayout
      title="Çalışma Birim Süresi"
      backHref="/analiz"
      period={period}
      filterNote={filterNote(
        colFilters,
        COLS.map((c) => (c.key === "ad" ? { ...c, label: listIsUrun ? "Ürün" : "Adım" } : c)),
      )}
      chips={CHIPS}
      focus={focus.all ? null : { labels: focus.labels, clearKeys: focus.clearKeys }}
      activeMetric={metric}
      chart={chartNode}
      cards={cards}
      list={list}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    />
  );
}
