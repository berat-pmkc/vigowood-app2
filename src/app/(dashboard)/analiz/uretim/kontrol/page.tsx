import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { formatTrDate, resolvePeriod } from "@/lib/periods";
import { AnalizLayout } from "../../_shared/analiz-layout";
import { AnalizChart } from "../../_shared/analiz-chart";
import type { MetricChip } from "../../_shared/metric-chips";
import { StatCard } from "../../_shared/stat-card";
import { CompactList, type CompactRow } from "../../_shared/compact-list";
import { buildSeries, resolveGranularity } from "../../_shared/series";
import { fmtNum } from "../../_shared/utils";
import {
  getKaliteRows,
  getUygunsuzBakiye,
  isKontrol,
  kontrolKarar,
  safe,
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

const KARAR_LABEL = { uygun: "Uygun", sokum: "Söküm", fire: "Fire", diger: "Diğer" } as const;
type SP = Record<string, string | string[] | undefined>;

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

  const kontrol = kal.rows.filter(isKontrol);
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
    .map((r) => ({
      tarih: r.tarih ? formatTrDate(r.tarih) : "—",
      sku: r.item_id,
      ad: r.item_adi ?? r.item_id,
      karar: KARAR_LABEL[kontrolKarar(r.islem)],
      qty: Math.abs(r.qty),
      personel: r.operator_name ?? "—",
    }));

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
  const sokumRows: CompactRow[] = [...sokumAcc.values()]
    .sort((a, b) => b.saglam + b.fire - (a.saglam + a.fire))
    .map((a) => ({ kod: a.id, ad: a.ad, saglam: a.saglam, fire: a.fire }));

  const cards = (
    <>
      <StatCard title="Uygun'a Dönen" value={fmtNum(qtyOf("uygun"))} subtitle="Satılabilir stoğa geri alınan" />
      <StatCard title="Söküme Giden" value={fmtNum(qtyOf("sokum"))} subtitle="Parçalarına ayrılan" />
      <StatCard title="Fire'ye Ayrılan" value={fmtNum(qtyOf("fire"))} subtitle="Fire stoğuna alınan" />
      <StatCard title="Bekleyen Uygunsuz Bakiye" value={fmtNum(bakiye)} subtitle="Şu an kontrol bekleyen (tüm zamanlar)" />
    </>
  );

  return (
    <AnalizLayout
      title="Kontrol Edilen Uygunsuz Ürünler"
      backHref="/analiz/uretim"
      period={period}
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
            columns={[
              { key: "tarih", label: "Tarih" },
              { key: "sku", label: "Ürün Kodu" },
              { key: "ad", label: "Ürün Adı" },
              { key: "karar", label: "Karar" },
              { key: "qty", label: "Miktar", align: "right", format: "number" },
              { key: "personel", label: "Personel" },
            ]}
            rows={rows}
          />
          {sokumRows.length > 0 && (
            <CompactList
              title="Söküm sonucu yarı mamuller"
              columns={[
                { key: "kod", label: "Parça Kodu" },
                { key: "ad", label: "Parça Adı" },
                { key: "saglam", label: "Sağlam", align: "right", format: "number" },
                { key: "fire", label: "Fire", align: "right", format: "number" },
              ]}
              rows={sokumRows}
            />
          )}
        </div>
      }
    />
  );
}
