import type { Blok } from "./types";

export interface DizilimSatiri {
  sira: number;
  sku: string;
  /** Bloğun konteyner boyunca başlangıç ve bitiş konumu (cm) */
  bas: number;
  bit: number;
  /** Kolinin bu duruştaki kenarları */
  boya: number;
  ene: number;
  dike: number;
  /** Boyda kaç sıra, ende kaç kolon, üst üste kaç kat */
  sirakolonkat: string;
  koli: number;
}

/**
 * Blok listesini sahada okunabilir dizilim tablosuna çevirir.
 *
 * Görselden kolinin hangi yüzünün nereye geleceği anlaşılmadığı için
 * her satır bunu açıkça yazar: "boy 43 · en 39 · dik 57,5" demek,
 * 43'lük kenar içeri, 39'luk kenar yana, 57,5'lik kenar dik demektir.
 */
export function dizilimTablosu(bloklar: Blok[]): DizilimSatiri[] {
  return [...bloklar]
    .sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z)
    .map((b, i) => ({
      sira: i + 1,
      sku: b.sku,
      bas: Math.round(b.x * 10) / 10,
      bit: Math.round((b.x + b.dx) * 10) / 10,
      boya: b.l,
      ene: b.w,
      dike: b.h,
      sirakolonkat: `${b.nx}×${b.ny}×${b.nz}`,
      koli: b.n,
    }));
}
