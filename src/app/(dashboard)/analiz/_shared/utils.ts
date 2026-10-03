/** Analiz için ortak yardımcılar (sunucu/istemci güvenli). */

export function deltaPct(cur: number, prev: number | null | undefined): number | null {
  if (prev === null || prev === undefined) return null;
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: digits });
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** workers jsonb → [{id,name}] (bozuk veriye dayanıklı) */
export function parseWorkers(w: unknown): { id: string; name: string }[] {
  if (!Array.isArray(w)) return [];
  const out: { id: string; name: string }[] = [];
  for (const x of w) {
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const id = String(o.id ?? o.user_id ?? o.name ?? "");
      const name = String(o.name ?? o.id ?? "");
      if (id) out.push({ id, name: name || id });
    } else if (typeof x === "string" && x) {
      out.push({ id: x, name: x });
    }
  }
  return out;
}

export const MAX_ROWS = 200_000;

/**
 * Supabase 1000 satır sınırını aşmak için sayfalayarak tüm satırları çeker.
 * build(lo, hi) => query.range(lo, hi) döndürmelidir.
 */
export async function fetchAll<T>(
  build: (lo: number, hi: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let lo = 0; lo < MAX_ROWS; lo += pageSize) {
    const { data, error } = await build(lo, lo + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}
