import type { Blok, Konteyner, PackAyar, PackSonuc, PackUrun } from "./types";
import { VARSAYILAN_AYAR } from "./types";

const EPS = 1e-6;

/**
 * Tekrarlanabilir sözde rastgele üretici — aynı tohum aynı planı verir.
 *
 * splitmix32 kullanılıyor. Basit bir LCG ile başlanmıştı ama ardışık
 * tohumlar (0, 1, 2...) neredeyse aynı diziyi üretiyordu; her deneme aynı
 * planı çıkarınca çoklu tohum araması işlevsiz kalıyordu. splitmix32
 * tohumu önce karıştırdığı için 0 ve 1 tamamen farklı diziler verir.
 */
function rastgele(tohum: number) {
  let s = (tohum + 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    z = (z ^ (z >>> 15)) >>> 0;
    return z / 4294967296;
  };
}

/** Bir kolinin üç ölçüsünün tekrarsız permütasyonları — olası duruşlar */
function durusler(boy: number, en: number, yuk: number): [number, number, number][] {
  const p: [number, number, number][] = [
    [boy, en, yuk], [boy, yuk, en], [en, boy, yuk],
    [en, yuk, boy], [yuk, boy, en], [yuk, en, boy],
  ];
  const gorulen = new Set<string>();
  return p.filter((d) => {
    const k = d.join("|");
    if (gorulen.has(k)) return false;
    gorulen.add(k);
    return true;
  });
}

interface Aday {
  hacim: number;
  sku: string;
  l: number; w: number; h: number;
  nx: number; ny: number; nz: number;
  n: number;
}

/**
 * Bir bölgeyi doldurur ve kalan boşluğu üçe bölerek kendini çağırır:
 * bloğun sağı, yanı (y) ve üstü (z). Guillotine bölme olduğu için
 * bloklar asla çakışmaz.
 *
 * Dönen değer yerleştirilen toplam hacim.
 */
function bolgeDoldur(
  x0: number, y0: number, z0: number,
  dx: number, dy: number, dz: number,
  kalan: Map<string, number>,
  kalanMin: Map<string, number>,
  urunler: Map<string, PackUrun & { hacim: number; durus: [number, number, number][] }>,
  cikti: Blok[],
  rnd: () => number,
  topK: number,
  ayar: PackAyar,
  derinlik: number,
): number {
  if (dx <= EPS || dy <= EPS || dz <= EPS || derinlik > ayar.maxDerinlik) return 0;

  const adaylar: Aday[] = [];
  for (const [sku, u] of urunler) {
    const rem = kalan.get(sku) ?? 0;
    if (rem <= 0) continue;

    for (const [dl, dw, dh] of u.durus) {
      if (dl > dx + EPS || dw > dy + EPS || dh > dz + EPS) continue;
      // Duvar tek koli derinliğinde kurulur.
      //
      // Referans planda bölgeler 43, 98, 57.5 cm gibi tam bir koli
      // ölçüsündeydi; derinlik hep 1 sıraydı. Bu sınır olmadan serbest
      // ürünlerde tek blok 18 sıra derinliğe gidip konteyner boyunca
      // uzanıyor, duvar mantığı bozuluyordu — sahada da yüklenemez.
      const nxHam = Math.floor((dx + EPS) / dl);
      const nx = derinlik === 0 ? Math.min(1, nxHam) : nxHam;
      const ny = Math.floor((dy + EPS) / dw);
      const nz = Math.floor((dz + EPS) / dh);
      if (nx * ny * nz <= 0) continue;

      // Kalan talebi aşmayacak şekilde kolon/sıra sayısını kırp
      const ny2 = Math.min(ny, Math.max(1, Math.ceil(rem / (nx * nz))));
      const nx2 = Math.min(nx, Math.max(1, Math.ceil(rem / (ny2 * nz))));
      const n = Math.min(rem, nx2 * ny2 * nz);

      // Çok küçük blok kurma — sahada dağınık üç beş koli olmasın
      if (n < Math.min(ayar.minBlok, rem)) continue;

      // Asgari payı henüz karşılanmamış ürün öne alınır — böylece seçilen
      // her ürün plana giriyor, konteyner tek tip ürünle dolmuyor
      const minEksik = kalanMin.get(sku) ?? 0;
      const oncelik = minEksik > 0 ? 1e9 : 0;
      adaylar.push({
        hacim: oncelik + n * u.hacim,
        sku, l: dl, w: dw, h: dh, nx: nx2, ny: ny2, nz, n,
      });
    }
  }
  if (adaylar.length === 0) return 0;

  adaylar.sort((a, b) => b.hacim - a.hacim);
  const k = Math.min(topK, adaylar.length);
  const sec = k > 1 ? adaylar[Math.floor(rnd() * k)] : adaylar[0];

  const bx = sec.nx * sec.l;
  const by = sec.ny * sec.w;
  const bz = sec.nz * sec.h;
  kalan.set(sec.sku, (kalan.get(sec.sku) ?? 0) - sec.n);
  kalanMin.set(sec.sku, Math.max(0, (kalanMin.get(sec.sku) ?? 0) - sec.n));
  cikti.push({
    sku: sec.sku, x: x0, y: y0, z: z0, dx: bx, dy: by, dz: bz,
    l: sec.l, w: sec.w, h: sec.h, nx: sec.nx, ny: sec.ny, nz: sec.nz, n: sec.n,
  });

  let tot = sec.hacim;
  tot += bolgeDoldur(x0 + bx, y0, z0, dx - bx, by, bz, kalan, kalanMin, urunler, cikti, rnd, topK, ayar, derinlik + 1);
  tot += bolgeDoldur(x0, y0 + by, z0, dx, dy - by, dz, kalan, kalanMin, urunler, cikti, rnd, topK, ayar, derinlik + 1);
  tot += bolgeDoldur(x0, y0, z0 + bz, bx, by, dz - bz, kalan, kalanMin, urunler, cikti, rnd, topK, ayar, derinlik + 1);
  return tot;
}

/** Tek bir yerleştirme denemesi — konteyner boyunca duvar duvar ilerler */
function tekDeneme(
  tohum: number,
  topK: number,
  kont: Konteyner,
  urunler: Map<string, PackUrun & { hacim: number; durus: [number, number, number][] }>,
  hedefler: Map<string, number>,
  asgariler: Map<string, number>,
  ayar: PackAyar,
): { bloklar: Blok[]; kalan: Map<string, number>; kalanMin: Map<string, number>; hacim: number; boy: number } {
  const rnd = rastgele(tohum);
  const kalan = new Map(hedefler);
  const kalanMin = new Map(asgariler);
  const bloklar: Blok[] = [];
  let x = 0;
  let toplam = 0;

  // Aday duvar derinlikleri: ürün ölçülerinin kendisi. Böylece duvar tam
  // bir koli boyutuna oturur, arada ölü boşluk kalmaz.
  const olcuSet = new Set<number>();
  for (const u of urunler.values()) {
    olcuSet.add(u.boy); olcuSet.add(u.en); olcuSet.add(u.yuk);
  }
  const olculer = [...olcuSet].sort((a, b) => a - b);

  let guard = 0;
  while (x < kont.uzunluk - EPS && guard++ < 200) {
    let kalanToplam = 0;
    for (const v of kalan.values()) kalanToplam += v;
    if (kalanToplam <= 0) break;

    let enIyi: { skor: number; boy: number; bloklar: Blok[]; kalan: Map<string, number>; kalanMin: Map<string, number>; hacim: number } | null = null;
    const adayBoylar = olculer.filter((o) => o <= kont.uzunluk - x + EPS);
    adayBoylar.push(kont.uzunluk - x);

    for (const Lz of adayBoylar) {
      for (let t = 0; t < 2; t++) {
        const k2 = new Map(kalan);
        const km2 = new Map(kalanMin);
        const o: Blok[] = [];
        const v = bolgeDoldur(0, 0, 0, Lz, kont.genislik, kont.yukseklik, k2, km2, urunler, o, rnd, topK, ayar, 0);
        if (v <= 0) continue;
        const skor = (v - ayar.blokCezasi * o.length) / Lz;
        if (enIyi === null || skor > enIyi.skor) {
          enIyi = { skor, boy: Lz, bloklar: o, kalan: k2, kalanMin: km2, hacim: v };
        }
      }
    }
    if (enIyi === null) break;

    for (const b of enIyi.bloklar) b.x += x;
    bloklar.push(...enIyi.bloklar);
    for (const [s, v] of enIyi.kalan) kalan.set(s, v);
    for (const [s, v] of enIyi.kalanMin) kalanMin.set(s, v);
    x += enIyi.boy;
    toplam += enIyi.hacim;
  }

  return { bloklar, kalan, kalanMin, hacim: toplam, boy: x };
}

/**
 * Yerleştirme araması.
 *
 * Kilitli ürünlerde hedef tam karşılanmaya çalışılır. Serbest ürünlerde
 * hedef üst sınırdır; boşluk kaldıkça doldurulur.
 *
 * Sıralama önceliği pack.py ile aynı: önce karşılanmayan kilitli talep,
 * sonra kullanılan boy, sonra blok sayısı.
 */
export function planla(
  urunListesi: PackUrun[],
  kont: Konteyner,
  ayarKismi: Partial<PackAyar> = {},
  ilerleme?: (yuzde: number) => void,
): PackSonuc {
  const ayar = { ...VARSAYILAN_AYAR, ...ayarKismi };

  const urunler = new Map(
    urunListesi
      .filter((u) => u.boy > 0 && u.en > 0 && u.yuk > 0 && u.hedef > 0)
      .map((u) => [
        u.sku,
        { ...u, hacim: u.boy * u.en * u.yuk, durus: durusler(u.boy, u.en, u.yuk) },
      ]),
  );
  if (urunler.size === 0) {
    return bosSonuc(kont);
  }

  const hedefler = new Map([...urunler].map(([s, u]) => [s, u.hedef]));
  // Asgari pay hedefi aşamaz — kullanıcı 5 koli istediyse asgari de 5 olur
  const asgariler = new Map(
    [...urunler].map(([s, u]) => [s, Math.min(u.enAz ?? 0, u.hedef)]),
  );
  const kilitli = new Set([...urunler].filter(([, u]) => u.kilitli).map(([s]) => s));

  // Sıralama: önce karşılanmayan asgari paylar, sonra kilitli talep,
  // sonra kullanılan boy, sonra blok sayısı. Asgari en üstte çünkü
  // seçilen ürünün plana hiç girmemesi doluluktan daha rahatsız edici.
  const skorla = (r: { bloklar: Blok[]; kalan: Map<string, number>; kalanMin: Map<string, number>; boy: number }) => {
    let minEksik = 0;
    for (const v of r.kalanMin.values()) minEksik += v;
    let kilitliEksik = 0;
    for (const s of kilitli) kilitliEksik += r.kalan.get(s) ?? 0;
    return [-minEksik, -kilitliEksik, -Math.round(r.boy * 10) / 10, -r.bloklar.length];
  };
  const dahaIyi = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
  };

  const t0 = Date.now();
  let enIyi: ReturnType<typeof tekDeneme> | null = null;
  let tohum = 0;
  while (Date.now() - t0 < ayar.butceMs) {
    for (const tk of [1, 2, 3]) {
      const r = tekDeneme(tohum, tk, kont, urunler, hedefler, asgariler, ayar);
      if (enIyi === null || dahaIyi(skorla(r), skorla(enIyi))) enIyi = r;
    }
    tohum++;
    if (ilerleme && tohum % 5 === 0) {
      ilerleme(Math.min(99, ((Date.now() - t0) / ayar.butceMs) * 100));
    }
  }
  if (enIyi === null) return bosSonuc(kont);

  // ─── Sonucu derle ───
  const yuklenen: Record<string, number> = {};
  let hacim = 0;
  let agirlik = 0;
  let koli = 0;
  for (const b of enIyi.bloklar) {
    yuklenen[b.sku] = (yuklenen[b.sku] ?? 0) + b.n;
    const u = urunler.get(b.sku)!;
    hacim += b.n * u.hacim;
    agirlik += b.n * u.koliAgirlik;
    koli += b.n;
  }
  const eksik: Record<string, number> = {};
  for (const [s, v] of enIyi.kalan) if (v > 0) eksik[s] = v;

  const kontHacim = kont.uzunluk * kont.genislik * kont.yukseklik;
  return {
    bloklar: enIyi.bloklar,
    eksik,
    yuklenen,
    kullanilanBoy: Math.round(enIyi.boy * 10) / 10,
    toplamHacim: hacim / 1e6,
    toplamAgirlik: Math.round(agirlik * 100) / 100,
    toplamKoli: koli,
    dolulukYuzde: Math.round((hacim / kontHacim) * 1000) / 10,
    agirlikAsimi: kont.maxYukKg > 0 && agirlik > kont.maxYukKg,
  };
}

function bosSonuc(kont: Konteyner): PackSonuc {
  return {
    bloklar: [], eksik: {}, yuklenen: {}, kullanilanBoy: 0,
    toplamHacim: 0, toplamAgirlik: 0, toplamKoli: 0,
    dolulukYuzde: 0, agirlikAsimi: false,
  };
}
