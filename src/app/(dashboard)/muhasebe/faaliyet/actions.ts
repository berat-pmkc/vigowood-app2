"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  satisGirisBatchSchema,
  maliyetGirisBatchSchema,
  type SatisGirisBatchData,
  type MaliyetGirisBatchData,
} from "@/lib/validations";
import {
  FINANCE_ROLES,
  AY_LABELS,
  MALIYET_KATEGORI_TURLERI,
} from "@/lib/constants";

// ─── Auth Guards ──────────────────────────────────────────

async function requireFinanceAccess() {
  const user = await getCurrentUser();
  if (!user || !FINANCE_ROLES.includes(user.role as (typeof FINANCE_ROLES)[number])) {
    throw new Error("Bu işlem için yetkiniz yok");
  }
  return user;
}

// ─── Dönem Yönetimi ──────────────────────────────────────

/** Faaliyet dönemini getir veya oluştur */
export async function getOrCreateDonem(
  yil: number,
  ayNo: number,
  kur: number
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const donemKodu = `${yil}_${String(ayNo).padStart(2, "0")}`;
    const ceyrek = `Q${Math.ceil(ayNo / 3)}`;
    const yariYil = ayNo <= 6 ? "H1" : "H2";
    const donemLabel = `${AY_LABELS[ayNo - 1]} ${yil}`;

    // Check existing
    const { data: existing } = await supabase
      .from("faaliyet_donemler")
      .select("id")
      .eq("yil", yil)
      .eq("ay_no", ayNo)
      .single();

    if (existing) {
      // Update kur if changed
      await supabase
        .from("faaliyet_donemler")
        .update({ kur_tl_usd: kur })
        .eq("id", existing.id);
      return { success: true, id: existing.id };
    }

    const { data: newDonem, error } = await supabase
      .from("faaliyet_donemler")
      .insert({
        donem_kodu: donemKodu,
        yil,
        ay_no: ayNo,
        ceyrek,
        yari_yil: yariYil,
        donem_label: donemLabel,
        kur_tl_usd: kur,
      })
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, id: newDonem.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** Tüm dönemleri satış/maliyet durumuyla birlikte getir */
export async function getDonemsWithStatus() {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const { data: donemler } = await supabase
      .from("faaliyet_donemler")
      .select("*")
      .order("yil", { ascending: false })
      .order("ay_no", { ascending: false });

    if (!donemler) return [];

    // Get counts for each donem
    const result = await Promise.all(
      donemler.map(async (d) => {
        const [satisRes, maliyetRes, karlilikRes] = await Promise.all([
          supabase
            .from("satis_giris")
            .select("id", { count: "exact", head: true })
            .eq("donem_id", d.id),
          supabase
            .from("maliyet_giris")
            .select("id", { count: "exact", head: true })
            .eq("donem_id", d.id),
          supabase
            .from("karlilik_data")
            .select("id", { count: "exact", head: true })
            .eq("donem_id", d.id),
        ]);

        return {
          ...d,
          satis_count: satisRes.count ?? 0,
          maliyet_count: maliyetRes.count ?? 0,
          karlilik_count: karlilikRes.count ?? 0,
        };
      })
    );

    return result;
  } catch {
    return [];
  }
}

/** Dönemin satış kayıtlarını getir */
export async function getSatisGirisForDonem(donemId: string) {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("satis_giris")
      .select("*")
      .eq("donem_id", donemId)
      .order("marka")
      .order("tl_satislar", { ascending: false });

    return data ?? [];
  } catch {
    return [];
  }
}

/** Dönemin maliyet kayıtlarını getir */
export async function getMaliyetGirisForDonem(donemId: string) {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("maliyet_giris")
      .select("*")
      .eq("donem_id", donemId)
      .order("kategori");

    return data ?? [];
  } catch {
    return [];
  }
}

/** Mevcut pazaryerlerini DB'den çek (serbest giriş için) */
export async function getDistinctPazaryerleri() {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const { data } = await supabase
      .from("satis_giris")
      .select("pazaryeri")
      .not("pazaryeri", "is", null);

    if (!data) return [];
    const unique = [...new Set(data.map((r) => r.pazaryeri).filter(Boolean))] as string[];
    return unique.sort();
  } catch {
    return [];
  }
}

// ─── Satış Girişi ──────────────────────────────────────────

/** Satış verilerini kaydet (DELETE + INSERT batch) */
export async function saveSatisGiris(
  raw: SatisGirisBatchData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const parsed = satisGirisBatchSchema.parse(raw);
    const supabase = await createClient();

    // 1. Get or create dönem
    const donemRes = await getOrCreateDonem(parsed.donem_yil, parsed.donem_ay, parsed.kur_tl_usd);
    if (!donemRes.success) return { success: false, error: donemRes.error };
    const donemId = donemRes.id;

    // 2. Delete existing entries for this dönem
    const { error: delErr } = await supabase
      .from("satis_giris")
      .delete()
      .eq("donem_id", donemId);
    if (delErr) throw delErr;

    // 3. Insert new entries
    const kur = parsed.kur_tl_usd;
    const rows = parsed.satirlar.map((s) => ({
      donem_id: donemId,
      marka: s.marka,
      kanal: s.kanal,
      tur: s.tur as "FAALIYET" | "FAALIYET_DISI",
      pazaryeri: s.pazaryeri,
      ulke: s.ulke ?? null,
      tl_satislar: s.tl_satislar,
      usd_satislar: s.usd_satislar,
      hesaplanan_tl: kur > 0 ? s.tl_satislar + s.usd_satislar * kur : s.tl_satislar,
      hesaplanan_usd: kur > 0 ? s.usd_satislar + s.tl_satislar / kur : s.usd_satislar,
      ortalama_kur: kur,
      aktarim_tarihi: new Date().toISOString(),
    }));

    const { error: insErr } = await supabase.from("satis_giris").insert(rows);
    if (insErr) throw insErr;

    // 4. Compute P&L
    await computeKarlilik(donemId);

    revalidatePath("/muhasebe/faaliyet");
    revalidatePath("/muhasebe/faaliyet/karlilik");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Maliyet Girişi ──────────────────────────────────────────

/** Maliyet verilerini kaydet (ORTAK dağıtım + DELETE + INSERT) */
export async function saveMaliyetGiris(
  raw: MaliyetGirisBatchData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireFinanceAccess();
    const parsed = maliyetGirisBatchSchema.parse(raw);
    const supabase = await createClient();

    // 1. Get or create dönem
    const donemRes = await getOrCreateDonem(parsed.donem_yil, parsed.donem_ay, parsed.kur_tl_usd);
    if (!donemRes.success) return { success: false, error: donemRes.error };
    const donemId = donemRes.id;

    // 2. Delete existing
    const { error: delErr } = await supabase
      .from("maliyet_giris")
      .delete()
      .eq("donem_id", donemId);
    if (delErr) throw delErr;

    // 3. Process rows — expand ORTAK into VW + HM splits
    const kur = parsed.kur_tl_usd;
    const insertRows: Array<{
      donem_id: string;
      tur: "FAALIYET" | "FAALIYET_DISI";
      kategori: string;
      cari_adi: string | null;
      marka: string;
      maliyet_grubu: "VIGO_WOOD" | "HAS_MOB" | "ORTAK";
      tl_maliyet: number;
      usd_maliyet: number;
      ortalama_kur: number;
      vigo_wood_orani: number | null;
      kaynak: string | null;
      aktarim_tarihi: string;
    }> = [];

    for (const s of parsed.satirlar) {
      const tur = (MALIYET_KATEGORI_TURLERI[s.kategori] ?? "FAALIYET") as "FAALIYET" | "FAALIYET_DISI";
      const usdMaliyet = kur > 0 ? s.tl_maliyet / kur : 0;

      if (s.maliyet_grubu === "ORTAK") {
        const oran = (s.vigo_wood_orani ?? 50) / 100;
        const vwPay = s.tl_maliyet * oran;
        const hmPay = s.tl_maliyet * (1 - oran);
        const vwUsd = kur > 0 ? vwPay / kur : 0;
        const hmUsd = kur > 0 ? hmPay / kur : 0;
        const ortakOranPct = s.vigo_wood_orani ?? 50;

        // VW portion
        insertRows.push({
          donem_id: donemId,
          tur,
          kategori: s.kategori,
          cari_adi: s.cari_adi ?? null,
          marka: "VIGO WOOD",
          maliyet_grubu: "ORTAK",
          tl_maliyet: Math.round(vwPay * 100) / 100,
          usd_maliyet: Math.round(vwUsd * 100) / 100,
          ortalama_kur: kur,
          vigo_wood_orani: ortakOranPct,
          kaynak: `Ortak Pay: ${vwPay.toFixed(0)} ₺ (%${ortakOranPct} of ${s.tl_maliyet.toFixed(0)} ₺)`,
          aktarim_tarihi: new Date().toISOString(),
        });
        // HM portion
        insertRows.push({
          donem_id: donemId,
          tur,
          kategori: s.kategori,
          cari_adi: s.cari_adi ?? null,
          marka: "HAS-MOB",
          maliyet_grubu: "ORTAK",
          tl_maliyet: Math.round(hmPay * 100) / 100,
          usd_maliyet: Math.round(hmUsd * 100) / 100,
          ortalama_kur: kur,
          vigo_wood_orani: ortakOranPct,
          kaynak: `Ortak Pay: ${hmPay.toFixed(0)} ₺ (%${100 - ortakOranPct} of ${s.tl_maliyet.toFixed(0)} ₺)`,
          aktarim_tarihi: new Date().toISOString(),
        });
      } else {
        const marka = s.maliyet_grubu === "VIGO_WOOD" ? "VIGO WOOD" : "HAS-MOB";
        insertRows.push({
          donem_id: donemId,
          tur,
          kategori: s.kategori,
          cari_adi: s.cari_adi ?? null,
          marka,
          maliyet_grubu: s.maliyet_grubu,
          tl_maliyet: s.tl_maliyet,
          usd_maliyet: Math.round(usdMaliyet * 100) / 100,
          ortalama_kur: kur,
          vigo_wood_orani: null,
          kaynak: `Direkt: ${s.tl_maliyet.toFixed(0)} ₺`,
          aktarim_tarihi: new Date().toISOString(),
        });
      }
    }

    const { error: insErr } = await supabase.from("maliyet_giris").insert(insertRows);
    if (insErr) throw insErr;

    // 4. Compute P&L
    await computeKarlilik(donemId);

    revalidatePath("/muhasebe/faaliyet");
    revalidatePath("/muhasebe/faaliyet/karlilik");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ─── Kârlılık Hesaplama (P&L Engine) ──────────────────────

/** Compute P&L for a single dönem → karlilik_data */
export async function computeKarlilik(donemId: string) {
  const supabase = await createClient();

  // Fetch dönem kuru
  const { data: donem } = await supabase
    .from("faaliyet_donemler")
    .select("kur_tl_usd")
    .eq("id", donemId)
    .single();
  const kur = Number(donem?.kur_tl_usd) || 0;

  // Fetch all sales & costs for this period
  const [satisRes, maliyetRes] = await Promise.all([
    supabase.from("satis_giris").select("*").eq("donem_id", donemId),
    supabase.from("maliyet_giris").select("*").eq("donem_id", donemId),
  ]);

  const satislar = satisRes.data ?? [];
  const maliyetler = maliyetRes.data ?? [];

  const rows: Array<{
    donem_id: string;
    marka: string;
    sira: number;
    kalem_turu: "GELIR" | "GIDER" | "TOPLAM" | "KAR" | "MARJ" | "FD_GELIR" | "FD_GIDER";
    kalem: string;
    aciklama: string | null;
    tl: number;
    usd: number;
    ortalama_kur: number;
    aktarim_tarihi: string;
  }> = [];

  const now = new Date().toISOString();
  const markalar = ["VIGO WOOD", "HAS-MOB"];

  for (const marka of markalar) {
    let sira = 1;
    const markaSatislar = satislar.filter((s) => s.marka === marka);
    const markaMaliyetler = maliyetler.filter((m) => m.marka === marka);

    // ── GELİR satırları (pazaryeri bazlı, büyükten küçüğe) ──
    // Group by pazaryeri — faaliyet gelirler only
    const faaliyetSatislar = markaSatislar.filter((s) => s.tur === "FAALIYET");
    const gelirByPazar: Record<string, { tl: number; usd: number }> = {};
    for (const s of faaliyetSatislar) {
      const key = s.pazaryeri || "Diğer";
      if (!gelirByPazar[key]) gelirByPazar[key] = { tl: 0, usd: 0 };
      gelirByPazar[key].tl += Number(s.hesaplanan_tl) || 0;
      gelirByPazar[key].usd += Number(s.hesaplanan_usd) || 0;
    }

    const sortedGelir = Object.entries(gelirByPazar).sort((a, b) => b[1].tl - a[1].tl);
    for (const [pazar, vals] of sortedGelir) {
      rows.push({
        donem_id: donemId, marka, sira: sira++,
        kalem_turu: "GELIR", kalem: pazar, aciklama: null,
        tl: Math.round(vals.tl * 100) / 100,
        usd: Math.round(vals.usd * 100) / 100,
        ortalama_kur: kur, aktarim_tarihi: now,
      });
    }

    // TOPLAM FAALİYET GELİRİ
    const toplamFaaliyetGelirTl = sortedGelir.reduce((sum, [, v]) => sum + v.tl, 0);
    const toplamFaaliyetGelirUsd = sortedGelir.reduce((sum, [, v]) => sum + v.usd, 0);
    rows.push({
      donem_id: donemId, marka, sira: sira++,
      kalem_turu: "TOPLAM", kalem: "TOPLAM FAALİYET GELİRİ", aciklama: null,
      tl: Math.round(toplamFaaliyetGelirTl * 100) / 100,
      usd: Math.round(toplamFaaliyetGelirUsd * 100) / 100,
      ortalama_kur: kur, aktarim_tarihi: now,
    });

    // ── GİDER satırları (FAALIYET türü, kategori bazlı, büyükten küçüğe) ──
    const faaliyetMaliyetler = markaMaliyetler.filter((m) => m.tur === "FAALIYET");
    const giderByKat: Record<string, { tl: number; usd: number }> = {};
    for (const m of faaliyetMaliyetler) {
      const key = m.kategori || "Diğer";
      if (!giderByKat[key]) giderByKat[key] = { tl: 0, usd: 0 };
      giderByKat[key].tl += Number(m.tl_maliyet) || 0;
      giderByKat[key].usd += Number(m.usd_maliyet) || 0;
    }

    const sortedGider = Object.entries(giderByKat).sort((a, b) => b[1].tl - a[1].tl);
    for (const [kat, vals] of sortedGider) {
      rows.push({
        donem_id: donemId, marka, sira: sira++,
        kalem_turu: "GIDER", kalem: kat, aciklama: null,
        tl: Math.round(vals.tl * 100) / 100,
        usd: Math.round(vals.usd * 100) / 100,
        ortalama_kur: kur, aktarim_tarihi: now,
      });
    }

    // TOPLAM FAALİYET GİDERİ
    const toplamFaaliyetGiderTl = sortedGider.reduce((sum, [, v]) => sum + v.tl, 0);
    const toplamFaaliyetGiderUsd = sortedGider.reduce((sum, [, v]) => sum + v.usd, 0);
    rows.push({
      donem_id: donemId, marka, sira: sira++,
      kalem_turu: "TOPLAM", kalem: "TOPLAM FAALİYET GİDERİ", aciklama: null,
      tl: Math.round(toplamFaaliyetGiderTl * 100) / 100,
      usd: Math.round(toplamFaaliyetGiderUsd * 100) / 100,
      ortalama_kur: kur, aktarim_tarihi: now,
    });

    // FAALİYET KARI (FAVÖK / EBITDA)
    const favokTl = toplamFaaliyetGelirTl - toplamFaaliyetGiderTl;
    const favokUsd = toplamFaaliyetGelirUsd - toplamFaaliyetGiderUsd;
    rows.push({
      donem_id: donemId, marka, sira: sira++,
      kalem_turu: "KAR", kalem: "FAALİYET KARI (FAVÖK)", aciklama: null,
      tl: Math.round(favokTl * 100) / 100,
      usd: Math.round(favokUsd * 100) / 100,
      ortalama_kur: kur, aktarim_tarihi: now,
    });

    // FAVÖK MARJ %
    const favokMarj = toplamFaaliyetGelirTl > 0
      ? (favokTl / toplamFaaliyetGelirTl) * 100
      : 0;
    rows.push({
      donem_id: donemId, marka, sira: sira++,
      kalem_turu: "MARJ", kalem: "FAVÖK Marjı", aciklama: null,
      tl: Math.round(favokMarj * 100) / 100, usd: 0,
      ortalama_kur: kur, aktarim_tarihi: now,
    });

    // ── FD GELİR ──
    const fdSatislar = markaSatislar.filter((s) => s.tur === "FAALIYET_DISI");
    let fdGelirTl = 0;
    let fdGelirUsd = 0;
    for (const s of fdSatislar) {
      fdGelirTl += Number(s.hesaplanan_tl) || 0;
      fdGelirUsd += Number(s.hesaplanan_usd) || 0;
    }
    if (fdGelirTl > 0 || fdSatislar.length > 0) {
      rows.push({
        donem_id: donemId, marka, sira: sira++,
        kalem_turu: "FD_GELIR", kalem: "Faaliyet Dışı Gelirler", aciklama: null,
        tl: Math.round(fdGelirTl * 100) / 100,
        usd: Math.round(fdGelirUsd * 100) / 100,
        ortalama_kur: kur, aktarim_tarihi: now,
      });
    }

    // ── FD GİDER ──
    const fdMaliyetler = markaMaliyetler.filter((m) => m.tur === "FAALIYET_DISI");
    const fdGiderByKat: Record<string, { tl: number; usd: number }> = {};
    for (const m of fdMaliyetler) {
      const key = m.kategori || "Diğer";
      if (!fdGiderByKat[key]) fdGiderByKat[key] = { tl: 0, usd: 0 };
      fdGiderByKat[key].tl += Number(m.tl_maliyet) || 0;
      fdGiderByKat[key].usd += Number(m.usd_maliyet) || 0;
    }
    let fdGiderTl = 0;
    let fdGiderUsd = 0;
    for (const [kat, vals] of Object.entries(fdGiderByKat).sort((a, b) => b[1].tl - a[1].tl)) {
      fdGiderTl += vals.tl;
      fdGiderUsd += vals.usd;
      rows.push({
        donem_id: donemId, marka, sira: sira++,
        kalem_turu: "FD_GIDER", kalem: kat, aciklama: null,
        tl: Math.round(vals.tl * 100) / 100,
        usd: Math.round(vals.usd * 100) / 100,
        ortalama_kur: kur, aktarim_tarihi: now,
      });
    }

    // GENEL KAR
    const genelKarTl = favokTl + fdGelirTl - fdGiderTl;
    const genelKarUsd = favokUsd + fdGelirUsd - fdGiderUsd;
    rows.push({
      donem_id: donemId, marka, sira: sira++,
      kalem_turu: "KAR", kalem: "GENEL KAR", aciklama: null,
      tl: Math.round(genelKarTl * 100) / 100,
      usd: Math.round(genelKarUsd * 100) / 100,
      ortalama_kur: kur, aktarim_tarihi: now,
    });

    // GENEL KAR MARJ %
    const toplamGelirTl = toplamFaaliyetGelirTl + fdGelirTl;
    const genelKarMarj = toplamGelirTl > 0
      ? (genelKarTl / toplamGelirTl) * 100
      : 0;
    rows.push({
      donem_id: donemId, marka, sira: sira++,
      kalem_turu: "MARJ", kalem: "Genel Kâr Marjı", aciklama: null,
      tl: Math.round(genelKarMarj * 100) / 100, usd: 0,
      ortalama_kur: kur, aktarim_tarihi: now,
    });
  }

  // ── GENEL (konsolide) = VW + HM ──
  {
    const vwRows = rows.filter((r) => r.marka === "VIGO WOOD");
    const hmRows = rows.filter((r) => r.marka === "HAS-MOB");
    let sira = 1;

    // Merge by kalem_turu + kalem
    const kalemMap = new Map<string, typeof rows>();
    for (const r of vwRows) {
      const key = `${r.kalem_turu}:${r.kalem}`;
      if (!kalemMap.has(key)) kalemMap.set(key, []);
      kalemMap.get(key)!.push(r);
    }
    for (const r of hmRows) {
      const key = `${r.kalem_turu}:${r.kalem}`;
      if (!kalemMap.has(key)) kalemMap.set(key, []);
      kalemMap.get(key)!.push(r);
    }

    // Collect all unique kalems in order (VW order first)
    const orderedKeys: string[] = [];
    for (const r of vwRows) {
      const key = `${r.kalem_turu}:${r.kalem}`;
      if (!orderedKeys.includes(key)) orderedKeys.push(key);
    }
    for (const r of hmRows) {
      const key = `${r.kalem_turu}:${r.kalem}`;
      if (!orderedKeys.includes(key)) orderedKeys.push(key);
    }

    for (const key of orderedKeys) {
      const items = kalemMap.get(key) ?? [];
      const first = items[0];
      if (!first) continue;

      if (first.kalem_turu === "MARJ") {
        // Recalculate margin for GENEL
        if (first.kalem === "FAVÖK Marjı") {
          const toplamGelir = rows.filter(
            (r) => r.marka !== "GENEL" && r.kalem === "TOPLAM FAALİYET GELİRİ"
          ).reduce((s, r) => s + r.tl, 0);
          const favok = rows.filter(
            (r) => r.marka !== "GENEL" && r.kalem === "FAALİYET KARI (FAVÖK)"
          ).reduce((s, r) => s + r.tl, 0);
          rows.push({
            donem_id: donemId, marka: "GENEL", sira: sira++,
            kalem_turu: "MARJ", kalem: first.kalem, aciklama: null,
            tl: toplamGelir > 0 ? Math.round((favok / toplamGelir) * 10000) / 100 : 0,
            usd: 0, ortalama_kur: kur, aktarim_tarihi: now,
          });
        } else {
          // Genel Kar Marjı
          const toplamGelir = rows.filter(
            (r) => r.marka !== "GENEL" && (r.kalem === "TOPLAM FAALİYET GELİRİ" || r.kalem_turu === "FD_GELIR")
          ).reduce((s, r) => s + r.tl, 0);
          const genelKar = rows.filter(
            (r) => r.marka !== "GENEL" && r.kalem === "GENEL KAR"
          ).reduce((s, r) => s + r.tl, 0);
          rows.push({
            donem_id: donemId, marka: "GENEL", sira: sira++,
            kalem_turu: "MARJ", kalem: first.kalem, aciklama: null,
            tl: toplamGelir > 0 ? Math.round((genelKar / toplamGelir) * 10000) / 100 : 0,
            usd: 0, ortalama_kur: kur, aktarim_tarihi: now,
          });
        }
      } else {
        // Sum TL and USD
        const totalTl = items.reduce((s, r) => s + r.tl, 0);
        const totalUsd = items.reduce((s, r) => s + r.usd, 0);
        rows.push({
          donem_id: donemId, marka: "GENEL", sira: sira++,
          kalem_turu: first.kalem_turu,
          kalem: first.kalem,
          aciklama: null,
          tl: Math.round(totalTl * 100) / 100,
          usd: Math.round(totalUsd * 100) / 100,
          ortalama_kur: kur, aktarim_tarihi: now,
        });
      }
    }
  }

  // Delete old → Insert new
  await supabase.from("karlilik_data").delete().eq("donem_id", donemId);
  if (rows.length > 0) {
    await supabase.from("karlilik_data").insert(rows);
  }
}

// ─── Kârlılık Veri Çekme ──────────────────────────────────

/** Kârlılık verilerini getir (tek dönem veya çoklu dönem aggregation) */
export async function getKarlilikData(
  donemIds: string[],
  marka?: string
) {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    let query = supabase
      .from("karlilik_data")
      .select("*")
      .in("donem_id", donemIds)
      .order("sira");

    if (marka) {
      query = query.eq("marka", marka);
    }

    const { data } = await query;
    return data ?? [];
  } catch {
    return [];
  }
}

/** Aggregated P&L for multiple periods (SUM group by marka, kalem_turu, kalem) */
export async function getAggregatedKarlilik(donemIds: string[], marka?: string) {
  const allData = await getKarlilikData(donemIds, marka);

  // Group by marka:kalem_turu:kalem → sum
  const groups = new Map<string, { tl: number; usd: number; sira: number; kalem_turu: string; kalem: string; marka: string }>();

  for (const row of allData) {
    const key = `${row.marka}:${row.kalem_turu}:${row.kalem}`;
    if (!groups.has(key)) {
      groups.set(key, {
        tl: 0, usd: 0,
        sira: row.sira, kalem_turu: row.kalem_turu!, kalem: row.kalem!, marka: row.marka!,
      });
    }
    const g = groups.get(key)!;
    if (row.kalem_turu === "MARJ") {
      // Average margins
      g.tl += Number(row.tl) || 0;
      g.usd += 1; // count for averaging
    } else {
      g.tl += Number(row.tl) || 0;
      g.usd += Number(row.usd) || 0;
    }
  }

  // Finalize margins (average)
  const periodCount = donemIds.length;
  const result = Array.from(groups.values()).map((g) => {
    if (g.kalem_turu === "MARJ" && periodCount > 1) {
      return { ...g, tl: Math.round((g.tl / periodCount) * 100) / 100, usd: 0 };
    }
    return g;
  });

  result.sort((a, b) => {
    const markaOrder = ["GENEL", "VIGO WOOD", "HAS-MOB"];
    const mi = markaOrder.indexOf(a.marka) - markaOrder.indexOf(b.marka);
    if (mi !== 0) return mi;
    return a.sira - b.sira;
  });

  return result;
}

/** Dönem özeti (satış/maliyet var mı, toplam gelir/gider/kar) */
export async function getDonemSummary(donemId: string) {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    const [satisRes, maliyetRes, karlilikRes] = await Promise.all([
      supabase.from("satis_giris").select("id", { count: "exact", head: true }).eq("donem_id", donemId),
      supabase.from("maliyet_giris").select("id", { count: "exact", head: true }).eq("donem_id", donemId),
      supabase.from("karlilik_data").select("kalem_turu, kalem, tl, marka").eq("donem_id", donemId).eq("marka", "GENEL"),
    ]);

    const karlilik = karlilikRes.data ?? [];
    const toplamGelir = karlilik.find((r) => r.kalem === "TOPLAM FAALİYET GELİRİ");
    const toplamGider = karlilik.find((r) => r.kalem === "TOPLAM FAALİYET GİDERİ");
    const favok = karlilik.find((r) => r.kalem === "FAALİYET KARI (FAVÖK)");
    const genelKar = karlilik.find((r) => r.kalem === "GENEL KAR");

    return {
      satisCount: satisRes.count ?? 0,
      maliyetCount: maliyetRes.count ?? 0,
      hasSatis: (satisRes.count ?? 0) > 0,
      hasMaliyet: (maliyetRes.count ?? 0) > 0,
      hasKarlilik: karlilik.length > 0,
      toplamGelir: Number(toplamGelir?.tl) || 0,
      toplamGider: Number(toplamGider?.tl) || 0,
      favok: Number(favok?.tl) || 0,
      genelKar: Number(genelKar?.tl) || 0,
    };
  } catch {
    return {
      satisCount: 0, maliyetCount: 0,
      hasSatis: false, hasMaliyet: false, hasKarlilik: false,
      toplamGelir: 0, toplamGider: 0, favok: 0, genelKar: 0,
    };
  }
}

interface TrendItem {
  donemKodu: string;
  donemLabel: string;
  gelir: number;
  gider: number;
  favok: number;
  genelKar: number;
}

/** Trend data — son 12 aya ait kârlılık verileri */
export async function getKarlilikTrend(): Promise<TrendItem[]> {
  try {
    await requireFinanceAccess();
    const supabase = await createClient();

    // Last 12 donemler
    const { data: donemler } = await supabase
      .from("faaliyet_donemler")
      .select("id, donem_kodu, donem_label")
      .order("yil", { ascending: false })
      .order("ay_no", { ascending: false })
      .limit(12);

    if (!donemler || donemler.length === 0) return [];

    const donemIds = donemler.map((d) => d.id);
    const { data: karlilik } = await supabase
      .from("karlilik_data")
      .select("donem_id, marka, kalem, tl")
      .in("donem_id", donemIds)
      .eq("marka", "GENEL")
      .in("kalem", ["TOPLAM FAALİYET GELİRİ", "TOPLAM FAALİYET GİDERİ", "FAALİYET KARI (FAVÖK)", "GENEL KAR"]);

    const trendMap = new Map<string, TrendItem>();
    for (const d of donemler) {
      trendMap.set(d.id, {
        donemKodu: d.donem_kodu,
        donemLabel: d.donem_label ?? d.donem_kodu,
        gelir: 0, gider: 0, favok: 0, genelKar: 0,
      });
    }
    for (const r of (karlilik ?? [])) {
      const entry = trendMap.get(r.donem_id);
      if (!entry) continue;
      if (r.kalem === "TOPLAM FAALİYET GELİRİ") entry.gelir = Number(r.tl) || 0;
      if (r.kalem === "TOPLAM FAALİYET GİDERİ") entry.gider = Number(r.tl) || 0;
      if (r.kalem === "FAALİYET KARI (FAVÖK)") entry.favok = Number(r.tl) || 0;
      if (r.kalem === "GENEL KAR") entry.genelKar = Number(r.tl) || 0;
    }

    return donemler
      .map((d) => trendMap.get(d.id)!)
      .filter(Boolean)
      .reverse();
  } catch {
    return [];
  }
}
