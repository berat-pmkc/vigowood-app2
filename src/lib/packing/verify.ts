import type { Blok, Konteyner, PackUrun } from "./types";

const EPS = 1e-6;

export interface DogrulamaSonucu {
  gecerli: boolean;
  hatalar: string[];
}

/**
 * Üretilen planı bağımsız olarak denetler.
 *
 * pack.py yanındaki verify.py'nin karşılığı. Algoritmaya güvenip sonucu
 * doğrudan ekrana basmak yerine her plan burdan geçiyor — hatalı bir plan
 * sahada yanlış yüklemeye yol açar.
 */
export function dogrula(
  bloklar: Blok[],
  kont: Konteyner,
  urunler: PackUrun[],
): DogrulamaSonucu {
  const hatalar: string[] = [];
  const olcuMap = new Map(urunler.map((u) => [u.sku, [u.boy, u.en, u.yuk].sort((a, b) => a - b)]));

  for (const b of bloklar) {
    // 1. Konteyner sınırları
    if (
      b.x < -EPS || b.y < -EPS || b.z < -EPS ||
      b.x + b.dx > kont.uzunluk + EPS ||
      b.y + b.dy > kont.genislik + EPS ||
      b.z + b.dz > kont.yukseklik + EPS
    ) {
      hatalar.push(`${b.sku} bloğu konteyner dışına taşıyor`);
    }

    // 2. Izgara tutarlılığı — blok hacmi sıra x kolon x kat ile uyuşmalı
    if (
      Math.abs(b.dx - b.nx * b.l) > EPS ||
      Math.abs(b.dy - b.ny * b.w) > EPS ||
      Math.abs(b.dz - b.nz * b.h) > EPS
    ) {
      hatalar.push(`${b.sku} bloğunun ölçüsü ızgarasıyla uyuşmuyor`);
    }
    if (b.n > b.nx * b.ny * b.nz) {
      hatalar.push(`${b.sku} bloğunda ızgaraya sığmayan koli var`);
    }

    // 3. Duruş gerçekten o ürünün ölçüsü mü
    const beklenen = olcuMap.get(b.sku);
    if (beklenen) {
      const gercek = [b.l, b.w, b.h].sort((a, b2) => a - b2);
      if (gercek.some((v, i) => Math.abs(v - beklenen[i]) > 1e-3)) {
        hatalar.push(`${b.sku} bloğunun duruşu ürün ölçüleriyle uyuşmuyor`);
      }
    }
  }

  // 4. İkili çakışma
  const cakisir = (a: Blok, b: Blok) =>
    a.x + a.dx > b.x + EPS && b.x + b.dx > a.x + EPS &&
    a.y + a.dy > b.y + EPS && b.y + b.dy > a.y + EPS &&
    a.z + a.dz > b.z + EPS && b.z + b.dz > a.z + EPS;

  for (let i = 0; i < bloklar.length; i++) {
    for (let j = i + 1; j < bloklar.length; j++) {
      if (cakisir(bloklar[i], bloklar[j])) {
        hatalar.push(`${bloklar[i].sku} ve ${bloklar[j].sku} blokları çakışıyor`);
      }
    }
  }

  return { gecerli: hatalar.length === 0, hatalar: [...new Set(hatalar)].slice(0, 20) };
}
