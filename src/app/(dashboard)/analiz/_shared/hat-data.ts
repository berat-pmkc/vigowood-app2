import "server-only";

import { getHatlar } from "@/lib/talimat/queries";
import { hatHaritasi, hatRengi, HAT_ATANMAMIS_AD, HAT_ATANMAMIS_RENK } from "@/lib/talimat/hat-renk";
import type { TalimatHat } from "@/lib/talimat/types";
import type { AnalizSeries } from "./analiz-chart";

type DayMap = Record<string, number>;

/** Analiz sayfaları için hat listesi (hata olursa boş: renkler yedek tonlara düşer) */
export async function getAnalizHatlar(): Promise<TalimatHat[]> {
  try {
    return await getHatlar();
  } catch (e) {
    console.error("[analiz] hatlar", e);
    return [];
  }
}

export const HAT_YOK = "_yok";

export interface HatToplam {
  id: string;
  ad: string;
  /** Hat sırası; atanmamış = null (nötr renk) */
  sira: number | null;
  renk: string;
  value: number;
}

/** hat_id → toplam (hat sırasına göre; atanmamış en sonda; sıfırlar atlanır) */
export function hatToplamlari(hatlar: TalimatHat[], byHatDay: Record<string, DayMap>): HatToplam[] {
  const map = hatHaritasi(hatlar);
  const out: HatToplam[] = [];
  for (const [id, days] of Object.entries(byHatDay)) {
    const value = Object.values(days).reduce((a, b) => a + b, 0);
    if (value <= 0) continue;
    const h = map.get(id);
    out.push(
      h
        ? { id, ad: h.ad, sira: h.sira, renk: h.renk, value }
        : { id: HAT_YOK, ad: HAT_ATANMAMIS_AD, sira: null, renk: HAT_ATANMAMIS_RENK, value },
    );
  }
  // bilinmeyen id'ler "atanmamış" altında birleşir
  const merged = new Map<string, HatToplam>();
  for (const t of out) {
    const m = merged.get(t.id);
    if (m) m.value += t.value;
    else merged.set(t.id, { ...t });
  }
  return [...merged.values()].sort((a, b) => (a.sira ?? 1e9) - (b.sira ?? 1e9));
}

/** Hat kırılımı grafiği için seri tanımı + buildSeries haritaları (anahtar: h_<id>) */
export function hatSerileri(
  hatlar: TalimatHat[],
  byHatDay: Record<string, DayMap>,
): { maps: Record<string, DayMap>; series: AnalizSeries[] } {
  const known = new Set(hatlar.map((h) => h.hat_id));
  const maps: Record<string, DayMap> = {};
  const series: AnalizSeries[] = [];
  for (const h of [...hatlar].sort((a, b) => a.sira - b.sira)) {
    const days = byHatDay[h.hat_id];
    if (!days || !Object.values(days).some((v) => v > 0)) continue;
    maps[`h_${h.hat_id}`] = days;
    series.push({ key: `h_${h.hat_id}`, label: h.ad, color: hatRengi(h) });
  }
  const none: DayMap = {};
  for (const [id, days] of Object.entries(byHatDay)) {
    if (known.has(id)) continue;
    for (const [d, v] of Object.entries(days)) none[d] = (none[d] ?? 0) + v;
  }
  if (Object.values(none).some((v) => v > 0)) {
    maps[`h_${HAT_YOK}`] = none;
    series.push({ key: `h_${HAT_YOK}`, label: HAT_ATANMAMIS_AD, color: HAT_ATANMAMIS_RENK });
  }
  return { maps, series };
}
