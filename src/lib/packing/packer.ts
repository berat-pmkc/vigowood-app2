/**
 * Konteyner yükleme planlaması — uygulama köprüsü.
 *
 * ÖNEMLİ: Burada artık algoritma YOK.
 *
 * Önceden bu dosya pack.py'nin elle yazılmış bir portunu içeriyordu.
 * "HC40 konteyner yükleme optimizasyonu" çalışmasında üretilen asıl motor
 * (container-packer) elimize geçince o port bırakıldı: aynı ürün setinde
 * referans motor %96,1 doluluk / 25 blok verirken port %88-92 bandında
 * kalıyordu. Fark ayar değil yapısaldı — referans motor çoklu başlangıçta
 * yalnız tohumu değil topK ve minBlok değerlerini de tarıyor, sonda boş
 * kalan boyu ayrı bir "ilave kapasite" geçişiyle dolduruyor.
 *
 * Bu dosya yalnızca tip dönüşümü yapar:
 *   PackUrun/Konteyner  →  ProductInput/ContainerDims   (girdi)
 *   PackResult          →  PackSonuc                     (çıktı)
 *
 * Arayüz ve Web Worker eski imzayı kullanmaya devam ettiği için
 * planlama ekranında değişiklik gerekmedi.
 */

import { pack, validatePlan, type ProductInput } from "@/lib/container-packer";
import {
  VARSAYILAN_AYAR,
  type Blok,
  type Konteyner,
  type PackAyar,
  type PackSonuc,
  type PackUrun,
} from "./types";

/**
 * Hedef girilmemiş ürünlere eşit HACİM payı verir.
 *
 * Keşif modunda tüm ürünler serbest bırakılınca algoritma konteyneri en sıkı
 * yerleşen ürünle dolduruyor, seçilen diğer ürünler plana hiç girmiyordu.
 * Konteynerin serbest hacmi ürün sayısına bölünüp her birinin koli hacmine
 * göre adede çevriliyor. Çarpan 1,25: pay biraz esnek olsun ama eşitlik
 * bozulmasın. (2,2'ye çıkarınca doluluk %88,8 → %90 oluyor, buna karşılık
 * ürünler arası hacim farkı 3 kattan 5 kata çıkıyor — eşit hacim istendiği
 * için 1,25'te bırakıldı.)
 */
const PAY_CARPANI = 1.25;

function esitHacimPayi(gecerli: PackUrun[], kont: Konteyner): Map<string, number> {
  const kontHacim = kont.uzunluk * kont.genislik * kont.yukseklik;
  const kilitliHacim = gecerli
    .filter((u) => u.kilitli && u.hedef > 0)
    .reduce((t, u) => t + u.hedef * u.boy * u.en * u.yuk, 0);

  const serbestler = gecerli.filter((u) => !(u.kilitli && u.hedef > 0));
  const paySayisi = Math.max(1, serbestler.length);
  const payHacim = (Math.max(0, kontHacim - kilitliHacim) / paySayisi) * PAY_CARPANI;

  const pay = new Map<string, number>();
  for (const u of serbestler) {
    const koliHacim = u.boy * u.en * u.yuk;
    pay.set(u.sku, koliHacim > 0 ? Math.max(1, Math.floor(payHacim / koliHacim)) : 0);
  }
  return pay;
}

export function planla(
  urunListesi: PackUrun[],
  kont: Konteyner,
  ayarKismi: Partial<PackAyar> = {},
  ilerleme?: (yuzde: number) => void,
): PackSonuc {
  const ayar = { ...VARSAYILAN_AYAR, ...ayarKismi };
  const gecerli = urunListesi.filter((u) => u.boy > 0 && u.en > 0 && u.yuk > 0);

  if (gecerli.length === 0) {
    return {
      bloklar: [], eksik: {}, yuklenen: {}, kullanilanBoy: 0,
      toplamHacim: 0, toplamAgirlik: 0, toplamKoli: 0,
      dolulukYuzde: 0, agirlikAsimi: false,
    };
  }

  const pay = esitHacimPayi(gecerli, kont);

  const girdi: ProductInput[] = gecerli.map((u) => {
    // Kilitli ürün: tam olarak hedef kadar, artırma yok.
    // Serbest ürün: eşit hacim payı kadar hedef, enAz altına düşmesin.
    const kilitli = u.kilitli && u.hedef > 0;
    const hedef = kilitli ? u.hedef : Math.max(u.enAz, pay.get(u.sku) ?? u.enAz);
    return {
      id: u.sku,
      name: u.ad ?? u.sku,
      dims: [u.boy, u.en, u.yuk] as [number, number, number],
      qty: hedef,
      // Kilitli ürün büyümez; serbest ürün boşluk kalırsa payının 2 katına
      // kadar artabilir — konteynerin sonundaki ölü boyu bu kapatıyor
      ...(kilitli ? {} : { maxQty: hedef * 2 }),
      color: u.renk,
    };
  });

  ilerleme?.(10);

  const plan = pack(
    girdi,
    {
      length: kont.uzunluk,
      width: kont.genislik,
      height: kont.yukseklik,
    },
    {
      timeBudgetMs: ayar.butceMs,
      minBlockQty: ayar.minBlok,
      blockPenalty: ayar.blokCezasi,
      maxDepth: ayar.maxDerinlik,
      seed: 1,
    },
  );

  ilerleme?.(90);

  // Geometrik doğrulama — ok:false dönen plan sahaya gitmemeli
  const dogrulama = validatePlan(plan, girdi);
  if (!dogrulama.ok) {
    throw new Error(`Plan doğrulaması başarısız: ${dogrulama.errors.slice(0, 3).join(" | ")}`);
  }

  const bloklar: Blok[] = plan.blocks.map((b) => ({
    sku: b.productId,
    x: b.x, y: b.y, z: b.z,
    dx: b.dx, dy: b.dy, dz: b.dz,
    l: b.l, w: b.w, h: b.h,
    nx: b.nx, ny: b.ny, nz: b.nz,
    n: b.count,
  }));

  const agirlikHar = new Map(gecerli.map((u) => [u.sku, u.koliAgirlik]));
  const toplamAgirlik = Object.entries(plan.placed)
    .reduce((t, [sku, n]) => t + n * (agirlikHar.get(sku) ?? 0), 0);

  ilerleme?.(100);

  return {
    bloklar,
    eksik: plan.shortfall,
    yuklenen: plan.placed,
    kullanilanBoy: plan.usedLength,
    toplamHacim: plan.volume,
    toplamAgirlik,
    toplamKoli: plan.totalUnits,
    dolulukYuzde: Math.round(plan.fillRatio * 1000) / 10,
    agirlikAsimi: kont.maxYukKg > 0 && toplamAgirlik > kont.maxYukKg,
  };
}
