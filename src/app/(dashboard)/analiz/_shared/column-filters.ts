/**
 * Kolon başlığı filtreleri (sunucu + istemci ortak, server-only import YOK).
 *
 * URL şeması: `f.<kolonKey>=<değer>`; farklı kolonlar AND ile birleşir.
 *  - Metin:  `LS03`            → içerir (büyük/küçük harf + Türkçe karakter duyarsız)
 *            `=A|B`            → listeden seçim (tam eşleşme, değerler encodeURIComponent)
 *            `~=x`             → "=" ile başlayan içerir-metni için kaçış
 *  - Sayı:   `gt0`             → değeri olanlar (> 0)
 *            `eq0`             → boş / 0
 *            `min:max`         → aralık (her iki taraf da isteğe bağlı: `5:`, `:10`)
 */

export type FilterKind = "text" | "number" | "select";

export interface FilterableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  /** number: tr-TR sayı, dk: 1 ondalık + " dk", percent: %x, text: olduğu gibi */
  format?: "text" | "number" | "dk" | "percent";
  /** Varsayılan: sayı biçimleri → "number", diğerleri → "text". false = filtre yok */
  filter?: FilterKind | false;
}

export type CellValue = string | number | null | undefined;
export type FilterRow = Record<string, CellValue>;

export type ColumnFilter =
  | { kind: "text"; contains?: string; values?: string[] }
  | { kind: "number"; op: "gt0" | "eq0" | "range"; min?: number; max?: number };

export type ColumnFilters = Record<string, ColumnFilter>;

export const FILTER_PREFIX = "f.";
export const MAX_DISTINCT = 50;

type SPLike = Record<string, string | string[] | undefined> | URLSearchParams;

export function columnKind(c: FilterableColumn): FilterKind | false {
  if (c.filter === false) return false;
  if (c.filter) return c.filter;
  return c.format && c.format !== "text" ? "number" : "text";
}

function norm(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

function getParam(sp: SPLike, name: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(name) ?? undefined;
  const v = sp[name];
  return Array.isArray(v) ? v[0] : v;
}

function parseNum(s: string): number | undefined {
  const t = s.trim().replace(",", ".");
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function parseFilterValue(raw: string, kind: FilterKind): ColumnFilter | null {
  if (!raw) return null;
  if (kind === "number") {
    if (raw === "gt0") return { kind: "number", op: "gt0" };
    if (raw === "eq0") return { kind: "number", op: "eq0" };
    const i = raw.indexOf(":");
    if (i < 0) return null;
    const min = parseNum(raw.slice(0, i));
    const max = parseNum(raw.slice(i + 1));
    if (min === undefined && max === undefined) return null;
    return { kind: "number", op: "range", min, max };
  }
  if (raw.startsWith("=")) {
    const values = raw
      .slice(1)
      .split("|")
      .filter((x) => x !== "")
      .map((x) => {
        try {
          return decodeURIComponent(x);
        } catch {
          return x;
        }
      });
    return values.length ? { kind: "text", values } : null;
  }
  const contains = raw.startsWith("~") ? raw.slice(1) : raw;
  return contains.trim() ? { kind: "text", contains: contains.trim() } : null;
}

export function serializeFilter(f: ColumnFilter): string {
  if (f.kind === "number") {
    if (f.op === "gt0") return "gt0";
    if (f.op === "eq0") return "eq0";
    return `${f.min ?? ""}:${f.max ?? ""}`;
  }
  if (f.values && f.values.length) return `=${f.values.map(encodeURIComponent).join("|")}`;
  const c = f.contains ?? "";
  return c.startsWith("=") || c.startsWith("~") ? `~${c}` : c;
}

/** URL parametrelerinden yalnızca verilen kolonlara ait filtreleri okur. */
export function parseColumnFilters(sp: SPLike, columns: FilterableColumn[]): ColumnFilters {
  const out: ColumnFilters = {};
  for (const c of columns) {
    const kind = columnKind(c);
    if (!kind) continue;
    const raw = getParam(sp, FILTER_PREFIX + c.key);
    if (raw === undefined) continue;
    const f = parseFilterValue(raw, kind);
    if (f) out[c.key] = f;
  }
  return out;
}

export function hasActiveFilters(filters: ColumnFilters): boolean {
  return Object.keys(filters).length > 0;
}

function cellText(v: CellValue): string {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

/** Hücre değerini sayıya çevirir (Supabase numeric kolonları string döner: "5", "22.5", "5,5"). */
export function toNum(v: CellValue): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = v.trim();
  if (t === "" || t === "—") return null;
  const n = Number(t.includes(",") && !t.includes(".") ? t.replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
}

function matchOne(v: CellValue, f: ColumnFilter): boolean {
  if (f.kind === "number") {
    const num = toNum(v);
    if (f.op === "gt0") return num !== null && num > 0;
    if (f.op === "eq0") return num === null || num === 0;
    if (num === null) return false;
    if (f.min !== undefined && num < f.min) return false;
    if (f.max !== undefined && num > f.max) return false;
    return true;
  }
  const t = cellText(v);
  if (f.values && f.values.length) return f.values.includes(t);
  if (f.contains) return norm(t).includes(norm(f.contains));
  return true;
}

export function matchesFilters(row: FilterRow, filters: ColumnFilters): boolean {
  for (const [key, f] of Object.entries(filters)) {
    if (!matchOne(row[key], f)) return false;
  }
  return true;
}

export function applyColumnFilters<T extends FilterRow>(rows: T[], filters: ColumnFilters): T[] {
  if (!hasActiveFilters(filters)) return rows;
  return rows.filter((r) => matchesFilters(r, filters));
}

/**
 * Kaynak kayıtları (ham satırlar) liste satırına çevirip filtreler; eşleşen KAYNAK kayıtları döner.
 * Kart/grafik hesabı için ham veriyi liste filtresine göre kısıtlamada kullanılır.
 */
export function pickByFilters<T>(items: T[], toRow: (t: T) => FilterRow, filters: ColumnFilters): T[] {
  if (!hasActiveFilters(filters)) return items;
  return items.filter((t) => matchesFilters(toRow(t), filters));
}

/** "Fire > 0", "Ürün Kodu: LS031" gibi Türkçe özet parçaları. */
export function describeFilters(filters: ColumnFilters, columns: FilterableColumn[]): string[] {
  const out: string[] = [];
  for (const c of columns) {
    const f = filters[c.key];
    if (f) out.push(describeFilter(c.label, f));
  }
  return out;
}

const nf = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export function describeFilter(label: string, f: ColumnFilter): string {
  if (f.kind === "number") {
    if (f.op === "gt0") return `${label} > 0`;
    if (f.op === "eq0") return `${label}: boş / 0`;
    if (f.min !== undefined && f.max !== undefined) return `${label}: ${nf(f.min)} – ${nf(f.max)}`;
    if (f.min !== undefined) return `${label} ≥ ${nf(f.min)}`;
    return `${label} ≤ ${nf(f.max ?? 0)}`;
  }
  if (f.values && f.values.length) return `${label}: ${f.values.join(", ")}`;
  return `${label}: ${f.contains ?? ""}`;
}

/** Sayfa notu: "Filtre uygulandı: Fire > 0 · Ürün Kodu: LS031" (aktif değilse null). */
export function filterNote(filters: ColumnFilters, columns: FilterableColumn[]): string | null {
  if (!hasActiveFilters(filters)) return null;
  return `Filtre uygulandı: ${describeFilters(filters, columns).join(" · ")}`;
}

/**
 * Metin kolonları için ayrık değerler (filtrelenmemiş satırlardan). ≤ MAX_DISTINCT ise döner.
 * Sunucuda hesaplanıp CompactList'e `filterOptions` olarak geçilir.
 */
export function distinctOptions(rows: FilterRow[], columns: FilterableColumn[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of columns) {
    const kind = columnKind(c);
    if (kind !== "text" && kind !== "select") continue;
    const set = new Set<string>();
    let over = false;
    for (const r of rows) {
      set.add(cellText(r[c.key]));
      if (set.size > MAX_DISTINCT) {
        over = true;
        break;
      }
    }
    if (!over && set.size > 0) out[c.key] = [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }
  return out;
}
