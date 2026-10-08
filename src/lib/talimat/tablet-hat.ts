/**
 * Hat bazlı tablet yardımcıları (saf fonksiyonlar; istemci + sunucu).
 * Ana ekranlarda seansları hat gruplarına ayırma ve hat renkleri.
 */
import type { TalimatHat } from "./types";

export interface HatGrup<T> {
  /** null: hat atanmamış (eski kayıtlar) */
  hat: TalimatHat | null;
  items: T[];
}

/** Seansları hat sırasına göre gruplar; hatsız (eski) seanslar en sonda. Boş hat grubu üretilmez. */
export function hataGoreSeansGrupla<T extends { hat_id?: string | null }>(items: T[], hatlar: TalimatHat[]): HatGrup<T>[] {
  const byHat = new Map<string, T[]>();
  const hatsiz: T[] = [];
  const bilinen = new Set(hatlar.map((h) => h.hat_id));
  for (const it of items) {
    if (it.hat_id && bilinen.has(it.hat_id)) {
      const a = byHat.get(it.hat_id) ?? [];
      a.push(it);
      byHat.set(it.hat_id, a);
    } else {
      hatsiz.push(it);
    }
  }
  const sonuc: HatGrup<T>[] = [];
  for (const h of [...hatlar].sort((a, b) => a.sira - b.sira)) {
    const a = byHat.get(h.hat_id);
    if (a && a.length > 0) sonuc.push({ hat: h, items: a });
  }
  if (hatsiz.length > 0) sonuc.push({ hat: null, items: hatsiz });
  return sonuc;
}

/** Hat sırasına göre vurgu rengi (başlık şeridi) */
const HAT_RENKLERI = ["#3368b1", "#2f8a6f", "#8a5a9e", "#c26a0c", "#6f4c37", "#0c1c2d"];
export function hatRengi(hat: Pick<TalimatHat, "sira"> | null | undefined): string {
  if (!hat) return "#5e5747";
  return HAT_RENKLERI[Math.max(0, hat.sira - 1) % HAT_RENKLERI.length];
}

/** DOM id: hat bölümüne kaydırma */
export function hatDomId(hatId: string): string {
  return `hat-${hatId}`;
}

export function dkFormat(dakika: number): string {
  const t = Math.max(0, Math.floor(dakika));
  const h = Math.floor(t / 60);
  const m = t % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}
