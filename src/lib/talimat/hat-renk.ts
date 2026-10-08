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

// ─── Aşama (üretim aşaması) renkleri ───────────────────────────────
// Tek kaynak: aşama renkleri hat paletinden türetilir; hat dışı metrikler
// hat renklerinden FARKLI sabit tonlar kullanır (karışıklık olmasın).

export type Asama =
  | "paketleme"
  | "montaj"
  | "doseme"
  | "kesim"
  | "birimSure"
  | "stok"
  | "personel"
  | "fire";

type HatLike = { ad: string; tur: string; sira: number };

/** Hat paletinde bulunmayan, hat-dışı metrik renkleri */
export const ASAMA_NOTR_RENK: Record<"kesim" | "birimSure" | "stok" | "personel" | "fire", string> = {
  kesim: "#a99c7d",
  birimSure: "#adb5be",
  stok: "#70c1aa",
  personel: "#8d9d70",
  fire: "#ee7683",
};

/** Hat listesi yokken (varsayılan sıralara göre) yedek renkler */
const ASAMA_YEDEK: Record<"paketleme" | "montaj" | "doseme", string> = {
  montaj: HAT_RENKLERI[0],
  doseme: HAT_RENKLERI[3],
  paketleme: HAT_RENKLERI[4],
};

const isDoseme = (h: HatLike) => h.ad.toLocaleUpperCase("tr").includes("DÖŞEME");

/** Aşamayı temsil eden hat (en düşük sıralı eşleşen hat) */
export function asamaHatti<T extends HatLike>(asama: Asama, hatlar: T[] | null | undefined): T | undefined {
  if (!hatlar?.length) return undefined;
  const sirali = [...hatlar].sort((a, b) => a.sira - b.sira);
  if (asama === "paketleme") return sirali.find((h) => h.tur === "paketleme");
  if (asama === "doseme") return sirali.find((h) => isDoseme(h));
  if (asama === "montaj") return sirali.find((h) => h.tur === "montaj" && !isDoseme(h));
  return undefined;
}

/** Aşama rengi: paketleme/montaj/döşeme = ilgili hattın rengi; diğerleri sabit nötr tonlar */
export function asamaRengi(asama: Asama, hatlar?: HatLike[] | null): string {
  if (asama === "paketleme" || asama === "montaj" || asama === "doseme") {
    const h = asamaHatti(asama, hatlar);
    return h ? hatRengi(h) : ASAMA_YEDEK[asama];
  }
  return ASAMA_NOTR_RENK[asama];
}

/** hat_id → { ad, sira, renk } haritası */
export function hatHaritasi<T extends HatLike & { hat_id: string }>(
  hatlar: T[],
): Map<string, { ad: string; sira: number; renk: string }> {
  return new Map(hatlar.map((h) => [h.hat_id, { ad: h.ad, sira: h.sira, renk: hatRengi(h) }]));
}

export const HAT_ATANMAMIS_AD = "Hat atanmamış";
export const HAT_ATANMAMIS_RENK = HAT_RENGI_YOK;
