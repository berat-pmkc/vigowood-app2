import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { formatTrDate, resolvePeriod } from "@/lib/periods";
import { AnalizLayout } from "../../_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "../../_shared/analiz-chart";
import type { MetricChip } from "../../_shared/metric-chips";
import { StatCard } from "../../_shared/stat-card";
import { CompactList, type CompactColumn, type CompactRow } from "../../_shared/compact-list";
import {
  distinctOptions,
  filterNote,
  hasActiveFilters,
  parseColumnFilters,
  pickByFilters,
} from "../../_shared/column-filters";
import { buildSeries, resolveGranularity } from "../../_shared/series";
import { fmtNum } from "../../_shared/utils";
import {
  getKaliteRows,
  isUygunsuzGiris,
  kaynakLabel,
  safe,
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
  { key: "kargo", label: "Kargo Firmasına Göre" },
  { key: "urun", label: "Ürüne Göre" },
];

type SP = Record<string, string | string[] | undefined>;
const URETIM_KAYNAK = ["paketleme", "montaj", "kesim"];

const COLS: CompactColumn[] = [
  { key: "tarih", label: "Tarih" },
  { key: "sku", label: "Ürün Kodu" },
  { key: "ad", label: "Ürün Adı" },
  { key: "kaynak", label: "Kaynak" },
  { key: "kargo", label: "Kargo Firması" },
  { key: "musteri", label: "Müşteri" },
  { key: "qty", label: "Miktar", align: "right", format: "number" },
];

const toRow = (r: KaliteRow): CompactRow => ({
  tarih: r.tarih ? formatTrDate(r.tarih) : "—",
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

  const kal = await safe(getKaliteRows(from, to, "UYGUNSUZ"), { available: false, rows: [] as KaliteRow[] });
  const allUnfiltered = kal.rows.filter(isUygunsuzGiris);

  // kolon filtreleri: kart + grafik + liste hepsi filtrelenmiş kayıtlardan türer
  const colFilters = parseColumnFilters(sp, COLS);
  const active = hasActiveFilters(colFilters);
  const all = pickByFilters(allUnfiltered, toRow, colFilters);
  const options = distinctOptions(allUnfiltered.map(toRow), COLS);

  // chip filtresi (veri + grafik + liste)
  const filtered = all.filter((r) => {
    if (metric === "iade") return r.kaynak === "iade";
    if (metric === "uretim") return URETIM_KAYNAK.includes(r.kaynak ?? "");
    if (metric === "stok") return r.kaynak === "stok";
    if (metric === "kargo") return !!r.kargo_firmasi;
    return true;
  });

  // kartlar (dönemin tümü)
  const total = all.reduce((a, r) => a + r.qty, 0);
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
      title: "Uygunsuz ürün girişi (adet)",
      type: "bar",
      xKey: "label",
      data: buildSeries(from, to, g, { v: byDay }),
      series: [{ key: "v", label: "Uygunsuz", color: "#ee7683" }],
    };
  }
  const { title: chartTitle, ...chartProps } = chart;

  const rows: CompactRow[] = [...filtered]
    .sort((a, b) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : 0))
    .map(toRow);

  // Filtre aktifken anlamlı verisi olmayan kartlar gizlenir
  const hide = (empty: boolean) => active && empty;
  const cards = (
    <>
      {!hide(total === 0) && <StatCard title="Toplam Uygunsuz Ürün" value={fmtNum(total)} subtitle="Adet" />}
      {!hide(!topProduct) && (
        <StatCard
          title="En Çok Gelen Ürün"
          value={topProduct ? fmtNum(topProduct[1]) : "—"}
          subtitle={topProduct ? `${topProduct[0]} · ${nameOf(topProduct[0])}` : "Kayıt yok"}
        />
      )}
      {!hide(iade === 0) && <StatCard title="İade Kaynaklı" value={fmtNum(iade)} subtitle="Adet" />}
      {!hide(uretim === 0) && (
        <StatCard title="Üretim Kaynaklı" value={fmtNum(uretim)} subtitle="Paketleme, montaj, kesim" />
      )}
      {!hide(!kargoTop) && (
        <StatCard
          title="En Çok Uygunsuzluk Çıkan Kargo"
          value={kargoTop ? kargoTop[0] : "—"}
          subtitle={kargoTop ? `${fmtNum(kargoTop[1])} adet` : "Kargo bilgisi yok"}
        />
      )}
    </>
  );

  return (
    <AnalizLayout
      title="Uygunsuz Ürünler"
      backHref="/analiz/uretim"
      period={period}
      filterNote={filterNote(colFilters, COLS)}
      chips={CHIPS}
      activeMetric={metric}
      chart={
        <>
          <AnalizChart {...chartProps} title={chartTitle} />
          {!kal.available && <p className="text-xs text-muted-foreground">Kalite verisi henüz yok</p>}
        </>
      }
      cards={cards}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      list={
        <CompactList
          title="Uygunsuz ürün kayıtları"
          columns={COLS}
          rows={rows}
          filterOptions={options}
        />
      }
    />
  );
}
