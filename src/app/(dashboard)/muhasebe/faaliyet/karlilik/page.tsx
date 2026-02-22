import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { KarlilikClient } from "./components/karlilik-client";
import { getKarlilikTrend, getDistinctPazaryerleri } from "../actions";

interface PageProps {
  searchParams: Promise<{
    period?: string;
    donem?: string;
    marka?: string;
  }>;
}

export const metadata: Metadata = {
  title: "Karlilik | VigoWood",
};

export default async function KarlilikPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const periodType = (["ay", "ceyrek", "yari_yil", "yillik"].includes(params.period ?? ""))
    ? params.period!
    : "ay";

  const activeMarka = params.marka || "GENEL";

  // 1. Tüm dönemleri çek
  const { data: allDonemler } = await supabase
    .from("faaliyet_donemler")
    .select("id, donem_kodu, yil, ay_no, ceyrek, yari_yil, donem_label, kur_tl_usd")
    .order("yil", { ascending: false })
    .order("ay_no", { ascending: false });

  const donemler = allDonemler ?? [];

  // 2. Seçili döneme göre ilgili dönem ID'lerini belirle
  let selectedDonemIds: string[] = [];
  let selectedLabel = "";

  if (donemler.length > 0) {
    const selectedDonem = params.donem
      ? donemler.find((d) => d.donem_kodu === params.donem) ?? donemler[0]
      : donemler[0];

    if (periodType === "ay") {
      selectedDonemIds = [selectedDonem.id];
      selectedLabel = selectedDonem.donem_label ?? selectedDonem.donem_kodu;
    } else if (periodType === "ceyrek") {
      const qDonemler = donemler.filter(
        (d) => d.yil === selectedDonem.yil && d.ceyrek === selectedDonem.ceyrek
      );
      selectedDonemIds = qDonemler.map((d) => d.id);
      selectedLabel = `${selectedDonem.ceyrek} ${selectedDonem.yil}`;
    } else if (periodType === "yari_yil") {
      const hDonemler = donemler.filter(
        (d) => d.yil === selectedDonem.yil && d.yari_yil === selectedDonem.yari_yil
      );
      selectedDonemIds = hDonemler.map((d) => d.id);
      selectedLabel = `${selectedDonem.yari_yil} ${selectedDonem.yil}`;
    } else {
      const yDonemler = donemler.filter((d) => d.yil === selectedDonem.yil);
      selectedDonemIds = yDonemler.map((d) => d.id);
      selectedLabel = `${selectedDonem.yil}`;
    }
  }

  // 3. Kârlılık verisi
  let karlilikData: Array<{
    marka: string | null;
    sira: number;
    kalem_turu: string | null;
    kalem: string | null;
    tl: number | null;
    usd: number | null;
    donem_id: string;
  }> = [];

  if (selectedDonemIds.length > 0) {
    const { data } = await supabase
      .from("karlilik_data")
      .select("marka, sira, kalem_turu, kalem, tl, usd, donem_id")
      .in("donem_id", selectedDonemIds)
      .order("sira");
    karlilikData = data ?? [];
  }

  // 4. Aggregate data if multi-month period
  type AggRow = { marka: string; sira: number; kalem_turu: string; kalem: string; tl: number; usd: number };
  const aggregated: AggRow[] = [];

  if (karlilikData.length > 0) {
    const map = new Map<string, AggRow & { count: number }>();
    for (const row of karlilikData) {
      const key = `${row.marka}:${row.kalem_turu}:${row.kalem}`;
      if (!map.has(key)) {
        map.set(key, {
          marka: row.marka ?? "",
          sira: row.sira,
          kalem_turu: row.kalem_turu ?? "",
          kalem: row.kalem ?? "",
          tl: 0,
          usd: 0,
          count: 0,
        });
      }
      const entry = map.get(key)!;
      entry.tl += Number(row.tl) || 0;
      entry.usd += Number(row.usd) || 0;
      entry.count++;
    }

    // For MARJ, average instead of sum
    for (const [, entry] of map) {
      if (entry.kalem_turu === "MARJ" && entry.count > 1) {
        entry.tl = Math.round((entry.tl / entry.count) * 100) / 100;
      }
      aggregated.push({
        marka: entry.marka,
        sira: entry.sira,
        kalem_turu: entry.kalem_turu,
        kalem: entry.kalem,
        tl: Math.round(entry.tl * 100) / 100,
        usd: Math.round(entry.usd * 100) / 100,
      });
    }
    aggregated.sort((a, b) => a.sira - b.sira);
  }

  // 5. Previous period comparison
  let prevLabel = "";
  let prevData: AggRow[] = [];

  if (donemler.length > 0 && selectedDonemIds.length > 0) {
    const selectedDonem = donemler.find((d) => selectedDonemIds.includes(d.id));
    if (selectedDonem) {
      let prevDonemIds: string[] = [];

      if (periodType === "ay") {
        const idx = donemler.findIndex((d) => d.id === selectedDonem.id);
        if (idx >= 0 && idx < donemler.length - 1) {
          const prev = donemler[idx + 1];
          prevDonemIds = [prev.id];
          prevLabel = prev.donem_label ?? prev.donem_kodu;
        }
      }
      // For quarterly/half/yearly, previous period comparison is more complex — skip for MVP

      if (prevDonemIds.length > 0) {
        const { data: pd } = await supabase
          .from("karlilik_data")
          .select("marka, sira, kalem_turu, kalem, tl, usd")
          .in("donem_id", prevDonemIds)
          .order("sira");

        prevData = (pd ?? []).map((r) => ({
          marka: r.marka ?? "",
          sira: r.sira,
          kalem_turu: r.kalem_turu ?? "",
          kalem: r.kalem ?? "",
          tl: Number(r.tl) || 0,
          usd: Number(r.usd) || 0,
        }));
      }
    }
  }

  // 6. Trend data
  const trendData = await getKarlilikTrend();

  // 7. Pazaryeri list for pie chart
  const pazaryerleri = await getDistinctPazaryerleri();

  // Build dönem seçenekleri for period type
  const donemOptions = (() => {
    if (periodType === "ay") {
      return donemler.map((d) => ({ value: d.donem_kodu, label: d.donem_label ?? d.donem_kodu }));
    }
    if (periodType === "ceyrek") {
      const seen = new Set<string>();
      return donemler
        .filter((d) => {
          const key = `${d.yil}_${d.ceyrek}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((d) => ({ value: d.donem_kodu, label: `${d.ceyrek} ${d.yil}` }));
    }
    if (periodType === "yari_yil") {
      const seen = new Set<string>();
      return donemler
        .filter((d) => {
          const key = `${d.yil}_${d.yari_yil}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((d) => ({ value: d.donem_kodu, label: `${d.yari_yil} ${d.yil}` }));
    }
    // yillik
    const seen = new Set<number>();
    return donemler
      .filter((d) => {
        if (seen.has(d.yil)) return false;
        seen.add(d.yil);
        return true;
      })
      .map((d) => ({ value: d.donem_kodu, label: `${d.yil}` }));
  })();

  const selectedDonemKodu = donemler.find((d) => selectedDonemIds.includes(d.id))?.donem_kodu ?? "";

  return (
    <div className="px-4 sm:px-6">
      <KarlilikClient
        periodType={periodType}
        activeMarka={activeMarka}
        selectedLabel={selectedLabel}
        selectedDonemKodu={selectedDonemKodu}
        donemOptions={donemOptions}
        data={aggregated}
        prevData={prevData}
        prevLabel={prevLabel}
        trendData={trendData}
        hasData={aggregated.length > 0}
      />
    </div>
  );
}
