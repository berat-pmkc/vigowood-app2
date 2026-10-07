import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { formatTrDate, resolvePeriod } from "@/lib/periods";
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
import { buildSeries, resolveGranularity } from "../../_shared/series";
import { fmtNum } from "../../_shared/utils";
import {
  getKaliteRows,
  isUygunsuzGirisAny,
  kaynakLabel,
  periodQuery,
  safe,
  TIP_LABELS,
  trunc,
  type KaliteRow,
} from "../../_shared/queries-d1";

export const metadata: Metadata = { title: "Uygunsuz Ürünler | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "tumu", label: "Tümü" },
  { key: "iade", label: "İade" },
  { key: "uretim", label: "Üretim" },
  { key: "stok", label: "Stok" },
  { key: "tip-urun", label: "Ürün" },
  { key: "tip-ym", label: "Yarı Mamul" },
  { key: "kargo", label: "Kargo Firmasına Göre" },
  { key: "urun", label: "Ürüne Göre" },
];

const FOCUS: FocusMap = {
  defaultChip: "tumu",
  chips: {
    iade: { cards: ["iade"], cols: [] },
    uretim: { cards: ["uretim"], cols: [] },
    stok: { cards: [], cols: [] },
    "tip-urun": { cards: ["total"], cols: [] },
    "tip-ym": { cards: ["ym"], cols: [] },
    kargo: { cards: ["kargo"], cols: [] },
    urun: { cards: ["top"], cols: [] },
  },
  cols: {},
};

type SP = Record<string, string | string[] | undefined>;
const URETIM_KAYNAK = ["paketleme", "montaj", "kesim"];

const COLS: CompactColumn[] = [
  { key: "tarih", label: "Tarih" },
  { key: "tip", label: "Tip" },
  { key: "sku", label: "Ürün / Parça Kodu" },
  { key: "ad", label: "Ad" },
  { key: "kaynak", label: "Kaynak" },
  { key: "kargo", label: "Kargo Firması" },
  { key: "musteri", label: "Müşteri" },
  { key: "qty", label: "Miktar", align: "right", format: "number" },
];

const toRow = (r: KaliteRow): CompactRow => ({
  tarih: r.tarih ? formatTrDate(r.tarih) : "—",
  tip: TIP_LABELS[r.item_tipi] ?? r.item_tipi,
  sku: r.item_id,
  ad: r.item_adi ?? r.item_id,
  kaynak: kaynakLabel(r.kaynak),
  kargo: r.kargo_firmasi ?? "—",
  musteri: r.musteri ?? "—",
  qty: r.qty,
});

function groupSum(rows: KaliteRow[], key: (r: KaliteRow) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.qty);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function cardValues(rows: KaliteRow[]) {
  const sumBy = (pred: (r: KaliteRow) => boolean) => rows.filter(pred).reduce((a, r) => a + r.qty, 0);
  return {
    total: sumBy((r) => r.item_tipi === "URUN"),
    totalYm: sumBy((r) => r.item_tipi === "YARI_MAMUL"),
    top: groupSum(rows, (r) => r.item_id)[0]?.[1] ?? 0,
    iade: sumBy((r) => r.kaynak === "iade"),
    uretim: sumBy((r) => URETIM_KAYNAK.includes(r.kaynak ?? "")),
    kargo: groupSum(rows.filter((r) => r.kargo_firmasi), (r) => r.kargo_firmasi as string)[0]?.[1] ?? 0,
  };
}

export default async function UygunsuzPage({ searchParams }: { searchParams: Promise<SP> }) {
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
  const active = hasActiveFilters(colFilters);
  const hasPrev = !!period.prevFrom && !!period.prevTo;
  const needPrev = metric === CHIPS[0].key && !active && hasPrev;
  const EMPTY_KAL = { available: false, rows: [] as KaliteRow[] };
  const [kal, kalPrev] = await Promise.all([
    safe(getKaliteRows(from, to, "UYGUNSUZ"), EMPTY_KAL),
    needPrev ? safe(getKaliteRows(period.prevFrom, period.prevTo, "UYGUNSUZ"), EMPTY_KAL) : Promise.resolve(null),
  ]);
  const allUnfiltered = kal.rows.filter(isUygunsuzGirisAny);

  // kolon filtreleri: kart + grafik + liste hepsi filtrelenmiş kayıtlardan türer
  const focus = resolveFocus(FOCUS, metric, colFilters, COLS, CHIPS);
  const all = pickByFilters(allUnfiltered, toRow, colFilters);
  const options = distinctOptions(allUnfiltered.map(toRow), COLS);

  // chip filtresi (veri + grafik + liste)
  const filtered = all.filter((r) => {
    if (metric === "iade") return r.kaynak === "iade";
    if (metric === "uretim") return URETIM_KAYNAK.includes(r.kaynak ?? "");
    if (metric === "stok") return r.kaynak === "stok";
    if (metric === "tip-urun") return r.item_tipi === "URUN";
    if (metric === "tip-ym") return r.item_tipi === "YARI_MAMUL";
    if (metric === "kargo") return !!r.kargo_firmasi;
    return true;
  });

  // kartlar (dönemin tümü)
  const total = all.filter((r) => r.item_tipi === "URUN").reduce((a, r) => a + r.qty, 0);
  const totalYm = all.filter((r) => r.item_tipi === "YARI_MAMUL").reduce((a, r) => a + r.qty, 0);
  const byProduct = groupSum(all, (r) => r.item_id);
  const topProduct = byProduct[0];
  const iade = all.filter((r) => r.kaynak === "iade").reduce((a, r) => a + r.qty, 0);
  const uretim = all.filter((r) => URETIM_KAYNAK.includes(r.kaynak ?? "")).reduce((a, r) => a + r.qty, 0);
  const kargoTop = groupSum(
    all.filter((r) => r.kargo_firmasi),
    (r) => r.kargo_firmasi as string,
  )[0];
  const nameOf = (sku: string) => all.find((r) => r.item_id === sku)?.item_adi ?? sku;

  // grafik
  let chart: AnalizChartProps & { title: string };
  if (metric === "kargo") {
    chart = {
      title: "Kargo firmasına göre uygunsuz ürün (adet)",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      data: groupSum(all, (r) => r.kargo_firmasi || "Belirtilmemiş")
        .slice(0, 12)
        .map(([label, qty]) => ({ label: trunc(label), qty })),
      series: [{ key: "qty", label: "Adet", color: "#f28a19" }],
    };
  } else if (metric === "urun") {
    chart = {
      title: "En çok uygunsuz çıkan 10 ürün (adet)",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      data: byProduct.slice(0, 10).map(([sku, qty]) => ({ label: trunc(nameOf(sku)), qty })),
      series: [{ key: "qty", label: "Adet", color: "#ee7683" }],
    };
  } else {
    const byDay: Record<string, number> = {};
    for (const r of filtered) byDay[r.tarih] = (byDay[r.tarih] ?? 0) + r.qty;
    chart = {
      title: "Uygunsuz giriş (adet)",
      type: "bar",
      xKey: "label",
      data: buildSeries(from, to, g, { v: byDay }),
      series: [{ key: "v", label: "Uygunsuz", color: "#ee7683" }],
    };
  }
  const { title: chartTitle, ...chartProps } = chart;

  const pv = kalPrev ? cardValues(kalPrev.rows.filter(isUygunsuzGirisAny)) : null;
  const mk = (k: string) => !focus.showCard(k);
  const summaryItems: SummaryItem[] = [
    { key: "total", label: "Uygunsuz Ürün", short: "Ürün", unit: "adet", lowerBetter: true, cur: total, prev: pv?.total ?? null, muted: mk("total") },
    { key: "ym", label: "Uygunsuz Yarı Mamul", short: "Y.Mamul", unit: "adet", lowerBetter: true, cur: totalYm, prev: pv?.totalYm ?? null, muted: mk("ym") },
    { key: "top", label: "En Çok Gelen Ürün", short: "En çok", unit: "adet", lowerBetter: true, cur: topProduct?.[1] ?? 0, prev: pv?.top ?? null, muted: mk("top") },
    { key: "iade", label: "İade Kaynaklı", short: "İade", unit: "adet", lowerBetter: true, cur: iade, prev: pv?.iade ?? null, muted: mk("iade") },
    { key: "uretim", label: "Üretim Kaynaklı", short: "Üretim", unit: "adet", lowerBetter: true, cur: uretim, prev: pv?.uretim ?? null, muted: mk("uretim") },
    { key: "kargo", label: "En Çok Kargo", short: "Kargo", unit: "adet", lowerBetter: true, cur: kargoTop?.[1] ?? 0, prev: pv?.kargo ?? null, muted: mk("kargo") },
  ];
  const chartNode =
    focus.chartMetric === CHIPS[0].key ? (
      <SummaryChart
        title={`Uygunsuz Özeti — ${period.label}`}
        items={summaryItems}
        hasPrev={needPrev}
        query={periodQuery(sp)}
      />
    ) : (
      <AnalizChart {...chartProps} title={chartTitle} />
    );

  const rows: CompactRow[] = [...filtered]
    .sort((a, b) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : 0))
    .map(toRow);

  // Odak dışı / filtre altında verisi olmayan kartlar boş görünür
  const mut = (k: string, empty = false) => !focus.showCard(k) || (active && empty);
  const cards = (
    <>
      <StatCard title="Toplam Uygunsuz Ürün" empty={mut("total", total === 0)} value={fmtNum(total)} subtitle="Adet" />
      <StatCard title="Toplam Uygunsuz Yarı Mamul" empty={mut("ym", totalYm === 0)} value={fmtNum(totalYm)} subtitle="Adet" />
      <StatCard
        title="En Çok Gelen Ürün"
        empty={mut("top", !topProduct)}
        value={topProduct ? fmtNum(topProduct[1]) : "—"}
        subtitle={topProduct ? `${topProduct[0]} · ${nameOf(topProduct[0])}` : "Kayıt yok"}
      />
      <StatCard title="İade Kaynaklı" empty={mut("iade", iade === 0)} value={fmtNum(iade)} subtitle="Adet" />
      <StatCard
        title="Üretim Kaynaklı"
        empty={mut("uretim", uretim === 0)}
        value={fmtNum(uretim)}
        subtitle="Paketleme, montaj, kesim"
      />
      <StatCard
        title="En Çok Uygunsuzluk Çıkan Kargo"
        empty={mut("kargo", !kargoTop)}
        value={kargoTop ? kargoTop[0] : "—"}
        subtitle={kargoTop ? `${fmtNum(kargoTop[1])} adet` : "Kargo bilgisi yok"}
      />
    </>
  );

  return (
    <AnalizLayout
      title="Uygunsuz Ürünler ve Yarı Mamuller"
      backHref="/analiz/uretim"
      period={period}
      filterNote={filterNote(colFilters, COLS)}
      focus={focus.all ? null : { labels: focus.labels, clearKeys: focus.clearKeys }}
      chips={CHIPS}
      activeMetric={metric}
      chart={
        <>
          {chartNode}
          {!kal.available && <p className="text-xs text-muted-foreground">Kalite verisi henüz yok</p>}
        </>
      }
      cards={cards}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      list={
        <CompactList
          title="Uygunsuz kayıtları (ürün + yarı mamul)"
          columns={COLS}
          rows={rows}
          filterOptions={options}
        />
      }
    />
  );
}
