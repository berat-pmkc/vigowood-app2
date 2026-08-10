/**
 * container-packer / render — SVG ve HTML görselleştirme
 * =====================================================
 * Sıfır bağımlılık, saf string üretimi. Server'da (API route) da çalışır,
 * client'ta da. React'te `dangerouslySetInnerHTML` ile basabilirsiniz.
 */

import type { Block, PackResult, ProductInput } from "./packer";
import { loadingTable } from "./packer";

const PALETTE = ["#8d99ae", "#48cae4", "#e0b884", "#b08968", "#f4a261", "#e76f51",
                 "#90be6d", "#c77dff", "#f9c74f", "#577590"];

function colorMap(products: ProductInput[]): Record<string, string> {
  const m: Record<string, string> = {};
  products.forEach((p, i) => { m[p.id] = p.color ?? PALETTE[i % PALETTE.length]; });
  return m;
}
function nameMap(products: ProductInput[]): Record<string, string> {
  const m: Record<string, string> = {};
  products.forEach((p) => { m[p.id] = p.name ?? p.id; });
  return m;
}
const num = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// ────────────────────────────────────────────────────────────────────────────
// Izgara hücreleri — bir bloğu iki eksene projeksiyonla
// ────────────────────────────────────────────────────────────────────────────

type Axis = "x" | "y" | "z";
const AXIS = {
  x: { n: "nx", d: "l" },
  y: { n: "ny", d: "w" },
  z: { n: "nz", d: "h" },
} as const;

function* cells(b: Block, a1: Axis, a2: Axis) {
  const n1 = b[AXIS[a1].n] as number, d1 = b[AXIS[a1].d] as number;
  const n2 = b[AXIS[a2].n] as number, d2 = b[AXIS[a2].d] as number;
  for (let i = 0; i < n1; i++)
    for (let j = 0; j < n2; j++)
      yield { a: (b[a1] as number) + i * d1, c: (b[a2] as number) + j * d2, da: d1, dc: d2 };
}

/**
 * İki eksenli projeksiyon çizimi.
 * @param depthAxis Uzaktan yakına çizim sırası — yakındaki katman üstte kalır.
 */
function projectionSvg(
  plan: PackResult, products: ProductInput[],
  a1: Axis, a2: Axis, W: number, H: number, depthAxis: Axis,
  className = "cp-view",
): string {
  const col = colorMap(products);
  const pad = 46;
  const out: string[] = [];
  out.push(`<svg viewBox="${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}" class="${className}" xmlns="http://www.w3.org/2000/svg">`);
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="#111" stroke-width="2.5"/>`);

  const ordered = [...plan.blocks].sort((p, q) => (q[depthAxis] as number) - (p[depthAxis] as number));
  for (const b of ordered) {
    const c = col[b.productId] ?? "#ccc";
    for (const cell of cells(b, a1, a2)) {
      const X = cell.a;
      const Y = H - cell.c - cell.dc; // Z/Y yukarı doğru artsın
      out.push(`<rect x="${X}" y="${Y}" width="${cell.da}" height="${cell.dc}" fill="${c}" stroke="#5b3fa8" stroke-width="0.7"/>`);
    }
  }
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#111" stroke-width="2.5"/>`);
  out.push(`<text x="${W / 2}" y="${H + 34}" text-anchor="middle" font-size="14" font-weight="600" fill="#111">${W} cm</text>`);
  out.push(`<text x="${-22}" y="${H / 2}" text-anchor="middle" font-size="14" font-weight="600" fill="#111" transform="rotate(-90 ${-22} ${H / 2})">${H} cm</text>`);
  out.push("</svg>");
  return out.join("");
}

/** Yandan bakış (boy × yükseklik). Yakın katman üstte çizilir. */
export function sideViewSvg(plan: PackResult, products: ProductInput[]): string {
  return projectionSvg(plan, products, "x", "z", plan.container.length, plan.container.height, "y");
}

/** Üstten bakış (boy × en). En üst katman üstte çizilir. */
export function topViewSvg(plan: PackResult, products: ProductInput[]): string {
  return projectionSvg(plan, products, "x", "y", plan.container.length, plan.container.width, "z");
}

// ────────────────────────────────────────────────────────────────────────────
// Bölgeler ve kesitler
// ────────────────────────────────────────────────────────────────────────────

export interface Zone { from: number; to: number; blocks: Block[] }

/** Planı X ekseninde, içeriği değişmeyen bölgelere ayırır. */
export function zonesOf(plan: PackResult): Zone[] {
  const cuts = Array.from(new Set(plan.blocks.flatMap((b) => [b.x, b.x + b.dx])))
    .sort((a, b) => a - b);
  const raw: Zone[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const from = cuts[i], to = cuts[i + 1];
    if (to - from < 0.5) continue;
    const blocks = plan.blocks.filter((b) => b.x < to - 0.01 && b.x + b.dx > from + 0.01);
    if (blocks.length) raw.push({ from, to, blocks });
  }
  // Aynı blok kümesine sahip ardışık bölgeleri birleştir
  const merged: Zone[] = [];
  for (const z of raw) {
    const prev = merged[merged.length - 1];
    const same = prev && prev.blocks.length === z.blocks.length &&
      prev.blocks.every((b, i) => b === z.blocks[i]);
    if (same) prev.to = z.to;
    else merged.push({ ...z });
  }
  return merged;
}

/** Bir bölgenin ön yüz kesiti (en × yükseklik). */
export function crossSectionSvg(zone: Zone, plan: PackResult, products: ProductInput[]): string {
  const col = colorMap(products);
  const W = plan.container.width, H = plan.container.height, pad = 30;
  const out: string[] = [];
  out.push(`<svg viewBox="${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}" class="cp-cross" xmlns="http://www.w3.org/2000/svg">`);
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="#111" stroke-width="2"/>`);
  for (const b of zone.blocks) {
    const c = col[b.productId] ?? "#ccc";
    for (let i = 0; i < b.ny; i++)
      for (let j = 0; j < b.nz; j++)
        out.push(`<rect x="${b.y + i * b.w}" y="${H - (b.z + j * b.h) - b.h}" width="${b.w}" height="${b.h}" fill="${c}" stroke="#5b3fa8" stroke-width="0.6"/>`);
  }
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#111" stroke-width="2"/>`);
  out.push("</svg>");
  return out.join("");
}

// ────────────────────────────────────────────────────────────────────────────
// Tam HTML raporu
// ────────────────────────────────────────────────────────────────────────────

export interface ReportOptions {
  title?: string;
  /** Hedef adetler farklıysa (ör. artış gösterilecekse) buradan verin. */
  targets?: Record<string, number>;
  /** Bölge kesitlerini dahil et. Varsayılan true. */
  includeCrossSections?: boolean;
}

/**
 * Kendi kendine yeten HTML raporu üretir: özet, yandan/üstten bakış,
 * dizilim tablosu, bölge kesitleri, ölçü doğrulaması.
 * Vercel'de bir route handler'dan `new Response(html, {headers:{'content-type':'text/html'}})`
 * ile doğrudan döndürebilirsiniz.
 */
export function renderReportHtml(
  plan: PackResult, products: ProductInput[], opts: ReportOptions = {},
): string {
  const col = colorMap(products);
  const nm = nameMap(products);
  const c = plan.container;
  const contVol = c.length * c.width * c.height;
  const zones = zonesOf(plan);
  const rows = loadingTable(plan);

  const maxX = plan.blocks.reduce((m, b) => Math.max(m, b.x + b.dx), 0);
  const maxY = plan.blocks.reduce((m, b) => Math.max(m, b.y + b.dy), 0);
  const maxZ = plan.blocks.reduce((m, b) => Math.max(m, b.z + b.dz), 0);

  // Ürün dökümü
  const prodRows = products.map((p) => {
    const target = opts.targets?.[p.id] ?? p.qty;
    const n = plan.placed[p.id] ?? 0;
    const diff = n - target;
    const vol = (n * p.dims[0] * p.dims[1] * p.dims[2]) / 1e6;
    const cls = diff > 0 ? "pos" : diff < 0 ? "neg" : "";
    return `<tr><td><span class="sw" style="background:${col[p.id]}"></span>${esc(nm[p.id])}</td>`
      + `<td>${num(p.dims[0])}×${num(p.dims[1])}×${num(p.dims[2])}</td>`
      + `<td>${target}</td><td><b>${n}</b></td>`
      + `<td class="${cls}">${diff > 0 ? "+" + diff : diff}</td><td>${vol.toFixed(2)} m³</td></tr>`;
  }).join("");

  // Dizilim tablosu
  const dz = rows.map((r) =>
    `<tr><td><b>${r.order}</b></td>`
    + `<td><span class="sw" style="background:${col[r.productId]}"></span><b>${esc(r.productId)}</b></td>`
    + `<td>${num(r.fromX)} – ${num(r.toX)}</td><td>${num(r.offsetY)}</td><td>${num(r.offsetZ)}</td>`
    + `<td class="ori"><b>${num(r.alongLength)}</b></td><td class="ori"><b>${num(r.alongWidth)}</b></td><td class="ori"><b>${num(r.vertical)}</b></td>`
    + `<td>${r.rowsDeep}</td><td>${r.columns}</td><td>${r.layers}</td>`
    + `<td><b>${r.units}</b></td>${r.bonus ? '<td class="pos">ilave</td>' : "<td></td>"}</tr>`,
  ).join("");

  // Duruş özeti
  const seen = new Map<string, number>();
  for (const b of plan.blocks) {
    const k = `${b.productId}|${b.l}|${b.w}|${b.h}`;
    seen.set(k, (seen.get(k) ?? 0) + b.count);
  }
  const oriRows = [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => {
      const [id, l, w, h] = k.split("|");
      return `<tr><td><span class="sw" style="background:${col[id]}"></span>${esc(nm[id] ?? id)}</td>`
        + `<td>Taban yüzü <b>${num(+l)} × ${num(+w)}</b> cm — dik ölçü <b>${num(+h)}</b> cm</td>`
        + `<td><b>${n}</b> koli</td></tr>`;
    }).join("");

  const zoneCards = opts.includeCrossSections === false ? "" : zones.map((z, i) => {
    const items = z.blocks.map((b) => `${b.productId}×${b.count}`).join(", ");
    return `<div class="cell"><div class="t">B${i + 1} · ${num(z.from)}–${num(z.to)} cm</div>`
      + crossSectionSvg(z, plan, products) + `<div class="s">${esc(items)}</div></div>`;
  }).join("");

  const legend = products.map((p) =>
    `<span><span class="sw" style="background:${col[p.id]}"></span>${esc(nm[p.id])}</span>`).join("");

  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(opts.title ?? "Konteyner Yükleme Planı")}</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:24px;font-family:'Segoe UI',system-ui,sans-serif;background:#f4f5f7;color:#1a1a1a}
.wrap{max-width:1500px;margin:0 auto}
h1{font-size:26px;margin:0 0 4px}
h2{font-size:17px;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid #d8dbe0}
.sub{color:#666;font-size:13px;margin-bottom:18px}
.card{background:#fff;border:1px solid #e0e3e8;border-radius:10px;padding:16px 18px;margin-bottom:16px}
.kpis{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.kpi{background:#fff;border:1px solid #e0e3e8;border-radius:10px;padding:12px 18px;flex:1;min-width:150px}
.kpi .v{font-size:24px;font-weight:700}
.kpi .l{font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.5px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:7px 9px;border-bottom:1px solid #eceef1;text-align:left}
th{background:#f7f8fa;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#666;text-align:center}
.pos{color:#0a8f4d;font-weight:600}.neg{color:#c62828;font-weight:600}
.sw{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:7px;vertical-align:-1px;border:1px solid rgba(0,0,0,.25)}
svg.cp-view,svg.cp-cross{width:100%;height:auto;display:block}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;margin:10px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:12px}
.cell{border:1px solid #e0e3e8;border-radius:8px;padding:8px}
.cell .t{font-size:11px;font-weight:700;margin-bottom:5px}
.cell .s{font-size:10.5px;color:#777;margin-top:5px}
table.dz{font-size:12px;white-space:nowrap}
table.dz td{text-align:center}
th.ohead{background:#fdece0;color:#a04000}
td.ori{background:#fff6ef}
tbody tr:nth-child(even){background:#fafbfc}
.note{background:#fff8e1;border-left:4px solid #f0a202;padding:11px 14px;border-radius:0 8px 8px 0;font-size:13px;line-height:1.55;margin-top:10px}
</style></head><body><div class="wrap">
<h1>${esc(opts.title ?? "Konteyner Yükleme Planı")}</h1>
<div class="sub">İç ölçü ${c.length} × ${c.width} × ${c.height} cm</div>

<div class="kpis">
<div class="kpi"><div class="l">Toplam Koli</div><div class="v">${plan.totalUnits}</div></div>
<div class="kpi"><div class="l">Hacim</div><div class="v">${(plan.volume / 1e6).toFixed(1)} m³</div></div>
<div class="kpi"><div class="l">Doluluk</div><div class="v">${(plan.fillRatio * 100).toFixed(1)}%</div></div>
<div class="kpi"><div class="l">Boy Kullanımı</div><div class="v">${num(maxX)} / ${c.length}</div></div>
<div class="kpi"><div class="l">Blok</div><div class="v">${plan.blocks.length}</div></div>
</div>

<div class="card"><h2>Ürün Dökümü</h2>
<table><thead><tr><th>Ürün</th><th>Ölçü (cm)</th><th>Hedef</th><th>Yüklenen</th><th>Fark</th><th>Hacim</th></tr></thead>
<tbody>${prodRows}</tbody></table></div>

<div class="card"><h2>Yandan Bakış (${c.length} × ${c.height} cm)</h2>
<div class="legend">${legend}</div>${sideViewSvg(plan, products)}</div>

<div class="card"><h2>Üstten Bakış (${c.length} × ${c.width} cm)</h2>${topViewSvg(plan, products)}</div>

<div class="card"><h2>Dizilim Tablosu</h2>
<div class="sub">Sıra = yükleme sırası (dipten kapıya, alttan üste). Turuncu sütunlar kolinin duruşunu verir.</div>
<div style="overflow-x:auto"><table class="dz"><thead>
<tr><th rowspan="2">Sıra</th><th rowspan="2">Ürün</th><th rowspan="2">Boy X (cm)</th><th rowspan="2">Duvardan Y</th><th rowspan="2">Tabandan Z</th>
<th colspan="3" class="ohead">KOLİ DURUŞU (cm)</th><th colspan="3">IZGARA</th><th rowspan="2">Koli</th><th rowspan="2"></th></tr>
<tr><th class="ohead">Boy yönü</th><th class="ohead">En yönü</th><th class="ohead">Dik</th><th>Boyda</th><th>Ende</th><th>Kat</th></tr>
</thead><tbody>${dz}</tbody></table></div>
<div class="note"><b>Nasıl okunur:</b> <i>Boy 43 · En 39 · Dik 57,5 · ızgara 1×6×4</i> → koliyi 43 cm'lik kenarı konteynerin boyuna, 39 cm'lik kenarı enine, 57,5 cm'lik kenarı dikey gelecek şekilde koyun; boyda 1 sıra, yan yana 6 kolon, üst üste 4 kat.</div>
</div>

<div class="card"><h2>Ürün Bazında Duruşlar</h2>
<table><thead><tr><th>Ürün</th><th>Duruş</th><th>Adet</th></tr></thead><tbody>${oriRows}</tbody></table></div>

${zoneCards ? `<div class="card"><h2>Bölge Kesitleri (${c.width} × ${c.height} cm)</h2><div class="grid">${zoneCards}</div></div>` : ""}

<div class="card"><h2>Ölçü Doğrulaması</h2>
<table><thead><tr><th>Eksen</th><th>İç ölçü</th><th>En uzak koli</th><th>Kalan pay</th></tr></thead><tbody>
<tr><td>Boy (X)</td><td>${c.length}</td><td>${num(maxX)}</td><td><b>${num(c.length - maxX)} cm</b></td></tr>
<tr><td>En (Y)</td><td>${c.width}</td><td>${num(maxY)}</td><td><b>${num(c.width - maxY)} cm</b></td></tr>
<tr><td>Yükseklik (Z)</td><td>${c.height}</td><td>${num(maxZ)}</td><td><b>${num(c.height - maxZ)} cm</b></td></tr>
</tbody></table>
<div class="note">Toplam ${plan.blocks.length} blok, ${plan.totalUnits} koli, ${(plan.volume / 1e6).toFixed(2)} m³ / ${(contVol / 1e6).toFixed(2)} m³.</div>
</div>
</div></body></html>`;
}

// ────────────────────────────────────────────────────────────────────────────
// CSV çıktısı — depo/ERP için
// ────────────────────────────────────────────────────────────────────────────

export function loadingTableCsv(plan: PackResult, sep = ";"): string {
  const head = ["Sira", "Urun", "X_bas", "X_son", "Y_duvardan", "Z_tabandan",
    "Boy_yonu", "En_yonu", "Dik", "Boyda_sira", "Ende_kolon", "Kat", "Koli", "Ilave"];
  const lines = [head.join(sep)];
  for (const r of loadingTable(plan)) {
    lines.push([r.order, r.productId, r.fromX, r.toX, r.offsetY, r.offsetZ,
      r.alongLength, r.alongWidth, r.vertical, r.rowsDeep, r.columns, r.layers,
      r.units, r.bonus ? "E" : ""].join(sep));
  }
  return lines.join("\n");
}
