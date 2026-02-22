"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { nakitGirisTakipSchema, type NakitGirisTakipData } from "@/lib/validations";
import { FINANCE_ROLES } from "@/lib/constants";

async function requireFinanceAccess() {
  const user = await getCurrentUser();
  if (!user || !FINANCE_ROLES.includes(user.role as (typeof FINANCE_ROLES)[number])) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "Yönetici") {
    throw new Error("Bu işlem sadece yöneticiler tarafından yapılabilir");
  }
  return user;
}

// ─── Dönem CRUD ──────────────────────────────────────────

/** Yeni dönem + giriş + çıkış oluştur (tek transaction) */
export async function createDonem(data: {
  donem_kodu: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  kur_bilgisi: number;
  // Varlık/Borç
  varlik_acilis_tl: number;
  varlik_acilis_usd: number;
  varlik_tl: number;
  varlik_usd: number;
  yatirim_tl: number;
  toplam_varlik_tl: number;
  gayrinakit_islem: number;
  toplam_piyasa_borcu: number;
  toplam_kk_borc: number;
  toplam_finansal_borc: number;
  // Girişler
  girisler: Record<string, number>;
  // Çıkışlar
  cikislar: Record<string, number>;
}): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    // 1. Dönem oluştur
    const { data: donem, error: donemErr } = await supabase
      .from("nakit_donemler")
      .insert({
        donem_kodu: data.donem_kodu,
        baslangic_tarihi: data.baslangic_tarihi,
        bitis_tarihi: data.bitis_tarihi,
        kur_bilgisi: data.kur_bilgisi,
        varlik_acilis_tl: data.varlik_acilis_tl,
        varlik_acilis_usd: data.varlik_acilis_usd,
        varlik_tl: data.varlik_tl,
        varlik_usd: data.varlik_usd,
        yatirim_tl: data.yatirim_tl,
        toplam_varlik_tl: data.toplam_varlik_tl,
        gayrinakit_islem: data.gayrinakit_islem,
        toplam_piyasa_borcu: data.toplam_piyasa_borcu,
        toplam_kk_borc: data.toplam_kk_borc,
        toplam_finansal_borc: data.toplam_finansal_borc,
        nakit_giris_tl: Number(data.girisler.toplam_tl) || 0,
        nakit_giris_usd: Number(data.girisler.toplam_yurtdisi) || 0,
        nakit_cikis_tl: Number(data.cikislar.toplam_tl) || 0,
        nakit_cikis_usd: Number(data.cikislar.toplam_yurtdisi_usd) || 0,
      })
      .select("id")
      .single();

    if (donemErr) throw donemErr;

    // 2. Girişler
    const { error: girisErr } = await supabase.from("nakit_girisler").insert({
      donem_id: donem.id,
      vigowood_com: data.girisler.vigowood_com || 0,
      trendyol: data.girisler.trendyol || 0,
      hepsiburada: data.girisler.hepsiburada || 0,
      amazon: data.girisler.amazon || 0,
      diger_pazaryeri: data.girisler.diger_pazaryeri || 0,
      has_mob: data.girisler.has_mob || 0,
      doviz_satisi: data.girisler.doviz_satisi || 0,
      nakit_kredi: data.girisler.nakit_kredi || 0,
      toplam_tl: data.girisler.toplam_tl || 0,
      amazon_yurtdisi: data.girisler.amazon_yurtdisi || 0,
      diger_yurtdisi: data.girisler.diger_yurtdisi || 0,
      toplam_yurtdisi: data.girisler.toplam_yurtdisi || 0,
    });
    if (girisErr) throw girisErr;

    // 3. Çıkışlar
    const { error: cikisErr } = await supabase.from("nakit_cikislar").insert({
      donem_id: donem.id,
      maas: data.cikislar.maas || 0,
      sgk: data.cikislar.sgk || 0,
      hammadde: data.cikislar.hammadde || 0,
      akaryakit: data.cikislar.akaryakit || 0,
      arac_bakim: data.cikislar.arac_bakim || 0,
      demirbas: data.cikislar.demirbas || 0,
      elektrik: data.cikislar.elektrik || 0,
      su: data.cikislar.su || 0,
      pazaryeri: data.cikislar.pazaryeri || 0,
      telekom: data.cikislar.telekom || 0,
      makine_bakim: data.cikislar.makine_bakim || 0,
      nakliye: data.cikislar.nakliye || 0,
      vergi: data.cikislar.vergi || 0,
      mutfak: data.cikislar.mutfak || 0,
      hukuk: data.cikislar.hukuk || 0,
      muhasebe: data.cikislar.muhasebe || 0,
      kredi_karti: data.cikislar.kredi_karti || 0,
      kredi_odemesi: data.cikislar.kredi_odemesi || 0,
      masraf_komisyon: data.cikislar.masraf_komisyon || 0,
      diger_giderler: data.cikislar.diger_giderler || 0,
      faaliyet_disi_harcamalar: data.cikislar.faaliyet_disi_harcamalar || 0,
      toplam_tl: data.cikislar.toplam_tl || 0,
      gumruk_usd: data.cikislar.gumruk_usd || 0,
      navlun_usd: data.cikislar.navlun_usd || 0,
      diger_usd: data.cikislar.diger_usd || 0,
      doviz_bozdurma_usd: data.cikislar.doviz_bozdurma_usd || 0,
      toplam_yurtdisi_usd: data.cikislar.toplam_yurtdisi_usd || 0,
    });
    if (cikisErr) throw cikisErr;

    revalidatePath("/muhasebe/nakit-akis");
    return { success: true, id: donem.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/** Dönem sil (sadece Yönetici — CASCADE ile giriş/çıkış da silinir) */
export async function deleteDonem(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("nakit_donemler")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/muhasebe/nakit-akis");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

// ─── Dönem Güncelleme + Yardımcı Sorgular ──────────────

/** Mevcut dönemi güncelle (nakit_donemler + nakit_girisler + nakit_cikislar) */
export async function updateDonem(
  donemId: string,
  data: {
    donem_kodu: string;
    baslangic_tarihi: string;
    bitis_tarihi: string;
    kur_bilgisi: number;
    varlik_acilis_tl: number;
    varlik_acilis_usd: number;
    varlik_tl: number;
    varlik_usd: number;
    yatirim_tl: number;
    toplam_varlik_tl: number;
    gayrinakit_islem: number;
    toplam_piyasa_borcu: number;
    toplam_kk_borc: number;
    toplam_finansal_borc: number;
    girisler: Record<string, number>;
    cikislar: Record<string, number>;
  }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    // 1. Dönem güncelle
    const { error: donemErr } = await supabase
      .from("nakit_donemler")
      .update({
        donem_kodu: data.donem_kodu,
        baslangic_tarihi: data.baslangic_tarihi,
        bitis_tarihi: data.bitis_tarihi,
        kur_bilgisi: data.kur_bilgisi,
        varlik_acilis_tl: data.varlik_acilis_tl,
        varlik_acilis_usd: data.varlik_acilis_usd,
        varlik_tl: data.varlik_tl,
        varlik_usd: data.varlik_usd,
        yatirim_tl: data.yatirim_tl,
        toplam_varlik_tl: data.toplam_varlik_tl,
        gayrinakit_islem: data.gayrinakit_islem,
        toplam_piyasa_borcu: data.toplam_piyasa_borcu,
        toplam_kk_borc: data.toplam_kk_borc,
        toplam_finansal_borc: data.toplam_finansal_borc,
        nakit_giris_tl: Number(data.girisler.toplam_tl) || 0,
        nakit_giris_usd: Number(data.girisler.toplam_yurtdisi) || 0,
        nakit_cikis_tl: Number(data.cikislar.toplam_tl) || 0,
        nakit_cikis_usd: Number(data.cikislar.toplam_yurtdisi_usd) || 0,
      })
      .eq("id", donemId);

    if (donemErr) throw donemErr;

    // 2. Girişleri upsert (donem_id bazlı)
    const { error: girisErr } = await supabase
      .from("nakit_girisler")
      .update({
        vigowood_com: data.girisler.vigowood_com || 0,
        trendyol: data.girisler.trendyol || 0,
        hepsiburada: data.girisler.hepsiburada || 0,
        amazon: data.girisler.amazon || 0,
        diger_pazaryeri: data.girisler.diger_pazaryeri || 0,
        has_mob: data.girisler.has_mob || 0,
        doviz_satisi: data.girisler.doviz_satisi || 0,
        nakit_kredi: data.girisler.nakit_kredi || 0,
        toplam_tl: data.girisler.toplam_tl || 0,
        amazon_yurtdisi: data.girisler.amazon_yurtdisi || 0,
        diger_yurtdisi: data.girisler.diger_yurtdisi || 0,
        toplam_yurtdisi: data.girisler.toplam_yurtdisi || 0,
      })
      .eq("donem_id", donemId);

    if (girisErr) throw girisErr;

    // 3. Çıkışları upsert
    const { error: cikisErr } = await supabase
      .from("nakit_cikislar")
      .update({
        maas: data.cikislar.maas || 0,
        sgk: data.cikislar.sgk || 0,
        hammadde: data.cikislar.hammadde || 0,
        akaryakit: data.cikislar.akaryakit || 0,
        arac_bakim: data.cikislar.arac_bakim || 0,
        demirbas: data.cikislar.demirbas || 0,
        elektrik: data.cikislar.elektrik || 0,
        su: data.cikislar.su || 0,
        pazaryeri: data.cikislar.pazaryeri || 0,
        telekom: data.cikislar.telekom || 0,
        makine_bakim: data.cikislar.makine_bakim || 0,
        nakliye: data.cikislar.nakliye || 0,
        vergi: data.cikislar.vergi || 0,
        mutfak: data.cikislar.mutfak || 0,
        hukuk: data.cikislar.hukuk || 0,
        muhasebe: data.cikislar.muhasebe || 0,
        kredi_karti: data.cikislar.kredi_karti || 0,
        kredi_odemesi: data.cikislar.kredi_odemesi || 0,
        masraf_komisyon: data.cikislar.masraf_komisyon || 0,
        diger_giderler: data.cikislar.diger_giderler || 0,
        faaliyet_disi_harcamalar: data.cikislar.faaliyet_disi_harcamalar || 0,
        toplam_tl: data.cikislar.toplam_tl || 0,
        gumruk_usd: data.cikislar.gumruk_usd || 0,
        navlun_usd: data.cikislar.navlun_usd || 0,
        diger_usd: data.cikislar.diger_usd || 0,
        doviz_bozdurma_usd: data.cikislar.doviz_bozdurma_usd || 0,
        toplam_yurtdisi_usd: data.cikislar.toplam_yurtdisi_usd || 0,
      })
      .eq("donem_id", donemId);

    if (cikisErr) throw cikisErr;

    revalidatePath("/muhasebe/nakit-akis");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

/** Son kaydedilen dönemin verileri (kapanış varlık → açılış auto-fill) */
export async function getLastDonem() {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const { data: donem } = await supabase
      .from("nakit_donemler")
      .select("*")
      .order("donem_kodu", { ascending: false })
      .limit(1)
      .single();

    if (!donem) return null;

    return {
      donemKodu: donem.donem_kodu,
      varlikTl: Number(donem.varlik_tl) || 0,
      varlikUsd: Number(donem.varlik_usd) || 0,
      yatirimTl: Number(donem.yatirim_tl) || 0,
      gayrinakitIslem: Number(donem.gayrinakit_islem) || 0,
      toplamPiyasaBorcu: Number(donem.toplam_piyasa_borcu) || 0,
      toplamKkBorc: Number(donem.toplam_kk_borc) || 0,
      toplamFinansalBorc: Number(donem.toplam_finansal_borc) || 0,
    };
  } catch {
    return null;
  }
}

/** doviz_kurlari tablosundan en güncel USD/TRY kuru */
export async function getAutoKur(): Promise<{
  kur: number;
  tarih: string;
} | null> {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("doviz_kurlari")
      .select("usd_try, tarih")
      .not("usd_try", "is", null)
      .order("tarih", { ascending: false })
      .limit(1)
      .single();

    if (!data || !data.usd_try) return null;

    return { kur: Number(data.usd_try), tarih: data.tarih };
  } catch {
    return null;
  }
}

/** Dönem bilgilerini + giriş/çıkış verilerini birlikte getir (düzenle formu için) */
export async function getDonemById(donemId: string) {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const [donemResult, girisResult, cikisResult] = await Promise.all([
      supabase.from("nakit_donemler").select("*").eq("id", donemId).single(),
      supabase
        .from("nakit_girisler")
        .select("*")
        .eq("donem_id", donemId)
        .single(),
      supabase
        .from("nakit_cikislar")
        .select("*")
        .eq("donem_id", donemId)
        .single(),
    ]);

    if (!donemResult.data) return null;

    return {
      donem: donemResult.data,
      giris: girisResult.data,
      cikis: cikisResult.data,
    };
  } catch {
    return null;
  }
}

// ─── Nakit Giriş Takip CRUD ─────────────────────────────

export async function createGirisTakip(
  formData: NakitGirisTakipData
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const parsed = nakitGirisTakipSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("nakit_giris_takip")
      .insert({
        tanimi: parsed.data.tanimi,
        tutar: parsed.data.tutar,
        cinsi: parsed.data.cinsi,
        tarih: parsed.data.tarih || null,
        turu: parsed.data.turu || null,
        marka: parsed.data.marka || null,
        odeme_durum: parsed.data.odeme_durum,
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/muhasebe/nakit-akis");
    return { success: true, id: data.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

export async function updateGirisTakip(
  id: string,
  formData: NakitGirisTakipData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const parsed = nakitGirisTakipSchema.safeParse(formData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const supabase = await createClient();

    const { error } = await supabase
      .from("nakit_giris_takip")
      .update({
        tanimi: parsed.data.tanimi,
        tutar: parsed.data.tutar,
        cinsi: parsed.data.cinsi,
        tarih: parsed.data.tarih || null,
        turu: parsed.data.turu || null,
        marka: parsed.data.marka || null,
        odeme_durum: parsed.data.odeme_durum,
      })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/muhasebe/nakit-akis");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

export async function toggleGirisTakipDurum(
  id: string,
  newDurum: "TAMAMLANDI" | "BEKLİYOR"
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const { error } = await supabase
      .from("nakit_giris_takip")
      .update({ odeme_durum: newDurum })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/muhasebe/nakit-akis");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}

export async function deleteGirisTakip(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("nakit_giris_takip")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/muhasebe/nakit-akis");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Bilinmeyen hata",
    };
  }
}
