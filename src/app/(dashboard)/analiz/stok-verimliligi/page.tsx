import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { resolvePeriod } from "@/lib/periods";
import { AnalizLayout } from "../_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "../_shared/analiz-chart";
import type { MetricChip } from "../_shared/metric-chips";
import { StatCard } from "../_shared/stat-card";
import { CompactList, type CompactRow } from "../_shared/compact-list";
import { buildSeries, resolveGranularity } from "../_shared/series";
import { getStokVerimlilikDetay, safe, type StokVerimlilikDetay } from "../_shared/queries-d2";

export const metadata: Metadata = { title: "Stok Verimliliği | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "genel", label: "Genel" },
  { key: "kritik-alti", label: "Kritik Altı" },
  { key: "asiri", label: "Aşırı Stok" },
  { key: "urun", label: "Ürün Bazlı" },
];

type SP = Record<string, string | string[] | undefined>;

const EMPTY: StokVerimlilikDetay = {
  overallPct: null,
  scoreByDay: {},
  belowByDay: {},
  aboveByDay: {},
  belowDayPct: null,
  aboveDayPct: null,
  currentBelow: 0,
  activeCount: 0,
  products: [],
  altPct: 0,
  ustPct: 100,
};

const pct = (v: number | null) => (v === null ? "—" : `%${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`);
const trunc = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

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

  const d = await safe(getStokVerimlilikDetay(from, to), EMPTY);

  let chart: AnalizChartProps & { title: string };
  switch (metric) {
    case "kritik-alti":
      chart = {
        title: "Kritik altındaki ürün oranı (%)",
        type: "area",
        xKey: "label",
        unit: "%",
        data: buildSeries(from, to, g, { v: d.belowByDay }, "avg"),
        series: [{ key: "v", label: "Kritik altı", color: "#ee7683" }],
      };
      break;
    case "asiri":
      chart = {
        title: "Aşırı stoktaki ürün oranı (%)",
        type: "area",
        xKey: "label",
        unit: "%",
        data: buildSeries(from, to, g, { v: d.aboveByDay }, "avg"),
        series: [{ key: "v", label: "Aşırı stok", color: "#f28a19" }],
      };
      break;
    case "urun":
      chart = {
        title: "En düşük verimli 10 ürün (%)",
        type: "bar",
        layout: "vertical",
        xKey: "label",
        unit: "%",
        data: d.products.slice(0, 10).map((p) => ({ label: trunc(`${p.sku} ${p.name}`), v: p.score })),
        series: [{ key: "v", label: "Verim", color: "#70c1aa" }],
      };
      break;
    default:
      chart = {
        title: "Genel stok verimliliği (%)",
        type: "area",
        xKey: "label",
        unit: "%",
        data: buildSeries(from, to, g, { v: d.scoreByDay }, "avg"),
        series: [{ key: "v", label: "Verim", color: "#70c1aa" }],
      };
  }
  const { title, ...chartProps } = chart;

  const rows: CompactRow[] = [...d.products]
    .sort((a, b) => a.score - b.score)
    .map((p) => ({
      sku: p.sku,
      ad: p.name,
      kritik: p.kritik,
      guncel: p.current,
      ort: p.avg,
      alt: p.belowDays,
      ust: p.aboveDays,
      verim: p.score,
    }));

  const cards = (
    <>
      <StatCard title="Genel Verim" value={pct(d.overallPct)} subtitle={`${d.activeCount} ürün, gün skoru ortalaması`} />
      <StatCard
        title="Kritik Altında Geçen Gün Oranı"
        value={pct(d.belowDayPct)}
        subtitle="Ürün-gün bazında"
      />
      <StatCard title="Aşırı Stokta Geçen Gün Oranı" value={pct(d.aboveDayPct)} subtitle="Ürün-gün bazında" />
      <StatCard
        title="Şu An Kritik Altı Ürün"
        value={d.currentBelow.toLocaleString("tr-TR")}
        subtitle={`${d.activeCount} aktif ürün içinde`}
      />
    </>
  );

  const list = (
    <CompactList
      title="Ürün Bazlı Stok Verimliliği"
      columns={[
        { key: "sku", label: "Ürün Kodu" },
        { key: "ad", label: "Ürün Adı" },
        { key: "kritik", label: "Kritik", align: "right", format: "number" },
        { key: "guncel", label: "Güncel Stok", align: "right", format: "number" },
        { key: "ort", label: "Ort. Stok", align: "right", format: "number" },
        { key: "alt", label: "Kritik Altı Gün", align: "right", format: "number" },
        { key: "ust", label: "Aşırı Gün", align: "right", format: "number" },
        { key: "verim", label: "Verim %", align: "right", format: "percent" },
      ]}
      rows={rows}
    />
  );

  const note = (
    <div className="rounded-xl border border-[#a99c7d]/30 bg-[#f0ede1]/60 p-4 text-xs text-[#5e5747]">
      <h3 className="mb-1.5 text-sm font-semibold text-[#474237]">Hesaplama Notu</h3>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          Her aktif ve kritik stok seviyesi tanımlı ürün için günlük bakiye, güncel stoktan geriye doğru stok
          hareketleri çıkarılarak yeniden kurulur. Gün skoru: stok {`[kritik, kritik × ${1 + d.ustPct / 100}]`}{" "}
          bandındaysa 100; kritiğin altındaysa bakiye ÷ kritik × 100 (en az 0); üst sınırın üstündeyse üst sınır ÷
          bakiye × 100.
        </li>
        <li>Ürün skoru, dönemdeki gün skorlarının ortalamasıdır; genel verim ürün skorlarının ortalamasıdır.</li>
        <li>
          Toleranslar ayarlanabilir: şu an alt tolerans %{d.altPct}, üst tolerans %{d.ustPct} (varsayılan: 0 / 100;
          ayar anahtarı <code>stok_verimlilik</code>). Daha sonra bu değerler ayarlardan değiştirilebilecek.
        </li>
        <li>
          Kritik stok seviyesinin geçmişi saklanmadığı için tüm günlerde ürünün güncel kritik değeri kullanılır.
          &ldquo;Tümü&rdquo; dönemi son 90 günü kapsar.
        </li>
      </ul>
    </div>
  );

  return (
    <AnalizLayout
      title="Stok Verimliliği"
      backHref="/analiz"
      period={period}
      chips={CHIPS}
      activeMetric={metric}
      chart={<AnalizChart {...chartProps} title={title} />}
      cards={cards}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      list={
        <div className="space-y-4">
          {list}
          {note}
        </div>
      }
    />
  );
}
