import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { bucketKey, bucketLabel, formatTrDate, resolvePeriod, type Granularity } from "@/lib/periods";
import { AnalizLayout } from "../_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "../_shared/analiz-chart";
import type { MetricChip } from "../_shared/metric-chips";
import { StatCard } from "../_shared/stat-card";
import { SummaryChart, type SummaryItem } from "../_shared/summary-chart";
import { getYanMalzeme, type YanMalzemeData } from "../_shared/queries-d3";
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
import { getProductNames } from "../_shared/queries";
import { asamaRengi, hatHaritasi, HAT_ATANMAMIS_AD, HAT_ATANMAMIS_RENK } from "@/lib/talimat/hat-renk";
import { getAnalizHatlar, hatSerileri, hatToplamlari } from "../_shared/hat-data";
import { HatLegend } from "../_shared/hat-legend";
import { getStandardTimes, type StandardTimes } from "../_shared/performance";
import {
  getGuncelStok,
  getKaliteRows,
  getProdRows,
  getStokCikisRows,
  isFireUrun,
  isKontrol,
  isUygunsuzGiris,
  periodQs,
  periodQuery,
  safe,
  type KaliteRow,
  type ProdRows,
} from "../_shared/queries-d1";

export const metadata: Metadata = { title: "Üretim | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "tumu", label: "Tümü" },
  { key: "miktar", label: "Üretim Miktarı" },
  { key: "hat", label: "Hatlara Göre" },
  { key: "birim-sure", label: "Birim Süre" },
  { key: "adam-saat", label: "Adam Saat" },
  { key: "uygunsuz", label: "Uygunsuz" },
  { key: "kontrol", label: "Kontrol Edilen" },
  { key: "fire", label: "Fire" },
];

type SP = Record<string, string | string[] | undefined>;

const COLS: CompactColumn[] = [
  { key: "donem", label: "Dönem" },
  { key: "sku", label: "Ürün Kodu" },
  { key: "ad", label: "Ürün Adı" },
  { key: "hat", label: "Hat", dot: true },
  { key: "uretim", label: "Toplam Üretim", align: "right", format: "number" },
  { key: "uyg", label: "Uygunsuz", align: "right", format: "number" },
  { key: "kon", label: "Kontrol Edilen", align: "right", format: "number" },
  { key: "fire", label: "Fire", align: "right", format: "number" },
  { key: "cikis", label: "Stoktan Çıkış", align: "right", format: "number" },
  { key: "stok", label: "Güncel Stok", align: "right", format: "number" },
  { key: "adam", label: "Adam Saat", align: "right", format: "number" },
  { key: "birim", label: "Birim Süre", align: "right", format: "dk" },
  { key: "perf", label: "Performans", align: "right", format: "percent" },
];
const FOCUS: FocusMap = {
  defaultChip: "tumu",
  chips: {
    miktar: { cards: ["miktar"], cols: ["uretim"] },
    hat: { cards: ["miktar"], cols: ["uretim"] },
    "birim-sure": { cards: ["birim"], cols: ["birim", "perf"] },
    "adam-saat": { cards: ["adam"], cols: ["adam"] },
    uygunsuz: { cards: ["uygunsuz"], cols: ["uyg"] },
    kontrol: { cards: ["kontrol"], cols: ["kon"] },
    fire: { cards: ["fire"], cols: ["fire"] },
  },
  cols: {
    uretim: { cards: ["miktar"], chip: "miktar" },
    uyg: { cards: ["uygunsuz"], chip: "uygunsuz" },
    kon: { cards: ["kontrol"], chip: "kontrol" },
    fire: { cards: ["fire"], chip: "fire" },
    cikis: { cards: [] },
    stok: { cards: [] },
    adam: { cards: ["adam"], chip: "adam-saat" },
    birim: { cards: ["birim"], chip: "birim-sure" },
    perf: { cards: [] },
  },
};
const EMPTY_PROD: ProdRows = { pack: [], montaj: [] };
const EMPTY_YAN: YanMalzemeData = { parts: new Map(), rows: [] };
const EMPTY_STD: StandardTimes = { montaj: new Map(), paketleme: new Map() };

function sum(rows: KaliteRow[], pred: (r: KaliteRow) => boolean, abs = false) {
  const t = rows.filter(pred).reduce((a, r) => a + r.qty, 0);
  return abs ? Math.abs(t) : t;
}

function totals(p: ProdRows) {
  const packed = p.pack.reduce((a, r) => a + r.qty, 0);
  const man = p.pack.reduce((a, r) => a + r.manMin, 0) + p.montaj.reduce((a, r) => a + r.manMin, 0);
  return { packed, man, unit: packed > 0 ? man / packed : null };
}

function dayMap<T>(rows: T[], day: (r: T) => string, val: (r: T) => number): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) m[day(r)] = (m[day(r)] ?? 0) + val(r);
  return m;
}

function periodText(key: string, g: Granularity): string {
  if (g === "gunluk") return formatTrDate(key);
  if (g === "haftalik") return `${formatTrDate(key)} haftası`;
  return bucketLabel(key, g);
}

export default async function UretimPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (![...ADMIN_ROLES, ...OFFICE_ROLES].includes(user.role)) redirect("/");

  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const { from, to } = period;
  const metricRaw = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const metric = CHIPS.some((c) => c.key === metricRaw) ? (metricRaw as string) : CHIPS[0].key;
  const g = resolveGranularity(sp.g, from, to);
  const qs = periodQs(sp);
  const colFilters = parseColumnFilters(sp, COLS);
  const filtActive = hasActiveFilters(colFilters);
  const hasPrev = !!period.prevFrom && !!period.prevTo;
  // Önceki dönem kalite/yan malzeme değerleri yalnızca Tümü özet grafiği için (filtre yokken) gerekli
  const needPrev = metric === CHIPS[0].key && !filtActive && hasPrev;

  const hatlarP = getAnalizHatlar();
  const [hatlar, prodAll, prodPrev, kalAll, stdT, cikis, stok, names, yan, kalPrev, yanPrev] = await Promise.all([
    hatlarP,
    safe(getProdRows(from, to), EMPTY_PROD),
    period.prevFrom && period.prevTo
      ? safe<ProdRows | null>(getProdRows(period.prevFrom, period.prevTo), EMPTY_PROD)
      : Promise.resolve<ProdRows | null>(null),
    safe(getKaliteRows(from, to), { available: false, rows: [] as KaliteRow[] }),
    safe(getStandardTimes(), EMPTY_STD),
    safe(getStokCikisRows(from, to), [] as { day: string; sku: string; qty: number }[]),
    safe(getGuncelStok(), new Map<string, number>()),
    safe(getProductNames(), new Map<string, string>()),
    safe(getYanMalzeme(from, to), EMPTY_YAN),
    needPrev ? safe(getKaliteRows(period.prevFrom, period.prevTo), { available: false, rows: [] as KaliteRow[] }) : Promise.resolve(null),
    needPrev ? safe(getYanMalzeme(period.prevFrom, period.prevTo), EMPTY_YAN) : Promise.resolve(null),
  ]);

  // ── Liste (kova × sku)
  interface Acc {
    bucket: string;
    sku: string;
    packed: number;
    man: number;
    earned: number;
    known: number;
    uyg: number;
    kon: number;
    fire: number;
    cikis: number;
    /** hat_id (null = atanmamış) → adet / kişi-dk; satırın hat etiketi paketleme hattından, yoksa montaj hattından gelir */
    packHat: Map<string | null, number>;
    montajHat: Map<string | null, number>;
  }
  const acc = new Map<string, Acc>();
  const get = (day: string, sku: string): Acc => {
    const b = bucketKey(day, g);
    const k = `${b}|${sku}`;
    let a = acc.get(k);
    if (!a) {
      a = { bucket: b, sku, packed: 0, man: 0, earned: 0, known: 0, uyg: 0, kon: 0, fire: 0, cikis: 0, packHat: new Map(), montajHat: new Map() };
      acc.set(k, a);
    }
    return a;
  };
  for (const r of prodAll.pack) {
    const a = get(r.day, r.sku);
    a.packed += r.qty;
    a.man += r.manMin;
    a.packHat.set(r.hatId, (a.packHat.get(r.hatId) ?? 0) + r.qty);
    const t = stdT.paketleme.get(r.sku);
    if (t && r.manMin > 0) {
      a.earned += r.qty * t;
      a.known += r.manMin;
    }
  }
  for (const r of prodAll.montaj) {
    if (!r.sku) continue;
    const a = get(r.day, r.sku);
    a.man += r.manMin;
    a.montajHat.set(r.hatId, (a.montajHat.get(r.hatId) ?? 0) + r.qty);
    const t = stdT.montaj.get(r.stepId);
    if (t && r.manMin > 0) {
      a.earned += r.qty * t;
      a.known += r.manMin;
    }
  }
  for (const r of kalAll.rows) {
    if (r.item_tipi !== "URUN" || !r.tarih) continue;
    if (isUygunsuzGiris(r)) get(r.tarih, r.item_id).uyg += r.qty;
    else if (isKontrol(r)) get(r.tarih, r.item_id).kon += Math.abs(r.qty);
    else if (r.stok_turu === "FIRE") get(r.tarih, r.item_id).fire += r.qty;
  }
  for (const r of cikis) get(r.day, r.sku).cikis += r.qty;

  const accList = [...acc.values()].sort((a, b) =>
    a.bucket === b.bucket ? b.packed - a.packed : a.bucket < b.bucket ? 1 : -1,
  );
  const hatMap = hatHaritasi(hatlar);
  const hatLabel = (a: Acc): string => {
    const src = a.packHat.size ? a.packHat : a.montajHat;
    let best: string | null | undefined;
    let bestQty = -1;
    for (const [id, q] of src) {
      if (q > bestQty) {
        best = id;
        bestQty = q;
      }
    }
    return (best ? hatMap.get(best)?.ad : undefined) ?? HAT_ATANMAMIS_AD;
  };
  const dotColors: Record<string, string> = { [HAT_ATANMAMIS_AD]: HAT_ATANMAMIS_RENK };
  for (const v of hatMap.values()) dotColors[v.ad] = v.renk;
  const toRow = (a: Acc): CompactRow => ({
    donem: periodText(a.bucket, g),
    sku: a.sku,
    ad: names.get(a.sku) ?? a.sku,
    hat: hatLabel(a),
    uretim: a.packed,
    uyg: a.uyg,
    kon: a.kon,
    fire: a.fire,
    cikis: a.cikis,
    stok: stok.get(a.sku) ?? 0,
    adam: a.man > 0 ? round(a.man / 60, 1) : null,
    birim: a.packed > 0 && a.man > 0 ? round(a.man / a.packed, 2) : null,
    perf: a.known > 0 ? round((a.earned / a.known) * 100, 1) : null,
  });

  // ── Kolon filtreleri: kart + grafik + liste eşleşen (kova × ürün) kayıtlarından türer
  const focus = resolveFocus(FOCUS, metric, colFilters, COLS, CHIPS);
  const matched = pickByFilters(accList, toRow, colFilters);
  const options = distinctOptions(accList.map(toRow), COLS);
  const selKeys = new Set(matched.map((a) => `${a.bucket}|${a.sku}`));
  const inSel = (day: string | null, sku: string | null) =>
    !filtActive || (!!day && !!sku && selKeys.has(`${bucketKey(day, g)}|${sku}`));
  const prod: ProdRows = filtActive
    ? {
        pack: prodAll.pack.filter((r) => inSel(r.day, r.sku)),
        montaj: prodAll.montaj.filter((r) => inSel(r.day, r.sku)),
      }
    : prodAll;
  const kal = {
    available: kalAll.available,
    rows: filtActive
      ? kalAll.rows.filter((r) => r.item_tipi === "URUN" && inSel(r.tarih, r.item_id))
      : kalAll.rows,
  };
  const rows: CompactRow[] = matched.slice(0, 1500).map(toRow);

  const T = totals(prod);
  const Tp = prodPrev && !filtActive ? totals(prodPrev) : null;
  const uygunsuz = sum(kal.rows, isUygunsuzGiris);
  const kontrol = sum(kal.rows, isKontrol, true);
  const fire = sum(kal.rows, isFireUrun);

  const yanTotal = yan.rows.reduce((a, r) => a + r.qty, 0);
  const yanKinds = new Set(yan.rows.map((r) => r.partId)).size;
  const yanPrevTotal = yanPrev ? yanPrev.rows.reduce((a, r) => a + r.qty, 0) : null;

  // ── Grafik
  const packByDay = dayMap(prod.pack, (r) => r.day, (r) => r.qty);
  const manByDay: Record<string, number> = {};
  for (const r of prod.pack) manByDay[r.day] = (manByDay[r.day] ?? 0) + r.manMin;
  for (const r of prod.montaj) manByDay[r.day] = (manByDay[r.day] ?? 0) + r.manMin;
  const kdays = (pred: (r: KaliteRow) => boolean, abs = false) => {
    const m = dayMap(kal.rows.filter(pred), (r) => r.tarih, (r) => r.qty);
    if (abs) for (const k of Object.keys(m)) m[k] = Math.abs(m[k]);
    return m;
  };

  const packByHatDay: Record<string, Record<string, number>> = {};
  for (const r of prod.pack) {
    const m = (packByHatDay[r.hatId ?? "_yok"] ??= {});
    m[r.day] = (m[r.day] ?? 0) + r.qty;
  }
  const hatToplam = hatToplamlari(hatlar, packByHatDay);
  const paketColor = asamaRengi("paketleme", hatlar);

  let chart: AnalizChartProps & { title: string };
  switch (focus.chartMetric) {
    case "hat": {
      const hs = hatSerileri(hatlar, packByHatDay);
      chart = {
        title: "Hatlara göre paketlenen adet",
        type: "bar",
        xKey: "label",
        stacked: true,
        data: hs.series.length ? buildSeries(from, to, g, hs.maps) : [],
        series: hs.series,
      };
      break;
    }
    case "birim-sure": {
      const unitByDay: Record<string, number> = {};
      for (const [d, man] of Object.entries(manByDay)) {
        if (packByDay[d] > 0) unitByDay[d] = round(man / packByDay[d], 2);
      }
      chart = {
        title: "Birim süre (kişi-dk / paketlenen adet)",
        type: "line",
        xKey: "label",
        unit: " dk",
        data: buildSeries(from, to, g, { v: unitByDay }, "avg"),
        series: [{ key: "v", label: "Birim süre", color: asamaRengi("birimSure") }],
      };
      break;
    }
    case "adam-saat": {
      const h: Record<string, number> = {};
      for (const [d, m] of Object.entries(manByDay)) h[d] = m / 60;
      chart = {
        title: "Adam saat",
        type: "bar",
        xKey: "label",
        unit: " sa",
        data: buildSeries(from, to, g, { v: h }),
        series: [{ key: "v", label: "Adam saat", color: "#5e5747" }],
      };
      break;
    }
    case "uygunsuz":
      chart = {
        title: "Uygunsuz ürün girişi (adet)",
        type: "bar",
        xKey: "label",
        data: buildSeries(from, to, g, { v: kdays(isUygunsuzGiris) }),
        series: [{ key: "v", label: "Uygunsuz", color: "#ee7683" }],
      };
      break;
    case "kontrol":
      chart = {
        title: "Kontrol edilen uygunsuz ürün (adet)",
        type: "bar",
        xKey: "label",
        data: buildSeries(from, to, g, { v: kdays(isKontrol, true) }),
        series: [{ key: "v", label: "Kontrol", color: "#8d9d70" }],
      };
      break;
    case "fire":
      chart = {
        title: "Ürün fire (adet)",
        type: "bar",
        xKey: "label",
        data: buildSeries(from, to, g, { v: kdays(isFireUrun) }),
        series: [{ key: "v", label: "Fire", color: "#6f4c37" }],
      };
      break;
    default:
      chart = {
        title: "Üretim miktarı (paketlenen adet)",
        type: "bar",
        xKey: "label",
        data: buildSeries(from, to, g, { v: packByDay }),
        series: [{ key: "v", label: "Paketleme", color: paketColor }],
      };
  }
  const { title: chartTitle, ...chartProps } = chart;

  const mutedKey = (k: string) => !focus.showCard(k);
  const summaryItems: SummaryItem[] = [
    { key: "miktar", label: "Üretim Miktarı", short: "Üretim", unit: "adet", cur: T.packed, prev: Tp?.packed ?? null, muted: mutedKey("miktar"), color: paketColor },
    { key: "birim", label: "Birim Süre", short: "B.Süre", unit: "dk", lowerBetter: true, cur: T.unit === null ? null : round(T.unit, 2), prev: Tp?.unit ?? null, muted: mutedKey("birim"), color: asamaRengi("birimSure") },
    { key: "adam", label: "Adam Saat", short: "Adam sa", unit: "sa", cur: round(T.man / 60, 1), prev: Tp ? round(Tp.man / 60, 1) : null, muted: mutedKey("adam") },
    { key: "uygunsuz", label: "Uygunsuz", short: "Uygunsuz", unit: "adet", lowerBetter: true, cur: uygunsuz, prev: kalPrev && !filtActive ? sum(kalPrev.rows, isUygunsuzGiris) : null, muted: mutedKey("uygunsuz"), href: "/analiz/uretim/uygunsuz" },
    { key: "kontrol", label: "Kontrol Edilen", short: "Kontrol", unit: "adet", cur: kontrol, prev: kalPrev && !filtActive ? sum(kalPrev.rows, isKontrol, true) : null, muted: mutedKey("kontrol"), href: "/analiz/uretim/kontrol" },
    { key: "fire", label: "Fire", short: "Fire", unit: "adet", lowerBetter: true, cur: fire, prev: kalPrev && !filtActive ? sum(kalPrev.rows, isFireUrun) : null, muted: mutedKey("fire"), href: "/analiz/fire", color: asamaRengi("fire") },
    { key: "yan", label: "Yan Malzeme", short: "Yan M.", unit: "adet", cur: yanTotal, prev: yanPrevTotal, muted: mutedKey("yan") || filtActive, href: "/analiz/uretim/yan-malzeme" },
  ];
  const chartNode =
    focus.chartMetric === CHIPS[0].key ? (
      <SummaryChart
        title={`Üretim Özeti — ${period.label}`}
        items={summaryItems}
        hasPrev={hasPrev && !filtActive}
        query={periodQuery(sp)}
      />
    ) : (
      <AnalizChart {...chartProps} title={chartTitle} />
    );

  const dk = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} dk`);

  // Odak dışı / filtre altında verisi olmayan kartlar boş görünür
  const mut = (k: string, empty = false) => !focus.showCard(k) || (filtActive && empty);
  const cards = (
    <>
      <StatCard
        title="Toplam Üretim Miktarı"
        empty={mut("miktar", T.packed === 0)}
        accent={paketColor}
        value={fmtNum(T.packed)}
        subtitle={
          <>
            Paketlenen ürün (adet)
            <HatLegend compact items={hatToplam} />
          </>
        }
        delta={Tp ? deltaPct(T.packed, Tp.packed) : null}
      />
      <StatCard
        title="Birim Süre"
        accent={asamaRengi("birimSure")}
        empty={mut("birim", T.unit === null)}
        value={dk(T.unit === null ? null : round(T.unit, 2))}
        subtitle="Montaj + paketleme kişi-dk / adet"
        delta={Tp && T.unit !== null && Tp.unit !== null ? deltaPct(T.unit, Tp.unit) : null}
        inverseDelta
      />
      <StatCard
        title="Adam Saat"
        empty={mut("adam", T.man === 0)}
        value={`${fmtNum(T.man / 60, 1)} sa`}
        subtitle="Montaj + paketleme toplam"
        delta={Tp ? deltaPct(T.man, Tp.man) : null}
      />
      <StatCard
        title="Uygunsuz Ürün Miktarı"
        empty={mut("uygunsuz", uygunsuz === 0)}
        href={`/analiz/uretim/uygunsuz${qs}`}
        value={fmtNum(uygunsuz)}
        subtitle="Ayrıntı için dokunun"
      />
      <StatCard
        title="Kontrol Edilen Uygunsuz Ürün"
        empty={mut("kontrol", kontrol === 0)}
        href={`/analiz/uretim/kontrol${qs}`}
        value={fmtNum(kontrol)}
        subtitle="Ayrıntı için dokunun"
      />
      <StatCard
        title="Fire Ürün Miktarı"
        empty={mut("fire", fire === 0)}
        href={`/analiz/fire${qs}`}
        value={fmtNum(fire)}
        subtitle="Ayrıntı için dokunun"
      />
      <StatCard
        title="Yan Malzeme Kullanımı"
        empty={mut("yan", true)}
        href={`/analiz/uretim/yan-malzeme${qs}`}
        value={fmtNum(yanTotal)}
        subtitle={`${fmtNum(yanKinds)} çeşit · reçeteden teorik`}
        delta={yanPrevTotal !== null ? deltaPct(yanTotal, yanPrevTotal) : null}
      />
    </>
  );

  return (
    <AnalizLayout
      title="Üretim"
      backHref="/analiz"
      period={period}
      filterNote={filterNote(colFilters, COLS)}
      focus={focus.all ? null : { labels: focus.labels, clearKeys: focus.clearKeys }}
      chips={CHIPS}
      activeMetric={metric}
      chart={
        <>
          {chartNode}
          {focus.chartMetric === "hat" && <HatLegend title="Hatlar" items={hatToplam} />}
          {!kal.available && <p className="text-xs text-muted-foreground">Kalite verisi henüz yok</p>}
        </>
      }
      cards={cards}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      list={
        <CompactList
          title="Ürün bazlı üretim"
          showGrouping
          activeGranularity={g}
          columns={COLS}
          rows={rows}
          filterOptions={options}
          visibleColumns={focus.visibleColumns}
          dotColors={dotColors}
        />
      }
    />
  );
}
