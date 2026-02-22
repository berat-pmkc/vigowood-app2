/**
 * Nakit Akış form yardımcı fonksiyonları
 */

import {
  NAKIT_GIRIS_TL_KOLONLAR,
  NAKIT_GIRIS_USD_KOLONLAR,
  NAKIT_CIKIS_TL_KOLONLAR,
  NAKIT_CIKIS_USD_KOLONLAR,
} from "@/lib/constants";

/** Son dönemin kodundan sonraki dönemi öner */
export function suggestNextDonem(lastDonemKodu: string): {
  yil: number;
  ay: number;
  donemNo: number;
} {
  // Format: "YYYY-M-D#" (ör: "2026-2-D1")
  const parts = lastDonemKodu.split("-");
  const yil = Number(parts[0]);
  const ay = Number(parts[1]);
  const d = parts[2]; // "D1" veya "D2"

  if (d === "D1") {
    return { yil, ay, donemNo: 2 };
  } else {
    // D2 → sonraki ayın D1'i
    const nextMonth = ay + 1;
    if (nextMonth > 12) {
      return { yil: yil + 1, ay: 1, donemNo: 1 };
    }
    return { yil, ay: nextMonth, donemNo: 1 };
  }
}

/** Canlı toplamları hesapla */
export function computeLiveTotals(
  girisler: Record<string, number>,
  cikislar: Record<string, number>
) {
  const girisTl = NAKIT_GIRIS_TL_KOLONLAR.reduce(
    (sum, col) => sum + (girisler[col] || 0),
    0
  );
  const girisUsd = NAKIT_GIRIS_USD_KOLONLAR.reduce(
    (sum, col) => sum + (girisler[col] || 0),
    0
  );
  const cikisTl = NAKIT_CIKIS_TL_KOLONLAR.reduce(
    (sum, col) => sum + (cikislar[col] || 0),
    0
  );
  const cikisUsd = NAKIT_CIKIS_USD_KOLONLAR.reduce(
    (sum, col) => sum + (cikislar[col] || 0),
    0
  );

  return {
    girisTl,
    girisUsd,
    cikisTl,
    cikisUsd,
    netTl: girisTl - cikisTl,
    netUsd: girisUsd - cikisUsd,
  };
}

/** Dönem başlangıç ve bitiş tarihlerini hesapla */
export function getDonemDates(
  yil: number,
  ay: number,
  donemNo: number
): { baslangic: string; bitis: string } {
  const mm = String(ay).padStart(2, "0");
  if (donemNo === 1) {
    return {
      baslangic: `${yil}-${mm}-01`,
      bitis: `${yil}-${mm}-14`,
    };
  }
  const sonGun = new Date(yil, ay, 0).getDate();
  return {
    baslangic: `${yil}-${mm}-15`,
    bitis: `${yil}-${mm}-${String(sonGun).padStart(2, "0")}`,
  };
}

/** Dönem kodu oluştur */
export function buildDonemKodu(
  yil: number,
  ay: number,
  donemNo: number
): string {
  return `${yil}-${ay}-D${donemNo}`;
}
