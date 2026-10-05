import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ADMIN_ROLES, OFFICE_ROLES, getCurrentUser } from "@/lib/auth";
import { resolvePeriod } from "@/lib/periods";
import { AnalizLayout } from "../_shared/analiz-layout";
import { AnalizChart } from "../_shared/analiz-chart";
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
import { resolveFocus, type FocusMap } from "../_shared/focus";
import { fmtNum, round } from "../_shared/utils";
import { getBirimSure, type BirimSureData } from "../_shared/queries";
import {
  computePerformance,
  getStandardTimes,
  type PersonPerformance,
  type PerformanceData,
  type StandardTimes,
} from "../_shared/performance";
import { getPersonStepStats, safe, type PersonStepStat } from "../_shared/queries-d2";
import { PersonSelect } from "./person-select";

export const metadata: Metadata = { title: "Personel Verimliliği | Analiz" };
export const revalidate = 30;

const CHIPS: MetricChip[] = [
  { key: "tumu", label: "Tümü" },
  { key: "performans", label: "Performans %" },
  { key: "adam-saat", label: "Adam Saat" },
  { key: "birim-sure", label: "Birim Süre" },
];

const FOCUS: FocusMap = {
  defaultChip: "tumu",
  chips: {
    performans: { cards: ["perf"], cols: ["kazanilan", "harcanan", "pct"] },
    "adam-saat": { cards: ["saat"], cols: ["saat"] },
    "birim-sure": { cards: ["birim"], cols: ["adet", "harcanan"] },
  },
  cols: {
    saat: { cards: ["saat"], chip: "adam-saat" },
    adet: { cards: [] },
    kazanilan: { cards: ["perf"] },
    harcanan: { cards: ["saat"] },
    pct: { cards: ["perf"], chip: "performans" },
    adim: { cards: [] },
  },
};

type SP = Record<string, string | string[] | undefined>;

const COLS: CompactColumn[] = [
  { key: "ad", label: "Personel" },
  { key: "saat", label: "Adam Saat", align: "right", format: "number" },
  { key: "adet", label: "Üretilen Adet (kredilenen)", align: "right", format: "number" },
  { key: "kazanilan", label: "Kazanılan Süre (dk)", align: "right", format: "number" },
  { key: "harcanan", label: "Harcanan Süre (dk)", align: "right", format: "number" },
  { key: "pct", label: "Performans %", align: "right", format: "percent" },
  { key: "adim", label: "Çalıştığı Adım Sayısı", align: "right", format: "number" },
];

const EMPTY_PERF: PerformanceData = { overallPct: null, people: [], stepStandards: [] };
const EMPTY_BIRIM: BirimSureData = {
  montajAvg: null,
  paketlemeAvg: null,
  montajByDay: {},
  paketlemeByDay: {},
  byStep: [],
};
const EMPTY_STD: StandardTimes = { montaj: new Map(), paketleme: new Map() };

const trunc = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (![...ADMIN_ROLES, ...OFFICE_ROLES].includes(user.role)) redirect("/");

  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const { from, to } = period;
  const metricRaw = Array.isArray(sp.m) ? sp.m[0] : sp.m;
  const metric = CHIPS.some((c) => c.key === metricRaw) ? (metricRaw as string) : CHIPS[0].key;
  const kisiRaw = Array.isArray(sp.kisi) ? sp.kisi[0] : sp.kisi;

  const [perf, std, birim, stepStats] = await Promise.all([
    safe(computePerformance(from, to), EMPTY_PERF),
    safe(getStandardTimes(), EMPTY_STD),
    safe(getBirimSure(from, to), EMPTY_BIRIM),
    safe(getPersonStepStats(from, to), new Map<string, PersonStepStat[]>()),
  ]);

  // Kolon filtreleri: kart + grafikler + liste eşleşen personelden türer
  const toRow = (p: PersonPerformance): CompactRow => ({
    ad: p.name,
    saat: round(p.actual / 60, 1),
    adet: round(p.montajQty + p.paketlemeQty, 1),
    kazanilan: round(p.earned, 0),
    harcanan: round(p.actual, 0),
    pct: p.pct,
    adim: stepStats.get(p.id)?.length ?? 0,
  });
  const colFilters = parseColumnFilters(sp, COLS);
  const filtActive = hasActiveFilters(colFilters);
  const focus = resolveFocus(FOCUS, metric, colFilters, COLS, CHIPS);
  const options = distinctOptions(perf.people.map(toRow), COLS);
  const people = pickByFilters(perf.people, toRow, colFilters);

  const totalActualMin = people.reduce((a, p) => a + p.actual, 0);
  const totalHours = totalActualMin / 60;
  const totalEarned = people.reduce((a, p) => a + p.earned, 0);
  const overallPct = filtActive ? (totalActualMin > 0 ? round((totalEarned / totalActualMin) * 100, 1) : null) : perf.overallPct;
  // Ortalama birim süre: filtre altında eşleşen kişilerin montaj adımları (net dk / adet)
  let stepMin = 0;
  let stepQty = 0;
  for (const p of people) for (const st of stepStats.get(p.id) ?? []) {
    stepMin += st.minutes;
    stepQty += st.qty;
  }
  const montajAvg = filtActive ? (stepQty > 0 ? round(stepMin / stepQty, 2) : null) : birim.montajAvg;

  // Seçili kişi (varsayılan: en çok saat çalışan)
  const byHours = [...people].sort((a, b) => b.actual - a.actual);
  const selected = byHours.find((p) => p.id === kisiRaw) ?? byHours[0];
  const personSteps = selected ? (stepStats.get(selected.id) ?? []) : [];

  // Grafik 1: performans %
  const perfChart = (
    <AnalizChart
      title="Personel performansı (%) — %100 = şirket ortalaması hızı"
      type="bar"
      layout="vertical"
      xKey="label"
      unit="%"
      data={people.slice(0, 20).map((p) => ({ label: trunc(p.name), v: p.pct }))}
      series={[{ key: "v", label: "Performans", color: "#70c1aa" }]}
    />
  );

  // Grafik 2: adam saat
  const hoursChart = (
    <AnalizChart
      title="Adam saat (kişi başına çalışma süresi)"
      type="bar"
      layout="vertical"
      xKey="label"
      unit=" sa"
      data={byHours.slice(0, 20).map((p) => ({ label: trunc(p.name), v: round(p.actual / 60, 1) }))}
      series={[{ key: "v", label: "Adam saat", color: "#3368b1" }]}
    />
  );

  // Grafik 3: seçili kişinin adım bazlı birim süresi (standart ile)
  const unitChart = (
    <div className="space-y-2">
      {people.length > 0 && selected && (
        <Suspense fallback={null}>
          <PersonSelect
            people={byHours.map((p) => ({ id: p.id, name: p.name }))}
            value={selected.id}
          />
        </Suspense>
      )}
      <AnalizChart
        title={`Adım bazlı birim süre — ${selected?.name ?? "—"} (dk / adet, standart ile)`}
        type="bar"
        layout="vertical"
        xKey="label"
        unit=" dk"
        data={[...personSteps]
          .sort((a, b) => b.minutes - a.minutes)
          .slice(0, 15)
          .map((s) => ({
            label: trunc(s.stepName ? `${s.stepId} ${s.stepName}` : s.stepId),
            kisi: s.unitDk,
            std: std.montaj.get(s.stepId) ?? null,
          }))}
        series={[
          { key: "kisi", label: "Kişi", color: "#8d9d70" },
          { key: "std", label: "Standart", color: "#adb5be" },
        ]}
      />
    </div>
  );

  let chart;
  if (focus.chartMetric === "performans") chart = perfChart;
  else if (focus.chartMetric === "adam-saat") chart = hoursChart;
  else if (focus.chartMetric === "birim-sure") chart = unitChart;
  else
    chart = (
      <div className="space-y-4">
        {perfChart}
        {hoursChart}
        {unitChart}
      </div>
    );

  // Odak dışı / filtre altında verisi olmayan kartlar boş görünür
  const mut = (k: string, empty = false) => !focus.showCard(k) || (filtActive && empty);
  const cards = (
    <>
      <StatCard
        title="Personel Adam Saat Çalışma Süresi"
        empty={mut("saat", people.length === 0)}
        value={`${fmtNum(totalHours, 1)} sa`}
        subtitle={`${people.length} kişi, net seans süresi (mola düşülmüş)`}
      />
      <StatCard
        title="Ortalama Birim Süre"
        empty={mut("birim", montajAvg === null)}
        value={montajAvg === null ? "—" : `${montajAvg.toLocaleString("tr-TR")} dk`}
        subtitle="Montaj, dk / adet (adet ağırlıklı)"
      />
      <StatCard
        title="Genel Performans"
        empty={mut("perf", overallPct === null)}
        value={overallPct === null ? "—" : `%${overallPct.toLocaleString("tr-TR")}`}
        subtitle="Kazanılan ÷ harcanan süre"
      />
    </>
  );

  const rows: CompactRow[] = people.map(toRow);

  const list = (
    <div className="space-y-4">
      <CompactList
        title="Personel Detayı"
        columns={COLS}
        rows={rows}
        filterOptions={options}
        visibleColumns={focus.visibleColumns}
      />
      <div className="rounded-xl border border-[#a99c7d]/30 bg-[#f0ede1]/60 p-4 text-xs text-[#5e5747]">
        <h3 className="mb-1.5 text-sm font-semibold text-[#474237]">Performans Formülü (Hesaplama Notu)</h3>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Her iş adımı (ve paketlemede her ürün) için standart süre Tₛ = son 180 gündeki tüm seansların birim süre
            medyanıdır (uç değerler hariç). Böylece süngeri desteğe yapıştırma gibi hızlı işler ile dykos makas gibi
            zahmetli işler kendi standardına göre ölçülür.
          </li>
          <li>
            Kazanılan Süre = Σ (adet × Tₛ ÷ çalışan sayısı); Harcanan Süre = Σ net seans süresi (molalar düşülmüş).
          </li>
          <li>
            Performans % = Kazanılan ÷ Harcanan × 100 (%100 = şirket ortalaması hızı). Farklı ürün ve adımlarda
            çalışan kişi tek oranda toplanır.
          </li>
          <li>
            Eksik bilgiler (daha doğru ölçüm için): resmi zaman etüdü/standart süreler; yoklama kayıtları personel ID
            ile tutulmadığı için mesai ile seans süresi eşleştirilemiyor (kullanım oranı); kesimde gerçek süre kaydı
            yok; iş adımı zorluk/beceri katsayısı yok; ekip seanslarında kişi bazlı adet ayrımı yok (adet eşit
            bölünüyor); kalite (fire/uygunsuz) kişiye bağlanırsa kalite çarpanı eklenebilir.
          </li>
          <li>Çalıştığı adım sayısı yalnızca montaj adımlarını kapsar.</li>
        </ul>
      </div>
    </div>
  );

  return (
    <AnalizLayout
      title="Personel Verimliliği"
      backHref="/analiz"
      period={period}
      filterNote={filterNote(colFilters, COLS)}
      focus={focus.all ? null : { labels: focus.labels, clearKeys: focus.clearKeys }}
      chips={CHIPS}
      activeMetric={metric}
      chart={chart}
      cards={cards}
      list={list}
      cardsClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    />
  );
}
