"use server";

/**
 * Toplu satır silme (Mavi Yaka: "Tüm listeyi temizle" / "Personeli listeden çıkar").
 * Mevcut talimat_satir_sil RPC'sini satır satır çağırır (DB değişikliği yok).
 * Sıra sıkıştırma nedeniyle her personelde sira'ya göre azalan sırayla silinir.
 */

import { z } from "zod";
import { TALIMAT_PLANNER_ROLES } from "./constants";
import { rolGerekli, rpcCagir, sonucaCevir, talimatDb, talimatYenile } from "./db";
import type { ActionResult } from "./types";

const uuid = z.string().uuid("Geçersiz kimlik");

export interface TopluSilSonuc {
  silinen: number;
  hatalar: string[];
}

export async function satirlariTopluSil(planId: string, satirIds: string[]): Promise<ActionResult<TopluSilSonuc>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const plan = uuid.parse(planId);
    const ids = z.array(uuid).max(2000).parse(satirIds);
    if (ids.length === 0) return { silinen: 0, hatalar: [] };

    const sb = await talimatDb();
    const { data: p, error: pe } = await sb.from("talimat_planlar").select("durum").eq("plan_id", plan).maybeSingle();
    if (pe) throw new Error(pe.message);
    if (!p) throw new Error("Plan bulunamadı");
    if (p.durum === "pasif") throw new Error("PLAN_PASIF: Pasif plan düzenlenemez");

    const { data: rows, error } = await sb
      .from("talimat_satirlar")
      .select("satir_id, personel_id, sira")
      .eq("plan_id", plan)
      .in("satir_id", ids);
    if (error) throw new Error(error.message);

    const sirali = ((rows ?? []) as Array<{ satir_id: string; personel_id: string; sira: number | null }>).sort(
      (a, b) => a.personel_id.localeCompare(b.personel_id) || (b.sira ?? 0) - (a.sira ?? 0),
    );

    let silinen = 0;
    const hatalar: string[] = [];
    for (const r of sirali) {
      try {
        await rpcCagir("talimat_satir_sil", { p_satir: r.satir_id });
        silinen++;
      } catch (e) {
        hatalar.push(e instanceof Error ? e.message : "Bilinmeyen hata");
      }
    }
    talimatYenile();
    return { silinen, hatalar };
  });
}
