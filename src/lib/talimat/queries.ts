/**
 * İş talimatı okuma sorguları (sunucu tarafı). Server component'lerden ve action'lardan çağrılır.
 *
 * Yetki: tüm tablolar/görünümler RLS ile korunur (okuma: üretim erişimi + ofis rolleri).
 * Sayfa düzeyinde ayrıca getCurrentUser() + rol kontrolü yapın (ilgili action'lar yapıyor).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { talimatDb } from "./db";
import { TALIMAT_AYAR_VARSAYILAN, TALIMAT_BILDIRIM_KIND, TALIMAT_PERSONEL_ROLES } from "./constants";
import { isStationEmail } from "@/lib/constants";
import { haftaBaslangici } from "./helpers";
import type {
  Depo,
  KesimOnDoldurma,
  PlakaSecenek,
  SeansOnDoldurma,
  TalimatAyarlari,
  TalimatBildirim,
  HatTur,
  TabletHatEkSeans,
  TabletHatSatir,
  TabletHatSeans,
  TalimatHat,
  TalimatKatki,
  TalimatPersonel,
  TalimatPlan,
  TalimatPlanHatGrubu,
  TalimatTabletHat,
  TalimatTabletHatListe,
  TalimatSatir,
  TalimatSatirFiltre,
  TalimatTabletListe,
  TalimatTabletTum,
  TabletAcikSeans,
  TalimatYayin,
  TalimatYayinHedefDetay,
  UrunStokSecenek,
} from "./types";

function hataFirlat(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** PostgREST .or() içine girecek serbest metni güvenli hale getirir */
function aramaTemizle(q: string): string {
  return q.replace(/[,()*%\\]/g, " ").trim();
}

// ─── Ayarlar ────────────────────────────────────────────────────

export async function getTalimatAyarlari(): Promise<TalimatAyarlari> {
  const sb = await talimatDb();
  const { data, error } = await sb.rpc("talimat_ayarlari");
  if (error || !data) return TALIMAT_AYAR_VARSAYILAN as unknown as TalimatAyarlari;
  return data as TalimatAyarlari;
}

// ─── Planlar ────────────────────────────────────────────────────

export async function getPlanlar(limit = 20): Promise<TalimatPlan[]> {
  const sb = await talimatDb();
  const { data, error } = await sb
    .from("talimat_plan_ozet")
    .select("*")
    .order("hafta_baslangic", { ascending: false })
    .limit(limit);
  hataFirlat(error);
  return (data ?? []) as TalimatPlan[];
}

export async function getPlan(planId: string): Promise<TalimatPlan | null> {
  const sb = await talimatDb();
  const { data, error } = await sb.from("talimat_plan_ozet").select("*").eq("plan_id", planId).maybeSingle();
  hataFirlat(error);
  return (data as TalimatPlan | null) ?? null;
}

/** Haftanın planı (hafta herhangi bir gün olabilir; verilmezse bu hafta) */
export async function getPlanByHafta(hafta?: string): Promise<TalimatPlan | null> {
  const sb = await talimatDb();
  const { data, error } = await sb
    .from("talimat_plan_ozet")
    .select("*")
    .eq("hafta_baslangic", haftaBaslangici(hafta ?? new Date()))
    .maybeSingle();
  hataFirlat(error);
  return (data as TalimatPlan | null) ?? null;
}

// ─── Satırlar ───────────────────────────────────────────────────

/** Planlayıcı ekranı: plan satırları (ilerleme dahil), personel ve sıraya göre */
export async function getPlanSatirlari(planId: string, f: TalimatSatirFiltre = {}): Promise<TalimatSatir[]> {
  const sb = await talimatDb();
  let q = sb
    .from("talimat_satir_ilerleme")
    .select("*")
    .eq("plan_id", planId)
    .order("hat_sira", { ascending: true, nullsFirst: false })
    .order("personel_adi", { ascending: true })
    .order("sira", { ascending: true });

  if (f.personelId) q = q.eq("personel_id", f.personelId);
  if (f.hatId) q = q.eq("hat_id", f.hatId);
  if (f.sadeceHat) q = q.not("hat_id", "is", null);
  if (f.istasyon) q = q.eq("etkin_istasyon", f.istasyon);
  if (f.arama && aramaTemizle(f.arama)) {
    const a = aramaTemizle(f.arama);
    q = q.or(`sku.ilike.%${a}%,urun_adi.ilike.%${a}%,plaka_id.ilike.%${a}%`);
  }
  // Ürünsüz (boş) satırlar "1. sıra" filtrelerinde sayılmaz
  if (f.sadeceOncelik1 || f.oncelik1SeansBaslamamis) q = q.or("sku.not.is.null,plaka_id.not.is.null");
  if (f.sadeceOncelik1) q = q.eq("sira", 1);
  if (f.oncelik1SeansBaslamamis) {
    q = q.eq("sira", 1).eq((f.seansKapsami ?? "bugun") === "hafta" ? "hafta_seans_var" : "bugun_seans_var", false);
  }
  if (f.sadeceDegisen) q = q.eq("degisti", true);
  if (f.sadeceOnaylamayan) q = q.eq("onay_bekliyor", true);
  if (f.sadecePasif) q = q.eq("etkin_pasif", true);
  if (f.sadeceTamamlanan) q = q.eq("etkin_durum", "tamamlandi");
  if (f.pasifGizle) q = q.eq("etkin_pasif", false);

  const { data, error } = await q;
  hataFirlat(error);
  return (data ?? []) as TalimatSatir[];
}

/** satır_id -> ilk eklenme zamanı (Mavi Yaka'da personel gruplarını "ilk eklenen üstte" sıralamak için) */
export async function getPlanSatirEklenme(planId: string): Promise<Record<string, string>> {
  const sb = await talimatDb();
  const { data, error } = await sb.from("talimat_satirlar").select("satir_id, created_at").eq("plan_id", planId);
  hataFirlat(error);
  const m: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ satir_id: string; created_at: string }>) m[r.satir_id] = r.created_at;
  return m;
}

export async function getSatir(satirId: string): Promise<TalimatSatir | null> {
  const sb = await talimatDb();
  const { data, error } = await sb.from("talimat_satir_ilerleme").select("*").eq("satir_id", satirId).maybeSingle();
  hataFirlat(error);
  return (data as TalimatSatir | null) ?? null;
}

/** Montaj satırı: personel x adım katkıları (haftalık, ürün düzeyinde) */
export async function getSatirKatkilari(satirId: string): Promise<TalimatKatki[]> {
  const sb = await talimatDb();
  const { data, error } = await sb
    .from("talimat_satir_katki")
    .select("*")
    .eq("satir_id", satirId)
    .order("seq_no", { ascending: true });
  hataFirlat(error);
  return (data ?? []) as TalimatKatki[];
}

/** Sıra seçerken: personelin dolu öncelikleri (sıra, ürün) — "bu sırada X var, araya ekleyelim mi?" */
export async function getSiraDurumu(
  planId: string,
  personelId: string,
): Promise<Array<{ satir_id: string; sira: number; sku: string | null; urun_adi: string | null; etkin_durum: string }>> {
  const sb = await talimatDb();
  const { data, error } = await sb
    .from("talimat_satir_ilerleme")
    .select("satir_id, sira, sku, urun_adi, etkin_durum")
    .eq("plan_id", planId)
    .eq("personel_id", personelId)
    .order("sira", { ascending: true });
  hataFirlat(error);
  return (data ?? []) as Array<{ satir_id: string; sira: number; sku: string | null; urun_adi: string | null; etkin_durum: string }>;
}

/** Talimata eklenebilecek personel: aktif Üretim/Hat kullanıcıları */
export async function getTalimatPersoneller(): Promise<TalimatPersonel[]> {
  const sb = await talimatDb();
  const { data, error } = await sb
    .from("users")
    .select("user_id, full_name, role, station, email")
    .in("role", TALIMAT_PERSONEL_ROLES)
    .eq("is_active", true)
    .order("full_name");
  hataFirlat(error);
  // Ortak istasyon tablet hesapları (kesim@, montaj@...) personel değildir
  return (data ?? [])
    .filter((u) => !isStationEmail(u.email ?? undefined))
    .map(({ email: _email, ...u }) => u) as TalimatPersonel[];
}

// ─── Yayınlar ───────────────────────────────────────────────────

export async function getYayinlar(planId: string, limit = 30): Promise<TalimatYayin[]> {
  const sb = await talimatDb();
  const { data, error } = await sb
    .from("talimat_yayin_ozet")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(limit);
  hataFirlat(error);
  return (data ?? []) as TalimatYayin[];
}

/** Yayın + hedef personeller (onay durumu, "görmedi" filtresi için onay_zamani=null) */
export async function getYayinDetay(
  yayinId: string,
): Promise<{ yayin: TalimatYayin; hedefler: TalimatYayinHedefDetay[] } | null> {
  const sb = await talimatDb();
  const { data: yayin, error } = await sb.from("talimat_yayin_ozet").select("*").eq("yayin_id", yayinId).maybeSingle();
  hataFirlat(error);
  if (!yayin) return null;

  const [{ data: hedefler, error: e2 }, { data: onaylar, error: e3 }] = await Promise.all([
    sb.from("talimat_yayin_hedefler").select("personel_id, hat_id, satir_ids, son_bildirim_at, bildirim_sayisi").eq("yayin_id", yayinId),
    sb.from("talimat_onaylar").select("personel_id, hat_id, onay_zamani").eq("yayin_id", yayinId),
  ]);
  hataFirlat(e2);
  hataFirlat(e3);

  const ids = (hedefler ?? []).map((h) => h.personel_id as string | null).filter((x): x is string => !!x);
  const hatIds = (hedefler ?? []).map((h) => h.hat_id as string | null).filter((x): x is string => !!x);
  const [{ data: kullanicilar }, { data: hatlar }] = await Promise.all([
    ids.length
      ? sb.from("users").select("user_id, full_name").in("user_id", ids)
      : Promise.resolve({ data: [] as Array<{ user_id: string; full_name: string }> }),
    hatIds.length
      ? sb.from("talimat_hatlar").select("hat_id, ad, sira").in("hat_id", hatIds)
      : Promise.resolve({ data: [] as Array<{ hat_id: string; ad: string; sira: number }> }),
  ]);
  const ad = new Map((kullanicilar ?? []).map((u) => [u.user_id as string, u.full_name as string]));
  const hatAd = new Map((hatlar ?? []).map((h) => [h.hat_id as string, h.ad as string]));
  const hatSira = new Map((hatlar ?? []).map((h) => [h.hat_id as string, h.sira as number]));
  const onay = new Map<string, string>();
  for (const o of onaylar ?? []) {
    onay.set((o.hat_id ? `h:${o.hat_id}` : `p:${o.personel_id}`) as string, o.onay_zamani as string);
  }

  return {
    yayin: yayin as TalimatYayin,
    hedefler: (hedefler ?? [])
      .map((h) => {
        const hatId = (h.hat_id as string | null) ?? null;
        const personelId = (h.personel_id as string | null) ?? null;
        return {
          personel_id: personelId,
          personel_adi: personelId ? (ad.get(personelId) ?? null) : null,
          hat_id: hatId,
          hat_adi: hatId ? (hatAd.get(hatId) ?? null) : null,
          satir_ids: (h.satir_ids as string[]) ?? [],
          son_bildirim_at: (h.son_bildirim_at as string | null) ?? null,
          bildirim_sayisi: (h.bildirim_sayisi as number) ?? 0,
          onay_zamani: onay.get(hatId ? `h:${hatId}` : `p:${personelId}`) ?? null,
        };
      })
      .sort((a, b) => {
        // hatlar önce (hat sırası), sonra eski personel hedefleri
        if (a.hat_id && b.hat_id) return (hatSira.get(a.hat_id) ?? 0) - (hatSira.get(b.hat_id) ?? 0);
        if (a.hat_id) return -1;
        if (b.hat_id) return 1;
        return (a.personel_adi ?? "").localeCompare(b.personel_adi ?? "", "tr");
      }),
  };
}

// ─── Hatlar (hat bazlı model) ───────────────────────────────────

/** Hat listesi (hat sırasıyla). sadeceAktif=true: pasif hatlar hariç */
export async function getHatlar(opts: { sadeceAktif?: boolean } = {}): Promise<TalimatHat[]> {
  const sb = await talimatDb();
  let q = sb.from("talimat_hatlar").select("*").order("sira", { ascending: true });
  if (opts.sadeceAktif) q = q.eq("aktif", true);
  const { data, error } = await q;
  hataFirlat(error);
  return (data ?? []) as TalimatHat[];
}

/** Planda bugün için pasif olan hat id'leri (talimat_pasifler kapsam='hat') */
export async function getPasifHatIdleri(planId: string): Promise<Set<string>> {
  const sb = await talimatDb();
  const bugun = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  const { data, error } = await sb
    .from("talimat_pasifler")
    .select("hat_id, baslangic, bitis")
    .eq("plan_id", planId)
    .eq("kapsam", "hat")
    .is("iptal_at", null);
  hataFirlat(error);
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ hat_id: string | null; baslangic: string; bitis: string }>) {
    // bitis 'infinity' (süresiz) metin olarak her tarihten büyüktür
    if (r.hat_id && r.baslangic <= bugun && r.bitis >= bugun) set.add(r.hat_id);
  }
  return set;
}

/**
 * Planlayıcı ekranı: plan satırları hat gruplarına ayrılmış (aktif hatlar, hat sırasıyla; her hat sıralı satırlarla).
 * Boş hat satırları dahildir (her aktif hatta en az 1 boş satır vardır). Pasif hatlar da gelir (pasif:true / hat.aktif=false).
 * Filtreler TalimatSatirFiltre ile aynıdır (ör. arama, sadeceDegisen); filtreden satırı kalmayan hat grubu yine döner.
 */
export async function getPlanHatGruplari(
  planId: string,
  f: TalimatSatirFiltre = {},
  opts: { pasifHatlariDahilEt?: boolean } = {},
): Promise<TalimatPlanHatGrubu[]> {
  const [hatlar, satirlar, pasifler] = await Promise.all([
    getHatlar({ sadeceAktif: !opts.pasifHatlariDahilEt }),
    getPlanSatirlari(planId, { ...f, sadeceHat: true }),
    getPasifHatIdleri(planId),
  ]);
  const gruplar = new Map<string, TalimatSatir[]>();
  for (const s of satirlar) {
    if (!s.hat_id) continue;
    const l = gruplar.get(s.hat_id) ?? [];
    l.push(s);
    gruplar.set(s.hat_id, l);
  }
  return hatlar.map((hat) => ({
    hat,
    satirlar: (gruplar.get(hat.hat_id) ?? []).sort((a, b) => a.sira - b.sira),
    pasif: pasifler.has(hat.hat_id),
  }));
}

/** Sıra seçerken: hattın dolu öncelikleri (sıra, ürün, boş mu) */
export async function getHatSiraDurumu(
  planId: string,
  hatId: string,
): Promise<Array<{ satir_id: string; sira: number; sku: string | null; urun_adi: string | null; etkin_durum: string; bos: boolean }>> {
  const sb = await talimatDb();
  const { data, error } = await sb
    .from("talimat_satir_ilerleme")
    .select("satir_id, sira, sku, plaka_id, urun_adi, etkin_durum")
    .eq("plan_id", planId)
    .eq("hat_id", hatId)
    .order("sira", { ascending: true });
  hataFirlat(error);
  return ((data ?? []) as Array<{ satir_id: string; sira: number; sku: string | null; plaka_id: string | null; urun_adi: string | null; etkin_durum: string }>).map(
    ({ plaka_id, ...r }) => ({ ...r, bos: !r.sku && !plaka_id }),
  );
}

// ─── Tablet ─────────────────────────────────────────────────────

/**
 * Tablet "İş Talimatları": personelin kendi listesi. Plan yoksa (hafta kapandı ve açık seans
 * yok) satirlar boş döner. Pasif satırlar dahil değildir.
 */
export async function getTabletListe(personelId: string): Promise<TalimatTabletListe> {
  const sb = await talimatDb();
  const bos: TalimatTabletListe = {
    personel_id: personelId,
    plan: null,
    satirlar: [],
    guncel: { guncel_mi: false, bitis: null },
    bekleyen_yayin_idler: [],
  };

  const { data: planId, error: e0 } = await sb.rpc("talimat_tablet_plan", { p_personel: personelId });
  hataFirlat(e0);
  if (!planId) return bos;

  const [plan, satirRes, hedefRes] = await Promise.all([
    getPlan(planId as string),
    sb
      .from("talimat_satir_ilerleme")
      .select("*")
      .eq("plan_id", planId)
      .eq("personel_id", personelId)
      .eq("etkin_pasif", false)
      // ürünsüz (boş) satırlar tablette görünmez
      .or("sku.not.is.null,plaka_id.not.is.null")
      .order("sira", { ascending: true }),
    sb
      .from("talimat_yayin_hedefler")
      .select("yayin_id, talimat_yayinlar!inner(durum, plan_id, bildirim_gonder, created_at)")
      .eq("personel_id", personelId)
      .eq("talimat_yayinlar.plan_id", planId)
      .eq("talimat_yayinlar.bildirim_gonder", true)
      .in("talimat_yayinlar.durum", ["gonderildi", "durduruldu"]),
  ]);
  hataFirlat(satirRes.error);
  hataFirlat(hedefRes.error);

  const adaylar = (hedefRes.data ?? []) as unknown as Array<{ yayin_id: string; talimat_yayinlar: { created_at: string } }>;
  let bekleyen: string[] = [];
  if (adaylar.length) {
    const { data: onaylar, error: e3 } = await sb
      .from("talimat_onaylar")
      .select("yayin_id")
      .eq("personel_id", personelId)
      .in("yayin_id", adaylar.map((a) => a.yayin_id));
    hataFirlat(e3);
    const onayli = new Set((onaylar ?? []).map((o) => o.yayin_id as string));
    bekleyen = adaylar
      .filter((a) => !onayli.has(a.yayin_id))
      .sort((a, b) => b.talimat_yayinlar.created_at.localeCompare(a.talimat_yayinlar.created_at))
      .map((a) => a.yayin_id);
  }

  return {
    personel_id: personelId,
    plan,
    satirlar: (satirRes.data ?? []) as TalimatSatir[],
    guncel: { guncel_mi: !!plan?.guncel_mi, bitis: plan?.guncel_bitis ?? null },
    bekleyen_yayin_idler: bekleyen,
  };
}

/**
 * Tablet: TÜM çalışanların listesi. Plan: yayındaki (bu hafta/öncesi) en yeni plan; yoksa
 * `yedekPersonelId` için talimat_tablet_plan (pasif plan + açık seans devamı).
 * Sorgular: plan + satırlar + yayın hedefleri + onaylar + açık montaj + açık paketleme (N+1 yok).
 */
export async function getTabletTumListe(yedekPersonelId?: string | null): Promise<TalimatTabletTum> {
  const sb = await talimatDb();
  const bos: TalimatTabletTum = { plan: null, satirlar: [], guncel: { guncel_mi: false, bitis: null }, bekleyen: {}, acik_seanslar: [] };

  const bugun = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  const { data: yayinda, error: e0 } = await sb
    .from("talimat_planlar")
    .select("plan_id")
    .eq("durum", "yayinda")
    .lte("hafta_baslangic", bugun)
    .order("hafta_baslangic", { ascending: false })
    .limit(1)
    .maybeSingle();
  hataFirlat(e0);
  let planId = (yayinda?.plan_id as string | undefined) ?? null;
  if (!planId && yedekPersonelId) {
    const { data, error } = await sb.rpc("talimat_tablet_plan", { p_personel: yedekPersonelId });
    hataFirlat(error);
    planId = (data as string | null) ?? null;
  }
  if (!planId) return bos;

  const [plan, satirRes, hedefRes, montajRes, paketRes] = await Promise.all([
    getPlan(planId),
    sb
      .from("talimat_satir_ilerleme")
      .select("*")
      .eq("plan_id", planId)
      .eq("etkin_pasif", false)
      .or("sku.not.is.null,plaka_id.not.is.null")
      .order("personel_id", { ascending: true })
      .order("sira", { ascending: true }),
    sb
      .from("talimat_yayin_hedefler")
      .select("yayin_id, personel_id, talimat_yayinlar!inner(durum, plan_id, bildirim_gonder, created_at)")
      .eq("talimat_yayinlar.plan_id", planId)
      .eq("talimat_yayinlar.bildirim_gonder", true)
      .in("talimat_yayinlar.durum", ["gonderildi", "durduruldu"]),
    sb
      .from("montaj_sessions")
      .select("session_id, sku, step_id, step_name, seq_no, is_final_step, start_time, durum, operator_id, operator_name, workers, duraklama_dk, duraklatma_baslangic, yardimci_sayisi, talimat_satir_id, ek_seans")
      .eq("durum", "montajda"),
    sb
      .from("pack_events")
      .select("session_id, sku, start_time, durum, operator_name, personel, workers, duraklama_dk, duraklatma_baslangic, yardimci_sayisi, talimat_satir_id, ek_seans, operator_id")
      .eq("durum", "paketlemede"),
  ]);
  hataFirlat(satirRes.error);
  hataFirlat(hedefRes.error);
  hataFirlat(montajRes.error);
  hataFirlat(paketRes.error);

  const satirlar = (satirRes.data ?? []) as TalimatSatir[];

  // Bekleyen onaylar (personel bazlı)
  const adaylar = (hedefRes.data ?? []) as unknown as Array<{
    yayin_id: string; personel_id: string; talimat_yayinlar: { created_at: string };
  }>;
  const bekleyen: Record<string, string[]> = {};
  if (adaylar.length) {
    const { data: onaylar, error: e3 } = await sb
      .from("talimat_onaylar")
      .select("yayin_id, personel_id")
      .in("yayin_id", [...new Set(adaylar.map((a) => a.yayin_id))]);
    hataFirlat(e3);
    const onayli = new Set((onaylar ?? []).map((o) => `${o.yayin_id}|${o.personel_id}`));
    adaylar
      .filter((a) => !onayli.has(`${a.yayin_id}|${a.personel_id}`))
      .sort((a, b) => b.talimat_yayinlar.created_at.localeCompare(a.talimat_yayinlar.created_at))
      .forEach((a) => {
        (bekleyen[a.personel_id] ??= []).push(a.yayin_id);
      });
  }

  // Açık seansları satırlara bağla: önce talimat_satir_id, yoksa aynı personel + aynı sku
  type Ham = Record<string, unknown>;
  const parseW = (w: unknown): Array<{ id: string; name: string }> | null => {
    if (Array.isArray(w)) return w as Array<{ id: string; name: string }>;
    if (typeof w === "string") {
      try {
        const j = JSON.parse(w);
        if (Array.isArray(j)) return j;
      } catch {
        /* geçersiz JSON */
      }
    }
    return null;
  };
  const satirById = new Map(satirlar.map((s) => [s.satir_id, s]));
  const montajSatirlari = satirlar.filter((s) => s.etkin_istasyon === "montaj" && s.sku);
  const paketSatirlari = satirlar.filter((s) => s.etkin_istasyon === "paketleme" && s.sku);
  const acik: TabletAcikSeans[] = [];

  // Ek seans ürün adları (tek sorgu)
  const ekSkular = [...new Set(
    [...(montajRes.data ?? []), ...(paketRes.data ?? [])]
      .filter((h) => (h as Record<string, unknown>).ek_seans)
      .map((h) => (h as Record<string, unknown>).sku as string | null)
      .filter((x): x is string => !!x),
  )];
  const skuAdi = new Map<string, string | null>();
  if (ekSkular.length) {
    const { data: urunler, error: eu } = await sb.from("products").select("sku, urun_adi").in("sku", ekSkular);
    hataFirlat(eu);
    for (const u of urunler ?? []) skuAdi.set(u.sku as string, (u.urun_adi as string | null) ?? null);
  }

  const baglan = (ham: Ham, adaySatirlar: TalimatSatir[], personelMi: (pid: string) => boolean): string | null => {
    const dogrudan = ham.talimat_satir_id as string | null;
    if (dogrudan) return satirById.has(dogrudan) ? dogrudan : null;
    const sku = ham.sku as string | null;
    if (!sku) return null;
    return adaySatirlar.find((s) => s.sku === sku && !!s.personel_id && personelMi(s.personel_id))?.satir_id ?? null;
  };

  for (const h of (montajRes.data ?? []) as Ham[]) {
    const workers = parseW(h.workers);
    if (h.ek_seans) {
      acik.push({
        session_id: h.session_id as string, tur: "montaj", satir_id: "", ek_seans: true,
        personel_id: (h.operator_id as string | null) ?? null,
        sku: (h.sku as string | null) ?? null, urun_adi: skuAdi.get(h.sku as string) ?? null,
        step_id: (h.step_id as string | null) ?? null, step_name: (h.step_name as string | null) ?? null,
        seq_no: (h.seq_no as number | null) ?? null, is_final_step: (h.is_final_step as boolean | null) ?? null,
        start_time: (h.start_time as string | null) ?? null, durum: h.durum as string,
        operator_name: (h.operator_name as string | null) ?? null, workers,
        duraklama_dk: (h.duraklama_dk as number | null) ?? null,
        duraklatma_baslangic: (h.duraklatma_baslangic as string | null) ?? null,
        yardimci_sayisi: (h.yardimci_sayisi as number | null) ?? null,
      });
      continue;
    }
    const satirId = baglan(h, montajSatirlari, (pid) => h.operator_id === pid || !!workers?.some((w) => w.id === pid));
    if (!satirId) continue;
    acik.push({
      session_id: h.session_id as string, tur: "montaj", satir_id: satirId,
      sku: (h.sku as string | null) ?? null, urun_adi: satirById.get(satirId)!.urun_adi,
      step_id: (h.step_id as string | null) ?? null, step_name: (h.step_name as string | null) ?? null,
      seq_no: (h.seq_no as number | null) ?? null, is_final_step: (h.is_final_step as boolean | null) ?? null,
      start_time: (h.start_time as string | null) ?? null, durum: h.durum as string,
      operator_name: (h.operator_name as string | null) ?? null, workers,
      duraklama_dk: (h.duraklama_dk as number | null) ?? null,
      duraklatma_baslangic: (h.duraklatma_baslangic as string | null) ?? null,
      yardimci_sayisi: (h.yardimci_sayisi as number | null) ?? null,
    });
  }
  for (const h of (paketRes.data ?? []) as Ham[]) {
    const workers = parseW(h.workers);
    if (h.ek_seans) {
      acik.push({
        session_id: h.session_id as string, tur: "paketleme", satir_id: "", ek_seans: true,
        personel_id: (h.operator_id as string | null) ?? null,
        sku: (h.sku as string | null) ?? null, urun_adi: skuAdi.get(h.sku as string) ?? null,
        step_id: null, step_name: null, seq_no: null, is_final_step: null,
        start_time: (h.start_time as string | null) ?? null, durum: h.durum as string,
        operator_name: (h.operator_name as string | null) ?? null, workers,
        duraklama_dk: (h.duraklama_dk as number | null) ?? null,
        duraklatma_baslangic: (h.duraklatma_baslangic as string | null) ?? null,
        yardimci_sayisi: (h.yardimci_sayisi as number | null) ?? null,
      });
      continue;
    }
    const csv = String(h.personel ?? "").replace(/\s/g, "").split(",").filter(Boolean);
    const satirId = baglan(h, paketSatirlari, (pid) => csv.includes(pid) || !!workers?.some((w) => w.id === pid));
    if (!satirId) continue;
    acik.push({
      session_id: h.session_id as string, tur: "paketleme", satir_id: satirId,
      sku: (h.sku as string | null) ?? null, urun_adi: satirById.get(satirId)!.urun_adi,
      step_id: null, step_name: null, seq_no: null, is_final_step: null,
      start_time: (h.start_time as string | null) ?? null, durum: h.durum as string,
      operator_name: (h.operator_name as string | null) ?? null, workers,
      duraklama_dk: (h.duraklama_dk as number | null) ?? null,
      duraklatma_baslangic: (h.duraklatma_baslangic as string | null) ?? null,
      yardimci_sayisi: (h.yardimci_sayisi as number | null) ?? null,
    });
  }

  return {
    plan,
    satirlar,
    guncel: { guncel_mi: !!plan?.guncel_mi, bitis: plan?.guncel_bitis ?? null },
    bekleyen,
    acik_seanslar: acik,
  };
}

/**
 * Tablet bildirimleri. İstasyon hesabı paylaşımlı olduğu için çağıran, ilgili personel ID'lerini
 * verir: seçili operatör (vw_selected_operator_id) VE/VEYA o istasyondaki aktif personeller.
 * Geri çekilmiş (geri_cekildi_at) bildirimler dahil edilmez. Varsayılan: yalnız okunmamışlar
 * (status='Yeni'). Payload'daki personel_istasyon istasyon filtrelemesi için kullanılabilir.
 */
export async function getTabletBildirimleri(
  personelIds: string[],
  opts: { sadeceOkunmamis?: boolean; limit?: number } = {},
): Promise<TalimatBildirim[]> {
  if (personelIds.length === 0) return [];
  const sb = await talimatDb();
  let q = sb
    .from("notifications")
    .select("notif_id, title, message, target_user, status, kind, sesli, yayin_id, created_at, geri_cekildi_at, payload")
    .eq("kind", TALIMAT_BILDIRIM_KIND)
    .in("target_user", personelIds)
    .is("geri_cekildi_at", null)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (opts.sadeceOkunmamis !== false) q = q.eq("status", "Yeni");
  const { data, error } = await q;
  hataFirlat(error);
  return (data ?? []) as TalimatBildirim[];
}

/**
 * Tablet "İş Talimatları" (hat bazlı): aktif hatlar için bölümler. Plan: bu haftanın yayındaki planı; plan pasif olduysa
 * yalnız hat satırlarına bağlı AÇIK seans sürdüğü sürece (en çok 14 gün) eski plan (talimat_tablet_plan_hat). Plan yoksa
 * hat bölümleri boş döner. Her hat için: aktif satırlar + tamamlananlar (ürünlü, pasif olmayan), satır başına açık seanslar,
 * hatta bağlanmayan açık seanslar, bugünün ek seansları, onay bekleyen yayınlar.
 * Sorgular paralel; N+1 yoktur.
 */
export async function getTabletHatListe(): Promise<TalimatTabletHatListe> {
  const sb = await talimatDb();
  const bugun = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

  const [{ data: planIdData, error: e0 }, hatlar] = await Promise.all([sb.rpc("talimat_tablet_plan_hat"), getHatlar({ sadeceAktif: true })]);
  hataFirlat(e0);
  const planId = (planIdData as string | null) ?? null;

  const bosHat = (hat: TalimatHat): TalimatTabletHat => ({
    hat, pasif: false, aktif: [], tamamlanan: [], diger_acik_seanslar: [], ek_seanslar: [], bekleyen_yayin_idler: [],
  });
  if (!planId) {
    return { plan: null, guncel: { guncel_mi: false, bitis: null }, hatlar: hatlar.map(bosHat) };
  }

  const [plan, satirRes, montajRes, paketRes, hedefRes, ekRes, pasifler] = await Promise.all([
    getPlan(planId),
    sb
      .from("talimat_satir_ilerleme")
      .select("*")
      .eq("plan_id", planId)
      .not("hat_id", "is", null)
      .eq("etkin_pasif", false)
      .not("sku", "is", null)
      .order("hat_sira", { ascending: true })
      .order("sira", { ascending: true }),
    sb
      .from("montaj_sessions")
      .select("session_id, sku, step_id, step_name, seq_no, is_final_step, start_time, durum, operator_id, operator_name, workers, duraklama_dk, duraklatma_baslangic, yardimci_sayisi, talimat_satir_id, hat_id, ek_seans")
      .eq("durum", "montajda")
      .or("hat_id.not.is.null,talimat_satir_id.not.is.null"),
    sb
      .from("pack_events")
      .select("session_id, sku, start_time, durum, operator_id, operator_name, workers, duraklama_dk, duraklatma_baslangic, yardimci_sayisi, talimat_satir_id, hat_id, ek_seans")
      .eq("durum", "paketlemede")
      .or("hat_id.not.is.null,talimat_satir_id.not.is.null"),
    sb
      .from("talimat_yayin_hedefler")
      .select("yayin_id, hat_id, talimat_yayinlar!inner(durum, plan_id, bildirim_gonder, created_at)")
      .not("hat_id", "is", null)
      .eq("talimat_yayinlar.plan_id", planId)
      .eq("talimat_yayinlar.bildirim_gonder", true)
      .in("talimat_yayinlar.durum", ["gonderildi", "durduruldu"]),
    sb
      .from("ek_seanslar")
      .select("kaynak, session_id, personel_id, personel_adi, sku, urun_adi, step_name, qty, durum, start_time, end_time, net_sure_dk, hat_id")
      .eq("gun", bugun)
      .not("hat_id", "is", null),
    getPasifHatIdleri(planId),
  ]);
  hataFirlat(satirRes.error);
  hataFirlat(montajRes.error);
  hataFirlat(paketRes.error);
  hataFirlat(hedefRes.error);
  hataFirlat(ekRes.error);

  const satirlar = (satirRes.data ?? []) as TalimatSatir[];
  const satirById = new Map(satirlar.map((s) => [s.satir_id, s]));

  // Ürün adları (satırı olmayan / ek seanslar için)
  const parseW = (w: unknown): Array<{ id: string; name: string }> | null => {
    if (Array.isArray(w)) return w as Array<{ id: string; name: string }>;
    if (typeof w === "string") {
      try {
        const j = JSON.parse(w);
        if (Array.isArray(j)) return j;
      } catch {
        /* geçersiz JSON */
      }
    }
    return null;
  };
  type Ham = Record<string, unknown>;
  const hamlar: Array<{ tur: "montaj" | "paketleme"; h: Ham }> = [
    ...((montajRes.data ?? []) as Ham[]).map((h) => ({ tur: "montaj" as const, h })),
    ...((paketRes.data ?? []) as Ham[]).map((h) => ({ tur: "paketleme" as const, h })),
  ];
  const eksikSku = [...new Set(
    hamlar.map(({ h }) => h.sku as string | null).filter((x): x is string => !!x),
  )];
  const skuAdi = new Map<string, string | null>();
  if (eksikSku.length) {
    const { data: urunler, error: eu } = await sb.from("products").select("sku, urun_adi").in("sku", eksikSku);
    hataFirlat(eu);
    for (const u of urunler ?? []) skuAdi.set(u.sku as string, (u.urun_adi as string | null) ?? null);
  }

  // Seans -> satır eşleme: talimat_satir_id (hat satırıysa) ya da aynı hat + sku (önce tamamlanmamış satır)
  const seansSatirlari = new Map<string, TabletHatSeans[]>();
  const digerSeanslar = new Map<string, TabletHatSeans[]>();
  for (const { tur, h } of hamlar) {
    const dogrudan = (h.talimat_satir_id as string | null) ?? null;
    const sku = (h.sku as string | null) ?? null;
    let satir = dogrudan ? satirById.get(dogrudan) : undefined;
    const hatId = (h.hat_id as string | null) ?? satir?.hat_id ?? null;
    if (!satir && hatId && sku) {
      const adaylar = satirlar.filter((s) => s.hat_id === hatId && s.sku === sku);
      satir = adaylar.find((s) => s.etkin_durum !== "tamamlandi") ?? adaylar[0];
    }
    if (!hatId && !satir) continue; // hatsız, talimatsız seans tabletin ana ekranına aittir
    const seans: TabletHatSeans = {
      session_id: h.session_id as string,
      tur,
      satir_id: satir?.satir_id ?? null,
      hat_id: hatId,
      sku,
      urun_adi: satir?.urun_adi ?? (sku ? (skuAdi.get(sku) ?? null) : null),
      step_id: tur === "montaj" ? ((h.step_id as string | null) ?? null) : null,
      step_name: tur === "montaj" ? ((h.step_name as string | null) ?? null) : null,
      seq_no: tur === "montaj" ? ((h.seq_no as number | null) ?? null) : null,
      is_final_step: tur === "montaj" ? ((h.is_final_step as boolean | null) ?? null) : null,
      start_time: (h.start_time as string | null) ?? null,
      durum: h.durum as string,
      operator_id: (h.operator_id as string | null) ?? null,
      operator_name: (h.operator_name as string | null) ?? null,
      workers: parseW(h.workers),
      duraklama_dk: (h.duraklama_dk as number | null) ?? null,
      duraklatma_baslangic: (h.duraklatma_baslangic as string | null) ?? null,
      yardimci_sayisi: (h.yardimci_sayisi as number | null) ?? null,
      ek_seans: !!h.ek_seans,
    };
    if (satir) {
      const l = seansSatirlari.get(satir.satir_id) ?? [];
      l.push(seans);
      seansSatirlari.set(satir.satir_id, l);
    } else if (hatId) {
      const l = digerSeanslar.get(hatId) ?? [];
      l.push(seans);
      digerSeanslar.set(hatId, l);
    }
  }

  // Bekleyen (onaylanmamış) hat yayınları
  const adaylar = (hedefRes.data ?? []) as unknown as Array<{ yayin_id: string; hat_id: string; talimat_yayinlar: { created_at: string } }>;
  const bekleyen = new Map<string, string[]>();
  if (adaylar.length) {
    const { data: onaylar, error: e3 } = await sb
      .from("talimat_onaylar")
      .select("yayin_id, hat_id")
      .not("hat_id", "is", null)
      .in("yayin_id", [...new Set(adaylar.map((a) => a.yayin_id))]);
    hataFirlat(e3);
    const onayli = new Set((onaylar ?? []).map((o) => `${o.yayin_id}|${o.hat_id}`));
    adaylar
      .filter((a) => !onayli.has(`${a.yayin_id}|${a.hat_id}`))
      .sort((a, b) => b.talimat_yayinlar.created_at.localeCompare(a.talimat_yayinlar.created_at))
      .forEach((a) => {
        const l = bekleyen.get(a.hat_id) ?? [];
        l.push(a.yayin_id);
        bekleyen.set(a.hat_id, l);
      });
  }

  const ekPerHat = new Map<string, TabletHatEkSeans[]>();
  for (const r of (ekRes.data ?? []) as unknown as Array<TabletHatEkSeans & { hat_id: string }>) {
    const l = ekPerHat.get(r.hat_id) ?? [];
    l.push({ ...r, qty: Number(r.qty ?? 0), net_sure_dk: r.net_sure_dk === null ? null : Number(r.net_sure_dk) });
    ekPerHat.set(r.hat_id, l);
  }

  const bolumler: TalimatTabletHat[] = hatlar.map((hat) => {
    const pasif = pasifler.has(hat.hat_id);
    const hatSatirlari: TabletHatSatir[] = pasif
      ? []
      : satirlar
          .filter((s) => s.hat_id === hat.hat_id)
          .map((s) => ({ ...s, acik_seanslar: seansSatirlari.get(s.satir_id) ?? [] }));
    return {
      hat,
      pasif,
      aktif: hatSatirlari.filter((s) => s.etkin_durum !== "tamamlandi"),
      tamamlanan: hatSatirlari.filter((s) => s.etkin_durum === "tamamlandi"),
      diger_acik_seanslar: digerSeanslar.get(hat.hat_id) ?? [],
      ek_seanslar: (ekPerHat.get(hat.hat_id) ?? []).sort((a, b) => b.start_time.localeCompare(a.start_time)),
      bekleyen_yayin_idler: bekleyen.get(hat.hat_id) ?? [],
    };
  });

  return { plan, guncel: { guncel_mi: !!plan?.guncel_mi, bitis: plan?.guncel_bitis ?? null }, hatlar: bolumler };
}

/**
 * Hat bildirimleri (kind='talimat_degisiklik', target_user NULL, payload.hat_id dolu). Geri çekilmişler hariç.
 * hatIds verilirse yalnız o hatlar. Varsayılan: yalnız okunmamışlar (status='Yeni').
 */
export async function getTabletHatBildirimleri(
  opts: { hatIds?: string[]; sadeceOkunmamis?: boolean; limit?: number } = {},
): Promise<TalimatBildirim[]> {
  const sb = await talimatDb();
  let q = sb
    .from("notifications")
    .select("notif_id, title, message, target_user, status, kind, sesli, yayin_id, created_at, geri_cekildi_at, payload")
    .eq("kind", TALIMAT_BILDIRIM_KIND)
    .is("geri_cekildi_at", null)
    .not("payload->>hat_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (opts.sadeceOkunmamis !== false) q = q.eq("status", "Yeni");
  if (opts.hatIds && opts.hatIds.length) q = q.in("payload->>hat_id", opts.hatIds);
  const { data, error } = await q;
  hataFirlat(error);
  return (data ?? []) as TalimatBildirim[];
}

/** İstasyon hesabı için ilgili personel ID'leri: users.station eşleşen aktif Üretim/Hat personeli */
export async function getIstasyonPersonelIdleri(station: string): Promise<string[]> {
  const sb = await talimatDb();
  const { data, error } = await sb
    .from("users")
    .select("user_id, email")
    .eq("station", station)
    .in("role", TALIMAT_PERSONEL_ROLES)
    .eq("is_active", true);
  hataFirlat(error);
  return (data ?? []).filter((u) => !isStationEmail(u.email ?? undefined)).map((u) => u.user_id as string);
}

/** "Seans Başlat": satırdan montaj/paketleme formunu ön doldurma verisi */
export async function getSeansOnDoldurma(satirId: string): Promise<SeansOnDoldurma | null> {
  const s = await getSatir(satirId);
  if (!s) return null;
  return {
    satir_id: s.satir_id,
    personel_id: s.personel_id,
    personel_adi: s.personel_adi,
    hat_id: s.hat_id ?? null,
    hat_adi: s.hat_adi ?? null,
    istasyon: s.etkin_istasyon,
    sku: s.sku,
    urun_adi: s.urun_adi,
    plaka_id: s.plaka_id,
    istenen_miktar: s.istenen_miktar,
    kalan: s.fark != null ? Math.max(s.fark, 0) : null,
    not_text: s.not_text?.trim() ? s.not_text : null,
  };
}

/** Kesim satırı "Bitirdi": yeni kesim kaydı ön doldurma (plaka + adet) */
export async function getKesimOnDoldurma(satirId: string): Promise<KesimOnDoldurma | null> {
  const s = await getSatir(satirId);
  if (!s) return null;
  const kalan = s.fark != null && s.fark > 0 ? s.fark : s.istenen_miktar;
  return {
    talimat_satir_id: s.satir_id,
    personel_id: s.personel_id,
    plaka_id: s.plaka_id,
    sku: s.sku,
    adet: kalan ?? null,
    not_text: s.not_text,
  };
}

// ─── Ürün / plaka / depo seçicileri ─────────────────────────────

/** Ürün seçici: ad/SKU arama + toplam stok ve depo bazlı stok */
export async function searchUrunler(arama: string, limit = 20): Promise<UrunStokSecenek[]> {
  const sb = await talimatDb();
  const a = aramaTemizle(arama);
  let q = sb.from("products").select("sku, urun_adi").eq("aktif_mi", true).order("urun_adi").limit(limit);
  if (a) q = q.or(`sku.ilike.%${a}%,urun_adi.ilike.%${a}%`);
  const { data, error } = await q;
  hataFirlat(error);
  const urunler = (data ?? []) as Array<{ sku: string; urun_adi: string | null }>;
  return urunStoklariEkle(sb, urunler);
}

/** Belirli SKU'lar için stok bilgisi */
export async function getUrunStoklari(skular: string[]): Promise<UrunStokSecenek[]> {
  if (skular.length === 0) return [];
  const sb = await talimatDb();
  const { data, error } = await sb.from("products").select("sku, urun_adi").in("sku", skular);
  hataFirlat(error);
  return urunStoklariEkle(sb, (data ?? []) as Array<{ sku: string; urun_adi: string | null }>);
}

async function urunStoklariEkle(
  sb: SupabaseClient,
  urunler: Array<{ sku: string; urun_adi: string | null }>,
): Promise<UrunStokSecenek[]> {
  if (urunler.length === 0) return [];
  const skular = urunler.map((u) => u.sku);
  const [toplamRes, depoRes] = await Promise.all([
    sb.from("urun_toplam_stok").select("sku, miktar").in("sku", skular),
    sb.from("urun_depo_stok").select("sku, depo_id, depo_adi, miktar").in("sku", skular),
  ]);
  hataFirlat(toplamRes.error);
  hataFirlat(depoRes.error);
  const toplam = new Map((toplamRes.data ?? []).map((t) => [t.sku as string, Number(t.miktar) || 0]));
  const depolar = new Map<string, UrunStokSecenek["depo_stoklari"]>();
  for (const d of depoRes.data ?? []) {
    const liste = depolar.get(d.sku as string) ?? [];
    liste.push({ depo_id: (d.depo_id as string | null) ?? null, depo_adi: (d.depo_adi as string | null) ?? null, miktar: Number(d.miktar) || 0 });
    depolar.set(d.sku as string, liste);
  }
  return urunler.map((u) => ({
    sku: u.sku,
    urun_adi: u.urun_adi,
    toplam_stok: toplam.get(u.sku) ?? 0,
    depo_stoklari: depolar.get(u.sku) ?? [],
  }));
}

/** Kesim satırı için: bu ürünün parçalarını kesen plakalar (plakalar.sku dizisi) */
export async function getPlakalarBySku(sku: string): Promise<PlakaSecenek[]> {
  const sb = await talimatDb();
  const { data, error } = await sb
    .from("plakalar")
    .select("plaka_id, plaka_adi")
    .contains("sku", [sku])
    .order("plaka_id");
  hataFirlat(error);
  const goruldu = new Set<string>();
  return ((data ?? []) as PlakaSecenek[]).filter((p) => (goruldu.has(p.plaka_id) ? false : (goruldu.add(p.plaka_id), true)));
}

export async function getDepolar(): Promise<Depo[]> {
  const sb = await talimatDb();
  const { data, error } = await sb.from("depolar").select("depo_id, ad, sira").eq("aktif", true).order("sira");
  hataFirlat(error);
  return (data ?? []) as Depo[];
}
