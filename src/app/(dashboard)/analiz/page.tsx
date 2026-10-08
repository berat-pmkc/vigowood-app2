import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { resolvePeriod, type ResolvedPeriod } from "@/lib/periods";
import { AnalizLayout } from "./_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "./_shared/analiz-chart";
import type { MetricChip } from "./_shared/metric-chips";
import { SummaryChart, type SummaryItem } from "./_shared/summary-chart";
import { StatCard, StatSlot } from "./_shared/stat-card";
import { buildSeries, resolveGranularity } from "./_shared/series";
import { deltaPct, fmtNum, round } from "./_shared/utils";
import {
  getBirimSure,
  getKalite,
  getKesim,
  getMontaj,
  getProductNames,
  getStokCikis,
  getStokVerimlilik,
  getUretim,
  type BirimSureData,
  type KaliteData,
  type KesimData,
  type MontajData,
  type StokVerimlilikData,
  type UretimData,
} from "./_shared/queries";
import { resolveFocus, type FocusMap } from "./_shared/focus";
import { asamaRengi } from "@/lib/talimat/hat-renk";
import type { TalimatHat } from "@/lib/talimat/types";
import { getAnalizHatlar, hatToplamlari } from "./_shared/hat-data";
import { HatLegend } from "./_shared/hat-legend";
import { computePerformance, type PerformanceData } from "./_shared/performance";

export const metadata: Metadata = { title: "Analiz" };
export const revalidate = 30;

/** Chip noktaları aşama renkleriyle (hat paletinden) gelir */
const chipsFor = (hatlar: TalimatHat[]): MetricChip[] => [
  { key: "ozet", label: "Özet" },
  { key: "uretim", label: "Üretim", color: asamaRengi("paketleme", hatlar) },
  { key: "montaj", label: "Montaj", color: asamaRengi("montaj", hatlar) },
  { key: "kesim", label: "Kesim", color: asamaRengi("kesim") },
  { key: "en-cok-satan", label: "En Çok Satan Ürünler" },
  { key: "satisi-dusen", label: "Satışı Düşen Ürünler" },
  { key: "stok-verimliligi", label: "Stok Verimliliği", color: asamaRengi("stok") },
  { key: "birim-sure", label: "Çalışma Birim Süresi", color: asamaRengi("birimSure") },
  { key: "personel", label: "Personel Verimliliği", color: asamaRengi("personel") },
];

const FOCUS: FocusMap = {
  defaultChip: "ozet",
  chips: {
    uretim: { cards: ["uretim"], cols: [] },
    montaj: { cards: ["montaj"], cols: [] },
    kesim: { cards: ["kesim"], cols: [] },
    "en-cok-satan": { cards: [], cols: [] },
    "satisi-dusen": { cards: [], cols: [] },
    "stok-verimliligi": { cards: ["stok"], cols: [] },
    "birim-sure": { cards: ["birim-sure"], cols: [] },
    personel: { cards: ["personel"], cols: [] },
  },
  cols: {},
};

type SP = Record<string, string | string[] | undefined>;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    console.error("[analiz]", e);
    return fallback;
  }
}

const EMPTY_URETIM: UretimData = { total: 0, byDay: {}, bySku: {}, byHatDay: {} };
const EMPTY_MONTAJ: MontajData = { total: 0, finalTotal: 0, sessions: 0, byDay: {}, byStep: {}, byHatDay: {} };
const EMPTY_KESIM: KesimData = { plates: 0, parts: 0, platesByDay: {}, partsByDay: {} };
const EMPTY_BIRIM: BirimSureData = {
  montajAvg: null,
  paketlemeAvg: null,
  montajByDay: {},
  paketlemeByDay: {},
  byStep: [],
};
const EMPTY_STOK: StokVerimlilikData = { overallPct: null, byDay: {}, activeCount: 0, below: 0, above: 0 };
const EMPTY_KALITE: KaliteData = { available: false, fire: { urun: 0, yariMamul: 0, plaka: 0, total: 0 } };
const EMPTY_PERF: PerformanceData = { overallPct: null, people: [], stepStandards: [] };

/** Önceki dönem yoksa (Tümü) sorgu atma */
function prevOf<T>(p: ResolvedPeriod, fn: (f: string, t: string) => Promise<T>, fallback: T): Promise<T | null> {
  if (!p.prevFrom || !p.prevTo) return Promise.resolve(null);
  return safe(fn(p.prevFrom, p.prevTo), fallback);
}

const trunc = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function buildChart(
  metric: string,
  period: ResolvedPeriod,
  sp: SP,
  d: {
    uretim: UretimData;
    montaj: MontajData;
    kesim: KesimData;
    birim: BirimSureData;
    stok: StokVerimlilikData;
    perf: PerformanceData;
    hatlar: TalimatHat[];
  },
): Promise<AnalizChartProps & { title: string }> {
  const { from, to } = period;
  const g = resolveGranularity(sp.g, from, to);

  switch (metric) {
    case "montaj":
      return {
        title: "Montaj (adım adedi)",
        type: "bar",
        xKey: "label",
        data: buildSeries(from, to, g, { v: d.montaj.byDay }),
        series: [{ key: "v", label: "Montaj", color: asamaRengi("montaj", d.hatlar) }],
      };
    case "kesim":
      return {
        title: "Kesim",
        type: "composed",
        xKey: "label",
        data: buildSeries(from, to, g, { plates: d.kesim.platesByDay, parts: d.kesim.partsByDay }),
        series: [
          { key: "plates", label: "Plaka", color: asamaRengi("kesim"), type: "bar", yAxisId: "left" },
          { key: "parts", label: "Parça", color: "#5e5747", type: "line", yAxisId: "right" },
        ],
      };
    case "en-cok-satan": {
      const [cikis, names] = await Promise.all([
        safe(getStokCikis(from, to), { total: 0, bySku: {}, byDay: {} }),
        safe(getProductNames(), new Map<string, string>()),
      ]);
      const top = Object.entries(cikis.bySku)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([sku, qty]) => ({ label: trunc(names.get(sku) ?? sku), qty }));
      return {
        title: "En çok satan 10 ürün (stok çıkışı, adet)",
        type: "bar",
        layout: "vertical",
        xKey: "label",
        data: top,
        series: [{ key: "qty", label: "Adet", color: "#0c1c2d" }],
      };
    }
    case "satisi-dusen": {
      if (!period.prevFrom || !period.prevTo) {
        return { title: "Satışı düşen ürünler", xKey: "label", data: [], series: [], emptyText: "Tüm zamanlar için karşılaştırma yok" };
      }
      const [cur, prev, names] = await Promise.all([
        safe(getStokCikis(from, to), { total: 0, bySku: {}, byDay: {} }),
        safe(getStokCikis(period.prevFrom, period.prevTo), { total: 0, bySku: {}, byDay: {} }),
        safe(getProductNames(), new Map<string, string>()),
      ]);
      const rows = Object.entries(prev.bySku)
        .filter(([, p]) => p >= 5)
        .map(([sku, p]) => {
          const c = cur.bySku[sku] ?? 0;
          return { label: trunc(names.get(sku) ?? sku), pct: round(((c - p) / p) * 100, 1) };
        })
        .filter((r) => r.pct < 0)
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 10);
      return {
        title: "Satışı düşen ürünler (önceki döneme göre değişim %)",
        type: "bar",
        layout: "vertical",
        xKey: "label",
        unit: "%",
        data: rows,
        series: [{ key: "pct", label: "Değişim", color: "#ee7683" }],
        emptyText: "Düşüş gösteren ürün yok",
      };
    }
    case "stok-verimliligi":
      return {
        title: "Stok verimliliği (kritik – 2×kritik bandındaki ürün %)",
        type: "area",
        xKey: "label",
        unit: "%",
        data: buildSeries(from, to, g, { pct: d.stok.byDay }, "avg"),
        series: [{ key: "pct", label: "Verimlilik", color: asamaRengi("stok") }],
      };
    case "birim-sure":
      return {
        title: "Çalışma birim süresi (kişi-dk / adet)",
        type: "line",
        xKey: "label",
        unit: " dk",
        data: buildSeries(from, to, g, { montaj: d.birim.montajByDay, paketleme: d.birim.paketlemeByDay }, "avg"),
        series: [
          { key: "montaj", label: "Montaj", color: asamaRengi("montaj", d.hatlar) },
          { key: "paketleme", label: "Paketleme", color: asamaRengi("paketleme", d.hatlar) },
        ],
      };
    case "personel":
      return {
        title: "Personel verimliliği (ilk 10, %)",
        type: "bar",
        layout: "vertical",
        xKey: "label",
        unit: "%",
        data: d.perf.people.slice(0, 10).map((p) => ({ label: trunc(p.name), pct: p.pct })),
        series: [{ key: "pct", label: "Performans", color: asamaRengi("personel") }],
      };
    case "uretim":
    default:
      return {
        title: "Üretim (paketlenen adet)",
        type: "bar",
        xKey: "label",
        data: buildSeries(from, to, g, { v: d.uretim.byDay }),
        series: [{ key: "v", label: "Paketleme", color: asamaRengi("paketleme", d.hatlar) }],
      };
  }
}

export default async function AnalizPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (![...ADMIN_ROLES, ...OFFICE_ROLES].includes(user.role)) redirect("/");

  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const { from, to } = period;
  const metricRaw = Array.isArray(sp.m) ? sp.m[0] : sp.m;

  const hatlar = await getAnalizHatlar();
  const CHIPS = chipsFor(hatlar);
  const metric = CHIPS.some((c) => c.key === metricRaw) ? (metricRaw as string) : CHIPS[0].key;
  const isOzet = metric === "ozet";
  const focus = resolveFocus(FOCUS, metric, {}, [], CHIPS);
  const mut = (k: string) => !focus.showCard(k);
  const [uretim, uretimPrev, montaj, montajPrev, kesim, kesimPrev, birim, stok, perf, kalite, birimPrev, stokPrev, perfPrev, kalitePrev] = await Promise.all([
    safe(getUretim(from, to), EMPTY_URETIM),
    prevOf(period, getUretim, EMPTY_URETIM),
    safe(getMontaj(from, to), EMPTY_MONTAJ),
    prevOf(period, getMontaj, EMPTY_MONTAJ),
    safe(getKesim(from, to), EMPTY_KESIM),
    prevOf(period, getKesim, EMPTY_KESIM),
    safe(getBirimSure(from, to), EMPTY_BIRIM),
    safe(getStokVerimlilik(from, to), EMPTY_STOK),
    safe(computePerformance(from, to), EMPTY_PERF),
    safe(getKalite(from, to), EMPTY_KALITE),
    // Önceki dönem değerleri yalnızca Özet grafiği için gerekli
    isOzet ? prevOf(period, getBirimSure, EMPTY_BIRIM) : Promise.resolve(null),
    isOzet ? prevOf(period, getStokVerimlilik, EMPTY_STOK) : Promise.resolve(null),
    isOzet ? prevOf(period, computePerformance, EMPTY_PERF) : Promise.resolve(null),
    isOzet ? prevOf(period, getKalite, EMPTY_KALITE) : Promise.resolve(null),
  ]);

  let chartNode: React.ReactNode;
  if (isOzet) {
    const hasPrev = !!period.prevFrom && !!period.prevTo;
    const items: SummaryItem[] = [
      { key: "uretim", label: "Üretim", short: "Üretim", href: "/analiz/uretim", unit: "adet", cur: uretim.total, prev: uretimPrev?.total ?? null, color: asamaRengi("paketleme", hatlar) },
      { key: "montaj", label: "Montaj", short: "Montaj", href: "/analiz/montaj", unit: "adet", cur: montaj.total, prev: montajPrev?.total ?? null, color: asamaRengi("montaj", hatlar) },
      { key: "kesim", label: "Kesim", short: "Kesim", href: "/analiz/kesim", unit: "plaka", cur: kesim.plates, prev: kesimPrev?.plates ?? null, color: asamaRengi("kesim") },
      { key: "birim-sure", label: "Birim Süre", short: "B.Süre", href: "/analiz/birim-sure", unit: "dk", lowerBetter: true, cur: birim.montajAvg, prev: birimPrev?.montajAvg ?? null, color: asamaRengi("birimSure") },
      { key: "stok", label: "Stok Verimliliği", short: "Stok V.", href: "/analiz/stok-verimliligi", unit: "%", cur: stok.overallPct, prev: stokPrev?.overallPct ?? null, color: asamaRengi("stok") },
      { key: "personel", label: "Personel Performans", short: "Perf.", href: "/analiz/personel", unit: "%", cur: perf.overallPct, prev: perfPrev?.overallPct ?? null, color: asamaRengi("personel") },
      { key: "fire", label: "Fire", short: "Fire", href: "/analiz/fire", unit: "adet", lowerBetter: true, cur: kalite.fire.total, prev: kalitePrev?.fire.total ?? null, color: asamaRengi("fire") },
    ];
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (k === "m" || v === undefined) continue;
      for (const x of Array.isArray(v) ? v : [v]) qs.append(k, x);
    }
    chartNode = <SummaryChart title={`Dönem Özeti — ${period.label}`} items={items} hasPrev={hasPrev} query={qs.toString()} />;
  } else {
    const { title: chartTitle, ...chartProps } = await buildChart(metric, period, sp, {
      uretim,
      montaj,
      kesim,
      birim,
      stok,
      perf,
      hatlar,
    });
    chartNode = <AnalizChart {...chartProps} title={chartTitle} />;
  }

  const dk = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} dk`);

  const cards = (
    <>
      <StatCard
        title="Üretim"
        empty={mut("uretim")}
        href="/analiz/uretim"
        accent={asamaRengi("paketleme", hatlar)}
        value={fmtNum(uretim.total)}
        subtitle={
          <>
            Paketlenen ürün (adet)
            <HatLegend compact items={hatToplamlari(hatlar, uretim.byHatDay)} />
          </>
        }
        delta={uretimPrev ? deltaPct(uretim.total, uretimPrev.total) : null}
      />
      <StatCard
        title="Montaj"
        empty={mut("montaj")}
        href="/analiz/montaj"
        accent={asamaRengi("montaj", hatlar)}
        value={fmtNum(montaj.total)}
        subtitle={
          <>
            {fmtNum(montaj.sessions)} seans · son adım {fmtNum(montaj.finalTotal)} adet
            <HatLegend compact items={hatToplamlari(hatlar, montaj.byHatDay)} />
          </>
        }
        delta={montajPrev ? deltaPct(montaj.total, montajPrev.total) : null}
      />
      <StatCard
        title="Kesim"
        empty={mut("kesim")}
        href="/analiz/kesim"
        accent={asamaRengi("kesim")}
        value={`${fmtNum(kesim.plates)} plaka`}
        subtitle={`${fmtNum(kesim.parts)} parça`}
        delta={kesimPrev ? deltaPct(kesim.plates, kesimPrev.plates) : null}
      />
      <StatCard
        title="Birim Süre"
        empty={mut("birim-sure")}
        href="/analiz/birim-sure"
        accent={asamaRengi("birimSure")}
        topLeft={<StatSlot label="Montaj" value={dk(birim.montajAvg)} small color={asamaRengi("montaj", hatlar)} />}
        topRight={<StatSlot label="Paketleme" value={dk(birim.paketlemeAvg)} small color={asamaRengi("paketleme", hatlar)} />}
        subtitle="Kişi-dk / adet (adet ağırlıklı ortalama)"
      />
      <StatCard
        title="Stok Verimliliği"
        empty={mut("stok")}
        href="/analiz/stok-verimliligi"
        accent={asamaRengi("stok")}
        value={stok.overallPct === null ? "—" : `%${stok.overallPct.toLocaleString("tr-TR")}`}
        subtitle={
          stok.activeCount
            ? `${stok.activeCount} üründen kritik altı ${stok.below}, 2×kritik üstü ${stok.above}`
            : "Kritik seviyesi tanımlı ürün yok"
        }
      />
      <StatCard
        title="Personel Performans"
        empty={mut("personel")}
        href="/analiz/personel"
        accent={asamaRengi("personel")}
        topLeft={
          <StatSlot label="Genel" value={perf.overallPct === null ? "—" : `%${perf.overallPct.toLocaleString("tr-TR")}`} />
        }
        topRight={
          <div className="space-y-0.5 text-right">
            {perf.stepStandards.slice(0, 3).map((s) => (
              <div key={s.stepId} className="text-[11px] text-[#5e5747]">
                <span className="text-muted-foreground">{s.stepId}</span>{" "}
                <span className="font-semibold">{s.stdDk.toLocaleString("tr-TR")} dk/adet</span>
              </div>
            ))}
          </div>
        }
        subtitle={`${perf.people.length} kişi`}
      />
      <StatCard
        title="Fire"
        empty={mut("fire")}
        href="/analiz/fire"
        accent={asamaRengi("fire")}
        topLeft={<StatSlot label="Ürün" value={fmtNum(kalite.fire.urun)} />}
        topCenter={<StatSlot label="Yarı Mamul" value={fmtNum(kalite.fire.yariMamul)} />}
        topRight={<StatSlot label="Plaka" value={fmtNum(kalite.fire.plaka)} />}
        subtitle={kalite.available ? "Kalite kayıtlarından" : "Kalite kayıtları henüz yok"}
      />
    </>
  );

  return (
    <AnalizLayout
      title="Analiz"
      period={period}
      chips={CHIPS}
      activeMetric={metric}
      chart={chartNode}
      cards={cards}
      focus={focus.all ? null : { labels: focus.labels, clearKeys: focus.clearKeys }}
    />
  );
}
