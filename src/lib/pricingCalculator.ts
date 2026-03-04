// =============================================
// Fiyatlama Hesaplama Motoru — Pure Client-Side Functions
// =============================================

/**
 * HAM FİYAT hesaplama
 * Ham = Satış × (1 - Komisyon - Vergi - Stopaj - Reklam) - Kargo - ÖzelMaliyetler
 *
 * Vergi = KDV payı: kdvOrani / (1 + kdvOrani) ≈ 0.10/1.10 ≈ 0.0909 (varsayılan %10 KDV)
 * Stopaj = pazaryeri bazında (varsayılan 0.01 = %1)
 */
export function hesaplaHamFiyat(
  satisFiyati: number,
  komisyonOrani: number,
  reklamOrani: number,
  stopajOrani: number,
  kdvOrani: number,
  kargo: number,
  ozelMaliyetler: number = 0
): number {
  const vergiOrani = kdvOrani / (1 + kdvOrani); // KDV dahil fiyattan vergi payı
  const net =
    satisFiyati * (1 - komisyonOrani - vergiOrani - stopajOrani - reklamOrani) -
    kargo -
    ozelMaliyetler;
  return Math.round(net * 100) / 100;
}

/**
 * ÖNERİ FİYAT hesaplama (tersten hesap)
 * Öneri = (Hedef + Kargo + Özel) / (1 - Komisyon - Vergi - Stopaj - Reklam)
 * Sonuç tam sayıya yuvarlanır (#11)
 */
export function hesaplaOneriFiyat(
  hedefFiyat: number,
  komisyonOrani: number,
  reklamOrani: number,
  stopajOrani: number,
  kdvOrani: number,
  kargo: number,
  ozelMaliyetler: number = 0
): number {
  const vergiOrani = kdvOrani / (1 + kdvOrani);
  const payda = 1 - komisyonOrani - vergiOrani - stopajOrani - reklamOrani;
  if (payda <= 0) return 0; // Impossible margin — prevent division by zero/negative
  const oneri = (hedefFiyat + kargo + ozelMaliyetler) / payda;
  return Math.round(oneri);
}

/**
 * KAR MARJİ hesaplama
 * Marj = (Ham - Hedef) / Hedef
 */
export function hesaplaKarMarji(hamFiyat: number, hedefFiyat: number): number {
  if (hedefFiyat <= 0) return 0;
  return (hamFiyat - hedefFiyat) / hedefFiyat;
}

/**
 * KARGO maliyeti hesaplama — desi tablosundan fiyat bulma
 * Desi tablosu: {"1": 105, "2": 105, "3": 95, ...}
 * Gelen desi değerine en yakın (eşit veya üst) key'i bulur
 */
export function hesaplaKargo(
  desi: number,
  desiFiyatlari: Record<string, number> | null
): number {
  if (!desiFiyatlari || desi <= 0) return 0;

  const keys = Object.keys(desiFiyatlari)
    .map(Number)
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  if (keys.length === 0) return 0;

  // Exact match or next higher tier
  for (const key of keys) {
    if (key >= desi) return desiFiyatlari[String(key)];
  }
  // Desi exceeds all tiers — use highest
  return desiFiyatlari[String(keys[keys.length - 1])];
}

/**
 * Tek satır hesaplama — tüm hesaplanmış alanları döndürür
 */
export interface PricingRowCalc {
  hamFiyat: number;
  komisyonBedeli: number;
  vergiTutari: number;
  stopajTutari: number;
  reklamBedeli: number;
  kargoMaliyeti: number;
  karMarji: number;
  oneriFiyat: number;
}

export function hesaplaSatir(params: {
  satisFiyati: number;
  komisyonOrani: number;
  reklamOrani: number;
  stopajOrani: number;
  kdvOrani: number;
  desi: number;
  desiFiyatlari: Record<string, number> | null;
  hedefFiyat: number;
  ozelMaliyetler?: number;
}): PricingRowCalc {
  const {
    satisFiyati,
    komisyonOrani,
    reklamOrani,
    stopajOrani,
    kdvOrani,
    desi,
    desiFiyatlari,
    hedefFiyat,
    ozelMaliyetler = 0,
  } = params;

  const kargoMaliyeti = hesaplaKargo(desi, desiFiyatlari);
  const vergiOrani = kdvOrani / (1 + kdvOrani);

  const hamFiyat = hesaplaHamFiyat(
    satisFiyati,
    komisyonOrani,
    reklamOrani,
    stopajOrani,
    kdvOrani,
    kargoMaliyeti,
    ozelMaliyetler
  );

  const komisyonBedeli = Math.round(satisFiyati * komisyonOrani * 100) / 100;
  const vergiTutari = Math.round(satisFiyati * vergiOrani * 100) / 100;
  const stopajTutari = Math.round(satisFiyati * stopajOrani * 100) / 100;
  const reklamBedeli = Math.round(satisFiyati * reklamOrani * 100) / 100;

  const karMarji = hesaplaKarMarji(hamFiyat, hedefFiyat);

  const oneriFiyat = hesaplaOneriFiyat(
    hedefFiyat,
    komisyonOrani,
    reklamOrani,
    stopajOrani,
    kdvOrani,
    kargoMaliyeti,
    ozelMaliyetler
  );

  return {
    hamFiyat,
    komisyonBedeli,
    vergiTutari,
    stopajTutari,
    reklamBedeli,
    kargoMaliyeti,
    karMarji,
    oneriFiyat,
  };
}

/**
 * Kar marjı renk sınıfı
 */
export function karMarjiRenk(marj: number): string {
  if (marj > 0.05) return "bg-green-100 text-green-800";
  if (marj >= 0) return "bg-green-50 text-green-700";
  if (marj >= -0.05) return "bg-orange-50 text-orange-700";
  return "bg-red-100 text-red-800";
}
