import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * ÜRÜN BİRİM MALİYET MOTORU
 *
 * Birim maliyet = MALZEME + İŞÇİLİK.
 *
 * MALZEME (reçeteden = step_bom):
 *   - HP parçalar (satın alınan) → qty_per × all_parts.birim_fiyat
 *   - Yarı mamül P parçalar (kesilen) → MDF levha payı: parçanın plakası →
 *     plaka MDF tipi/renk → HP MDF fiyatı ÷ o plakadan çıkan toplam parça.
 *   - ASM- (ara ürün çıktısı) → ATLANIR; malzemesi kendi adımında sayıldı.
 *
 * İŞÇİLİK (gerçek seans ortalamalarından):
 *   - Montaj: her adımın (sku+step) gerçek MEDYAN işçilik dk/adet'i toplanır.
 *   - Paketleme: o ürünün paketleme medyan dk/adet'i.
 *   × işçilik saat ücreti (app_settings.maliyet_ayarlari).
 */

const MDF_HP: Record<string, string> = {
  "8mm MDF|Ceviz": "HP0015",
  "8mm MDF|Meşe": "HP0016",
  "8mm MDF|Cambridge": "HP0017",
  "2.7mm MDF|*": "HP0018",
  "5mm MDF|*": "HP0019",
};

function mdfHpKodu(tipi: string | null, renk: string | null): string | null {
  if (!tipi) return null;
  return MDF_HP[`${tipi}|${renk ?? ""}`] ?? MDF_HP[`${tipi}|*`] ?? null;
}

export interface MaliyetKalemi {
  partId: string;
  ad: string;
  tur: "HP" | "MDF";
  miktar: number;
  birimFiyat: number;
  tutar: number;
  /** "manuel" = all_parts.birim_fiyat elle girildi, "formul" = plakadan hesaplandı */
  kaynak: "manuel" | "formul";
}

export interface AdimIscilik {
  adim: string;
  kaynak: "montaj" | "paketleme";
  dkAdet: number;
  tutar: number;
}

export interface UrunMaliyet {
  sku: string;
  urunAdi: string | null;
  malzemeKalemleri: MaliyetKalemi[];
  malzemeToplam: number;
  iscilikAdimlari: AdimIscilik[];
  iscilikToplam: number;
  birimMaliyet: number;
  eksikFiyatliParca: string[];
  iscilikEksikAdim: number;
}

export interface MaliyetAyarlari {
  montajSaatUcreti: number;
  paketlemeSaatUcreti: number;
}

export async function getMaliyetAyarlari(): Promise<MaliyetAyarlari> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "maliyet_ayarlari").maybeSingle();
  const v = (data?.value ?? {}) as Record<string, unknown>;
  return {
    montajSaatUcreti: Number(v.montaj_saat_ucreti ?? 174),
    paketlemeSaatUcreti: Number(v.paketleme_saat_ucreti ?? 174),
  };
}

export async function urunMaliyetleriHesapla(skular: string[]): Promise<Map<string, UrunMaliyet>> {
  const supabase = await createClient();
  const ayar = await getMaliyetAyarlari();
  const sonuc = new Map<string, UrunMaliyet>();
  if (skular.length === 0) return sonuc;

  const { data: urunler } = await supabase.from("products").select("sku, urun_adi").in("sku", skular);
  const urunAd = new Map<string, string | null>((urunler ?? []).map((u) => [u.sku, u.urun_adi]));

  const { data: adimlar } = await supabase
    .from("assembly_steps").select("step_id, sku, step_name").in("sku", skular);
  const stepIds = (adimlar ?? []).map((a) => a.step_id);
  const stepSku = new Map<string, string>((adimlar ?? []).map((a) => [a.step_id, a.sku!]));

  const bom: { step_id: string; part_id: string; qty_per: number }[] = [];
  for (let i = 0; i < stepIds.length; i += 200) {
    const { data } = await supabase.from("step_bom").select("step_id, part_id, qty_per").in("step_id", stepIds.slice(i, i + 200));
    bom.push(...((data ?? []) as typeof bom));
  }

  const receteler = new Map<string, Map<string, number>>();
  for (const b of bom) {
    const sku = stepSku.get(b.step_id);
    if (!sku) continue;
    const m = receteler.get(sku) ?? new Map<string, number>();
    m.set(b.part_id, (m.get(b.part_id) ?? 0) + Number(b.qty_per ?? 0));
    receteler.set(sku, m);
  }

  const tumPartlar = new Set<string>();
  for (const m of receteler.values()) for (const p of m.keys()) tumPartlar.add(p);

  const { data: partData } = await supabase
    .from("all_parts").select("part_id, part_adi, birim_fiyat, part_type").in("part_id", [...tumPartlar]);
  const partBilgi = new Map<string, { ad: string; fiyat: number | null }>(
    (partData ?? []).map((p) => [p.part_id, { ad: p.part_adi ?? p.part_id, fiyat: p.birim_fiyat as number | null }]),
  );

  // ── P parçaları için plaka MDF payı
  const pParts = [...tumPartlar].filter((p) => /-P\d/.test(p));
  const pMdfBirim = new Map<string, number>();
  const pAd = new Map<string, string>();
  if (pParts.length > 0) {
    const { data: pp } = await supabase
      .from("plaka_parts").select("part_id, plaka_id, default_qty").in("part_id", pParts);
    const plakaIds = [...new Set((pp ?? []).map((x) => x.plaka_id))];
    const { data: plk } = await supabase
      .from("plakalar").select("plaka_id, tipi, renk").in("plaka_id", plakaIds);
    const plakaMeta = new Map<string, { tipi: string | null; renk: string | null }>(
      (plk ?? []).map((x) => [x.plaka_id, { tipi: x.tipi, renk: x.renk }]),
    );
    const plakaToplam = new Map<string, number>();
    for (const x of pp ?? []) plakaToplam.set(x.plaka_id, (plakaToplam.get(x.plaka_id) ?? 0) + Number(x.default_qty ?? 0));

    const mdfKodlar = [...new Set(Object.values(MDF_HP))];
    const { data: mdfData } = await supabase.from("all_parts").select("part_id, birim_fiyat, part_adi").in("part_id", mdfKodlar);
    const mdfFiyat = new Map<string, number | null>((mdfData ?? []).map((m) => [m.part_id, m.birim_fiyat as number | null]));
    // P parça adları
    const { data: pAdData } = await supabase.from("all_parts").select("part_id, part_adi").in("part_id", pParts);
    for (const x of pAdData ?? []) pAd.set(x.part_id, x.part_adi ?? x.part_id);

    const enIyiPlaka = new Map<string, { plaka_id: string; dq: number }>();
    for (const x of pp ?? []) {
      const cur = enIyiPlaka.get(x.part_id);
      if (!cur || Number(x.default_qty ?? 0) > cur.dq) enIyiPlaka.set(x.part_id, { plaka_id: x.plaka_id, dq: Number(x.default_qty ?? 0) });
    }
    for (const [partId, { plaka_id }] of enIyiPlaka) {
      const meta = plakaMeta.get(plaka_id);
      const hp = mdfHpKodu(meta?.tipi ?? null, meta?.renk ?? null);
      const fiyat = hp ? mdfFiyat.get(hp) ?? null : null;
      const toplamParca = plakaToplam.get(plaka_id) ?? 0;
      if (fiyat != null && toplamParca > 0) pMdfBirim.set(partId, fiyat / toplamParca);
    }
  }

  const montajIsc = await medyanIscilik(supabase, "montaj_sessions", skular);
  const paketIsc = await medyanIscilik(supabase, "pack_events", skular);

  for (const sku of skular) {
    const recete = receteler.get(sku) ?? new Map<string, number>();
    const kalemler: MaliyetKalemi[] = [];
    const eksik: string[] = [];

    for (const [partId, qty] of recete) {
      if (partId.startsWith("ASM-")) continue;
      if (partId.startsWith("HP")) {
        const bilgi = partBilgi.get(partId);
        const fiyat = bilgi?.fiyat ?? null;
        if (fiyat == null) { eksik.push(partId); continue; }
        if (fiyat === 0) continue;
        kalemler.push({ partId, ad: bilgi?.ad ?? partId, tur: "HP", miktar: qty, birimFiyat: fiyat, tutar: qty * fiyat, kaynak: "manuel" });
      } else if (/-P\d/.test(partId)) {
        // Öncelik: elle girilen birim_fiyat (all_parts). Yoksa plaka MDF payı formülü.
        const manuel = partBilgi.get(partId)?.fiyat ?? null;
        const birim = manuel != null ? manuel : (pMdfBirim.get(partId) ?? null);
        if (birim == null) { eksik.push(partId); continue; }
        if (birim === 0) continue;
        kalemler.push({
          partId,
          ad: pAd.get(partId) ?? partBilgi.get(partId)?.ad ?? partId,
          tur: "MDF", miktar: qty,
          birimFiyat: Number(birim.toFixed(4)),
          tutar: qty * birim,
          kaynak: manuel != null ? "manuel" : "formul",
        });
      }
    }

    const malzemeToplam = kalemler.reduce((t, k) => t + k.tutar, 0);

    const iscAdim: AdimIscilik[] = [];
    const montajSteps = montajIsc.get(sku) ?? new Map<string, number>();
    for (const [adim, dk] of montajSteps) {
      iscAdim.push({ adim, kaynak: "montaj", dkAdet: Number(dk.toFixed(2)), tutar: (dk / 60) * ayar.montajSaatUcreti });
    }
    const pkt = paketIsc.get(sku)?.get("__paketleme__");
    if (pkt != null) {
      iscAdim.push({ adim: "PAKETLEME", kaynak: "paketleme", dkAdet: Number(pkt.toFixed(2)), tutar: (pkt / 60) * ayar.paketlemeSaatUcreti });
    }
    const iscilikToplam = iscAdim.reduce((t, a) => t + a.tutar, 0);

    const receteAdimlari = new Set((adimlar ?? []).filter((a) => a.sku === sku).map((a) => a.step_name));
    const olculuAdim = new Set(montajSteps.keys());
    let eksikAdim = 0;
    for (const ad of receteAdimlari) if (ad && ad !== "PAKETLEME" && !olculuAdim.has(ad)) eksikAdim++;

    sonuc.set(sku, {
      sku, urunAdi: urunAd.get(sku) ?? null,
      malzemeKalemleri: kalemler.sort((a, b) => b.tutar - a.tutar),
      malzemeToplam,
      iscilikAdimlari: iscAdim.sort((a, b) => b.tutar - a.tutar),
      iscilikToplam,
      birimMaliyet: malzemeToplam + iscilikToplam,
      eksikFiyatliParca: [...new Set(eksik)],
      iscilikEksikAdim: eksikAdim,
    });
  }

  return sonuc;
}

async function medyanIscilik(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tablo: "montaj_sessions" | "pack_events",
  skular: string[],
): Promise<Map<string, Map<string, number>>> {
  const sonuc = new Map<string, Map<string, number>>();
  const olcumler = new Map<string, number[]>();

  const kolonlar = tablo === "montaj_sessions"
    ? "sku, step_name, qty, start_time, end_time, worker_count, net_sure_dk"
    : "sku, qty, start_time, end_time, worker_count";

  for (let i = 0; i < skular.length; i += 100) {
    const { data } = await supabase
      .from(tablo).select(kolonlar)
      .eq("durum", "tamamlandi").not("end_time", "is", null).in("sku", skular.slice(i, i + 100));
    for (const r of (data ?? []) as unknown as Record<string, unknown>[]) {
      const sku = String(r.sku ?? "");
      const qty = Number(r.qty ?? 0);
      if (!sku || qty <= 0) continue;
      const st = r.start_time ? new Date(String(r.start_time)).getTime() : 0;
      const en = r.end_time ? new Date(String(r.end_time)).getTime() : 0;
      const net = tablo === "montaj_sessions" ? Number(r.net_sure_dk ?? 0) : 0;
      const gecen = net > 0 ? net : (en > st ? (en - st) / 60000 : 0);
      if (gecen <= 1 || gecen > 240) continue;
      const kisi = Number(r.worker_count ?? 1) || 1;
      const ia = (gecen * kisi) / qty;
      if (!(ia > 0)) continue;
      const step = tablo === "montaj_sessions" ? String(r.step_name ?? "") : "__paketleme__";
      const key = `${sku} ${step}`;
      const arr = olcumler.get(key) ?? [];
      arr.push(ia);
      olcumler.set(key, arr);
    }
  }

  const medyan = (xs: number[]) => {
    const a = [...xs].sort((x, y) => x - y);
    const o = Math.floor(a.length / 2);
    return a.length % 2 ? a[o] : (a[o - 1] + a[o]) / 2;
  };
  for (const [key, xs] of olcumler) {
    const [sku, step] = key.split(" ");
    const m = sonuc.get(sku) ?? new Map<string, number>();
    m.set(step, medyan(xs));
    sonuc.set(sku, m);
  }
  return sonuc;
}
