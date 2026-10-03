import "server-only";

import { createClient } from "@/lib/supabase/server";
import { trDay, tsBounds } from "@/lib/periods";
import { fetchAll } from "./utils";
import { isSalesSource } from "./queries";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function sb(): Promise<any> {
  return await createClient();
}

// ─── Kalite defteri ─────────────────────────────────────────────

export interface KaliteRow {
  tarih: string;
  item_tipi: string;
  item_id: string;
  item_adi: string | null;
  stok_turu: string;
  qty: number;
  islem: string;
  kaynak: string | null;
  operator_name: string | null;
  kargo_firmasi: string | null;
  musteri: string | null;
}

export interface KaliteRowsResult {
  available: boolean;
  rows: KaliteRow[];
}

/** kalite_hareketleri satırları (tarih aralığı; tablo yoksa boş döner). */
export async function getKaliteRows(
  from: string | null,
  to: string | null,
  stokTuru?: string,
): Promise<KaliteRowsResult> {
  try {
    const s = await sb();
    const data = await fetchAll<any>((lo, hi) => {
      let q = s
        .from("kalite_hareketleri")
        .select(
          "tarih, item_tipi, item_id, item_adi, stok_turu, qty, islem, kaynak, operator_name, kargo_firmasi, musteri",
        )
        .order("id");
      if (stokTuru) q = q.eq("stok_turu", stokTuru);
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    });
    const rows: KaliteRow[] = data.map((r: any) => ({
      tarih: trDay(r.tarih) ?? "",
      item_tipi: String(r.item_tipi ?? ""),
      item_id: String(r.item_id ?? ""),
      item_adi: r.item_adi ?? null,
      stok_turu: String(r.stok_turu ?? ""),
      qty: Number(r.qty ?? 0),
      islem: String(r.islem ?? ""),
      kaynak: r.kaynak ?? null,
      operator_name: r.operator_name ?? null,
      kargo_firmasi: r.kargo_firmasi ?? null,
      musteri: r.musteri ?? null,
    }));
    return { available: true, rows };
  } catch (e) {
    console.error("[analiz-d1] kalite", e);
    return { available: false, rows: [] };
  }
}

/** Tüm zamanlar güncel UYGUNSUZ bakiye (URUN). */
export async function getUygunsuzBakiye(): Promise<number> {
  try {
    const s = await sb();
    const data = await fetchAll<{ qty: number | null }>((lo, hi) =>
      s
        .from("kalite_hareketleri")
        .select("qty")
        .eq("stok_turu", "UYGUNSUZ")
        .eq("item_tipi", "URUN")
        .order("id")
        .range(lo, hi),
    );
    return data.reduce((a, r) => a + Number(r.qty ?? 0), 0);
  } catch {
    return 0;
  }
}

export const isUygunsuzGiris = (r: KaliteRow) =>
  r.stok_turu === "UYGUNSUZ" && r.islem === "giris" && r.item_tipi === "URUN";
export const isKontrol = (r: KaliteRow) => r.stok_turu === "UYGUNSUZ" && r.qty < 0 && r.item_tipi === "URUN";
export const isFireUrun = (r: KaliteRow) => r.stok_turu === "FIRE" && r.item_tipi === "URUN";

export function kontrolKarar(islem: string): "uygun" | "sokum" | "fire" | "diger" {
  if (islem === "kontrol_uygun") return "uygun";
  if (islem === "sokum") return "sokum";
  if (islem === "fire_giris") return "fire";
  return "diger";
}

export const KAYNAK_LABELS: Record<string, string> = {
  iade: "İade",
  paketleme: "Paketleme",
  montaj: "Montaj",
  kesim: "Kesim",
  stok: "Stok",
  kontrol: "Kontrol",
};
export const kaynakLabel = (k: string | null) => (k ? (KAYNAK_LABELS[k] ?? k) : "—");

export const TIP_LABELS: Record<string, string> = {
  URUN: "Ürün",
  YARI_MAMUL: "Yarı Mamul",
  PLAKA: "Plaka",
};

// ─── Üretim satırları + adam-dakika ─────────────────────────────

export interface PackRow {
  day: string;
  sku: string;
  qty: number;
  /** kişi-dk (paketleme: (bitiş−başlangıç−duraklama)×işçi) */
  manMin: number;
  /** paketleme standart süre kullanılabilirse (qty×T) kazanılan dk için SKU anahtarı */
}
export interface MontajRow {
  day: string;
  sku: string;
  stepId: string;
  qty: number;
  manMin: number;
}
export interface ProdRows {
  pack: PackRow[];
  montaj: MontajRow[];
}

export async function getProdRows(from: string | null, to: string | null): Promise<ProdRows> {
  const s = await sb();
  const b = tsBounds(from, to);
  const [p, m] = await Promise.all([
    fetchAll<any>((lo, hi) => {
      let q = s
        .from("pack_events")
        .select("tarih, sku, qty, start_time, end_time, duraklama_dk, worker_count")
        .eq("durum", "tamamlandi")
        .order("session_id");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    }),
    fetchAll<any>((lo, hi) => {
      let q = s
        .from("montaj_sessions")
        .select("created_at, sku, step_id, qty, net_sure_dk, worker_count")
        .eq("durum", "tamamlandi")
        .order("session_id");
      if (b.gte) q = q.gte("created_at", b.gte);
      if (b.lte) q = q.lte("created_at", b.lte);
      return q.range(lo, hi);
    }),
  ]);

  const pack: PackRow[] = [];
  for (const r of p) {
    const day = trDay(r.tarih);
    if (!day || !r.sku) continue;
    let man = 0;
    if (r.start_time && r.end_time) {
      const mins =
        (new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000 - Number(r.duraklama_dk ?? 0);
      if (mins > 0) man = mins * Math.max(Number(r.worker_count ?? 1), 1);
    }
    pack.push({ day, sku: r.sku, qty: Number(r.qty ?? 0), manMin: man });
  }
  const montaj: MontajRow[] = [];
  for (const r of m) {
    const day = trDay(r.created_at);
    if (!day) continue;
    const net = Number(r.net_sure_dk ?? 0);
    montaj.push({
      day,
      sku: r.sku ?? "",
      stepId: r.step_id,
      qty: Number(r.qty ?? 0),
      manMin: net > 0 ? net * Math.max(Number(r.worker_count ?? 1), 1) : 0,
    });
  }
  return { pack, montaj };
}

/** Satış sayılan stok çıkışı: sku × gün */
export async function getStokCikisRows(
  from: string | null,
  to: string | null,
): Promise<{ day: string; sku: string; qty: number }[]> {
  const s = await sb();
  const rows = await fetchAll<{ sku: string | null; qty: number | null; source: string | null; tarih: string | null }>(
    (lo, hi) => {
      let q = s.from("stock_movements").select("sku, qty, source, tarih").lt("qty", 0).order("id");
      if (from) q = q.gte("tarih", from);
      if (to) q = q.lte("tarih", to);
      return q.range(lo, hi);
    },
  );
  const out: { day: string; sku: string; qty: number }[] = [];
  for (const r of rows) {
    const day = trDay(r.tarih);
    if (!day || !r.sku || !isSalesSource(r.source)) continue;
    out.push({ day, sku: r.sku, qty: Math.abs(Number(r.qty ?? 0)) });
  }
  return out;
}

export async function getGuncelStok(): Promise<Map<string, number>> {
  const s = await sb();
  const rows = await fetchAll<{ sku: string | null; miktar: number | null }>((lo, hi) =>
    s.from("urun_toplam_stok").select("sku, miktar").range(lo, hi),
  );
  const m = new Map<string, number>();
  for (const r of rows) if (r.sku) m.set(r.sku, Number(r.miktar ?? 0));
  return m;
}

export async function getActiveSkus(): Promise<Map<string, string>> {
  const s = await sb();
  const rows = await fetchAll<{ sku: string; urun_adi: string | null }>((lo, hi) =>
    s.from("products").select("sku, urun_adi").eq("aktif_mi", true).order("sku").range(lo, hi),
  );
  return new Map(rows.map((r) => [r.sku, r.urun_adi ?? r.sku]));
}

// ─── Sayfa yardımcıları ─────────────────────────────────────────

type SPx = Record<string, string | string[] | undefined>;

export async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch (e) {
    console.error("[analiz-d1]", e);
    return fallback;
  }
}

/** Dönem parametrelerini (period/from/to) koruyan query string */
export function periodQs(sp: SPx): string {
  const u = new URLSearchParams();
  for (const k of ["period", "from", "to"]) {
    const raw = sp[k];
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v) u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}

export const trunc = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
