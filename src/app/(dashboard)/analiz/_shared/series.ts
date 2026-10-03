import {
  autoGranularity,
  bucketKey,
  bucketKeys,
  bucketLabel,
  parseGranularity,
  type Granularity,
} from "@/lib/periods";
import { round } from "./utils";

export type ChartRow = Record<string, string | number | null>;

export function resolveGranularity(
  gParam: string | string[] | undefined,
  from: string | null,
  to: string | null,
): Granularity {
  return parseGranularity(gParam) ?? autoGranularity(from, to);
}

/**
 * Gün bazlı haritaları kovalara (günlük/haftalık/aylık/yıllık) toplar veya ortalar.
 * Dönem sınırlıysa boş kovalar 0 (sum) / null (avg) ile doldurulur.
 * from=null (Tümü) ise veri aralığından türetilir.
 */
export function buildSeries(
  from: string | null,
  to: string | null,
  g: Granularity,
  maps: Record<string, Record<string, number>>,
  mode: "sum" | "avg" = "sum",
): ChartRow[] {
  const names = Object.keys(maps);
  const allDays = names.flatMap((n) => Object.keys(maps[n])).sort();
  const f = from ?? allDays[0];
  const t = to ?? allDays[allDays.length - 1];
  if (!f || !t) return [];

  const keys = bucketKeys(f, t, g);
  const acc: Record<string, Record<string, { s: number; n: number }>> = {};
  for (const name of names) {
    acc[name] = {};
    for (const [day, v] of Object.entries(maps[name])) {
      const k = bucketKey(day, g);
      const a = (acc[name][k] ??= { s: 0, n: 0 });
      a.s += v;
      a.n += 1;
    }
  }

  return keys.map((k) => {
    const row: ChartRow = { label: bucketLabel(k, g), key: k };
    for (const name of names) {
      const a = acc[name][k];
      row[name] = a ? round(mode === "avg" ? a.s / a.n : a.s, 2) : mode === "avg" ? null : 0;
    }
    return row;
  });
}
