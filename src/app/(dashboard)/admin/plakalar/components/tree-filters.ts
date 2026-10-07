import type {
  TreeData,
  TreePart,
  TreePlaka,
  TreePlakaPart,
  TreeProduct,
} from "./tree-types";

export interface Filters {
  q: string;
  sku: string;
  tip: string; // part_type
  mdf: string; // plaka tipi
  renk: string;
  mak: string; // MAK-1..3
  plakasiz: boolean;
}

const lc = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("tr");
const has = (hay: (string | null | undefined)[], q: string) => {
  const n = lc(q).trim();
  return hay.some((h) => lc(h).includes(n));
};

export function isFilterActive(f: Filters) {
  return !!(f.q.trim() || f.sku || f.tip || f.mdf || f.renk || f.mak || f.plakasiz);
}

/** Verinin değişmesine göre bir kez hesaplanan indeksler. */
export interface Index {
  productMap: Map<string, TreeProduct>;
  partMap: Map<string, TreePart>;
  platesBySku: Map<string, TreePlaka[]>;
  ppByPlaka: Map<string, TreePlakaPart[]>;
  plakaById: Map<string, TreePlaka>;
}

export function buildIndex(d: TreeData): Index {
  const productMap = new Map(d.products.map((p) => [p.sku, p]));
  const partMap = new Map(d.parts.map((p) => [p.part_id, p]));
  const platesBySku = new Map<string, TreePlaka[]>();
  const plakaById = new Map<string, TreePlaka>();
  for (const pl of d.plakalar) {
    plakaById.set(pl.plaka_id, pl);
    for (const s of pl.sku) {
      const arr = platesBySku.get(s) ?? [];
      arr.push(pl);
      platesBySku.set(s, arr);
    }
  }
  const ppByPlaka = new Map<string, TreePlakaPart[]>();
  for (const pp of d.plakaParts) {
    const arr = ppByPlaka.get(pp.plaka_id) ?? [];
    arr.push(pp);
    ppByPlaka.set(pp.plaka_id, arr);
  }
  return { productMap, partMap, platesBySku, ppByPlaka, plakaById };
}

// ─── Liste (ürün → plaka → parça) ─────────────────────────────

export interface ListePlate {
  plaka: TreePlaka;
  plateMatch: boolean;
  parts: { pp: TreePlakaPart; part: TreePart | undefined; match: boolean }[];
}
export interface ListeProduct {
  sku: string;
  product: TreeProduct | undefined;
  productMatch: boolean;
  plateCount: number;
  partCount: number;
  plates: ListePlate[];
}

function plateText(pl: TreePlaka) {
  return [pl.plaka_id, pl.plaka_adi, pl.plakalar_id, pl.tipi, pl.renk];
}

export function computeListe(d: TreeData, idx: Index, f: Filters): ListeProduct[] {
  const q = f.q.trim();
  const skus = new Set<string>(idx.platesBySku.keys());
  if (f.plakasiz) {
    for (const p of d.products) if (!skus.has(p.sku)) skus.add(p.sku);
  }
  const out: ListeProduct[] = [];
  for (const sku of [...skus].sort()) {
    if (f.sku && sku !== f.sku) continue;
    const allPlates = idx.platesBySku.get(sku) ?? [];
    if (f.plakasiz && allPlates.length > 0) continue;
    const product = idx.productMap.get(sku);
    const productMatch = !!q && has([sku, product?.urun_adi], q);
    const qProd = !q || productMatch;

    const allPartIds = new Set<string>();
    for (const pl of allPlates) {
      for (const pp of idx.ppByPlaka.get(pl.plaka_id) ?? []) allPartIds.add(pp.part_id);
    }

    const plates: ListePlate[] = [];
    for (const pl of allPlates) {
      if (f.mdf && pl.tipi !== f.mdf) continue;
      if (f.renk && pl.renk !== f.renk) continue;
      if (f.mak && !((pl.kesim_sureleri?.[f.mak] ?? 0) > 0)) continue;
      const plateMatch = !!q && has(plateText(pl), q);
      const parts = (idx.ppByPlaka.get(pl.plaka_id) ?? [])
        .map((pp) => {
          const part = idx.partMap.get(pp.part_id);
          const partMatch = !!q && has([pp.part_id, part?.part_adi, part?.tur], q);
          return { pp, part, match: partMatch };
        })
        .filter(
          (x) =>
            (!f.tip || x.part?.part_type === f.tip) &&
            (qProd || plateMatch || x.match)
        );
      const showEmpty = !f.tip && (qProd || plateMatch);
      if (parts.length === 0 && !showEmpty) continue;
      plates.push({ plaka: pl, plateMatch, parts });
    }
    if (!f.plakasiz && plates.length === 0) continue;
    out.push({
      sku,
      product,
      productMatch,
      plateCount: allPlates.length,
      partCount: allPartIds.size,
      plates,
    });
  }
  return out;
}

// ─── Parçalar (ürün → parça) ──────────────────────────────────

export interface ParcaPlateLink {
  plaka: TreePlaka;
  pp: TreePlakaPart;
}
export interface ParcaRow {
  part: TreePart;
  match: boolean;
  links: ParcaPlateLink[];
}
export interface ParcaProduct {
  sku: string; // UNASSIGNED = ürüne bağlı olmayan
  product: TreeProduct | undefined;
  productMatch: boolean;
  parts: ParcaRow[];
  totalParts: number;
  plateOptions: TreePlaka[];
}

export const UNASSIGNED = "__unassigned__";

/**
 * Parça hangi ürüne ait: plaka bağlantısı (plaka SKU'ları + plaka_parts.sku)
 * veya kod öneki (<SKU>-P<NN>, yeni eklenen ama henüz plakasız parçalar için).
 */
export function computeParcalar(d: TreeData, idx: Index, f: Filters): ParcaProduct[] {
  const q = f.q.trim();
  const bySku = new Map<string, Map<string, ParcaPlateLink[]>>();
  const ensure = (sku: string, partId: string) => {
    let m = bySku.get(sku);
    if (!m) bySku.set(sku, (m = new Map()));
    let l = m.get(partId);
    if (!l) m.set(partId, (l = []));
    return l;
  };

  for (const pp of d.plakaParts) {
    const pl = idx.plakaById.get(pp.plaka_id);
    if (!pl) continue; // MDF dışı plakalar bu görünümde yok
    const skus = new Set<string>(pl.sku);
    if (pp.sku) skus.add(pp.sku);
    for (const s of skus) {
      const links = ensure(s, pp.part_id);
      if (!links.some((l) => l.pp.ppart_id === pp.ppart_id)) links.push({ plaka: pl, pp });
    }
  }

  for (const s of idx.platesBySku.keys()) if (!bySku.has(s)) bySku.set(s, new Map());
  const skuSet = new Set(d.products.map((p) => p.sku));
  for (const part of d.parts) {
    const i = part.part_id.lastIndexOf("-P");
    if (i > 0 && /^\d+$/.test(part.part_id.slice(i + 2))) {
      const pre = part.part_id.slice(0, i);
      if (skuSet.has(pre)) ensure(pre, part.part_id);
    }
  }
  const assigned = new Set<string>();
  for (const m of bySku.values()) for (const id of m.keys()) assigned.add(id);

  const groups: [string, Map<string, ParcaPlateLink[]>][] = [...bySku.entries()];
  const orphan = new Map<string, ParcaPlateLink[]>();
  for (const part of d.parts) {
    if (part.part_type === "YARIMAMUL" && !assigned.has(part.part_id)) orphan.set(part.part_id, []);
  }
  if (orphan.size > 0) groups.push([UNASSIGNED, orphan]);

  groups.sort((a, b) =>
    a[0] === UNASSIGNED ? 1 : b[0] === UNASSIGNED ? -1 : a[0].localeCompare(b[0])
  );

  const out: ParcaProduct[] = [];
  for (const [sku, partsMap] of groups) {
    if (f.sku && sku !== f.sku) continue;
    const product = idx.productMap.get(sku);
    const productMatch = !!q && has([sku, product?.urun_adi], q);
    const qProd = !q || productMatch;
    const rows: ParcaRow[] = [];
    for (const [partId, links] of partsMap) {
      const part = idx.partMap.get(partId);
      if (!part) continue;
      if (f.tip && part.part_type !== f.tip) continue;
      if (f.mdf && part.mdf_tipi !== f.mdf && !links.some((l) => l.plaka.tipi === f.mdf)) continue;
      if (f.renk && part.mdf_renk !== f.renk && !links.some((l) => l.plaka.renk === f.renk)) continue;
      if (f.mak && !links.some((l) => (l.plaka.kesim_sureleri?.[f.mak] ?? 0) > 0)) continue;
      const match =
        !!q &&
        has(
          [part.part_id, part.part_adi, part.tur, part.mdf_tipi, part.mdf_renk, ...links.map((l) => l.plaka.plaka_id)],
          q
        );
      if (!qProd && !match) continue;
      rows.push({ part, match, links });
    }
    rows.sort((a, b) => a.part.part_id.localeCompare(b.part.part_id, "tr", { numeric: true }));
    if (rows.length === 0 && (f.tip || f.mdf || f.renk || f.mak || (q && !productMatch))) continue;
    out.push({
      sku,
      product,
      productMatch,
      parts: rows,
      totalParts: partsMap.size,
      plateOptions: idx.platesBySku.get(sku) ?? [],
    });
  }
  return out;
}
