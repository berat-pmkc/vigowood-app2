"use server";

/**
 * İş Talimatları server action'ları (P4b yönetim + P4c tablet ekranları bunları çağırır).
 * Her action ActionResult<T> döner: { success: true, data } | { success: false, error, code? }.
 * Hata kodları: ARDISIK_SKU (art arda aynı ürün), SIRA_DOLU (dolu sıra, kaydir=true ile araya girilir),
 * PLAN_PASIF (pasif plan düzenlenemez), YETKI.
 * Detaylar: docs/talimat-api.md
 */

import { z } from "zod";
import { getCurrentUserWithAuth } from "@/lib/auth";
import { ADMIN_EQUIVALENT_ROLES } from "@/lib/constants";
import { TALIMAT_AYAR_KEY, TALIMAT_PLANNER_ROLES, TALIMAT_VIEW_ROLES } from "./constants";
import { rolGerekli, rpcCagir, sonucaCevir, talimatDb, talimatYenile } from "./db";
import {
  getKesimOnDoldurma,
  getPlakalarBySku,
  getPlanSatirlari,
  getSatirKatkilari,
  getSeansOnDoldurma,
  getSiraDurumu,
  getTabletBildirimleri,
  getTabletListe,
  getTabletTumListe,
  getYayinDetay,
  searchUrunler,
  getTalimatAyarlari,
  getIstasyonPersonelIdleri,
} from "./queries";
import type {
  ActionResult,
  KesimOnDoldurma,
  PasifGirdi,
  PlakaSecenek,
  SatirKaydetGirdi,
  SeansOnDoldurma,
  TalimatAyarlari,
  TalimatBildirim,
  TalimatKatki,
  TalimatSatir,
  TalimatSatirFiltre,
  TalimatTabletListe,
  TalimatTabletTum,
  TalimatYayin,
  TalimatYayinHedefDetay,
  UrunStokSecenek,
  YayinlaGirdi,
  YayinlaSonuc,
} from "./types";

const uuid = z.string().uuid("Geçersiz kimlik");
const tarih = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD olmalı");

// ─── Plan ───────────────────────────────────────────────────────

/** Haftanın planını getirir, yoksa taslak oluşturur (hafta verilmezse bu hafta). */
export async function planGetirVeyaOlustur(hafta?: string): Promise<ActionResult<string>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const h = hafta ? tarih.parse(hafta) : null;
    const id = await rpcCagir<string>("talimat_plan_getir_veya_olustur", { p_hafta: h });
    talimatYenile();
    return id;
  });
}

/** Önceki haftanın tüm satırlarını hedef haftaya kopyalar (taslak plan). Dönen: hedef plan_id */
export async function planKopyala(kaynakPlanId: string, hedefHafta: string): Promise<ActionResult<string>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const id = await rpcCagir<string>("talimat_kopyala_hafta", {
      p_kaynak_plan: uuid.parse(kaynakPlanId),
      p_hedef_hafta: tarih.parse(hedefHafta),
    });
    talimatYenile();
    return id;
  });
}

// ─── Satır CRUD ─────────────────────────────────────────────────

const satirSchema = z.object({
  satir_id: uuid.optional(),
  plan_id: uuid.optional(),
  hat_id: uuid.nullable().optional(),
  personel_id: z.string().min(1).optional(),
  sira: z.number().int().min(1).nullable().optional(),
  kaydir: z.boolean().optional(),
  istasyon: z.enum(["kesim", "montaj", "paketleme"]).nullable().optional(),
  sku: z.string().min(1).nullable().optional(),
  plaka_id: z.string().min(1).nullable().optional(),
  istenen_miktar: z.number().positive("Miktar sıfırdan büyük olmalı").nullable().optional(),
  not_text: z.string().max(1000).nullable().optional(),
  talep_id: uuid.nullable().optional(),
  durum: z.enum(["aktif", "pasif", "tamamlandi"]).optional(),
  pasif_neden: z.string().max(300).nullable().optional(),
  pasif_baslangic: tarih.nullable().optional(),
  pasif_until: tarih.nullable().optional(),
});

/**
 * Satır ekle/güncelle. satir_id yoksa plan_id + hat_id (hat satırı) ya da plan_id + personel_id (eski personel satırı)
 * zorunlu. Gönderilmeyen alan değişmez. Hat satırında personel_id yok sayılır; istasyon hat türünden gelir.
 * hat_id değiştirilirse satır yeni hattın sonuna (sira verilirse oraya) taşınır.
 * Yeni satırda sira doluysa SIRA_DOLU döner; kaydir:true ile araya girer. Dönen: satir_id.
 */
export async function satirKaydet(girdi: SatirKaydetGirdi): Promise<ActionResult<string>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const p = satirSchema.parse(girdi);
    if (!p.satir_id && (!p.plan_id || (!p.hat_id && !p.personel_id))) throw new Error("Yeni satır için plan ve hat gerekli");
    const id = await rpcCagir<string>("talimat_satir_kaydet", { p });
    talimatYenile();
    return id;
  });
}

export async function satirSil(satirId: string): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    await rpcCagir("talimat_satir_sil", { p_satir: uuid.parse(satirId) });
    talimatYenile();
    return undefined;
  });
}

/**
 * Tamamlanan satırı "tekrar aktif et": sayaç sıfırlanır (üretilen bu andan itibaren sayılır),
 * istenen miktar herhangi bir pozitif sayı olabilir. Dönen: satir_id.
 */
export async function satirYenidenAktifEt(satirId: string, istenen: number, sira?: number | null): Promise<ActionResult<string>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const miktar = z.number().positive("Miktar sıfırdan büyük olmalı").parse(istenen);
    // sira: hattın aktif satırları arasındaki görünen konum (boş = aktiflerin sonu) — SQL 166
    const id =
      sira != null
        ? await rpcCagir<string>("talimat_satir_yeniden_aktif_sirali", {
            p_satir: uuid.parse(satirId),
            p_istenen: miktar,
            p_sira: z.number().int().positive().parse(sira),
          })
        : await rpcCagir<string>("talimat_satir_yeniden_aktif", { p_satir: uuid.parse(satirId), p_istenen: miktar });
    talimatYenile();
    return id;
  });
}

/** Personelin TÜM satırlarını verilen sırayla yeniden numaralar (sürükle-bırak) */
export async function satirSirala(planId: string, personelId: string, satirIdleri: string[]): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    await rpcCagir("talimat_satir_sirala", {
      p_plan: uuid.parse(planId),
      p_personel: z.string().min(1).parse(personelId),
      p_satir_ids: z.array(uuid).min(1).parse(satirIdleri),
    });
    talimatYenile();
    return undefined;
  });
}

// ─── Yayın / bildirim / onay ────────────────────────────────────

/**
 * "Değişiklikleri yayınla". bildirimGonder=false -> "bildirimsiz yenile".
 * gonderimZamani: ISO zaman (boş = hemen). Taslak planın ilk yayını herkese gider.
 */
export async function talimatYayinla(girdi: YayinlaGirdi): Promise<ActionResult<YayinlaSonuc>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const p = z
      .object({
        planId: uuid,
        bildirimGonder: z.boolean(),
        gonderimZamani: z.string().datetime({ offset: true }).nullish(),
        sesli: z.boolean().optional(),
        hedef: z.enum(["degisenler", "herkes"]).optional(),
      })
      .parse(girdi);
    const sonuc = await rpcCagir<YayinlaSonuc>("talimat_yayinla", {
      p_plan: p.planId,
      p_bildirim: p.bildirimGonder,
      p_gonderim: p.gonderimZamani ?? null,
      p_sesli: p.sesli ?? false,
      p_hedef: p.hedef ?? "degisenler",
    });
    talimatYenile();
    return sonuc;
  });
}

/** Bildirimi durdur (hatırlatmalar kesilir) veya geri çek (gönderilmiş bildirimler de kalkar) */
export async function bildirimDurdur(yayinId: string, geriCek = false): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    await rpcCagir("talimat_bildirim_durdur", { p_yayin: uuid.parse(yayinId), p_geri_cek: geriCek });
    talimatYenile();
    return undefined;
  });
}

/**
 * Personel "Görüldü, anlaşıldı". Yetki: planlayıcı; ya da personelin kendisi / seçili operatörü /
 * aynı istasyon hesabı. hepsi=true (varsayılan) aynı plandaki tüm bekleyen yayınları onaylar.
 * Dönen: onaylanan yayın sayısı.
 */
export async function talimatOnayla(yayinId: string, personelId: string, hepsi = true): Promise<ActionResult<number>> {
  return sonucaCevir(async () => {
    const ctx = await getCurrentUserWithAuth();
    if (!ctx || !(TALIMAT_VIEW_ROLES as readonly string[]).includes(ctx.profile.role)) throw new Error("Yetkisiz erişim");
    const hedef = z.string().min(1).parse(personelId);
    const planlayici = (TALIMAT_PLANNER_ROLES as readonly string[]).includes(ctx.profile.role);
    if (!planlayici && hedef !== ctx.profile.user_id && hedef !== ctx.auth.operatorId) {
      const sb = await talimatDb();
      const { data } = await sb.from("users").select("station").eq("user_id", hedef).maybeSingle();
      if (!data || data.station !== ctx.profile.station) throw new Error("Bu personel adına onay veremezsiniz");
    }
    const n = await rpcCagir<number>("talimat_onayla", { p_yayin: uuid.parse(yayinId), p_personel: hedef, p_hepsi: hepsi });
    talimatYenile();
    return n;
  });
}

/** Tablet bildirimlerini okundu işaretle (notification_reads; user_id = ilgili personel) */
export async function bildirimOkundu(notifIdleri: string[], personelId: string): Promise<ActionResult> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    const ids = z.array(z.string().min(1)).min(1).parse(notifIdleri);
    const sb = await talimatDb();
    const { error } = await sb
      .from("notification_reads")
      .upsert(ids.map((notif_id) => ({ notif_id, user_id: personelId })), { onConflict: "notif_id,user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return undefined;
  });
}

// ─── Güncellik / pasif ──────────────────────────────────────────

/** Listeyi gun gün "güncel" işaretle (bugün dahil). Dönen: bitiş tarihi (YYYY-MM-DD) */
export async function guncelIsaretle(planId: string, gun: number): Promise<ActionResult<string>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const bitis = await rpcCagir<string>("talimat_guncel_isaretle", {
      p_plan: uuid.parse(planId),
      p_gun: z.number().int().min(1).max(31).parse(gun),
    });
    talimatYenile();
    return bitis;
  });
}

const pasifSchema = z.object({
  kapsam: z.enum(["satir", "personel", "hat", "liste"]),
  planId: uuid,
  ids: z.array(z.string().min(1)).optional(),
  baslangic: tarih.nullish(),
  bitis: tarih.nullish(),
  neden: z.string().max(300).nullish(),
});

/** Satır/personel/tüm liste pasif (bir gün ya da tarih aralığı). Dönen: etkilenen kayıt sayısı */
export async function talimatPasifYap(girdi: PasifGirdi): Promise<ActionResult<number>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const p = pasifSchema.parse(girdi);
    if (p.kapsam !== "liste" && (!p.ids || p.ids.length === 0)) throw new Error("Pasif edilecek kayıt seçilmedi");
    if (p.kapsam === "hat") p.ids?.forEach((id) => uuid.parse(id));
    const n = await rpcCagir<number>("talimat_pasif", {
      p_kapsam: p.kapsam,
      p_plan: p.planId,
      p_ids: p.ids ?? [],
      p_baslangic: p.baslangic ?? null,
      p_bitis: p.bitis ?? null,
      p_neden: p.neden ?? null,
    });
    talimatYenile();
    return n;
  });
}

export async function talimatPasifKaldir(girdi: Pick<PasifGirdi, "kapsam" | "planId" | "ids">): Promise<ActionResult<number>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    const p = pasifSchema.pick({ kapsam: true, planId: true, ids: true }).parse(girdi);
    const n = await rpcCagir<number>("talimat_pasif_kaldir", { p_kapsam: p.kapsam, p_plan: p.planId, p_ids: p.ids ?? [] });
    talimatYenile();
    return n;
  });
}

export interface TalimatPasifKayit {
  pasif_id: string;
  kapsam: "personel" | "liste" | "hat";
  personel_id: string | null;
  /** kapsam='hat' ise dolu */
  hat_id?: string | null;
  baslangic: string;
  /** 'infinity' = süresiz */
  bitis: string;
  neden: string | null;
}

/** Plandaki iptal edilmemiş personel/liste pasif kayıtları (rozetler için) */
export async function talimatPasifKayitlari(planId: string): Promise<TalimatPasifKayit[]> {
  try {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    const sb = await talimatDb();
    const { data, error } = await sb
      .from("talimat_pasifler")
      .select("pasif_id,kapsam,personel_id,hat_id,baslangic,bitis,neden")
      .eq("plan_id", planId)
      .is("iptal_at", null);
    if (error) return [];
    return (data ?? []) as TalimatPasifKayit[];
  } catch {
    return [];
  }
}

// ─── Ayarlar ────────────────────────────────────────────────────

const ayarSchema = z.object({
  pasif_gun_saat: z.object({ gun: z.number().int().min(1).max(7), saat: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).optional(),
  pazartesi_bildirim_saat: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  hatirlatma_dakika: z.number().int().min(1).max(240).optional(),
  rapor_dakika: z.number().int().min(1).max(240).optional(),
});

/** Ayarları kaydet (app_settings 'talimat_ayarlari'; kısmi güncelleme, yalnız admin-eşdeğeri roller) */
export async function talimatAyarlariKaydet(girdi: Partial<TalimatAyarlari>): Promise<ActionResult<TalimatAyarlari>> {
  return sonucaCevir(async () => {
    await rolGerekli(ADMIN_EQUIVALENT_ROLES);
    const yeni = ayarSchema.parse(girdi);
    const mevcut = await getTalimatAyarlari();
    const birlesik = { ...mevcut, ...yeni };
    const sb = await talimatDb();
    const { error } = await sb
      .from("app_settings")
      .upsert({ key: TALIMAT_AYAR_KEY, value: birlesik, description: "İş talimatı ayarları" }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return birlesik as TalimatAyarlari;
  });
}

// ─── Okuma action'ları (istemci bileşenlerinden çağrılır) ───────

export async function talimatSatirlariGetir(planId: string, filtre: TalimatSatirFiltre = {}): Promise<ActionResult<TalimatSatir[]>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getPlanSatirlari(uuid.parse(planId), filtre);
  });
}

export async function satirKatkilariGetir(satirId: string): Promise<ActionResult<TalimatKatki[]>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getSatirKatkilari(uuid.parse(satirId));
  });
}

export async function siraDurumuGetir(planId: string, personelId: string) {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_PLANNER_ROLES);
    return getSiraDurumu(uuid.parse(planId), personelId);
  });
}

export async function yayinDetayGetir(yayinId: string): Promise<ActionResult<{ yayin: TalimatYayin; hedefler: TalimatYayinHedefDetay[] } | null>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getYayinDetay(uuid.parse(yayinId));
  });
}

export async function urunAra(arama: string): Promise<ActionResult<UrunStokSecenek[]>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return searchUrunler(arama);
  });
}

export async function plakalariGetir(sku: string): Promise<ActionResult<PlakaSecenek[]>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getPlakalarBySku(sku);
  });
}

/** Tablet: personelin kendi listesi (+ güncellik rozeti + bekleyen onay yayınları) */
export async function tabletListeGetir(personelId: string): Promise<ActionResult<TalimatTabletListe>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getTabletListe(personelId);
  });
}

/** Tablet: tüm çalışanların listesi + açık seanslar (tek çağrı) */
export async function tabletTumListeGetir(yedekPersonelId?: string | null): Promise<ActionResult<TalimatTabletTum>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getTabletTumListe(yedekPersonelId);
  });
}

/**
 * Tablet bildirimleri. personelIds boşsa: oturumdaki seçili operatör; istasyon hesabıysa
 * ayrıca o istasyonun aktif personeli (bkz. docs/talimat-api.md "Bildirim hedefleme").
 */
export async function tabletBildirimleriGetir(
  personelIds?: string[],
  opts: { sadeceOkunmamis?: boolean; istasyonKapsami?: boolean } = {},
): Promise<ActionResult<TalimatBildirim[]>> {
  return sonucaCevir(async () => {
    const ctx = await getCurrentUserWithAuth();
    if (!ctx || !(TALIMAT_VIEW_ROLES as readonly string[]).includes(ctx.profile.role)) throw new Error("Yetkisiz erişim");
    const ids = new Set<string>(personelIds ?? []);
    if (!personelIds || personelIds.length === 0) {
      if (ctx.auth.operatorId) ids.add(ctx.auth.operatorId);
      ids.add(ctx.profile.user_id);
    }
    if (opts.istasyonKapsami && ctx.profile.station) {
      for (const id of await getIstasyonPersonelIdleri(ctx.profile.station)) ids.add(id);
    }
    return getTabletBildirimleri([...ids], { sadeceOkunmamis: opts.sadeceOkunmamis });
  });
}

/** "Seans Başlat" ön doldurma (ürün, personel, not) */
export async function seansOnDoldurmaGetir(satirId: string): Promise<ActionResult<SeansOnDoldurma | null>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getSeansOnDoldurma(uuid.parse(satirId));
  });
}

/** Kesim "Bitirdi" -> yeni kesim formu ön doldurma (plaka + adet; kayıt talimat_satir_id ile bağlanır) */
export async function kesimOnDoldurmaGetir(satirId: string): Promise<ActionResult<KesimOnDoldurma | null>> {
  return sonucaCevir(async () => {
    await rolGerekli(TALIMAT_VIEW_ROLES);
    return getKesimOnDoldurma(uuid.parse(satirId));
  });
}
