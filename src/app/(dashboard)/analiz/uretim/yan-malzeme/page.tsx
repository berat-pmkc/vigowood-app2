import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { bucketKey, bucketLabel, formatTrDate, resolvePeriod, type Granularity } from "@/lib/periods";
import { AnalizLayout } from "../../_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "../../_shared/analiz-chart";
import type { MetricChip } from "../../_shared/metric-chips";
import { StatCard } from "../../_shared/stat-card";
import { SummaryChart, type SummaryItem } from "../../_shared/summary-chart";
import { CompactList, type CompactColumn, type CompactRow } from "../../_shared/compact-list";
import {
  distinctOptions,
  filterNote,
  hasActiveFilters,
  parseColumnFilters,
  pickByFilters,
} from "../../_shared/column-filters";
import { resolveFocus, type FocusMap } from "../../_shared/focus";
import { resolveGranularity } from "../../_shared/series";
import { deltaPct, fmtNum, round } from "../../_shared/utils";
import { getProductNames } from "../../_shared/queries";
import { periodQuery, safe } from "../../_shared/queries-d1";
import { getYanMalzeme, type YanMalzemeData } from "../../_shared/queries-d3";

export const metadata: Metadata = { title: "Yan Malzeme Kullanımı | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "tumu", label: "Tümü" },
  { key: "en-cok", label: "En Çok Kullanılan" },
  { key: "urun", label: "Ürüne Göre" },
  { key: "adim", label: "Adıma Göre" },
];

type SP = Record<string, string | string[] | undefined>;

const COLS: CompactColumn[] = [
  { key: "donem", label: "Dönem" },
  { key: "kod", label: "Yan Malzeme Kodu" },
  { key: "ad", label: "Yan Malzeme Adı" },
  { key: "sku", label: "Ürün Kodu" },
  { key: "adim", label: "İş Adımı" },
  { key: "qty", label: "Kullanım Miktarı", align: "right", format: "number" },
  { key: "stok", label: "Güncel Stok", align: "right", format: "number" },
  { key: "kritik", label: "Kritik Stok", align: "right", format: "number" },
];

const FOCUS: FocusMap = {
  defaultChip: "tumu",
  chips: {
    "en-cok": { cards: ["top", "toplam"], cols: ["qty"] },
    urun: { cards: ["urun"], cols: ["qty"] },
    adim: { cards: ["toplam"], cols: ["qty"] },
  },
  cols: {
    qty: { cards: ["toplam", "top"], chip: "en-cok" },
    stok: { cards: [] },
    kritik: { cards: [] },
  },
};

const EMPTY_YAN: YanMalzemeData = { parts: new Map(), rows: [] };

interface Acc {
  bucket: string;
  partId: string;
  sku: string;
  stepId: string;
  qty: number;
}

function periodText(key: string, g: Granularity): string {
  if (g === "gunluk") return formatTrDate(key);
  if (g === "haftalik") return `${formatTrDate(key)} haftası`;
  return bucketLabel(key, g);
}

const trunc = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default async function YanMalzemePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (![...ADMIN_ROLES, ...OFFICE_ROLES].includes(user.role)) redirect("/");

  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const { from, to } = period;
  const metricRaw = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const metric = CHIPS.some((c) => c.key === metricRaw) ? (metricRaw as string) : CHIPS[0].key;
  const g = resolveGranularity(sp.g, from, to);

  const colFilters = parseColumnFilters(sp, COLS);
  const filtActive = hasActiveFilters(colFilters);
  const needPrev = !!period.prevFrom && !!period.prevTo && metric === CHIPS[0].key && !filtActive;

  const [yan, yanPrev, names] = await Promise.all([
    safe(getYanMalzeme(from, to), EMPTY_YAN),
    needPrev ? safe(getYanMalzeme(period.prevFrom, period.prevTo), EMPTY_YAN) : Promise.resolve(null),
    safe(getProductNames(), new Map<string, string>()),
  ]);

  // Liste: dönem kovası x yan malzeme x ürün x adım
  const acc = new Map<string, Acc>();
  for (const r of yan.rows) {
    const b = bucketKey(r.day, g);
    const k = `${b}|${r.partId}|${r.sku}|${r.stepId}`;
    const a = acc.get(k) ?? { bucket: b, partId: r.partId, sku: r.sku, stepId: r.stepId, qty: 0 };
    a.qty += r.qty;
    acc.set(k, a);
  }
  const accList = [...acc.values()].sort((a, b) =>
    a.bucket === b.bucket ? b.qty - a.qty : a.bucket < b.bucket ? 1 : -1,
  );
  const toRow = (a: Acc): CompactRow => {
    const p = yan.parts.get(a.partId);
    return {
      donem: periodText(a.bucket, g),
      kod: a.partId,
      ad: p?.adi ?? a.partId,
      sku: a.sku || "—",
      adim: a.stepId,
      qty: round(a.qty, 2),
      stok: p?.stok ?? 0,
      kritik: p?.kritik ?? 0,
    };
  };

  const focus = resolveFocus(FOCUS, metric, colFilters, COLS, CHIPS);
  const matched = pickByFilters(accList, toRow, colFilters);
  const options = distinctOptions(accList.map(toRow), COLS);
  const rows: CompactRow[] = matched.slice(0, 1500).map(toRow);

  // Kartlar eşleşen kayıtlardan türer
  const sumBy = (list: Acc[], key: (a: Acc) => string) => {
    const m = new Map<string, number>();
    for (const a of list) m.set(key(a), (m.get(key(a)) ?? 0) + a.qty);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const byPart = sumBy(matched, (a) => a.partId);
  const bySku = sumBy(matched.filter((a) => a.sku), (a) => a.sku);
  const byStep = sumBy(matched, (a) => a.stepId);
  const total = matched.reduce((a, r) => a + r.qty, 0);
  const topPart = byPart[0];
  const partName = (id: string) => yan.parts.get(id)?.adi ?? id;
  const kritikAlti = [...yan.parts.values()].filter((p) => p.stok < p.kritik);

  const prevTotal = yanPrev ? yanPrev.rows.reduce((a, r) => a + r.qty, 0) : null;
  const prevKinds = yanPrev ? new Set(yanPrev.rows.map((r) => r.partId)).size : null;
  const prevByPart = new Map<string, number>();
  if (yanPrev) for (const r of yanPrev.rows) prevByPart.set(r.partId, (prevByPart.get(r.partId) ?? 0) + r.qty);
  const prevTop = yanPrev ? Math.max(0, ...prevByPart.values()) : null;
  const prevSkus = yanPrev ? new Set(yanPrev.rows.map((r) => r.sku).filter(Boolean)).size : null;

  // Grafik
  const mk = (k: string) => !focus.showCard(k);
  const summaryItems: SummaryItem[] = [
    { key: "toplam", label: "Toplam Kullanım", short: "Toplam", unit: "adet", cur: round(total, 1), prev: prevTotal, muted: mk("toplam") },
    { key: "cesit", label: "Çeşit Sayısı", short: "Çeşit", unit: "çeşit", cur: byPart.length, prev: prevKinds, muted: mk("cesit") },
    { key: "top", label: "En Çok Kullanılan", short: "En çok", unit: "adet", cur: round(topPart?.[1] ?? 0, 1), prev: prevTop, muted: mk("top") },
    { key: "urun", label: "Kullanılan Ürün", short: "Ürün", unit: "adet", cur: bySku.length, prev: prevSkus, muted: mk("urun") },
    { key: "kritik", label: "Kritik Altı", short: "Kr. Altı", unit: "çeşit", lowerBetter: true, cur: kritikAlti.length, prev: null, muted: mk("kritik") || filtActive },
  ];

  let chart: AnalizChartProps & { title: string };
  if (focus.chartMetric === "urun") {
    chart = {
      title: "En çok yan malzeme kullanan 10 ürün (adet)",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      data: bySku.slice(0, 10).map(([sku, qty]) => ({ label: trunc(names.get(sku) ?? sku), qty: round(qty, 2) })),
      series: [{ key: "qty", label: "Kullanım", color: "#8d9d70" }],
    };
  } else if (focus.chartMetric === "adim") {
    chart = {
      title: "Adıma göre yan malzeme kullanımı (ilk 10, adet)",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      data: byStep.slice(0, 10).map(([step, qty]) => ({ label: trunc(step), qty: round(qty, 2) })),
      series: [{ key: "qty", label: "Kullanım", color: "#3368b1" }],
    };
  } else {
    chart = {
      title: "En çok kullanılan 10 yan malzeme (adet)",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      data: byPart.slice(0, 10).map(([id, qty]) => ({ label: trunc(partName(id)), qty: round(qty, 2) })),
      series: [{ key: "qty", label: "Kullanım", color: "#cdbd9d" }],
    };
  }
  const { title: chartTitle, ...chartProps } = chart;

  const chartNode =
    focus.chartMetric === CHIPS[0].key ? (
      <SummaryChart
        title={`Yan Malzeme Özeti — ${period.label}`}
        items={summaryItems}
        hasPrev={needPrev}
        query={periodQuery(sp)}
      />
    ) : (
      <AnalizChart {...chartProps} title={chartTitle} />
    );

  const mut = (k: string, empty = false) => !focus.showCard(k) || (filtActive && empty);
  const cards = (
    <>
      <StatCard
        title="Toplam Kullanım"
        empty={mut("toplam", total === 0)}
        value={fmtNum(total)}
        subtitle="Reçetelerden teorik (adet)"
        delta={prevTotal !== null ? deltaPct(total, prevTotal) : null}
      />
      <StatCard
        title="Çeşit Sayısı"
        empty={mut("cesit", byPart.length === 0)}
        value={fmtNum(byPart.length)}
        subtitle="Kullanılan farklı yan malzeme"
        delta={prevKinds !== null ? deltaPct(byPart.length, prevKinds) : null}
      />
      <StatCard
        title="En Çok Kullanılan Yan Malzeme"
        empty={mut("top", !topPart)}
        value={topPart ? fmtNum(topPart[1]) : "—"}
        subtitle={topPart ? `${topPart[0]} · ${partName(topPart[0])}` : "Kayıt yok"}
      />
      <StatCard
        title="Kullanılan Ürün Sayısı"
        empty={mut("urun", bySku.length === 0)}
        value={fmtNum(bySku.length)}
        subtitle="Yan malzeme tüketen farklı ürün"
        delta={prevSkus !== null ? deltaPct(bySku.length, prevSkus) : null}
      />
      <StatCard
        title="Kritik Altı Yan Malzeme"
        empty={mut("kritik", true)}
        value={fmtNum(kritikAlti.length)}
        subtitle="Güncel stok < kritik stok (tüm zamanlar)"
      />
    </>
  );

  return (
    <AnalizLayout
      title="Yan Malzeme Kullanımı"
      backHref="/analiz/uretim"
      period={period}
      filterNote={filterNote(colFilters, COLS)}
      focus={focus.all ? null : { labels: focus.labels, clearKeys: focus.clearKeys }}
      chips={CHIPS}
      activeMetric={metric}
      chart={chartNode}
      cards={cards}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      list={
        <div className="space-y-1">
          <CompactList
            title="Yan malzeme kullanımı"
            showGrouping
            activeGranularity={g}
            columns={COLS}
            rows={rows}
            filterOptions={options}
            visibleColumns={focus.visibleColumns}
          />
          <p className="px-1 text-[11px] text-muted-foreground">
            Kullanım teoriktir: tamamlanan montaj seansı adedi x adımın reçetesindeki hazır eleman miktarı (montaj
            stok düşümüyle aynı mantık). Gerçek sayım farkı bu rakama yansımaz.
          </p>
        </div>
      }
    />
  );
}
