/**
 * container-packer — konteyner yükleme optimizasyonu
 * =================================================
 * 3D guillotine (kesim düzlemi) tabanlı blok yerleştirme + rastgele yeniden
 * başlatmalı arama. Sıfır bağımlılık; hem Node.js (Vercel API route / server
 * action) hem de tarayıcıda çalışır.
 *
 * Temel fikir
 * -----------
 * 1. Konteyner boyunca (X ekseni) art arda "bölge"ler açılır. Her bölge tam
 *    kesit (en × yükseklik) kaplar, boyu ürün ölçülerinden seçilir.
 * 2. Bölgenin içi guillotine yöntemiyle doldurulur: her adımda en çok hacim
 *    kaplayan (ürün, duruş, ızgara) seçilir, kalan hacim çakışmayan 3 dikdörtgen
 *    prizmaya bölünüp aynı işlem tekrarlanır.
 * 3. Farklı tohumlarla (seed) yüzlerce kez çalıştırılıp en iyi sonuç seçilir.
 *
 * Çıktı geometrisi kesindir: hiçbir koli çakışmaz, hiçbiri sınır dışına taşmaz
 * (validatePlan ile doğrulanabilir).
 */

// ────────────────────────────────────────────────────────────────────────────
// Tipler
// ────────────────────────────────────────────────────────────────────────────

/** Bir kolinin üç kenar ölçüsü (cm). Sıra önemsizdir. */
export type Dims = [number, number, number];

export interface ProductInput {
  /** Benzersiz kimlik, ör. "XL" */
  id: string;
  /** Ekranda gösterilecek ad */
  name?: string;
  /** Koli dış ölçüleri (cm) — sıra önemsiz */
  dims: Dims;
  /** Hedef adet. Algoritma bu kadarını yüklemeye çalışır. */
  qty: number;
  /**
   * Opsiyonel. Yükleme sonunda boşluk kalırsa bu adede kadar artırılabilir.
   * Verilmezse qty ile sınırlı kalır (artış yapılmaz).
   */
  maxQty?: number;
  /** Görselleştirme rengi (CSS) */
  color?: string;
  /**
   * Opsiyonel duruş kısıtı. Verilirse koli SADECE bu duruşlarda konur.
   * Her eleman [boy, en, yükseklik] sırasındadır.
   * Örn. "sadece dik durabilir, devrilemez":
   *   allowedOrientations: [[57.5, 43, 39], [43, 57.5, 39]]
   */
  allowedOrientations?: Dims[];
}

export interface ContainerDims {
  /** Boy — konteyner uzunluğu, X ekseni (cm) */
  length: number;
  /** En — genişlik, Y ekseni (cm) */
  width: number;
  /** Yükseklik — Z ekseni (cm) */
  height: number;
}

/**
 * Yerleştirilmiş bir blok: aynı üründen, aynı duruşta, nx × ny × nz ızgara.
 * Konum (x,y,z) bloğun dipteki-soldaki-tabandaki köşesidir.
 */
export interface Block {
  productId: string;
  /** Blok köşesi (cm) */
  x: number; y: number; z: number;
  /** Blok dış ölçüleri (cm) */
  dx: number; dy: number; dz: number;
  /** Kolinin duruşu: hangi ölçüsü hangi eksene bakıyor (cm) */
  l: number; // boy yönü (X) — derinlik
  w: number; // en yönü  (Y) — yanal
  h: number; // dik      (Z) — yükseklik
  /** Izgara: boyda kaç sıra, ende kaç kolon, üst üste kaç kat */
  nx: number; ny: number; nz: number;
  /** Bu blokta gerçekten bulunan koli adedi (nx*ny*nz'den küçük olabilir) */
  count: number;
  /** Hedef adedin üstüne eklenen ilave kapasite mi */
  bonus?: boolean;
}

export interface PackResult {
  container: ContainerDims;
  blocks: Block[];
  /** Ürün başına yüklenen adet */
  placed: Record<string, number>;
  /** Ürün başına yüklenemeyen adet (0 olması hedeflenir) */
  shortfall: Record<string, number>;
  /** Toplam koli */
  totalUnits: number;
  /** Yüklenen hacim (cm³) */
  volume: number;
  /** Hacim doluluk oranı (0–1) */
  fillRatio: number;
  /** Kolilerin ulaştığı en uzak nokta (cm) */
  usedLength: number;
  /** Denenen tohum sayısı */
  iterations: number;
}

export interface PackOptions {
  /**
   * Bir blokta en az kaç koli olsun. Yüksek değer daha sade/uygulanabilir
   * dizilim, düşük değer daha yüksek doluluk verir. Varsayılan 4.
   */
  minBlockQty?: number;
  /** Bir bölge içinde en fazla kaç alt bölünme. Varsayılan 6. */
  maxDepth?: number;
  /**
   * Blok başına ceza (cm³). Yükseltirseniz algoritma az sayıda büyük blok
   * tercih eder (depoda uygulaması kolay). Varsayılan 15000.
   */
  blockPenalty?: number;
  /** Her adımda en iyi kaç seçenek arasından rastgele seçilsin. Varsayılan 3. */
  topK?: number;
  /** Arama süresi (ms). Varsayılan 5000. Vercel'de 10000'i geçmeyin. */
  timeBudgetMs?: number;
  /** Sabit tohum — aynı girdi için hep aynı sonuç istiyorsanız. */
  seed?: number;
  /**
   * Hedeflerin tamamı yüklenen ilk plan bulunduğunda aramayı bitir.
   * Hızlı yanıt gerekiyorsa true yapın; kaliteden bir miktar feragat edersiniz.
   * Varsayılan false.
   */
  stopWhenComplete?: boolean;
}

const EPS = 1e-6;

const DEFAULTS: Required<Omit<PackOptions, "seed">> = {
  stopWhenComplete: false,
  minBlockQty: 4,
  maxDepth: 6,
  blockPenalty: 15000,
  topK: 3,
  timeBudgetMs: 5000,
};

/** Yaygın konteyner iç ölçüleri (cm) — muhafazakâr/garanti değerler. */
export const CONTAINERS: Record<string, ContainerDims> = {
  "40HC": { length: 1200, width: 235, height: 269 },
  "40STD": { length: 1200, width: 235, height: 239 },
  "20STD": { length: 589, width: 235, height: 239 },
  "45HC": { length: 1355, width: 235, height: 269 },
};

// ────────────────────────────────────────────────────────────────────────────
// Yardımcılar
// ────────────────────────────────────────────────────────────────────────────

interface Orient { l: number; w: number; h: number }

interface Prep {
  id: string;
  dims: Dims;
  vol: number;
  orients: Orient[];
  qty: number;
  maxQty: number;
}

function orientationsOf(dims: Dims, allowed?: Dims[]): Orient[] {
  if (allowed && allowed.length) {
    return allowed.map(([l, w, h]) => ({ l, w, h }));
  }
  const [a, b, c] = dims;
  const perms: Dims[] = [
    [a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a],
  ];
  const seen = new Set<string>();
  const out: Orient[] = [];
  for (const [l, w, h] of perms) {
    const k = `${l}|${w}|${h}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ l, w, h });
  }
  return out;
}

/** Deterministik PRNG (mulberry32) — aynı seed hep aynı planı verir. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function prepare(products: ProductInput[]): Prep[] {
  return products
    .filter((p) => p.qty > 0 || (p.maxQty ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      dims: p.dims,
      vol: p.dims[0] * p.dims[1] * p.dims[2],
      orients: orientationsOf(p.dims, p.allowedOrientations),
      qty: p.qty,
      maxQty: Math.max(p.qty, p.maxQty ?? p.qty),
    }));
}

// ────────────────────────────────────────────────────────────────────────────
// Çekirdek: guillotine bölge doldurma
// ────────────────────────────────────────────────────────────────────────────

interface Ctx {
  items: Prep[];
  minBlockQty: number;
  maxDepth: number;
  topK: number;
  rand: () => number;
}

/**
 * (x0,y0,z0) köşeli dx×dy×dz boşluğu doldurur. Yerleştirilen kolilerin toplam
 * hacmini döndürür, blokları `out` dizisine ekler, `demand`ı düşer.
 */
function fillRegion(
  x0: number, y0: number, z0: number,
  dx: number, dy: number, dz: number,
  demand: Record<string, number>,
  out: Block[],
  ctx: Ctx,
  depth = 0,
): number {
  if (dx <= EPS || dy <= EPS || dz <= EPS || depth > ctx.maxDepth) return 0;

  type Opt = {
    vol: number; item: Prep; o: Orient;
    nx: number; ny: number; nz: number; n: number;
  };
  const opts: Opt[] = [];

  for (const item of ctx.items) {
    const rem = demand[item.id] ?? 0;
    if (rem <= 0) continue;
    for (const o of item.orients) {
      if (o.l > dx + EPS || o.w > dy + EPS || o.h > dz + EPS) continue;
      const nxMax = Math.floor((dx + EPS) / o.l);
      const nyMax = Math.floor((dy + EPS) / o.w);
      const nzMax = Math.floor((dz + EPS) / o.h);
      if (nxMax * nyMax * nzMax <= 0) continue;

      // Talebi aşmamak için önce kolon, sonra derinlik sayısını kırp
      const ny = Math.min(nyMax, Math.max(1, Math.ceil(rem / (nxMax * nzMax))));
      const nx = Math.min(nxMax, Math.max(1, Math.ceil(rem / (ny * nzMax))));
      const n = Math.min(rem, nx * ny * nzMax);

      // Çok küçük blokları ele (uygulanabilirlik için)
      if (n < Math.min(ctx.minBlockQty, rem)) continue;

      opts.push({ vol: n * item.vol, item, o, nx, ny, nz: nzMax, n });
    }
  }
  if (!opts.length) return 0;

  opts.sort((a, b) => b.vol - a.vol);
  const k = Math.min(ctx.topK, opts.length);
  const ch = k > 1 ? opts[Math.floor(ctx.rand() * k)] : opts[0];

  const bx = ch.nx * ch.o.l;
  const by = ch.ny * ch.o.w;
  const bz = ch.nz * ch.o.h;

  demand[ch.item.id] -= ch.n;
  out.push({
    productId: ch.item.id,
    x: x0, y: y0, z: z0,
    dx: bx, dy: by, dz: bz,
    l: ch.o.l, w: ch.o.w, h: ch.o.h,
    nx: ch.nx, ny: ch.ny, nz: ch.nz,
    count: ch.n,
  });

  let total = ch.vol;
  // Guillotine: kalan hacim çakışmayan 3 prizmaya bölünür
  total += fillRegion(x0 + bx, y0, z0, dx - bx, by, bz, demand, out, ctx, depth + 1); // arka
  total += fillRegion(x0, y0 + by, z0, dx, dy - by, dz, demand, out, ctx, depth + 1); // yan
  total += fillRegion(x0, y0, z0 + bz, dx, by, dz - bz, demand, out, ctx, depth + 1); // üst
  return total;
}

// ────────────────────────────────────────────────────────────────────────────
// Tek geçiş: bölge bölge konteyneri doldur
// ────────────────────────────────────────────────────────────────────────────

interface OnceResult {
  blocks: Block[];
  demand: Record<string, number>;
  volume: number;
  used: number;
}

function packOnce(
  ctx: Ctx,
  cont: ContainerDims,
  blockPenalty: number,
  initialDemand: Record<string, number>,
): OnceResult {
  let demand = { ...initialDemand };
  const blocks: Block[] = [];
  let x = 0;
  let volume = 0;

  // Bölge boyu adayları: tüm ürün kenar ölçüleri
  const zoneLens = Array.from(
    new Set(ctx.items.flatMap((i) => i.dims as number[])),
  ).sort((a, b) => a - b);

  const remaining = () =>
    Object.values(demand).reduce((s, v) => s + Math.max(0, v), 0);

  while (x < cont.length - EPS && remaining() > 0) {
    let best: { sc: number; Lz: number; out: Block[]; d: Record<string, number>; v: number } | null = null;
    const cands = zoneLens.filter((z) => z <= cont.length - x + EPS);
    cands.push(cont.length - x);

    for (const Lz of cands) {
      if (Lz <= EPS) continue;
      for (let t = 0; t < 2; t++) {
        const d = { ...demand };
        const out: Block[] = [];
        const v = fillRegion(0, 0, 0, Lz, cont.width, cont.height, d, out, ctx);
        if (v <= 0) continue;
        const sc = (v - blockPenalty * out.length) / Lz; // birim boya düşen net hacim
        if (!best || sc > best.sc) best = { sc, Lz, out, d, v };
      }
    }
    if (!best) break;

    for (const b of best.out) b.x += x;
    blocks.push(...best.out);
    demand = best.d;
    x += best.Lz;
    volume += best.v;
  }

  return { blocks, demand, volume, used: x };
}

// ────────────────────────────────────────────────────────────────────────────
// Genel API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Konteyner yükleme planı üretir.
 *
 * @example
 * const plan = pack(
 *   [
 *     { id: "XXL", dims: [98, 72, 6],        qty: 348 },
 *     { id: "XL",  dims: [72, 54.5, 21.5],   qty: 246 },
 *     { id: "L",   dims: [57.5, 43, 39],     qty: 272 },
 *     { id: "M",   dims: [44, 37.5, 35],     qty: 100 },
 *     { id: "WC",  dims: [56.5, 28.5, 22.5], qty: 150 },
 *   ],
 *   CONTAINERS["40HC"],
 *   { timeBudgetMs: 6000 },
 * );
 */
export function pack(
  products: ProductInput[],
  container: ContainerDims,
  options: PackOptions = {},
): PackResult {
  const o = { ...DEFAULTS, ...options };
  const items = prepare(products);
  if (!items.length) throw new Error("En az bir ürün gerekli");

  const contVol = container.length * container.width * container.height;
  const t0 = Date.now();
  const baseSeed = options.seed ?? 1;

  const scoreOf = (r: OnceResult) => {
    const short = Object.values(r.demand).reduce((s, v) => s + Math.max(0, v), 0);
    // Öncelik: 1) eksik yok  2) daha kısa boy (sonda ilave kapasiteye yer kalsın)
    //          3) daha az blok (uygulanabilirlik)
    return [-short, -Math.round(r.used * 10), -r.blocks.length];
  };
  const better = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
  };

  const targetDemand: Record<string, number> = {};
  for (const it of items) targetDemand[it.id] = it.qty;

  let best: OnceResult | null = null;
  let iterations = 0;

  while (Date.now() - t0 < o.timeBudgetMs) {
    // minBlockQty'yi de değiştiriyoruz: yüksek değer sade dizilim verir, düşük
    // değer artakalan tek tük koliyi kurtarır. Skorlama önce "eksik yok"a bakar.
    for (const topK of [1, 2, 3]) {
      for (const mbq of [o.minBlockQty, 2, 1]) {
        const ctx: Ctx = {
          items,
          minBlockQty: mbq,
          maxDepth: o.maxDepth,
          topK,
          rand: mulberry32(baseSeed + iterations * 7919 + topK * 31 + mbq),
        };
        const r = packOnce(ctx, container, o.blockPenalty, targetDemand);
        if (!best || better(scoreOf(r), scoreOf(best))) best = r;
      }
    }
    // Hedeflerin tamamı yüklendiyse ve istenirse erken çık
    if (o.stopWhenComplete && best &&
        Object.values(best.demand).every((v) => v <= 0)) { iterations++; break; }
    iterations++;
  }
  if (!best) throw new Error("Yerleştirme başarısız");

  const blocks = [...best.blocks];
  let volume = best.volume;

  // ── İlave kapasite: sonda kalan boyu maxQty'si olan ürünlerle doldur ──
  const placedNow: Record<string, number> = {};
  for (const b of blocks) placedNow[b.productId] = (placedNow[b.productId] ?? 0) + b.count;

  const bonusDemand: Record<string, number> = {};
  let bonusPossible = false;
  for (const it of items) {
    const extra = it.maxQty - (placedNow[it.id] ?? 0);
    bonusDemand[it.id] = Math.max(0, extra);
    if (bonusDemand[it.id] > 0) bonusPossible = true;
  }

  // Eksik kalan hedefleri de son boşlukta tamamlamayı dene
  for (const it of items) {
    const miss = it.qty - (placedNow[it.id] ?? 0);
    if (miss > 0) { bonusDemand[it.id] = Math.max(bonusDemand[it.id] ?? 0, miss); bonusPossible = true; }
  }

  const frontier = blocks.reduce((m, b) => Math.max(m, b.x + b.dx), 0);
  const tail = container.length - frontier;
  if (bonusPossible && tail > 5) {
    let bestBonus: { v: number; out: Block[] } | null = null;
    for (const topK of [1, 2, 3]) {
      for (let s = 0; s < 250; s++) {
        const ctx: Ctx = {
          items,
          // Son boşlukta tek tük koli de değerlidir; blok alt sınırını gevşetiyoruz
          minBlockQty: 1,
          maxDepth: o.maxDepth,
          topK,
          rand: mulberry32(baseSeed + s * 104729 + topK),
        };
        const d = { ...bonusDemand };
        const out: Block[] = [];
        const v = fillRegion(0, 0, 0, tail, container.width, container.height, d, out, ctx);
        if (!bestBonus || v > bestBonus.v) bestBonus = { v, out };
      }
    }
    if (bestBonus && bestBonus.v > 0) {
      for (const b of bestBonus.out) {
        b.x += frontier;
        b.bonus = true;
        blocks.push(b);
      }
      volume += bestBonus.v;
    }
  }

  // ── Özet ──
  const placed: Record<string, number> = {};
  for (const it of items) placed[it.id] = 0;
  for (const b of blocks) placed[b.productId] += b.count;

  const shortfall: Record<string, number> = {};
  for (const it of items) shortfall[it.id] = Math.max(0, it.qty - placed[it.id]);

  const usedLength = blocks.reduce((m, b) => Math.max(m, b.x + b.dx), 0);

  return {
    container,
    blocks: blocks.sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z),
    placed,
    shortfall,
    totalUnits: Object.values(placed).reduce((s, v) => s + v, 0),
    volume,
    fillRatio: volume / contVol,
    usedLength,
    iterations,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Doğrulama — çakışma ve taşma kontrolü
// ────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  maxX: number; maxY: number; maxZ: number;
}

/**
 * Planın geometrik olarak geçerli olduğunu doğrular.
 * Üretimde her plan için çağırmanızı öneririm — O(n²) ama n genelde < 200.
 */
export function validatePlan(plan: PackResult, products: ProductInput[]): ValidationResult {
  const errors: string[] = [];
  const { blocks, container: c } = plan;
  const dimsById = new Map(products.map((p) => [p.id, [...p.dims].sort((a, b) => a - b)]));

  for (const b of blocks) {
    if (b.x < -EPS || b.y < -EPS || b.z < -EPS)
      errors.push(`Negatif konum: ${b.productId} @ (${b.x},${b.y},${b.z})`);
    if (b.x + b.dx > c.length + EPS || b.y + b.dy > c.width + EPS || b.z + b.dz > c.height + EPS)
      errors.push(`Sınır taşması: ${b.productId} @ (${b.x},${b.y},${b.z})`);
    if (Math.abs(b.dx - b.nx * b.l) > EPS || Math.abs(b.dy - b.ny * b.w) > EPS || Math.abs(b.dz - b.nz * b.h) > EPS)
      errors.push(`Izgara tutarsız: ${b.productId} @ ${b.x}`);
    if (b.count > b.nx * b.ny * b.nz)
      errors.push(`Izgaradan fazla koli: ${b.productId} @ ${b.x}`);
    const ref = dimsById.get(b.productId);
    const got = [b.l, b.w, b.h].sort((p, q) => p - q);
    if (!ref || ref.some((v, i) => Math.abs(v - got[i]) > EPS))
      errors.push(`Duruş ölçüsü ürünle uyuşmuyor: ${b.productId} @ ${b.x}`);
  }

  const overlap = (a: Block, b: Block) =>
    a.x + a.dx > b.x + EPS && b.x + b.dx > a.x + EPS &&
    a.y + a.dy > b.y + EPS && b.y + b.dy > a.y + EPS &&
    a.z + a.dz > b.z + EPS && b.z + b.dz > a.z + EPS;

  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++)
      if (overlap(blocks[i], blocks[j]))
        errors.push(`ÇAKIŞMA: ${blocks[i].productId}@${blocks[i].x} ↔ ${blocks[j].productId}@${blocks[j].x}`);

  return {
    ok: errors.length === 0,
    errors,
    maxX: blocks.reduce((m, b) => Math.max(m, b.x + b.dx), 0),
    maxY: blocks.reduce((m, b) => Math.max(m, b.y + b.dy), 0),
    maxZ: blocks.reduce((m, b) => Math.max(m, b.z + b.dz), 0),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Esnek adet çözücü — "şu üründen en fazla kaç tane gider?"
// ────────────────────────────────────────────────────────────────────────────

export interface FlexResult {
  /** Esnek ürünün bulunan en yüksek adedi */
  qty: number;
  plan: PackResult;
}

/**
 * Bir ürünün adedini, diğer ürünlerin hedefleri bozulmadan gidebilecek en
 * yüksek değere kadar ikili arama ile yükseltir.
 *
 * Örn. "WC'yi 150'de sabitledim, XL en fazla kaç gider?"
 *   solveFlexQty(products, CONTAINERS["40HC"], "XL", 190, 400, { timeBudgetMs: 3000 })
 *
 * Not: her adımda pack() çağırdığı için süre ≈ log2(max-min) × timeBudgetMs.
 * Vercel'de arka plan işi (queue / cron) olarak çalıştırın.
 */
export function solveFlexQty(
  products: ProductInput[],
  container: ContainerDims,
  flexId: string,
  minQty: number,
  maxQty: number,
  options: PackOptions = {},
): FlexResult {
  const run = (q: number) =>
    pack(
      products.map((p) => (p.id === flexId ? { ...p, qty: q, maxQty: q } : p)),
      container,
      options,
    );

  const fits = (p: PackResult) => Object.values(p.shortfall).every((v) => v === 0);

  let lo = minQty;
  let hi = maxQty;
  let bestPlan = run(lo);
  let bestQty = lo;
  if (!fits(bestPlan)) return { qty: lo, plan: bestPlan };

  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const p = run(mid);
    if (fits(p)) {
      lo = mid;
      bestQty = mid;
      bestPlan = p;
    } else {
      hi = mid - 1;
    }
  }
  return { qty: bestQty, plan: bestPlan };
}

// ────────────────────────────────────────────────────────────────────────────
// Dizilim tablosu — depo için satır satır talimat
// ────────────────────────────────────────────────────────────────────────────

export interface LoadingRow {
  order: number;
  productId: string;
  /** Boy aralığı (cm) */
  fromX: number; toX: number;
  /** Sol duvardan ve tabandan uzaklık (cm) */
  offsetY: number; offsetZ: number;
  /** Kolinin duruşu: hangi ölçü hangi eksene */
  alongLength: number; alongWidth: number; vertical: number;
  /** Izgara */
  rowsDeep: number; columns: number; layers: number;
  units: number;
  bonus: boolean;
}

/** Blokları yükleme sırasına (dipten kapıya, alttan üste) dizer. */
export function loadingTable(plan: PackResult): LoadingRow[] {
  return [...plan.blocks]
    .sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y)
    .map((b, i) => ({
      order: i + 1,
      productId: b.productId,
      fromX: b.x, toX: b.x + b.dx,
      offsetY: b.y, offsetZ: b.z,
      alongLength: b.l, alongWidth: b.w, vertical: b.h,
      rowsDeep: b.nx, columns: b.ny, layers: b.nz,
      units: b.count,
      bonus: !!b.bonus,
    }));
}
