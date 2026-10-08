/**
 * Mavi Yaka (planlayıcı) hat bazlı yardımcıları — mevcut dosyalara dokunmadan.
 * Ek seanslar: `ek_seanslar` görünümünde hat_id/hat_adi (SQL 160) varsa hat bilgisiyle, yoksa eski kolonlarla döner.
 */
import "server-only";

import { getEkSeanslarAralik, type EkSeansSatir } from "./ek-seans";
import { talimatDb } from "./db";

export type EkSeansSatirHat = EkSeansSatir & { hat_id?: string | null; hat_adi?: string | null };

const ISO_GUN = /^\d{4}-\d{2}-\d{2}$/;
const SELECT =
  "kaynak, session_id, personel_id, personel_adi, hat_id, hat_adi, sku, urun_adi, step_id, step_name, seq_no, qty, durum, start_time, end_time, net_sure_dk, gun";

export async function getEkSeanslarAralikHat(from: string, to: string, personelId?: string | null): Promise<EkSeansSatirHat[]> {
  if (!ISO_GUN.test(from) || !ISO_GUN.test(to)) throw new Error("Geçersiz tarih");
  const sb = await talimatDb();
  const out: EkSeansSatirHat[] = [];
  for (let off = 0; off < 20000; off += 1000) {
    let q = sb
      .from("ek_seanslar")
      .select(SELECT)
      .gte("gun", from)
      .lte("gun", to)
      .order("start_time", { ascending: true })
      .range(off, off + 999);
    if (personelId) q = q.eq("personel_id", personelId);
    const { data, error } = await q;
    if (error) {
      // hat kolonları henüz yoksa eski görünüme düş
      if (off === 0) return getEkSeanslarAralik(from, to, personelId);
      throw new Error(error.message);
    }
    const rows = (data ?? []) as unknown as EkSeansSatirHat[];
    for (const r of rows) out.push({ ...r, qty: Number(r.qty ?? 0), net_sure_dk: r.net_sure_dk === null ? null : Number(r.net_sure_dk) });
    if (rows.length < 1000) break;
  }
  return out;
}
