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
  TalimatKatki,
  TalimatPersonel,
  TalimatPlan,
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
    .order("personel_adi", { ascending: true })
    .order("sira", { ascending: true });

  if (f.personelId) q = q.eq("personel_id", f.personelId);
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
    sb.from("talimat_yayin_hedefler").select("personel_id, satir_ids, son_bildirim_at, bildirim_sayisi").eq("yayin_id", yayinId),
    sb.from("talimat_onaylar").select("personel_id, onay_zamani").eq("yayin_id", yayinId),
  ]);
  hataFirlat(e2);
  hataFirlat(e3);

  const ids = (hedefler ?? []).map((h) => h.personel_id as string);
  const { data: kullanicilar } = ids.length
    ? await sb.from("users").select("user_id, full_name").in("user_id", ids)
    : { data: [] as Array<{ user_id: string; full_name: string }> };
  const ad = new Map((kullanicilar ?? []).map((u) => [u.user_id as string, u.full_name as string]));
  const onay = new Map((onaylar ?? []).map((o) => [o.personel_id as string, o.onay_zamani as string]));

  return {
    yayin: yayin as TalimatYayin,
    hedefler: (hedefler ?? [])
      .map((h) => ({
        personel_id: h.personel_id as string,
        personel_adi: ad.get(h.personel_id as string) ?? null,
        satir_ids: (h.satir_ids as string[]) ?? [],
        son_bildirim_at: (h.son_bildirim_at as string | null) ?? null,
        bildirim_sayisi: (h.bildirim_sayisi as number) ?? 0,
        onay_zamani: onay.get(h.personel_id as string) ?? null,
      }))
      .sort((a, b) => (a.personel_adi ?? "").localeCompare(b.personel_adi ?? "", "tr")),
  };
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
    return adaySatirlar.find((s) => s.sku === sku && personelMi(s.personel_id))?.satir_id ?? null;
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
