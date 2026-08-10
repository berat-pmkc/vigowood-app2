/**
 * Konteyner yükleme planlaması — tip tanımları.
 *
 * Algoritma HC40 optimizasyon çalışmasındaki pack.py'nin portudur:
 * konteyner boyunca duvar duvar ilerlenir, her duvar guillotine bölme ile
 * doldurulur, çoklu tohumla en iyi sonuç aranır.
 */

/** Planlamaya giren bir ürün — koli ölçüleri ve sınırlarıyla */
export interface PackUrun {
  sku: string;
  ad: string | null;
  /** Koli dış ölçüleri (cm): boy, en, yükseklik */
  boy: number;
  en: number;
  yuk: number;
  /** Bir koliye giren ürün adedi — plan koli bazında, adet bundan türer */
  koliAdedi: number;
  /** Koli ağırlığı (kg), bilinmiyorsa 0 */
  koliAgirlik: number;
  /**
   * Hedef koli sayısı.
   * kilitli=true ise tam bu kadar yüklenir.
   * kilitli=false ise üst sınır olarak kullanılır; sistem daha az koyabilir.
   */
  hedef: number;
  kilitli: boolean;
  renk: string;
}

export interface Konteyner {
  uzunluk: number;
  genislik: number;
  yukseklik: number;
  maxYukKg: number;
}

/** Yerleştirilmiş tek bir blok — aynı ürünün aynı duruştaki grubu */
export interface Blok {
  sku: string;
  /** Blok köşesinin konteyner içindeki konumu (cm) */
  x: number;
  y: number;
  z: number;
  /** Bloğun kapladığı hacmin ölçüleri */
  dx: number;
  dy: number;
  dz: number;
  /** Kolinin bu duruştaki kenar uzunlukları: boya, ene, diğe gelen */
  l: number;
  w: number;
  h: number;
  /** Boyda kaç sıra, ende kaç kolon, üst üste kaç kat */
  nx: number;
  ny: number;
  nz: number;
  /** Bu blokta gerçekte kaç koli var (nx*ny*nz'den az olabilir) */
  n: number;
}

export interface PackSonuc {
  bloklar: Blok[];
  /** Karşılanamayan koli sayısı, ürün bazında */
  eksik: Record<string, number>;
  /** Yüklenen koli sayısı, ürün bazında */
  yuklenen: Record<string, number>;
  kullanilanBoy: number;
  toplamHacim: number;
  toplamAgirlik: number;
  toplamKoli: number;
  dolulukYuzde: number;
  /** Ağırlık limiti aşıldıysa true */
  agirlikAsimi: boolean;
}

export interface PackAyar {
  /** Arama süresi (ms) */
  butceMs: number;
  /** Bu sayıdan az koli içeren blok kurulmaz — sahada dağınıklığı önler */
  minBlok: number;
  /** Guillotine bölmede azami derinlik */
  maxDerinlik: number;
  /**
   * Blok cezası. Skor = (hacim - ceza * blokSayısı) / derinlik.
   * Yükseltmek daha az ve daha büyük blok üretir; sahada yüklemesi kolaylaşır
   * ama doluluk bir miktar düşebilir.
   */
  blokCezasi: number;
}

export const VARSAYILAN_AYAR: PackAyar = {
  butceMs: 8000,
  minBlok: 6,
  maxDerinlik: 3,
  blokCezasi: 80000,
};
