"use server";

/**
 * Zamanlı pasif / aktif işlemleri (SQL 164): gün-saat seçerek pasif et / aktif et, aktif için iş sırası,
 * isteğe bağlı bildirimli/bildirimsiz yayın. Zamanı gelince talimat_zamanlayici() uygular.
 */

import { z } from "zod";
import { TALIMAT_PLANNER_ROLES } from "./constants";
import { rolGerekli, rpcCagir, sonucaCevir, talimatDb, talimatYenile } from "./db";
import type { ActionResult, ZamanliIslem, ZamanliIslemGirdi } from "./types";

const uuid = z.string().uuid("Geçersiz kimlik");

const girdiSchema = z.object({
  planId: uuid,
  kapsam: z.enum(["satir", "hat", "liste"]),
  ids: z.array(uuid).optional(),
  islem: z.enum(["pasif", "aktif"]),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD olmalı").nullish(),
  saat: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Saat SS:DD olmalı").nullish(),
  hedefSira: z.number().int().min(1).max(10000).nullish(),
  neden: z.string().max(300).nullish(),
  bitis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD olmalı").nullish(),
  yayin: z.enum(["yok", "bildirimsiz", "bildirimli"]).optional(),
  sesli: z.boolean().optional(),
});

export interface ZamanliIslemSonuc {
  islemId: string;
  durum: "bekliyor" | "yapildi";
  /** Pasif/aktif uygulandı ama yayın yapılamadıysa uyarı */
  uyari: string | null;
}

/** Zamanlı (veya "hemen") pasif/aktif işlemi ekler. Türkiye saati sabit UTC+3. */
export async function talimatZamanliIslemEkle(girdi: ZamanliIslemGirdi): Promise<ActionResult<ZamanliIslemSonuc>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const p = girdiSchema.parse(girdi);
    if (p.kapsam !== "liste" && (!p.ids || p.ids.length === 0)) throw new Error("Kayıt seçilmedi");
    const zaman = p.tarih ? `${p.tarih}T${p.saat ?? "00:00"}:00+03:00` : null;
    const r = await rpcCagir<{ islem_id: string; durum: "bekliyor" | "yapildi"; hata?: string | null }>(
      "talimat_zamanli_islem_ekle",
      {
        p_plan: p.planId,
        p_kapsam: p.kapsam,
        p_ids: p.ids ?? [],
        p_islem: p.islem,
        p_zaman: zaman,
        p_hedef_sira: p.hedefSira ?? null,
        p_neden: p.neden ?? null,
        p_bitis: p.bitis ?? null,
        p_yayin: p.yayin ?? "yok",
        p_sesli: !!p.sesli,
      },
    );
    talimatYenile();
    return { islemId: r.islem_id, durum: r.durum, uyari: r.hata ?? null };
  });
}

export async function talimatZamanliIslemIptal(islemId: string): Promise<ActionResult<boolean>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const ok = await rpcCagir<boolean>("talimat_zamanli_islem_iptal", { p_islem: uuid.parse(islemId) });
    talimatYenile();
    return ok;
  });
}

/** Plandaki bekleyen zamanlı işlemler (yalnız planlayıcı; yetkisiz/hata = boş) */
export async function talimatZamanliIslemler(planId: string): Promise<ZamanliIslem[]> {
  try {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const sb = await talimatDb();
    const { data, error } = await sb
      .from("talimat_zamanli_islemler")
      .select("islem_id,plan_id,kapsam,ids,islem,calisma_zamani,hedef_sira,pasif_neden,pasif_bitis,yayin,sesli,durum,hata,created_at")
      .eq("plan_id", planId)
      .eq("durum", "bekliyor")
      .order("calisma_zamani", { ascending: true });
    if (error) return [];
    return (data ?? []) as ZamanliIslem[];
  } catch {
    return [];
  }
}
