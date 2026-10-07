"use server";

/**
 * Yönetim ekranları (Mavi Yaka planlama + Talepler) için ek okuma action'ları.
 * Çekirdek API (actions.ts / queries.ts) değiştirilmez.
 */

import { TALIMAT_PLANNER_ROLES, TALIMAT_VIEW_ROLES } from "./constants";
import { rolGerekli, sonucaCevir, talimatDb } from "./db";
import { haftaBaslangici } from "./helpers";
import type { ActionResult, TalimatPlan } from "./types";

export interface PlakaParcaOzet {
  part_id: string;
  part_adi: string | null;
  adet: number | null;
}

/** Plakadan çıkan parçaların özeti (kesim satırında plaka seçerken gösterilir) */
export async function plakaOzetiGetir(plakaId: string): Promise<ActionResult<PlakaParcaOzet[]>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    const sb = await talimatDb();
    const { data, error } = await sb
      .from("plaka_parts")
      .select("part_id, default_qty")
      .eq("plaka_id", plakaId);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ part_id: string; default_qty: number | null }>;
    if (rows.length === 0) return [];
    const { data: parts } = await sb
      .from("all_parts")
      .select("part_id, part_adi")
      .in("part_id", rows.map((r) => r.part_id));
    const ad = new Map((parts ?? []).map((p) => [p.part_id as string, p.part_adi as string]));
    return rows.map((r) => ({ part_id: r.part_id, part_adi: ad.get(r.part_id) ?? null, adet: r.default_qty }));
  });
}

/**
 * "İş talimatına ata" için hedef plan: bu haftanın yayındaki planı, yoksa bu hafta/sonrası en yakın taslak
 * (talep_talimata_ata RPC'sinin planId boşken kullandığı mantık).
 */
export async function ataHedefPlanGetir(): Promise<ActionResult<TalimatPlan | null>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const sb = await talimatDb();
    const bu = haftaBaslangici(new Date());
    const { data: yayinda } = await sb
      .from("talimat_plan_ozet")
      .select("*")
      .eq("hafta_baslangic", bu)
      .eq("durum", "yayinda")
      .maybeSingle();
    if (yayinda) return yayinda as TalimatPlan;
    const { data: taslak } = await sb
      .from("talimat_plan_ozet")
      .select("*")
      .eq("durum", "taslak")
      .gte("hafta_baslangic", bu)
      .order("hafta_baslangic", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (taslak as TalimatPlan | null) ?? null;
  });
}

export interface TalepBaglanti {
  talep_id: string;
  /** bağlı satırlardan en az biri değişmiş / onay bekliyor */
  kirmizi: boolean;
  plan_id: string;
  hafta_baslangic: string;
  /** Derin bağlantı hedefi: en son haftadaki (tercihen değişmiş) bağlı satır */
  satir_id: string;
}

/** Taleplere bağlı iş talimatı satırlarının özeti ("Değişti" rozeti ve "Talimatı gör" bağlantısı için) */
export async function talepBaglantilariGetir(talepIdleri: string[]): Promise<ActionResult<TalepBaglanti[]>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    if (talepIdleri.length === 0) return [];
    const sb = await talimatDb();
    const { data, error } = await sb
      .from("talimat_satir_ilerleme")
      .select("talep_id, satir_id, plan_id, hafta_baslangic, kirmizi")
      .in("talep_id", talepIdleri);
    if (error) throw new Error(error.message);
    const harita = new Map<string, TalepBaglanti>();
    for (const r of (data ?? []) as Array<{ talep_id: string; satir_id: string; plan_id: string; hafta_baslangic: string; kirmizi: boolean }>) {
      const m = harita.get(r.talep_id);
      if (!m) {
        harita.set(r.talep_id, { talep_id: r.talep_id, kirmizi: !!r.kirmizi, plan_id: r.plan_id, hafta_baslangic: r.hafta_baslangic, satir_id: r.satir_id });
        continue;
      }
      const daSonra = r.hafta_baslangic > m.hafta_baslangic;
      const ayniHaftaKirmizi = r.hafta_baslangic === m.hafta_baslangic && !!r.kirmizi && !m.kirmizi;
      m.kirmizi = m.kirmizi || !!r.kirmizi;
      if (daSonra || ayniHaftaKirmizi) {
        m.hafta_baslangic = r.hafta_baslangic;
        m.plan_id = r.plan_id;
        m.satir_id = r.satir_id;
      }
    }
    return [...harita.values()];
  });
}
