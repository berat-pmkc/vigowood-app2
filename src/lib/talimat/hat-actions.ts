"use server";

/**
 * Hat bazlı iş talimatı server action'ları (H1). Her action ActionResult<T> döner.
 * Satır CRUD (hat_id ile) ve pasif(hat) için actions.ts'deki `satirKaydet` / `satirSil` / `talimatPasifYap` kullanılır;
 * burada hat yönetimi, hat içi sıralama, hatta kopyalama, hat onayı ve hat bazlı okuma action'ları bulunur.
 * Detaylar: docs/talimat-api.md "Hat bazlı model".
 */

import { z } from "zod";
import { TALIMAT_PLANNER_ROLES, TALIMAT_VIEW_ROLES } from "./constants";
import { rolGerekli, rpcCagir, sonucaCevir, talimatYenile } from "./db";
import {
  getHatlar,
  getHatSiraDurumu,
  getPlanHatGruplari,
  getTabletHatBildirimleri,
  getTabletHatListe,
} from "./queries";
import type {
  ActionResult,
  HatTur,
  TalimatBildirim,
  TalimatHat,
  TalimatPlanHatGrubu,
  TalimatSatirFiltre,
  TalimatTabletHatListe,
} from "./types";

const uuid = z.string().uuid("Geçersiz kimlik");
const hatTur = z.enum(["montaj", "paketleme"]);

// ─── Hat yönetimi (planlayıcı) ──────────────────────────────────

/** Hat listesi (hat sırasıyla). sadeceAktif=true pasif hatları gizler. */
export async function hatlariGetir(sadeceAktif = true): Promise<ActionResult<TalimatHat[]>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getHatlar({ sadeceAktif });
  });
}

/** Yeni hat ("Hat ekle"). Mevcut pasif olmayan planlara 1 boş satırla eklenir. Aynı isim: hata. Dönen: hat_id */
export async function hatEkle(ad: string, tur: HatTur): Promise<ActionResult<string>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const p = z.object({ ad: z.string().trim().min(1, "Hat adı boş olamaz").max(60), tur: hatTur }).parse({ ad, tur });
    const id = await rpcCagir<string>("hat_ekle", { p_ad: p.ad, p_tur: p.tur });
    talimatYenile();
    return id;
  });
}

/** Hat adı / türü / sırası / aktifliği (gönderilmeyen alan değişmez). Tür değişirse hattın satırlarının istasyonu güncellenir. */
export async function hatGuncelle(
  hatId: string,
  alanlar: { ad?: string; tur?: HatTur; sira?: number; aktif?: boolean },
): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const p = z
      .object({
        ad: z.string().trim().min(1).max(60).optional(),
        tur: hatTur.optional(),
        sira: z.number().int().optional(),
        aktif: z.boolean().optional(),
      })
      .parse(alanlar);
    await rpcCagir("hat_guncelle", {
      p_hat: uuid.parse(hatId),
      p_ad: p.ad ?? null,
      p_tur: p.tur ?? null,
      p_sira: p.sira ?? null,
      p_aktif: p.aktif ?? null,
    });
    talimatYenile();
    return undefined;
  });
}

/** Hattı kalıcı olarak pasife al (pasif=true) / geri aç. Satırlar silinmez. (Tarih aralıklı pasif için talimatPasifYap kapsam='hat'.) */
export async function hatPasifYap(hatId: string, pasif = true): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    await rpcCagir("hat_pasif", { p_hat: uuid.parse(hatId), p_pasif: pasif });
    talimatYenile();
    return undefined;
  });
}

// ─── Plan: hat grupları, sıralama, kopyalama ────────────────────

/** Planlayıcı ekranı: plan satırları hat gruplarında (boş hat satırları dahil) */
export async function planHatGruplariGetir(
  planId: string,
  filtre: TalimatSatirFiltre = {},
  pasifHatlariDahilEt = false,
): Promise<ActionResult<TalimatPlanHatGrubu[]>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getPlanHatGruplari(uuid.parse(planId), filtre, { pasifHatlariDahilEt });
  });
}

/** Sıra seçerken: hattın dolu öncelikleri (bos=true -> ürünsüz satır, doldurulabilir) */
export async function hatSiraDurumuGetir(planId: string, hatId: string) {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    return getHatSiraDurumu(uuid.parse(planId), uuid.parse(hatId));
  });
}

/** Hattın TÜM satırlarını verilen sırayla yeniden numaralar (sürükle-bırak) */
export async function satirSiralaHat(planId: string, hatId: string, satirIdleri: string[]): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    await rpcCagir("talimat_satir_sirala_hat", {
      p_plan: uuid.parse(planId),
      p_hat: uuid.parse(hatId),
      p_satir_ids: z.array(uuid).min(1).parse(satirIdleri),
    });
    talimatYenile();
    return undefined;
  });
}

/**
 * Seçili satırları başka bir hattın SONUNA kopyalar (aynı plan). Hedef hattaki boş satırlar önce doldurulur, gerekirse yeni satır
 * açılır; sku, istenen miktar, not ve açık talep bağı kopyalanır, sayaç sıfırdan başlar. Boş kaynak satırlar atlanır.
 * Dönen: yeni/doldurulan satır id'leri (verilen sırayla).
 */
export async function satirlariHattaKopyala(satirIdleri: string[], hedefHatId: string): Promise<ActionResult<string[]>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const ids = await rpcCagir<string[]>("talimat_satirlari_hatta_kopyala", {
      p_satir_ids: z.array(uuid).min(1, "Kopyalanacak satır seçilmedi").parse(satirIdleri),
      p_hedef_hat: uuid.parse(hedefHatId),
    });
    talimatYenile();
    return ids;
  });
}

// ─── Onay (hat) ─────────────────────────────────────────────────

/**
 * Hat başına bir "Görüldü, anlaşıldı". Hatta ait talimatı gören herhangi bir üretim kullanıcısı / istasyon tableti onaylar
 * (onaylayan kullanıcı kaydedilir). hepsi=true (varsayılan): aynı plandaki o hatta ait tüm bekleyen yayınları onaylar.
 * Dönen: onaylanan yayın sayısı (zaten onaylıysa 0).
 */
export async function talimatOnaylaHat(yayinId: string, hatId: string, hepsi = true): Promise<ActionResult<number>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    const n = await rpcCagir<number>("talimat_onayla", {
      p_yayin: uuid.parse(yayinId),
      p_hat: uuid.parse(hatId),
      p_hepsi: hepsi,
    });
    talimatYenile();
    return n;
  });
}

// ─── Tablet ─────────────────────────────────────────────────────

/** Tablet "İş Talimatları": hat bölümleri (aktif/tamamlanan satırlar, satır başına açık seans, ek seanslar, bekleyen onaylar) */
export async function tabletHatListeGetir(): Promise<ActionResult<TalimatTabletHatListe>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getTabletHatListe();
  });
}

/** Hat bildirimleri (banner): geri çekilmeyenler; hatIds verilirse yalnız o hatlar */
export async function tabletHatBildirimleriGetir(
  hatIds?: string[],
  opts: { sadeceOkunmamis?: boolean } = {},
): Promise<ActionResult<TalimatBildirim[]>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getTabletHatBildirimleri({ hatIds, sadeceOkunmamis: opts.sadeceOkunmamis });
  });
}
