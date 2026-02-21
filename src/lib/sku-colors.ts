/**
 * SKU Renk Sistemi — Deterministik hash-based palet
 * Her SKU'ya tutarlı bir renk atar (aynı SKU her zaman aynı renk)
 */

const SKU_COLORS = [
  { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" }, // blue
  { bg: "#dcfce7", text: "#166534", border: "#86efac" }, // green
  { bg: "#fef9c3", text: "#854d0e", border: "#fde047" }, // yellow
  { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" }, // pink
  { bg: "#e0e7ff", text: "#3730a3", border: "#a5b4fc" }, // indigo
  { bg: "#fed7aa", text: "#9a3412", border: "#fdba74" }, // orange
  { bg: "#ccfbf1", text: "#115e59", border: "#5eead4" }, // teal
  { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" }, // violet
  { bg: "#fecdd3", text: "#9f1239", border: "#fda4af" }, // rose
  { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" }, // emerald
  { bg: "#e0f2fe", text: "#075985", border: "#7dd3fc" }, // sky
  { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" }, // amber
  { bg: "#f3e8ff", text: "#6b21a8", border: "#d8b4fe" }, // purple
  { bg: "#ecfccb", text: "#3f6212", border: "#bef264" }, // lime
  { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" }, // red
  { bg: "#f0fdfa", text: "#134e4a", border: "#99f6e4" }, // cyan
  { bg: "#fdf4ff", text: "#86198f", border: "#f0abfc" }, // fuchsia
  { bg: "#f7fee7", text: "#4d7c0f", border: "#a3e635" }, // light-green
  { bg: "#fff1f2", text: "#be123c", border: "#fb7185" }, // warm-rose
  { bg: "#f0f9ff", text: "#0369a1", border: "#38bdf8" }, // light-blue
] as const;

/**
 * Simple string hash function (djb2)
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash;
}

/**
 * SKU string'inden deterministik renk indexi döndür
 */
export function getSkuColorIndex(sku: string): number {
  return hashString(sku) % SKU_COLORS.length;
}

/**
 * SKU badge stili döndür (background, text, border)
 */
export function getSkuBadgeStyle(sku: string): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const color = SKU_COLORS[getSkuColorIndex(sku)];
  return {
    backgroundColor: color.bg,
    color: color.text,
    borderColor: color.border,
  };
}
