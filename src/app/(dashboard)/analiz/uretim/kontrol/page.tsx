import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { formatTrDate, resolvePeriod } from "@/lib/periods";
import { AnalizLayout } from "../../_shared/analiz-layout";
import { AnalizChart } from "../../_shared/analiz-chart";
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
import { resolveFocus, type FocusMap } from "../../_shared/focus";
import { buildSeries, resolveGranularity } from "../../_shared/series";
import { fmtNum } from "../../_shared/utils";
import {
  getKaliteRows,
  getUygunsuzBakiye,
  isKontrolAny,
  kontrolKarar,
  safe,
  TIP_LABELS,
  type KaliteRow,
} from "../../_shared/queries-d1";

export const metadata: Metadata = { title: "Kontrol Edilen Ürünler | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "tumu", label: "Tümü" },
  { key: "uygun", label: "Uygun" },
  { key: "sokum", label: "Söküm" },
  { key: "fire", label: "Fire" },
];

const FOCUS: FocusMap = {
  defaultChip: "tumu",
  chips: {
    uygun: { cards: ["uygun"], cols: [] },
    sokum: { cards: ["sokum"], cols: [] },
    fire: { cards: ["fire"], cols: [] },
  },
  cols: {},
};

const KARAR_LABEL = { uygun: "Uygun", sokum: "Söküm", fire: "Fire", diger: "Diğer" } as const;
type SP = Record<string, string | string[] | undefined>;

const COLS: CompactColumn[] = [
  { key: "tarih", label: "Tarih" },
  { key: "tip", label: "Tip" },
  { key: "sku", label: "Ürün / Parça Kodu" },
  { key: "ad", label: "Ad" },
  { key: "karar", label: "Karar" },
  { key: "qty", label: "Miktar", align: "right", format: "number" },
  { key: "personel", label: "Personel" },
];
// Söküm listesi kendi anahtarlarını kullanır (yalnızca kendi listesini filtreler)
const SOKUM_COLS: CompactColumn[] = [
  { key: "s_kod", label: "Parça Kodu" },
  { key: "s_ad", label: "Parça Adı" },
  { key: "s_saglam", label: "Sağlam", align: "right", format: "number" },
  { key: "s_fire", label: "Fire", align: "right", format: "number" },
];

const toRow = (r: KaliteRow): CompactRow => ({
  tarih: r.tarih ? formatTrDate(r.tarih) : "—",
  tip: TIP_LABELS[r.item_tipi] ?? r.item_tipi,
  sku: r.item_id,
  ad: r.item_adi ?? r.item_id,
  karar: KARAR_LABEL[kontrolKarar(r.islem)],
  qty: Math.abs(r.qty),
  personel: r.operator_name ?? "—",
});

export default async function KontrolPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (![...ADMIN_ROLES, ...OFFICE_ROLES].includes(user.role)) redirect("/");

  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const { from, to } = period;
  const metricRaw = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const metric = CHIPS.some((c) => c.key === metricRaw) ? (metricRaw as string) : CHIPS[0].key;
  const g = resolveGranularity(sp.g, from, to);

  const [kal, bakiye] = await Promise.all([
    safe(getKaliteRows(from, to), { available: false, rows: [] as KaliteRow[] }),
    safe(getUygunsuzBakiye(), 0),
  ]);

  const kontrolAll = kal.rows.filter(isKontrolAny);
  const colFilters = parseColumnFilters(sp, COLS);
  const filtActive = hasActiveFilters(colFilters);
  const focus = resolveFocus(FOCUS, metric, colFilters, COLS, CHIPS);
  // kart + grafik + liste filtrelenmiş kontrol kayıtlarından türer
  const kontrol = pickByFilters(kontrolAll, toRow, colFilters);
  const options = distinctOptions(kontrolAll.map(toRow), COLS);
  const qtyOf = (k: string) =>
    kontrol.filter((r) => kontrolKarar(r.islem) === k).reduce((a, r) => a + Math.abs(r.qty), 0);
  const filtered = kontrol.filter((r) => metric === "tumu" || kontrolKarar(r.islem) === metric);

  // grafik: kararlar zaman içinde (yığılmış)
  const maps: Record<string, Record<string, number>> = { uygun: {}, sokum: {}, fire: {} };
  for (const r of filtered) {
    const k = kontrolKarar(r.islem);
    if (k === "diger") continue;
    maps[k][r.tarih] = (maps[k][r.tarih] ?? 0) + Math.abs(r.qty);
  }
  const SERIES = [
    { key: "uygun", label: "Uygun", color: "#70c1aa" },
    { key: "sokum", label: "Söküm", color: "#f28a19" },
    { key: "fire", label: "Fire", color: "#ee7683" },
  ];
  const active = metric === "tumu" ? SERIES : SERIES.filter((s) => s.key === metric);
  const sub: Record<string, Record<string, number>> = {};
  for (const s of active) sub[s.key] = maps[s.key];

  const rows: CompactRow[] = [...filtered]
    .sort((a, b) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : 0))
    .map(toRow);

  // söküm sonucu yarı mamuller
  const sokumAcc = new Map<string, { id: string; ad: string; saglam: number; fire: number }>();
  for (const r of kal.rows) {
    if (r.item_tipi !== "YARI_MAMUL") continue;
    if (r.islem !== "sokum_saglam" && r.islem !== "sokum_fire") continue;
    const a = sokumAcc.get(r.item_id) ?? { id: r.item_id, ad: r.item_adi ?? r.item_id, saglam: 0, fire: 0 };
    if (r.islem === "sokum_saglam") a.saglam += Math.abs(r.qty);
    else a.fire += Math.abs(r.qty);
    sokumAcc.set(r.item_id, a);
  }
  const sokumAllRows: CompactRow[] = [...sokumAcc.values()]
    .sort((a, b) => b.saglam + b.fire - (a.saglam + a.fire))
    .map((a) => ({ s_kod: a.id, s_ad: a.ad, s_saglam: a.saglam, s_fire: a.fire }));
  const sokumFilters = parseColumnFilters(sp, SOKUM_COLS);
  const sokumRows = pickByFilters(sokumAllRows, (r) => r, sokumFilters);
  const sokumOptions = distinctOptions(sokumAllRows, SOKUM_COLS);

  // Filtre aktifken anlamlı verisi olmayan kartlar gizlenir; tüm-zaman bakiyesi filtreyle hesaplanamaz
  const qU = qtyOf("uygun");
  const qS = qtyOf("sokum");
  const qF = qtyOf("fire");
  const mut = (k: string, empty = false) => !focus.showCard(k) || (filtActive && empty);
  const cards = (
    <>
      <StatCard title="Uygun'a Dönen" empty={mut("uygun", qU === 0)} value={fmtNum(qU)} subtitle="Satılabilir stoğa geri alınan" />
      <StatCard title="Söküme Giden" empty={mut("sokum", qS === 0)} value={fmtNum(qS)} subtitle="Parçalarına ayrılan" />
      <StatCard title="Fire'ye Ayrılan" empty={mut("fire", qF === 0)} value={fmtNum(qF)} subtitle="Fire stoğuna alınan" />
      <StatCard
        title="Bekleyen Uygunsuz Bakiye"
        empty={mut("bakiye", true) || !focus.all}
        value={fmtNum(bakiye)}
        subtitle="Şu an kontrol bekleyen (tüm zamanlar)"
      />
    </>
  );

  return (
    <AnalizLayout
      title="Kontrol Edilen Uygunsuz Ürünler"
      backHref="/analiz/uretim"
      period={period}
      filterNote={filterNote(colFilters, COLS)}
      focus={focus.all ? null : { labels: focus.labels, clearKeys: focus.clearKeys }}
      chips={CHIPS}
      activeMetric={metric}
      chart={
        <>
          <AnalizChart
            title="Kontrol kararları (adet)"
            type="bar"
            stacked
            xKey="label"
            data={buildSeries(from, to, g, sub)}
            series={active}
          />
          {!kal.available && <p className="text-xs text-muted-foreground">Kalite verisi henüz yok</p>}
        </>
      }
      cards={cards}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      list={
        <div className="space-y-4">
          <CompactList
            title="Kontrol kayıtları"
            columns={COLS}
            rows={rows}
            filterOptions={options}
          />
          {(sokumAllRows.length > 0) && (
            <CompactList
              title="Söküm sonucu yarı mamuller"
              columns={SOKUM_COLS}
              rows={sokumRows}
              filterOptions={sokumOptions}
            />
          )}
        </div>
      }
    />
  );
}
