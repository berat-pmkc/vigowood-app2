import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { formatTrDate, resolvePeriod } from "@/lib/periods";
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
import { fmtNum, round } from "../_shared/utils";
import { getUretim } from "../_shared/queries";
import {
  getActiveSkus,
  getKaliteRows,
  kaynakLabel,
  safe,
  TIP_LABELS,
  trunc,
  type KaliteRow,
} from "../_shared/queries-d1";

export const metadata: Metadata = { title: "Fire | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "en-cok", label: "En Çok Fire" },
  { key: "en-az", label: "En Az Fire" },
  { key: "firesiz", label: "Firesiz Ürünler" },
  { key: "urun", label: "Ürün" },
  { key: "yari-mamul", label: "Yarı Mamul" },
  { key: "plaka", label: "Plaka" },
];
const TIP_OF: Record<string, string> = { urun: "URUN", "yari-mamul": "YARI_MAMUL", plaka: "PLAKA" };

type SP = Record<string, string | string[] | undefined>;

const FIRE_COLS: CompactColumn[] = [
  { key: "tarih", label: "Tarih" },
  { key: "tip", label: "Tip" },
  { key: "kod", label: "Kod" },
  { key: "ad", label: "Ad" },
  { key: "kaynak", label: "Kaynak" },
  { key: "qty", label: "Miktar", align: "right", format: "number" },
  { key: "personel", label: "Personel" },
];
// Firesiz listesi kendi anahtarlarını kullanır (fire listesiyle çakışmasın)
const FIRESIZ_COLS: CompactColumn[] = [
  { key: "fkod", label: "Ürün Kodu" },
  { key: "fad", label: "Ürün Adı" },
  { key: "fqty", label: "Üretim", align: "right", format: "number" },
];

const toFireRow = (r: KaliteRow): CompactRow => ({
  tarih: r.tarih ? formatTrDate(r.tarih) : "—",
  tip: TIP_LABELS[r.item_tipi] ?? r.item_tipi,
  kod: r.item_id,
  ad: r.item_adi ?? r.item_id,
  kaynak: kaynakLabel(r.kaynak),
  qty: r.qty,
  personel: r.operator_name ?? "—",
});

export default async function FirePage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (![...ADMIN_ROLES, ...OFFICE_ROLES].includes(user.role)) redirect("/");

  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const { from, to } = period;
  const metricRaw = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const metric = CHIPS.some((c) => c.key === metricRaw) ? (metricRaw as string) : CHIPS[0].key;
  const g = resolveGranularity(sp.g, from, to);

  const [kal, uretim, aktif] = await Promise.all([
    safe(getKaliteRows(from, to, "FIRE"), { available: false, rows: [] as KaliteRow[] }),
    safe(getUretim(from, to), { total: 0, byDay: {}, bySku: {} }),
    safe(getActiveSkus(), new Map<string, string>()),
  ]);

  const allFires = kal.rows;
  const isFiresiz = metric === "firesiz";
  const fireFilters = isFiresiz ? {} : parseColumnFilters(sp, FIRE_COLS);
  const firesizFilters = isFiresiz ? parseColumnFilters(sp, FIRESIZ_COLS) : {};
  const fireActive = hasActiveFilters(fireFilters);
  const firesizActive = hasActiveFilters(firesizFilters);
  const note = isFiresiz ? filterNote(firesizFilters, FIRESIZ_COLS) : filterNote(fireFilters, FIRE_COLS);

  // Kart + grafik + liste filtrelenmiş fire kayıtlarından türer
  const fires = pickByFilters(allFires, toFireRow, fireFilters);
  const sumTip = (t: string) => fires.filter((r) => r.item_tipi === t).reduce((a, r) => a + r.qty, 0);
  const urunFire = sumTip("URUN");
  // Fire oranı: filtre varsa yalnızca filtredeki ürünlerin üretimine göre
  const rateSkus = new Set(fires.filter((r) => r.item_tipi === "URUN").map((r) => r.item_id));
  const rateDen = fireActive
    ? [...rateSkus].reduce((a, sku) => a + (uretim.bySku[sku] ?? 0), 0)
    : uretim.total;
  const rate = rateDen > 0 ? round((urunFire / rateDen) * 100, 2) : null;

  // kalem bazlı toplam
  const items = new Map<string, { tip: string; id: string; ad: string; qty: number }>();
  for (const r of fires) {
    const k = `${r.item_tipi}|${r.item_id}`;
    const a = items.get(k) ?? { tip: r.item_tipi, id: r.item_id, ad: r.item_adi ?? r.item_id, qty: 0 };
    a.qty += r.qty;
    items.set(k, a);
  }
  const itemList = [...items.values()];
  const label = (a: { tip: string; id: string; ad: string }) =>
    trunc(`${a.ad}${a.ad === a.id ? "" : ""}`) + (a.tip === "URUN" ? "" : ` (${TIP_LABELS[a.tip] ?? a.tip})`);

  // firesiz ürünler: aktif, dönemde üretimi olan ama fire kaydı olmayan
  // (tanım, fire listesi filtrelerinden bağımsızdır: tüm dönem fire kayıtları esas alınır)
  const fireSkus = new Set(allFires.filter((r) => r.item_tipi === "URUN" && r.qty > 0).map((r) => r.item_id));
  const firesizAll = Object.entries(uretim.bySku)
    .filter(([sku, q]) => q > 0 && aktif.has(sku) && !fireSkus.has(sku))
    .map(([sku, q]) => ({ sku, ad: aktif.get(sku) ?? sku, qty: q }))
    .sort((a, b) => b.qty - a.qty);
  const toFiresizRow = (a: { sku: string; ad: string; qty: number }): CompactRow => ({
    fkod: a.sku,
    fad: a.ad,
    fqty: a.qty,
  });
  const firesiz = pickByFilters(firesizAll, toFiresizRow, firesizFilters);

  let chart: AnalizChartProps & { title: string };
  if (metric === "en-cok") {
    chart = {
      title: "En çok fire veren 10 kalem (adet)",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      data: [...itemList]
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10)
        .map((a) => ({ label: label(a), qty: a.qty })),
      series: [{ key: "qty", label: "Fire", color: "#ee7683" }],
    };
  } else if (metric === "en-az") {
    chart = {
      title: "En az fire veren 10 kalem (fire > 0, adet)",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      data: itemList
        .filter((a) => a.qty > 0)
        .sort((a, b) => a.qty - b.qty)
        .slice(0, 10)
        .map((a) => ({ label: label(a), qty: a.qty })),
      series: [{ key: "qty", label: "Fire", color: "#f28a19" }],
    };
  } else if (metric === "firesiz") {
    chart = {
      title: `Firesiz ürünler: ${fmtNum(firesiz.length)} ürün (üretim adedine göre ilk 10)`,
      type: "bar",
      layout: "vertical",
      xKey: "label",
      data: firesiz.slice(0, 10).map((a) => ({ label: trunc(a.ad), qty: a.qty })),
      series: [{ key: "qty", label: "Üretim", color: "#70c1aa" }],
      emptyText: "Firesiz ürün yok",
    };
  } else {
    const tip = TIP_OF[metric];
    const byDay: Record<string, number> = {};
    for (const r of fires) if (r.item_tipi === tip) byDay[r.tarih] = (byDay[r.tarih] ?? 0) + r.qty;
    chart = {
      title: `${TIP_LABELS[tip]} fire (adet)`,
      type: "bar",
      xKey: "label",
      data: buildSeries(from, to, g, { v: byDay }),
      series: [{ key: "v", label: "Fire", color: "#6f4c37" }],
    };
  }
  const { title: chartTitle, ...chartProps } = chart;

  // liste
  const tipFilter = TIP_OF[metric];
  const byDate = (a: KaliteRow, b: KaliteRow) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : 0);
  const rows: CompactRow[] = fires
    .filter((r) => !tipFilter || r.item_tipi === tipFilter)
    .sort(byDate)
    .map(toFireRow);
  const fireOptions = distinctOptions(
    allFires.filter((r) => !tipFilter || r.item_tipi === tipFilter).map(toFireRow),
    FIRE_COLS,
  );
  const firesizOptions = distinctOptions(firesizAll.map(toFiresizRow), FIRESIZ_COLS);

  const list =
    metric === "firesiz" ? (
      <CompactList
        title="Firesiz ürünler (dönemde üretilen, fire kaydı olmayan)"
        columns={FIRESIZ_COLS}
        rows={firesiz.map(toFiresizRow)}
        filterOptions={firesizOptions}
        emptyText="Firesiz ürün yok"
      />
    ) : (
      <CompactList
        title="Fire kayıtları"
        columns={FIRE_COLS}
        rows={rows}
        filterOptions={fireOptions}
      />
    );

  // Filtre aktifken anlamlı verisi olmayan kartlar gizlenir
  const ymFire = sumTip("YARI_MAMUL");
  const plakaFire = sumTip("PLAKA");
  const cards = firesizActive ? (
    <>
      <StatCard title="Firesiz Ürün" value={fmtNum(firesiz.length)} subtitle="Filtreye uyan ürün sayısı" />
      <StatCard
        title="Firesiz Ürün Üretimi"
        value={fmtNum(firesiz.reduce((a, r) => a + r.qty, 0))}
        subtitle="Adet"
      />
    </>
  ) : (
    <>
      {(!fireActive || urunFire > 0) && <StatCard title="Ürün Firesi" value={fmtNum(urunFire)} subtitle="Adet" />}
      {(!fireActive || ymFire > 0) && <StatCard title="Yarı Mamul Firesi" value={fmtNum(ymFire)} subtitle="Adet" />}
      {(!fireActive || plakaFire > 0) && <StatCard title="Plaka Firesi" value={fmtNum(plakaFire)} subtitle="Adet" />}
      {(!fireActive || (rate !== null && urunFire > 0)) && (
        <StatCard
          title="Fire Oranı"
          value={rate === null ? "—" : `%${rate.toLocaleString("tr-TR")}`}
          subtitle={`Ürün firesi / üretim (${fmtNum(rateDen)} adet)`}
        />
      )}
    </>
  );

  return (
    <AnalizLayout
      title="Fire"
      backHref="/analiz"
      period={period}
      filterNote={note}
      chips={CHIPS}
      activeMetric={metric}
      chart={
        <>
          <AnalizChart {...chartProps} title={chartTitle} />
          {!kal.available && <p className="text-xs text-muted-foreground">Kalite verisi henüz yok</p>}
        </>
      }
      cards={cards}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      list={list}
    />
  );
}
