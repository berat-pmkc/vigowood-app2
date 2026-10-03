/**
 * Analiz dönem çözümleyici (Europe/Istanbul, hafta Pazartesi başlar).
 *
 * URL: ?period=<key>[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 * key: bugun | dun | bu-hafta (varsayılan) | gecen-hafta | bu-ay | gecen-ay |
 *      q1-YYYY..q4-YYYY | bu-yil | gecen-yil | son-30 | ozel | tum
 */

export type Granularity = "gunluk" | "haftalik" | "aylik" | "yillik";

export interface ResolvedPeriod {
  key: string;
  label: string;
  /** YYYY-MM-DD (dahil); "tum" için null */
  from: string | null;
  to: string | null;
  /** Karşılaştırma dönemi; yoksa null */
  prevFrom: string | null;
  prevTo: string | null;
  /** Gün sayısı (tum için null) */
  days: number | null;
}

export const DEFAULT_PERIOD_KEY = "bu-hafta";

export const FIXED_PERIODS: { key: string; label: string }[] = [
  { key: "bugun", label: "Bugün" },
  { key: "dun", label: "Dün" },
  { key: "bu-hafta", label: "Bu Hafta" },
  { key: "gecen-hafta", label: "Geçen Hafta" },
  { key: "bu-ay", label: "Bu Ay" },
  { key: "gecen-ay", label: "Geçen Ay" },
  { key: "bu-yil", label: "Bu Yıl" },
  { key: "gecen-yil", label: "Geçen Yıl" },
  { key: "son-30", label: "Son 30 Gün" },
  { key: "tum", label: "Tümü" },
];

const TR_TZ = "Europe/Istanbul";
const pad = (n: number) => String(n).padStart(2, "0");

export function trBugun(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TR_TZ });
}

function parts(s: string): [number, number, number] {
  const [y, m, d] = s.split("-").map(Number);
  return [y, m, d];
}
function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** YYYY-MM-DD'ye gün ekler/çıkarır */
export function addDays(s: string, delta: number): string {
  const [y, m, d] = parts(s);
  return iso(y, m, d + delta);
}
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
export function monthStart(s: string): string {
  const [y, m] = parts(s);
  return `${y}-${pad(m)}-01`;
}
export function monthEnd(s: string): string {
  const [y, m] = parts(s);
  return iso(y, m + 1, 0);
}
export function weekStart(s: string): string {
  const [y, m, d] = parts(s);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Pazar
  return addDays(s, -(dow === 0 ? 6 : dow - 1));
}

/** GG.AA.YYYY */
export function formatTrDate(s: string): string {
  const [y, m, d] = parts(s);
  return `${pad(d)}.${pad(m)}.${y}`;
}
export function formatRangeText(from: string | null, to: string | null): string {
  if (!from || !to) return "Tüm zamanlar";
  return from === to ? formatTrDate(from) : `${formatTrDate(from)} – ${formatTrDate(to)}`;
}

export const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function validDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

function prevEqualLength(from: string, to: string) {
  const len = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1);
  return { prevFrom: addDays(prevTo, -(len - 1)), prevTo };
}

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function resolvePeriod(searchParams: SP | undefined): ResolvedPeriod {
  const sp = searchParams ?? {};
  const raw = (first(sp.period) || DEFAULT_PERIOD_KEY).toLowerCase();
  const today = trBugun();
  const [ty, tm] = parts(today);

  const mk = (
    key: string,
    label: string,
    from: string | null,
    to: string | null,
    prev?: { prevFrom: string; prevTo: string } | null,
  ): ResolvedPeriod => {
    const p =
      prev === undefined
        ? from && to
          ? prevEqualLength(from, to)
          : { prevFrom: null, prevTo: null }
        : (prev ?? { prevFrom: null, prevTo: null });
    return {
      key,
      label,
      from,
      to,
      prevFrom: p.prevFrom,
      prevTo: p.prevTo,
      days: from && to ? daysBetween(from, to) + 1 : null,
    };
  };

  // çeyrek
  const qm = /^q([1-4])-(\d{4})$/.exec(raw);
  if (qm) {
    const q = Number(qm[1]);
    const y = Number(qm[2]);
    const from = iso(y, (q - 1) * 3 + 1, 1);
    const to = iso(y, q * 3 + 1, 0);
    const pf = iso(y, (q - 2) * 3 + 1, 1);
    const pt = iso(y, (q - 1) * 3 + 1, 0);
    return mk(raw, `${q}. Çeyrek ${y}`, from, to, { prevFrom: pf, prevTo: pt });
  }

  switch (raw) {
    case "bugun":
      return mk("bugun", "Bugün", today, today);
    case "dun": {
      const d = addDays(today, -1);
      return mk("dun", "Dün", d, d);
    }
    case "gecen-hafta": {
      const f = addDays(weekStart(today), -7);
      return mk("gecen-hafta", "Geçen Hafta", f, addDays(f, 6));
    }
    case "bu-ay": {
      const f = monthStart(today);
      const pf = iso(ty, tm - 1, 1);
      const len = daysBetween(f, today) + 1;
      const pt = addDays(pf, len - 1);
      return mk("bu-ay", "Bu Ay", f, today, {
        prevFrom: pf,
        prevTo: pt > monthEnd(pf) ? monthEnd(pf) : pt,
      });
    }
    case "gecen-ay": {
      const f = iso(ty, tm - 1, 1);
      return mk("gecen-ay", "Geçen Ay", f, monthEnd(f), {
        prevFrom: iso(ty, tm - 2, 1),
        prevTo: addDays(f, -1),
      });
    }
    case "bu-yil": {
      const f = `${ty}-01-01`;
      const pf = `${ty - 1}-01-01`;
      const pt = addDays(pf, daysBetween(f, today));
      return mk("bu-yil", "Bu Yıl", f, today, { prevFrom: pf, prevTo: pt });
    }
    case "gecen-yil":
      return mk("gecen-yil", "Geçen Yıl", `${ty - 1}-01-01`, `${ty - 1}-12-31`, {
        prevFrom: `${ty - 2}-01-01`,
        prevTo: `${ty - 2}-12-31`,
      });
    case "son-30":
      return mk("son-30", "Son 30 Gün", addDays(today, -29), today);
    case "tum":
      return mk("tum", "Tüm Zamanlar", null, null, null);
    case "ozel": {
      const f = first(sp.from);
      const t = first(sp.to);
      if (validDate(f) && validDate(t)) {
        const [a, b] = f <= t ? [f, t] : [t, f];
        return mk("ozel", "Özel Aralık", a, b);
      }
      break;
    }
    default:
      break;
  }
  // varsayılan: bu hafta (Pzt → bugün), önceki haftanın aynı gün sayısı
  const f = weekStart(today);
  const len = daysBetween(f, today) + 1;
  const pf = addDays(f, -7);
  return mk("bu-hafta", "Bu Hafta", f, today, { prevFrom: pf, prevTo: addDays(pf, len - 1) });
}

// ─── Gruplama ─────────────────────────────────────────────────

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  gunluk: "Günlük",
  haftalik: "Haftalık",
  aylik: "Aylık",
  yillik: "Yıllık",
};

export function parseGranularity(v: string | string[] | undefined): Granularity | null {
  const x = Array.isArray(v) ? v[0] : v;
  return x === "gunluk" || x === "haftalik" || x === "aylik" || x === "yillik" ? x : null;
}

/** ≤62 gün günlük, ≤240 gün haftalık, sonrası aylık (>5 yıl: yıllık) */
export function autoGranularity(from: string | null, to: string | null): Granularity {
  if (!from || !to) return "aylik";
  const n = daysBetween(from, to) + 1;
  if (n <= 62) return "gunluk";
  if (n <= 240) return "haftalik";
  if (n <= 365 * 5) return "aylik";
  return "yillik";
}

/** Tarih (YYYY-MM-DD) → kova anahtarı */
export function bucketKey(date: string, g: Granularity): string {
  switch (g) {
    case "gunluk":
      return date;
    case "haftalik":
      return weekStart(date);
    case "aylik":
      return date.slice(0, 7);
    case "yillik":
      return date.slice(0, 4);
  }
}

/** Kova anahtarı → ekran etiketi */
export function bucketLabel(key: string, g: Granularity): string {
  switch (g) {
    case "gunluk":
      return `${key.slice(8, 10)}.${key.slice(5, 7)}`;
    case "haftalik":
      return `${key.slice(8, 10)}.${key.slice(5, 7)} hf`;
    case "aylik": {
      const [y, m] = key.split("-");
      return `${AY_ADLARI[Number(m) - 1].slice(0, 3)} ${y.slice(2)}`;
    }
    case "yillik":
      return key;
  }
}

/** from..to arasındaki tüm kova anahtarları (sıralı, boşluksuz). `to` bugünle sınırlanır. */
export function bucketKeys(from: string, to: string, g: Granularity): string[] {
  const today = trBugun();
  const end = to > today ? today : to;
  const out: string[] = [];
  const seen = new Set<string>();
  for (let d = from, i = 0; d <= end && i < 4000; d = addDays(d, 1), i++) {
    const k = bucketKey(d, g);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/** Timestamp (ISO) → TR yerel günü YYYY-MM-DD */
export function trDay(ts: string | null | undefined): string | null {
  if (!ts) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: TR_TZ });
}

/** Timestamp sütunları için TR sınırları (null = sınırsız) */
export function tsBounds(from: string | null, to: string | null) {
  return {
    gte: from ? `${from}T00:00:00+03:00` : null,
    lte: to ? `${to}T23:59:59.999+03:00` : null,
  };
}
