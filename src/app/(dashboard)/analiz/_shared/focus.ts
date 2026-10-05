/**
 * Odak (focus) modu: seçili metrik chip'i ve sayısal kolon filtreleri, hangi kartların ve
 * liste kolonlarının görüneceğini belirler. Yalnızca görünürlük; hesaplamalar değişmez.
 * Sunucu + istemci ortak (server-only import YOK).
 */
import { FILTER_PREFIX, type ColumnFilters, type FilterableColumn } from "./column-filters";

export interface FocusMap {
  /** Varsayılan (odaksız) chip anahtarı: "tumu" / "ozet" */
  defaultChip: string;
  /** chip → görünecek kartlar + liste metrik kolonları (kimlik kolonları her zaman görünür) */
  chips: Record<string, { cards: string[]; cols: string[] }>;
  /** Metrik kolonlar: kolon → bağlı kartlar (+ varsa grafiği veren chip). Burada olmayan kolonlar "kimlik" sayılır. */
  cols: Record<string, { cards: string[]; chip?: string }>;
}

export interface Focus {
  /** true: odak yok, her şey görünür */
  all: boolean;
  showCard: (key: string) => boolean;
  /** undefined = tüm kolonlar */
  visibleColumns?: string[];
  /** "Odak: ..." etiketleri */
  labels: string[];
  /** Odağı temizlemek için URL'den silinecek parametreler (m + sayısal f.*) */
  clearKeys: string[];
  /** Grafik için etkin chip (Tümü + tek sayısal filtre odağı → o metriğin grafiği) */
  chartMetric: string;
}

export function resolveFocus(
  map: FocusMap,
  metric: string,
  filters: ColumnFilters,
  columns: FilterableColumn[],
  chips: { key: string; label: string }[],
): Focus {
  const chipFocus = metric !== map.defaultChip ? map.chips[metric] : undefined;
  const numKeys = columns
    .map((c) => c.key)
    .filter((k) => filters[k]?.kind === "number" && map.cols[k]);

  if (!chipFocus && numKeys.length === 0) {
    return { all: true, showCard: () => true, labels: [], clearKeys: [], chartMetric: metric };
  }

  const cards = new Set<string>(chipFocus?.cards ?? []);
  const metricCols = new Set<string>(chipFocus?.cols ?? []);
  for (const k of numKeys) {
    metricCols.add(k);
    for (const c of map.cols[k].cards) cards.add(c);
  }

  const labels: string[] = [];
  if (chipFocus) labels.push(chips.find((c) => c.key === metric)?.label ?? metric);
  for (const k of numKeys) {
    const l = columns.find((c) => c.key === k)?.label ?? k;
    if (!labels.includes(l)) labels.push(l);
  }

  const visibleColumns = columns.filter((c) => !map.cols[c.key] || metricCols.has(c.key)).map((c) => c.key);
  const clearKeys = [...(chipFocus ? ["m"] : []), ...numKeys.map((k) => FILTER_PREFIX + k)];

  let chartMetric = metric;
  if (!chipFocus && numKeys.length === 1) chartMetric = map.cols[numKeys[0]].chip ?? metric;

  return { all: false, showCard: (key) => cards.has(key), visibleColumns, labels, clearKeys, chartMetric };
}
