import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { formatTrDate, resolvePeriod } from "@/lib/periods";
import { AnalizLayout } from "../_shared/analiz-layout";
import { AnalizChart, type AnalizChartProps } from "../_shared/analiz-chart";
import type { MetricChip } from "../_shared/metric-chips";
import { StatCard } from "../_shared/stat-card";
import { CompactList, type CompactRow } from "../_shared/compact-list";
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

  const fires = kal.rows;
  const sumTip = (t: string) => fires.filter((r) => r.item_tipi === t).reduce((a, r) => a + r.qty, 0);
  const urunFire = sumTip("URUN");
  const rate = uretim.total > 0 ? round((urunFire / uretim.total) * 100, 2) : null;

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
  const fireSkus = new Set(itemList.filter((i) => i.tip === "URUN" && i.qty > 0).map((i) => i.id));
  const firesiz = Object.entries(uretim.bySku)
    .filter(([sku, q]) => q > 0 && aktif.has(sku) && !fireSkus.has(sku))
    .map(([sku, q]) => ({ sku, ad: aktif.get(sku) ?? sku, qty: q }))
    .sort((a, b) => b.qty - a.qty);

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
  const rows: CompactRow[] = fires
    .filter((r) => !tipFilter || r.item_tipi === tipFilter)
    .sort((a, b) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : 0))
    .map((r) => ({
      tarih: r.tarih ? formatTrDate(r.tarih) : "—",
      tip: TIP_LABELS[r.item_tipi] ?? r.item_tipi,
      kod: r.item_id,
      ad: r.item_adi ?? r.item_id,
      kaynak: kaynakLabel(r.kaynak),
      qty: r.qty,
      personel: r.operator_name ?? "—",
    }));

  const list =
    metric === "firesiz" ? (
      <CompactList
        title="Firesiz ürünler (dönemde üretilen, fire kaydı olmayan)"
        columns={[
          { key: "kod", label: "Ürün Kodu" },
          { key: "ad", label: "Ürün Adı" },
          { key: "qty", label: "Üretim", align: "right", format: "number" },
        ]}
        rows={firesiz.map((a) => ({ kod: a.sku, ad: a.ad, qty: a.qty }))}
        emptyText="Firesiz ürün yok"
      />
    ) : (
      <CompactList
        title="Fire kayıtları"
        columns={[
          { key: "tarih", label: "Tarih" },
          { key: "tip", label: "Tip" },
          { key: "kod", label: "Kod" },
          { key: "ad", label: "Ad" },
          { key: "kaynak", label: "Kaynak" },
          { key: "qty", label: "Miktar", align: "right", format: "number" },
          { key: "personel", label: "Personel" },
        ]}
        rows={rows}
      />
    );

  const cards = (
    <>
      <StatCard title="Ürün Firesi" value={fmtNum(urunFire)} subtitle="Adet" />
      <StatCard title="Yarı Mamul Firesi" value={fmtNum(sumTip("YARI_MAMUL"))} subtitle="Adet" />
      <StatCard title="Plaka Firesi" value={fmtNum(sumTip("PLAKA"))} subtitle="Adet" />
      <StatCard
        title="Fire Oranı"
        value={rate === null ? "—" : `%${rate.toLocaleString("tr-TR")}`}
        subtitle={`Ürün firesi / üretim (${fmtNum(uretim.total)} adet)`}
      />
    </>
  );

  return (
    <AnalizLayout
      title="Fire"
      backHref="/analiz"
      period={period}
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
