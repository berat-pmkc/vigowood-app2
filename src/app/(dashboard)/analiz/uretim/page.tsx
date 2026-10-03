import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { bucketKey, bucketLabel, formatTrDate, resolvePeriod, type Granularity } from "@/lib/periods";
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
import { deltaPct, fmtNum, round } from "../_shared/utils";
import { getProductNames } from "../_shared/queries";
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
  safe,
  type KaliteRow,
  type ProdRows,
} from "../_shared/queries-d1";

export const metadata: Metadata = { title: "Üretim | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "miktar", label: "Üretim Miktarı" },
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
  { key: "uretim", label: "Toplam Üretim", align: "right", format: "number" },
  { key: "uyg", label: "Uygunsuz", align: "right", format: "number" },
  { key: "kon", label: "Kontrol Edilen", align: "right", format: "number" },
  { key: "fire", label: "Fire", align: "right", format: "number" },
  { key: "cikis", label: "Stoktan Çıkış", align: "right", format: "number" },
  { key: "stok", label: "Güncel Stok", align: "right", format: "number" },
  { key: "birim", label: "Birim Süre", align: "right", format: "dk" },
  { key: "perf", label: "Performans", align: "right", format: "percent" },
];
const EMPTY_PROD: ProdRows = { pack: [], montaj: [] };
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

  const [prodAll, prodPrev, kalAll, stdT, cikis, stok, names] = await Promise.all([
    safe(getProdRows(from, to), EMPTY_PROD),
    period.prevFrom && period.prevTo
      ? safe<ProdRows | null>(getProdRows(period.prevFrom, period.prevTo), EMPTY_PROD)
      : Promise.resolve<ProdRows | null>(null),
    safe(getKaliteRows(from, to), { available: false, rows: [] as KaliteRow[] }),
    safe(getStandardTimes(), EMPTY_STD),
    safe(getStokCikisRows(from, to), [] as { day: string; sku: string; qty: number }[]),
    safe(getGuncelStok(), new Map<string, number>()),
    safe(getProductNames(), new Map<string, string>()),
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
  }
  const acc = new Map<string, Acc>();
  const get = (day: string, sku: string): Acc => {
    const b = bucketKey(day, g);
    const k = `${b}|${sku}`;
    let a = acc.get(k);
    if (!a) {
      a = { bucket: b, sku, packed: 0, man: 0, earned: 0, known: 0, uyg: 0, kon: 0, fire: 0, cikis: 0 };
      acc.set(k, a);
    }
    return a;
  };
  for (const r of prodAll.pack) {
    const a = get(r.day, r.sku);
    a.packed += r.qty;
    a.man += r.manMin;
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
  const toRow = (a: Acc): CompactRow => ({
    donem: periodText(a.bucket, g),
    sku: a.sku,
    ad: names.get(a.sku) ?? a.sku,
    uretim: a.packed,
    uyg: a.uyg,
    kon: a.kon,
    fire: a.fire,
    cikis: a.cikis,
    stok: stok.get(a.sku) ?? 0,
    birim: a.packed > 0 && a.man > 0 ? round(a.man / a.packed, 2) : null,
    perf: a.known > 0 ? round((a.earned / a.known) * 100, 1) : null,
  });

  // ── Kolon filtreleri: kart + grafik + liste eşleşen (kova × ürün) kayıtlarından türer
  const colFilters = parseColumnFilters(sp, COLS);
  const filtActive = hasActiveFilters(colFilters);
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

  let chart: AnalizChartProps & { title: string };
  switch (metric) {
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
        series: [{ key: "v", label: "Birim süre", color: "#3368b1" }],
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
        series: [{ key: "v", label: "Adam saat", color: "#f28a19" }],
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
        series: [{ key: "v", label: "Paketleme", color: "#cdbd9d" }],
      };
  }
  const { title: chartTitle, ...chartProps } = chart;

  const dk = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} dk`);

  // Filtre aktifken anlamlı verisi olmayan kartlar gizlenir
  const hide = (empty: boolean) => filtActive && empty;
  const cards = (
    <>
      {!hide(T.packed === 0) && (
        <StatCard
          title="Toplam Üretim Miktarı"
          value={fmtNum(T.packed)}
          subtitle="Paketlenen ürün (adet)"
          delta={Tp ? deltaPct(T.packed, Tp.packed) : null}
        />
      )}
      {!hide(T.unit === null) && (
        <StatCard
          title="Birim Süre"
          value={dk(T.unit === null ? null : round(T.unit, 2))}
          subtitle="Montaj + paketleme kişi-dk / adet"
          delta={Tp && T.unit !== null && Tp.unit !== null ? deltaPct(T.unit, Tp.unit) : null}
          inverseDelta
        />
      )}
      {!hide(T.man === 0) && (
        <StatCard
          title="Adam Saat"
          value={`${fmtNum(T.man / 60, 1)} sa`}
          subtitle="Montaj + paketleme toplam"
          delta={Tp ? deltaPct(T.man, Tp.man) : null}
        />
      )}
      {!hide(uygunsuz === 0) && (
        <StatCard
          title="Uygunsuz Ürün Miktarı"
          href={`/analiz/uretim/uygunsuz${qs}`}
          value={fmtNum(uygunsuz)}
          subtitle="Ayrıntı için dokunun"
        />
      )}
      {!hide(kontrol === 0) && (
        <StatCard
          title="Kontrol Edilen Uygunsuz Ürün"
          href={`/analiz/uretim/kontrol${qs}`}
          value={fmtNum(kontrol)}
          subtitle="Ayrıntı için dokunun"
        />
      )}
      {!hide(fire === 0) && (
        <StatCard
          title="Fire Ürün Miktarı"
          href={`/analiz/fire${qs}`}
          value={fmtNum(fire)}
          subtitle="Ayrıntı için dokunun"
        />
      )}
    </>
  );

  return (
    <AnalizLayout
      title="Üretim"
      backHref="/analiz"
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
          title="Ürün bazlı üretim"
          showGrouping
          activeGranularity={g}
          columns={COLS}
          rows={rows}
          filterOptions={options}
        />
      }
    />
  );
}
