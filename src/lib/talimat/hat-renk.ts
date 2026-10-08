/**
 * Hat renkleri (saf fonksiyonlar; istemci + sunucu).
 * Tablet ve planlayıcı ekranları aynı hattı aynı renkle gösterir.
 */

/** Hat sırasına göre vurgu rengi (başlık şeridi) */
export const HAT_RENKLERI = ["#3368b1", "#2f8a6f", "#8a5a9e", "#c26a0c", "#6f4c37", "#0c1c2d"];
const HAT_RENGI_YOK = "#5e5747";

export function hatRengi(hat: { sira: number } | null | undefined): string {
  if (!hat) return HAT_RENGI_YOK;
  return HAT_RENKLERI[Math.max(0, hat.sira - 1) % HAT_RENKLERI.length];
}

/** Hat renginin saydam tonu (satır arka planı vb.); alpha 0..1 */
export function hatRengiAcik(hat: { sira: number } | null | undefined, alpha = 0.07): string {
  const hex = hatRengi(hat).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Düz hat rengi üzerinde okunur yazı rengi (tüm palet koyu: beyaz) */
export const HAT_YAZI_RENGI = "#ffffff";
