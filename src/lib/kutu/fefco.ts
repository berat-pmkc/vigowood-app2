/**
 * FEFCO açık kutu (die-line) geometrisi.
 *
 * Girdi iç ölçüler, çıktı levha üzerindeki panel yerleşimi. Saf fonksiyon —
 * hem ekranda canlı çizim hem de kayıt anındaki levha ölçüsü hesabı bunu
 * kullanıyor, iki yerde farklı formül olmasın diye.
 *
 * BİRİM: milimetre. Makine programı da mm kullanıyor.
 *
 * FORMÜLLER EKRANDA GÖSTERİLİYOR. Sebebi: bunlar standart FEFCO
 * geometrisi, sizin makinenizin pay değerleri (bıçak payı, oluk kalınlığı)
 * dahil değil. Makinedeki hesapla karşılaştırıp sabit bir fark çıkarsa
 * buraya pay olarak eklenir.
 */

export type FefcoKodu = "0201" | "0401";

export interface KutuOlcu {
  /** İç uzunluk (mm) */
  uzunluk: number;
  /** İç genişlik (mm) */
  genislik: number;
  /** İç yükseklik (mm) */
  yukseklik: number;
}

/** Levha üzerinde tek bir panel */
export interface Panel {
  x: number;
  y: number;
  w: number;
  h: number;
  etiket: string;
  /** Gövde paneli mi, kapak/kulak mı — çizimde farklı tonlanıyor */
  tur: "govde" | "kapak" | "yapistirma";
}

/** Katlama çizgisi (kesikli çizilir) */
export interface KatlamaCizgisi {
  x1: number; y1: number; x2: number; y2: number;
}

export interface DieLine {
  kod: FefcoKodu;
  /** Levha dış ölçüsü (mm) */
  en: number;
  boy: number;
  alanM2: number;
  paneller: Panel[];
  katlamalar: KatlamaCizgisi[];
  /** Ekranda gösterilecek formül açıklaması */
  formul: { en: string; boy: string };
}

/**
 * FEFCO 0201 — Amerikan kutu (RSC).
 *
 * Dört yan panel gövdeyi sarar: U, G, U, G. Her panelin altında ve
 * üstünde G/2 derinliğinde kapak var; karşılıklı kapaklar ortada buluşur.
 * Sonda yapıştırma payı bulunur.
 *
 *   en  = 2 x (U + G) + yapıştırma payı
 *   boy = Y + G          (üst kapak G/2 + gövde Y + alt kapak G/2)
 */
function dieLine0201(o: KutuOlcu, yapistirmaPayi: number): DieLine {
  const { uzunluk: U, genislik: G, yukseklik: Y } = o;
  const kapak = G / 2;
  const boy = Y + G;
  const en = 2 * (U + G) + yapistirmaPayi;

  const paneller: Panel[] = [];
  const katlamalar: KatlamaCizgisi[] = [];

  const genislikler = [U, G, U, G];
  const adlar = ["Uzun yüz", "Kısa yüz", "Uzun yüz", "Kısa yüz"];
  let x = 0;

  for (let i = 0; i < genislikler.length; i++) {
    const w = genislikler[i];
    paneller.push({ x, y: kapak, w, h: Y, etiket: adlar[i], tur: "govde" });
    paneller.push({ x, y: 0, w, h: kapak, etiket: "Kapak", tur: "kapak" });
    paneller.push({ x, y: kapak + Y, w, h: kapak, etiket: "Kapak", tur: "kapak" });

    // Panel arası dikey katlama
    if (i > 0) katlamalar.push({ x1: x, y1: 0, x2: x, y2: boy });
    x += w;
  }

  // Yapıştırma payı
  if (yapistirmaPayi > 0) {
    katlamalar.push({ x1: x, y1: 0, x2: x, y2: boy });
    paneller.push({ x, y: kapak, w: yapistirmaPayi, h: Y, etiket: "Yapıştırma", tur: "yapistirma" });
  }

  // Kapak katlama çizgileri (yatay)
  katlamalar.push({ x1: 0, y1: kapak, x2: en, y2: kapak });
  katlamalar.push({ x1: 0, y1: kapak + Y, x2: en, y2: kapak + Y });

  return {
    kod: "0201", en, boy,
    alanM2: (en * boy) / 1_000_000,
    paneller, katlamalar,
    formul: {
      en: `2 × (${U} + ${G})${yapistirmaPayi ? ` + ${yapistirmaPayi}` : ""} = ${en} mm`,
      boy: `${Y} + ${G} = ${boy} mm`,
    },
  };
}

/**
 * FEFCO 0401 — tek parça sarma kutu (one-piece folder).
 *
 * Levha, kısa kesitte U şeklinde katlanır: yan duvar, taban, yan duvar.
 * Uzun eksende ise ön duvar, taban, arka duvar, kapak ve kilit dili
 * sırayla gelir.
 *
 *   en  = G + 2Y
 *   boy = 2U + 3Y   (ön Y + taban U + arka Y + kapak U + kilit Y)
 */
function dieLine0401(o: KutuOlcu): DieLine {
  const { uzunluk: U, genislik: G, yukseklik: Y } = o;
  const en = G + 2 * Y;
  const boy = 2 * U + 3 * Y;

  const paneller: Panel[] = [];
  const katlamalar: KatlamaCizgisi[] = [];

  // Uzun eksende sıralanan bantlar
  const bantlar: { h: number; etiket: string; tur: Panel["tur"] }[] = [
    { h: Y, etiket: "Ön duvar", tur: "govde" },
    { h: U, etiket: "Taban", tur: "govde" },
    { h: Y, etiket: "Arka duvar", tur: "govde" },
    { h: U, etiket: "Kapak", tur: "kapak" },
    { h: Y, etiket: "Kilit dili", tur: "kapak" },
  ];

  let y = 0;
  for (const b of bantlar) {
    // Orta şerit her zaman gövde genişliği kadar
    paneller.push({ x: Y, y, w: G, h: b.h, etiket: b.etiket, tur: b.tur });
    // Yanlar yalnızca taban ve duvar bantlarında kulak olur
    if (b.etiket === "Taban" || b.etiket === "Kapak") {
      paneller.push({ x: 0, y, w: Y, h: b.h, etiket: "Yan", tur: "kapak" });
      paneller.push({ x: Y + G, y, w: Y, h: b.h, etiket: "Yan", tur: "kapak" });
    }
    if (y > 0) katlamalar.push({ x1: 0, y1: y, x2: en, y2: y });
    y += b.h;
  }

  katlamalar.push({ x1: Y, y1: 0, x2: Y, y2: boy });
  katlamalar.push({ x1: Y + G, y1: 0, x2: Y + G, y2: boy });

  return {
    kod: "0401", en, boy,
    alanM2: (en * boy) / 1_000_000,
    paneller, katlamalar,
    formul: {
      en: `${G} + 2 × ${Y} = ${en} mm`,
      boy: `2 × ${U} + 3 × ${Y} = ${boy} mm`,
    },
  };
}

export function dieLineHesapla(
  kod: FefcoKodu,
  olcu: KutuOlcu,
  yapistirmaPayi = 35,
): DieLine | null {
  const { uzunluk, genislik, yukseklik } = olcu;
  if (!(uzunluk > 0 && genislik > 0 && yukseklik > 0)) return null;
  return kod === "0201"
    ? dieLine0201(olcu, yapistirmaPayi)
    : dieLine0401(olcu);
}

export const FEFCO_ADLARI: Record<FefcoKodu, string> = {
  "0201": "0201 — Amerikan kutu",
  "0401": "0401 — Tek parça sarma",
};
