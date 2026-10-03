import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { resolvePeriod } from "@/lib/periods";
import { AnalizLayout } from "../_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "../_shared/analiz-chart";
import type { MetricChip } from "../_shared/metric-chips";
import { StatCard } from "../_shared/stat-card";
import { CompactList, type CompactRow } from "../_shared/compact-list";
import { resolveGranularity, buildSeries } from "../_shared/series";
import { fmtNum, round } from "../_shared/utils";
import { getBirimSure, getProductNames, type BirimSureData } from "../_shared/queries";
import { getStandardTimes, type StandardTimes } from "../_shared/performance";
import { getPaketlemeBySku, safe } from "../_shared/queries-d2";

export const metadata: Metadata = { title: "Çalışma Birim Süresi | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "montaj", label: "Montaj" },
  { key: "paketleme", label: "Paketleme" },
  { key: "adim", label: "Adım Bazlı" },
  { key: "urun", label: "Ürün Bazlı" },
];

type SP = Record<string, string | string[] | undefined>;

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

  const [birim, std, pack, names] = await Promise.all([
    safe(getBirimSure(from, to), EMPTY_BIRIM),
    safe(getStandardTimes(), EMPTY_STD),
    safe(getPaketlemeBySku(from, to), [] as { sku: string; qty: number; avgDk: number }[]),
    safe(getProductNames(), new Map<string, string>()),
  ]);

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

  // Kartlar: en yavaş / en hızlı adım (kendi standardına göre fark %)
  const comparable = stepRows.filter((r) => r.fark !== null && r.qty >= 5);
  const pool = comparable.length ? comparable : stepRows.filter((r) => r.fark !== null);
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
  if (metric === "paketleme") {
    chart = {
      title: "Paketleme birim süresi (dk / adet)",
      type: "line",
      xKey: "label",
      unit: " dk",
      data: buildSeries(from, to, g, { v: birim.paketlemeByDay }, "avg"),
      series: [{ key: "v", label: "Paketleme", color: "#3368b1" }],
    };
  } else if (metric === "adim") {
    chart = {
      title: "En yavaş 10 adım (dk / adet) ve standartları",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      unit: " dk",
      data: [...stepRows]
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10)
        .map((r) => ({ label: trunc(r.label), avg: r.avg, std: r.std })),
      series: [
        { key: "avg", label: "Ortalama", color: "#8d9d70" },
        { key: "std", label: "Standart", color: "#adb5be" },
      ],
    };
  } else if (metric === "urun") {
    chart = {
      title: "En yavaş 10 ürün — paketleme (dk / adet) ve standartları",
      type: "bar",
      layout: "vertical",
      xKey: "label",
      unit: " dk",
      data: [...urunRows]
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10)
        .map((r) => ({ label: trunc(r.label), avg: r.avg, std: r.std })),
      series: [
        { key: "avg", label: "Ortalama", color: "#3368b1" },
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
      series: [{ key: "v", label: "Montaj", color: "#8d9d70" }],
    };
  }
  const { title, ...chartProps } = chart;

  const listIsUrun = metric === "urun" || metric === "paketleme";
  const listRows: CompactRow[] = (listIsUrun ? urunRows : stepRows)
    .sort((a, b) => b.qty - a.qty)
    .map((r) => ({ ad: r.label, adet: round(r.qty, 0), avg: r.avg, std: r.std, fark: r.fark }));

  const cards = (
    <>
      <StatCard title="Montaj Birim Süre" value={dk(birim.montajAvg)} subtitle="dk / adet, adet ağırlıklı" />
      <StatCard title="Paketleme Birim Süre" value={dk(birim.paketlemeAvg)} subtitle="dk / adet, adet ağırlıklı" />
      <StatCard title="En Yavaş Adım" value={slowCard.value} subtitle={slowCard.subtitle} />
      <StatCard title="En Hızlı Adım" value={fastCard.value} subtitle={fastCard.subtitle} />
    </>
  );

  const list = (
    <div className="space-y-1">
      <CompactList
        title={listIsUrun ? "Ürün Bazlı Birim Süre (Paketleme)" : "Adım Bazlı Birim Süre (Montaj)"}
        columns={[
          { key: "ad", label: listIsUrun ? "Ürün" : "Adım" },
          { key: "adet", label: "Adet", align: "right", format: "number" },
          { key: "avg", label: "Birim Süre", align: "right", format: "dk" },
          { key: "std", label: "Standart Süre", align: "right", format: "dk" },
          { key: "fark", label: "Fark %", align: "right", format: "percent" },
        ]}
        rows={listRows}
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
      chips={CHIPS}
      activeMetric={metric}
      chart={<AnalizChart {...chartProps} title={title} />}
      cards={cards}
      list={list}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    />
  );
}
