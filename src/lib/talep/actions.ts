"use server";

/**
 * Talep server action'ları. Talebi ofis rolleri açar; açan 10 dakika içinde serbestçe düzenler/geri çeker/siler,
 * sonrasında değişiklikler revizyon olarak kaydedilir ve bağlı talimat satırları kırmızı (degisti) olur.
 * İş talimatına atama yalnız planlayıcılarda (TALIMAT_PLANNER_ROLES).
 * Detaylar: docs/talimat-api.md
 */

import { z } from "zod";
import { TALEP_CREATOR_ROLES, TALIMAT_PLANNER_ROLES, TALIMAT_VIEW_ROLES } from "@/lib/talimat/constants";
import { rolGerekli, rpcCagir, sonucaCevir, talimatYenile } from "@/lib/talimat/db";
import type { ActionResult } from "@/lib/talimat/types";
import { getTalep, getTalepler, getTalepRevizyonlari, getTalepStokUyarisi } from "./queries";
import type {
  Talep,
  TalepFiltre,
  TalepGuncelleGirdi,
  TalepGuncelleSonuc,
  TalepOlusturGirdi,
  TalepRevizyon,
  TalepStokUyarisi,
  TalepTalimataAtaGirdi,
} from "./types";

const uuid = z.string().uuid("Geçersiz kimlik");
const tarih = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD olmalı");

/** Talep oluştur. Dönen: talep_id. (Stok uyarısı için önce talepStokUyarisiGetir çağrılabilir.) */
export async function talepOlustur(girdi: TalepOlusturGirdi): Promise<ActionResult<string>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALEP_CREATOR_ROLES);
    const p = z
      .object({
        sku: z.string().min(1, "Ürün seçilmeli"),
        hedefDepoId: z.string().min(1).nullish(),
        istenenMiktar: z.number().positive("Miktar sıfırdan büyük olmalı").nullish(),
        terminTarihi: tarih.nullish(),
        aciklama: z.string().max(1000).nullish(),
      })
      .parse(girdi);
    const id = await rpcCagir<string>("talep_olustur", {
      p_sku: p.sku,
      p_hedef_depo: p.hedefDepoId ?? null,
      p_miktar: p.istenenMiktar ?? null,
      p_termin: p.terminTarihi ?? null,
      p_aciklama: p.aciklama ?? null,
    });
    talimatYenile();
    return id;
  });
}

/**
 * Talebi güncelle (gönderilmeyen alan değişmez, null ise temizlenir). 10 dk sonrası revizyon kaydı oluşur;
 * bağlı satırlar degisti=true olur. bildirimGonder=true ve çağıran planlayıcıysa bağlı planlar bildirimli yayınlanır.
 */
export async function talepGuncelle(girdi: TalepGuncelleGirdi): Promise<ActionResult<TalepGuncelleSonuc>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALEP_CREATOR_ROLES);
    const p = z
      .object({
        talepId: uuid,
        sku: z.string().min(1).optional(),
        hedefDepoId: z.string().min(1).nullable().optional(),
        istenenMiktar: z.number().positive("Miktar sıfırdan büyük olmalı").nullable().optional(),
        terminTarihi: tarih.nullable().optional(),
        aciklama: z.string().max(1000).nullable().optional(),
        bildirimGonder: z.boolean().optional(),
      })
      .parse(girdi);
    const alanlar: Record<string, unknown> = {};
    if (p.sku !== undefined) alanlar.sku = p.sku;
    if (p.hedefDepoId !== undefined) alanlar.hedef_depo_id = p.hedefDepoId;
    if (p.istenenMiktar !== undefined) alanlar.istenen_miktar = p.istenenMiktar;
    if (p.terminTarihi !== undefined) alanlar.termin_tarihi = p.terminTarihi;
    if (p.aciklama !== undefined) alanlar.aciklama = p.aciklama;
    const sonuc = await rpcCagir<TalepGuncelleSonuc>("talep_guncelle", {
      p_talep: p.talepId,
      p: alanlar,
      p_bildirim: p.bildirimGonder ?? false,
    });
    talimatYenile();
    return sonuc;
  });
}

/** Talebi geri çek (kapanis='geri_cekildi'; bağlı iş talimatı satırları pasife alınır) */
export async function talepGeriCek(talepId: string, neden?: string | null): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALEP_CREATOR_ROLES);
    await rpcCagir("talep_geri_cek", { p_talep: uuid.parse(talepId), p_neden: neden ?? null });
    talimatYenile();
    return undefined;
  });
}

/** Talebi sil (açan: ilk 10 dk; planlayıcı: her zaman; iş talimatına bağlı talep silinemez) */
export async function talepSil(talepId: string): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALEP_CREATOR_ROLES);
    await rpcCagir("talep_sil", { p_talep: uuid.parse(talepId) });
    talimatYenile();
    return undefined;
  });
}

/** Talebi kapat: 'tamamlandi' | 'tamamlanmadi' (+ neden). Açan veya planlayıcı. */
export async function talepKapat(
  talepId: string,
  durum: "tamamlandi" | "tamamlanmadi",
  neden?: string | null,
): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALEP_CREATOR_ROLES);
    await rpcCagir("talep_kapat", {
      p_talep: uuid.parse(talepId),
      p_durum: z.enum(["tamamlandi", "tamamlanmadi"]).parse(durum),
      p_neden: neden ?? null,
    });
    talimatYenile();
    return undefined;
  });
}

/**
 * Kapalı talebi listeden "Kaldır": aktif listeden çıkar, geçmiş sekmelerine geçer (açan veya planlayıcı).
 * Kapalı olmayan talep kaldırılamaz.
 */
export async function talepKaldir(talepId: string): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALEP_CREATOR_ROLES);
    await rpcCagir("talep_kaldir", { p_talep: uuid.parse(talepId) });
    talimatYenile();
    return undefined;
  });
}

/** Toplu "Kaldır". Dönen: kaldırılan talep sayısı (yetkisiz/açık olanlar atlanır). */
export async function talepKaldirToplu(talepIdleri: string[]): Promise<ActionResult<number>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALEP_CREATOR_ROLES);
    const ids = z.array(uuid).min(1).max(500).parse(talepIdleri);
    const n = await rpcCagir<number>("talep_kaldir_toplu", { p_talepler: ids });
    talimatYenile();
    return Number(n) || 0;
  });
}

/** Planlayıcı: "stokta mevcut" kısayolu (talebi kapatır, bağlı satırları pasife alır) */
export async function talepStoktaMevcut(talepId: string, neden?: string | null): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    await rpcCagir("talep_stokta_mevcut", { p_talep: uuid.parse(talepId), p_neden: neden ?? null });
    talimatYenile();
    return undefined;
  });
}

/** Kapalı talebi yeniden aç (açan veya planlayıcı) */
export async function talepYenidenAc(talepId: string): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALEP_CREATOR_ROLES);
    await rpcCagir("talep_yeniden_ac", { p_talep: uuid.parse(talepId) });
    talimatYenile();
    return undefined;
  });
}

/**
 * Talebi iş talimatına ata (planlayıcı). sira boşsa listenin sonuna eklenir; dolu sırada SIRA_DOLU döner,
 * kaydir:true ile araya girer. Talep açıklaması satır notuna kopyalanır. Dönen: satir_id.
 */
export async function talepTalimataAta(girdi: TalepTalimataAtaGirdi): Promise<ActionResult<string>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const p = z
      .object({
        talepId: uuid,
        personelId: z.string().min(1, "Personel seçilmeli"),
        sira: z.number().int().min(1).nullish(),
        miktar: z.number().positive("Miktar sıfırdan büyük olmalı").nullish(),
        istasyon: z.enum(["kesim", "montaj", "paketleme"]).nullish(),
        plakaId: z.string().min(1).nullish(),
        kaydir: z.boolean().optional(),
        planId: uuid.nullish(),
      })
      .parse(girdi);
    const id = await rpcCagir<string>("talep_talimata_ata", {
      p_talep: p.talepId,
      p_personel: p.personelId,
      p_sira: p.sira ?? null,
      p_miktar: p.miktar ?? null,
      p_istasyon: p.istasyon ?? null,
      p_kaydir: p.kaydir ?? false,
      p_plan: p.planId ?? null,
      p_plaka: p.plakaId ?? null,
    });
    talimatYenile();
    return id;
  });
}

// ─── Okuma action'ları ──────────────────────────────────────────

/** Talep listesi. Geçmiş listeleri: kapali:true + durumlar:["tamamlandi","stokta_mevcut"] (Tamamlanan) / ["tamamlanmadi","geri_cekildi"] (Tamamlanmayan) */
export async function talepleriGetir(filtre: TalepFiltre = {}): Promise<ActionResult<{ talepler: Talep[]; toplam: number }>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getTalepler(filtre);
  });
}

export async function talepDetayGetir(talepId: string): Promise<ActionResult<{ talep: Talep | null; revizyonlar: TalepRevizyon[] }>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    const id = uuid.parse(talepId);
    const [talep, revizyonlar] = await Promise.all([getTalep(id), getTalepRevizyonlari(id)]);
    return { talep, revizyonlar };
  });
}

/** Stok >= istenen ise uyarı (UI: "Stokta 500 var, yine de talep ediyor musunuz?" — metin için helpers.stokUyarisiMetni) */
export async function talepStokUyarisiGetir(
  sku: string,
  depoId: string | null,
  istenen: number | null,
): Promise<ActionResult<TalepStokUyarisi>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALEP_CREATOR_ROLES);
    return getTalepStokUyarisi(z.string().min(1).parse(sku), depoId, istenen);
  });
}
