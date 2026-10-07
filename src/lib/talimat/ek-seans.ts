/**
 * Ek Seans (plan dışı, "Ek Seans Aç" ile başlatılan montaj/paketleme seansları) sorguları.
 * Kaynak: `ek_seanslar` görünümü (security_invoker, SQL 152). Yetki: TALIMAT_VIEW_ROLES (salt okunur).
 */
import "server-only";

import { TALIMAT_VIEW_ROLES } from "./constants";
import { rolGerekli, talimatDb } from "./db";

export interface EkSeansSatir {
  kaynak: "montaj" | "paketleme";
  session_id: string;
  personel_id: string | null;
  personel_adi: string | null;
  sku: string | null;
  urun_adi: string | null;
  step_id: string | null;
  step_name: string | null;
  seq_no: number | null;
  qty: number;
  durum: "acik" | "beklemede" | "tamamlandi";
  start_time: string;
  end_time: string | null;
  net_sure_dk: number | null;
  gun: string;
}

export interface EkSeansToplam {
  personel_id: string;
  personel_adi: string;
  seans_sayisi: number;
  toplam_adet: number;
  toplam_sure_dk: number;
  montaj_sayisi: number;
  paketleme_sayisi: number;
  son_seans: string | null;
}

const ISO_GUN = /^\d{4}-\d{2}-\d{2}$/;
const SELECT =
  "kaynak, session_id, personel_id, personel_adi, sku, urun_adi, step_id, step_name, seq_no, qty, durum, start_time, end_time, net_sure_dk, gun";
const SAYFA = 1000;
const MAKS = 20000;

async function aralikCek(from: string, to: string, personelId?: string | null): Promise<EkSeansSatir[]> {
  if (!ISO_GUN.test(from) || !ISO_GUN.test(to)) throw new Error("Geçersiz tarih");
  const sb = await talimatDb();
  const out: EkSeansSatir[] = [];
  for (let off = 0; off < MAKS; off += SAYFA) {
    let q = sb
      .from("ek_seanslar")
      .select(SELECT)
      .gte("gun", from)
      .lte("gun", to)
      .order("start_time", { ascending: true })
      .range(off, off + SAYFA - 1);
    if (personelId) q = q.eq("personel_id", personelId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as EkSeansSatir[];
    for (const r of rows) out.push({ ...r, qty: Number(r.qty ?? 0), net_sure_dk: r.net_sure_dk === null ? null : Number(r.net_sure_dk) });
    if (rows.length < SAYFA) break;
  }
  return out;
}

/** Bir günün (Europe/Istanbul) ek seansları, başlangıç saatine göre */
export async function getEkSeanslarGun(gun: string, personelId?: string | null): Promise<EkSeansSatir[]> {
  await rolGerekli(TALIMAT_VIEW_ROLES);
  return aralikCek(gun, gun, personelId);
}

/** Aralıktaki (dahil) ek seanslar */
export async function getEkSeanslarAralik(from: string, to: string, personelId?: string | null): Promise<EkSeansSatir[]> {
  await rolGerekli(TALIMAT_VIEW_ROLES);
  return aralikCek(from, to, personelId);
}

/** Aralıktaki ek seansların personel bazlı toplamları */
export async function getEkSeansToplamlari(from: string, to: string): Promise<EkSeansToplam[]> {
  await rolGerekli(TALIMAT_VIEW_ROLES);
  const rows = await aralikCek(from, to);
  const m = new Map<string, EkSeansToplam>();
  for (const r of rows) {
    const id = r.personel_id ?? "-";
    let t = m.get(id);
    if (!t) {
      t = {
        personel_id: id, personel_adi: r.personel_adi ?? id, seans_sayisi: 0, toplam_adet: 0,
        toplam_sure_dk: 0, montaj_sayisi: 0, paketleme_sayisi: 0, son_seans: null,
      };
      m.set(id, t);
    }
    t.seans_sayisi++;
    t.toplam_adet += r.qty;
    t.toplam_sure_dk += r.net_sure_dk ?? 0;
    if (r.kaynak === "montaj") t.montaj_sayisi++;
    else t.paketleme_sayisi++;
    if (!t.son_seans || r.start_time > t.son_seans) t.son_seans = r.start_time;
  }
  return [...m.values()].sort((a, b) => b.seans_sayisi - a.seans_sayisi || a.personel_adi.localeCompare(b.personel_adi, "tr"));
}
