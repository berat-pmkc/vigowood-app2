import type { Blok } from "./types";

export interface DizilimSatiri {
  sira: number;
  sku: string;
  /** Konteyner boyunca başlangıç–bitiş (cm) — dipten kapıya */
  bas: number;
  bit: number;
  /** Sol duvardan uzaklık (cm) */
  y: number;
  /** Tabandan yükseklik (cm) */
  z: number;
  /** Kolinin bu duruştaki kenarları */
  boya: number;
  ene: number;
  dike: number;
  sirakolonkat: string;
  koli: number;
}

/**
 * Blok listesini sahada okunabilir dizilim tablosuna çevirir.
 *
 * Sıra numarası yükleme sırasıdır: dipten kapıya, alttan üste, soldan sağa.
 * Görselden kolinin hangi yüzünün nereye geleceği anlaşılmadığı için her
 * satır bunu açıkça yazar — "boy 43 · en 39 · dik 57,5" demek, 43'lük kenar
 * içeri, 39'luk kenar yana, 57,5'lik kenar dik demektir.
 *
 * Konum sütunları da gerekli: aynı bölgede birden fazla blok olabiliyor,
 * hangisinin duvara hangisinin ortaya geleceği yalnızca Y ile anlaşılıyor.
 */
export function dizilimTablosu(bloklar: Blok[]): DizilimSatiri[] {
  return [...bloklar]
    .sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y)
    .map((b, i) => ({
      sira: i + 1,
      sku: b.sku,
      bas: Math.round(b.x * 10) / 10,
      bit: Math.round((b.x + b.dx) * 10) / 10,
      y: Math.round(b.y * 10) / 10,
      z: Math.round(b.z * 10) / 10,
      boya: b.l,
      ene: b.w,
      dike: b.h,
      sirakolonkat: `${b.nx}×${b.ny}×${b.nz}`,
      koli: b.n,
    }));
}
