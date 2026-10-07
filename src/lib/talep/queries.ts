/**
 * Talep okuma sorguları (sunucu tarafı). RLS: okuma = ofis rolleri + üretim erişimi.
 * Sıralama: varsayılan en yeni önce (TalepFiltre.sirala ile değiştirilebilir).
 */
import "server-only";

import { talimatDb } from "@/lib/talimat/db";
import type { Talep, TalepFiltre, TalepRevizyon, TalepStokUyarisi } from "./types";

function hataFirlat(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function aramaTemizle(q: string): string {
  return q.replace(/[,()*%\\]/g, " ").trim();
}

/** Talep listesi (talep_durum görünümü). { talepler, toplam } döner. */
export async function getTalepler(f: TalepFiltre = {}): Promise<{ talepler: Talep[]; toplam: number }> {
  const sb = await talimatDb();
  let q = sb.from("talep_durum").select("*", { count: "exact" }).order("created_at", { ascending: f.sirala === "eski" });

  if (f.durumlar && f.durumlar.length) q = q.in("durum", f.durumlar);
  if (f.kapali === true) q = q.not("kapanis", "is", null);
  if (f.kapali === false) q = q.is("kapanis", null);
  if (f.kaldirilmamis) q = q.is("kaldirildi_at", null);
  if (f.sku) q = q.eq("sku", f.sku);
  if (f.olusturan) q = q.eq("olusturan", f.olusturan);
  if (f.depoId) q = q.eq("hedef_depo_id", f.depoId);
  if (f.baslangic) q = q.gte("created_at", `${f.baslangic}T00:00:00+03:00`);
  if (f.bitis) q = q.lte("created_at", `${f.bitis}T23:59:59.999+03:00`);
  if (f.arama && aramaTemizle(f.arama)) {
    const a = aramaTemizle(f.arama);
    q = q.or(`sku.ilike.%${a}%,urun_adi.ilike.%${a}%,aciklama.ilike.%${a}%`);
  }
  const limit = f.limit ?? 100;
  const offset = f.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  hataFirlat(error);
  return { talepler: (data ?? []) as Talep[], toplam: count ?? 0 };
}

export async function getTalep(talepId: string): Promise<Talep | null> {
  const sb = await talimatDb();
  const { data, error } = await sb.from("talep_durum").select("*").eq("talep_id", talepId).maybeSingle();
  hataFirlat(error);
  return (data as Talep | null) ?? null;
}

/** 10 dakikadan sonraki düzenleme/kapanış kayıtları */
export async function getTalepRevizyonlari(talepId: string): Promise<TalepRevizyon[]> {
  const sb = await talimatDb();
  const { data, error } = await sb
    .from("talep_revizyonlar")
    .select("*")
    .eq("talep_id", talepId)
    .order("created_at", { ascending: true });
  hataFirlat(error);
  const rows = (data ?? []) as TalepRevizyon[];
  const ids = [...new Set(rows.map((r) => r.yapan).filter((x): x is string => !!x))];
  if (ids.length === 0) return rows;
  const { data: us } = await sb.from("users").select("user_id, full_name").in("user_id", ids);
  const ad = new Map((us ?? []).map((u) => [u.user_id as string, u.full_name as string]));
  return rows.map((r) => ({ ...r, yapan_adi: r.yapan ? (ad.get(r.yapan) ?? null) : null }));
}

/** Talep formunda stok uyarısı (stok >= istenen ise uyarı) */
export async function getTalepStokUyarisi(sku: string, depoId: string | null, istenen: number | null): Promise<TalepStokUyarisi> {
  const sb = await talimatDb();
  const [toplamRes, depoRes] = await Promise.all([
    sb.from("urun_toplam_stok").select("miktar").eq("sku", sku).maybeSingle(),
    depoId
      ? sb.from("urun_depo_stok").select("miktar").eq("sku", sku).eq("depo_id", depoId)
      : Promise.resolve({ data: null, error: null }),
  ]);
  hataFirlat(toplamRes.error);
  const toplam = Number(toplamRes.data?.miktar) || 0;
  const depo = depoId ? ((depoRes.data ?? []) as Array<{ miktar: number }>).reduce((t, r) => t + (Number(r.miktar) || 0), 0) : null;
  const esas = depo != null ? depo : toplam;
  return { uyari: !!istenen && istenen > 0 && esas >= istenen, toplam_stok: toplam, depo_stok: depo, istenen };
}
