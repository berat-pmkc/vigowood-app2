import "server-only";

import { diaAyarOku, diaListele, DiaHata, type DiaFiltre } from "./client";
import { createClient } from "@supabase/supabase-js";
import { getSalesSettings, isExportChannelFromSettings, isServiceSkuFromSettings } from "@/lib/sales-settings";

/**
 * DİA fatura satırlarını okuyup satis_raporlari / satis_satirlari'na yazar.
 *
 * TASARIM NOTU — alan adları neden sabit değil:
 * DİA'nın fatura listesi, DİA ekranındaki kolonları döndürüyor; kolon adları
 * kurulumdan kuruluma (ve sürümden sürüme) değişebiliyor. Kodun içine tek bir
 * ad gömmek yerine her mantıksal alan için ADAY LİSTESİ tutuluyor; kayıtta
 * hangisi varsa o kullanılıyor. Hiçbiri tutmazsa `bilinmeyenAlanlar` ile
 * ham anahtarlar geri dönüyor, böylece eşleştirme ekrandan görülüp
 * `app_settings.dia_satis_ayarlari` ile yeniden deploy etmeden düzeltilebiliyor.
 */

// ─── Alan eşleştirme ────────────────────────────────────────────

export type AlanAdi =
  | "tarih"
  | "faturaNo"
  | "cariUnvan"
  | "satisElemani"
  | "sku"
  | "miktar"
  | "birimFiyat"
  | "toplamTutar"
  | "kdvOrani"
  | "doviz";

const VARSAYILAN_ADAYLAR: Record<AlanAdi, string[]> = {
  tarih: ["tarih", "faturatarihi", "belgetarihi", "fistarihi", "duzenlemetarihi"],
  faturaNo: ["faturano", "fisno", "belgeno", "fisnumarasi", "seri_sira"],
  cariUnvan: ["unvan", "carikartunvan", "cariunvan", "carihesapunvan", "musteriunvan"],
  satisElemani: ["satiselemani", "satiselemaniadi", "satiselemankodu", "plasiyer", "plasiyeradi"],
  sku: ["stokkartkodu", "stokhizmetkodu", "stokkodu", "kod", "urunkodu"],
  miktar: ["miktar", "stokmiktar", "birimmiktar"],
  birimFiyat: ["birimfiyat", "fiyat", "birimfiyati"],
  toplamTutar: ["toplamtutar", "satirtoplam", "toplam", "tutar", "netfiyat", "brutfiyat"],
  kdvOrani: ["kdvorani", "kdv", "kdvyuzde", "kdvoran"],
  doviz: ["satirdovizi", "dovizturu", "doviz", "dovizkodu", "parabirimi"],
};

export interface DiaSatisAyarlari {
  /** Fatura satırlarını döndüren servis. Kurulumda farklıysa buradan değişir. */
  servis: string;
  /** Yalnızca satış faturaları gelsin diye uygulanacak sabit filtreler. */
  sabitFiltreler: DiaFiltre[];
  /** Alan adı ezmeleri: { sku: "stokkartkodu" } gibi. Boşsa adaylar kullanılır. */
  alanEslesme: Partial<Record<AlanAdi, string>>;
  /** Tarih alanının DİA'daki adı (filtre için gerekli, kayıt alanından ayrı). */
  tarihFiltreAlani: string;
}

export const VARSAYILAN_SATIS_AYARLARI: DiaSatisAyarlari = {
  servis: "scf_fatura_listele_ayrintili",
  // Satış faturaları. DİA'da alış/satış ayrımı genelde "turu" alanında;
  // kurulumda farklıysa ayarlardan düzeltilir.
  sabitFiltreler: [{ field: "turu", operator: "=", value: "S" }],
  alanEslesme: {},
  tarihFiltreAlani: "tarih",
};

export async function getDiaSatisAyarlari(): Promise<DiaSatisAyarlari> {
  try {
    const supabase = yonetimIstemcisi();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "dia_satis_ayarlari")
      .maybeSingle();

    if (!data?.value || typeof data.value !== "object") return VARSAYILAN_SATIS_AYARLARI;
    const v = data.value as Partial<DiaSatisAyarlari>;
    return {
      servis: v.servis || VARSAYILAN_SATIS_AYARLARI.servis,
      sabitFiltreler: Array.isArray(v.sabitFiltreler)
        ? v.sabitFiltreler
        : VARSAYILAN_SATIS_AYARLARI.sabitFiltreler,
      alanEslesme: v.alanEslesme ?? {},
      tarihFiltreAlani: v.tarihFiltreAlani || VARSAYILAN_SATIS_AYARLARI.tarihFiltreAlani,
    };
  } catch {
    return VARSAYILAN_SATIS_AYARLARI;
  }
}

type Kayit = Record<string, unknown>;

function alanBul(kayit: Kayit, alan: AlanAdi, ayar: DiaSatisAyarlari): unknown {
  const ezme = ayar.alanEslesme[alan];
  if (ezme && ezme in kayit) return kayit[ezme];

  for (const aday of VARSAYILAN_ADAYLAR[alan]) {
    if (aday in kayit && kayit[aday] !== null && kayit[aday] !== "") return kayit[aday];
  }
  // Büyük/küçük harf ve alt çizgi farklarını tolere et
  const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const anahtarlar = Object.keys(kayit);
  for (const aday of VARSAYILAN_ADAYLAR[alan]) {
    const bulunan = anahtarlar.find((k) => normal(k) === normal(aday));
    if (bulunan && kayit[bulunan] !== null && kayit[bulunan] !== "") return kayit[bulunan];
  }
  return undefined;
}

// ─── Dönüştürücüler ─────────────────────────────────────────────

/** DİA tarihleri "2026-08-18" veya "2026-08-18 14:03:00.00" gelir. */
function tariheCevir(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const nokta = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (nokta) return `${nokta[3]}-${nokta[2].padStart(2, "0")}-${nokta[1].padStart(2, "0")}`;
  return null;
}

/** DİA sayıları string gelebiliyor; hem "1.234,56" hem "1234.56" desteklenir. */
function sayiyaCevir(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const sonVirgul = s.lastIndexOf(",");
  const sonNokta = s.lastIndexOf(".");
  if (sonVirgul > -1 && sonNokta > -1) {
    return sonVirgul > sonNokta
      ? parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0
      : parseFloat(s.replace(/,/g, "")) || 0;
  }
  if (sonVirgul > -1) return parseFloat(s.replace(",", ".")) || 0;
  return parseFloat(s) || 0;
}

export interface DiaSatir {
  tarih: string | null;
  satis_kanali: string | null;
  fatura_no: string | null;
  musteri_adi: string | null;
  sku: string;
  miktar: number;
  birim_fiyat: number;
  toplam_tutar: number;
  kdv_orani: number | null;
  doviz: string;
  is_hizmet: boolean;
}

// ─── Çekme ──────────────────────────────────────────────────────

export interface CekmeSonucu {
  satirlar: DiaSatir[];
  hamKayitSayisi: number;
  /** İlk kaydın anahtarları — eşleştirme doğrulaması için ekranda gösterilir. */
  ornekAnahtarlar: string[];
  ornekKayit: Kayit | null;
  /** Hiçbir adayla eşleşmeyen mantıksal alanlar. Boş olmalı. */
  eslesmeyenAlanlar: AlanAdi[];
}

/** Verilen tarih aralığındaki satış faturası satırlarını DİA'dan çeker. */
export async function diaSatisCek(
  baslangic: string,
  bitis: string,
): Promise<CekmeSonucu> {
  const ayar = diaAyarOku();
  if (!ayar) {
    throw new DiaHata(
      "DİA ayarları eksik. DIA_UYE_KODU, DIA_KULLANICI, DIA_SIFRE ve DIA_FIRMA_KODU tanımlanmalı.",
    );
  }

  const satisAyar = await getDiaSatisAyarlari();
  const salesSettings = await getSalesSettings();

  const filtreler: DiaFiltre[] = [
    ...satisAyar.sabitFiltreler,
    { field: satisAyar.tarihFiltreAlani, operator: ">=", value: baslangic },
    { field: satisAyar.tarihFiltreAlani, operator: "<=", value: bitis },
  ];

  const kayitlar = await diaListele<Kayit & { _key?: string }>(
    ayar,
    "scf",
    satisAyar.servis,
    { filters: filtreler },
  );

  const ornekKayit = kayitlar[0] ?? null;
  const ornekAnahtarlar = ornekKayit ? Object.keys(ornekKayit).sort() : [];

  const eslesmeyenAlanlar: AlanAdi[] = [];
  if (ornekKayit) {
    for (const alan of Object.keys(VARSAYILAN_ADAYLAR) as AlanAdi[]) {
      if (alanBul(ornekKayit, alan, satisAyar) === undefined) eslesmeyenAlanlar.push(alan);
    }
  }

  const satirlar: DiaSatir[] = [];

  for (const k of kayitlar) {
    const sku = String(alanBul(k, "sku", satisAyar) ?? "").trim();
    const miktar = sayiyaCevir(alanBul(k, "miktar", satisAyar));
    if (!sku || miktar === 0) continue;

    const kdvHam = alanBul(k, "kdvOrani", satisAyar);
    const kdvSayi = kdvHam == null ? null : sayiyaCevir(kdvHam);
    const kdvOrani = kdvSayi != null && kdvSayi >= 0 && kdvSayi <= 100 ? kdvSayi : null;

    const kanal = alanBul(k, "satisElemani", satisAyar);
    const dovizHam = alanBul(k, "doviz", satisAyar);

    satirlar.push({
      tarih: tariheCevir(alanBul(k, "tarih", satisAyar)),
      satis_kanali: kanal ? String(kanal).trim().toUpperCase() : null,
      fatura_no: (() => {
        const v = alanBul(k, "faturaNo", satisAyar);
        return v ? String(v).trim() : null;
      })(),
      musteri_adi: (() => {
        const v = alanBul(k, "cariUnvan", satisAyar);
        return v ? String(v).trim() : null;
      })(),
      sku,
      miktar: Math.round(miktar),
      birim_fiyat: sayiyaCevir(alanBul(k, "birimFiyat", satisAyar)),
      toplam_tutar: sayiyaCevir(alanBul(k, "toplamTutar", satisAyar)),
      kdv_orani: kdvOrani,
      doviz: dovizHam ? String(dovizHam).trim() : "TL",
      is_hizmet: isServiceSkuFromSettings(sku, salesSettings.hizmetSkulari),
    });
  }

  return {
    satirlar,
    hamKayitSayisi: kayitlar.length,
    ornekAnahtarlar,
    ornekKayit,
    eslesmeyenAlanlar,
  };
}

// ─── Yazma ──────────────────────────────────────────────────────

function yonetimIstemcisi() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export interface IslemeSonucu {
  raporId: string | null;
  cekilen: number;
  yazilan: number;
  atlanan: number;
  atlananFaturalar: string[];
  eslesmeyenAlanlar: AlanAdi[];
  ornekAnahtarlar: string[];
}

/**
 * Tarih aralığındaki satışları çeker ve sisteme işler.
 *
 * MÜKERRERLİK: Fatura no anahtardır. Sistemde zaten bulunan fatura numaraları
 * atlanır — cron'un iki kez çalışması, aynı günün elle tekrar çekilmesi veya
 * DİA'da geriye dönük fatura girilmesi durumunda stok iki kez düşmesin diye.
 */
export async function diaSatisIsle(
  baslangic: string,
  bitis: string,
  opsiyon: { kaynak?: string; kullaniciAdi?: string } = {},
): Promise<IslemeSonucu> {
  const cekme = await diaSatisCek(baslangic, bitis);
  const supabase = yonetimIstemcisi();
  const settings = await getSalesSettings();

  const bos: IslemeSonucu = {
    raporId: null,
    cekilen: cekme.satirlar.length,
    yazilan: 0,
    atlanan: 0,
    atlananFaturalar: [],
    eslesmeyenAlanlar: cekme.eslesmeyenAlanlar,
    ornekAnahtarlar: cekme.ornekAnahtarlar,
  };

  if (cekme.satirlar.length === 0) return bos;

  // ── Mükerrer fatura elemesi
  const faturaNolar = [...new Set(cekme.satirlar.map((s) => s.fatura_no).filter(Boolean) as string[])];
  const mevcut = new Set<string>();
  for (let i = 0; i < faturaNolar.length; i += 200) {
    const { data } = await supabase
      .from("satis_satirlari")
      .select("fatura_no")
      .in("fatura_no", faturaNolar.slice(i, i + 200));
    for (const r of data ?? []) if (r.fatura_no) mevcut.add(r.fatura_no);
  }

  const yeni = cekme.satirlar.filter((s) => !s.fatura_no || !mevcut.has(s.fatura_no));
  bos.atlanan = cekme.satirlar.length - yeni.length;
  bos.atlananFaturalar = [...mevcut];

  if (yeni.length === 0) return bos;

  // ── Rapor kaydı
  const simdi = new Date();
  const iki = (n: number) => String(n).padStart(2, "0");
  const raporId = `DIA-${simdi.getFullYear()}${iki(simdi.getMonth() + 1)}${iki(simdi.getDate())}-${iki(simdi.getHours())}${iki(simdi.getMinutes())}${iki(simdi.getSeconds())}`;
  const raporTarihi = yeni[0]?.tarih || bitis;

  const toplamTutar = yeni.reduce((s, r) => s + r.toplam_tutar, 0);
  const trTutar = yeni
    .filter((r) => !r.satis_kanali || !isExportChannelFromSettings(r.satis_kanali, settings.kanallari))
    .reduce((s, r) => s + r.toplam_tutar, 0);

  const { error: raporHata } = await supabase.from("satis_raporlari").insert({
    rapor_id: raporId,
    rapor_tarihi: raporTarihi,
    yukleyen_id: null,
    yukleyen_adi: opsiyon.kullaniciAdi ?? "DİA Otomatik",
    dosya_adi: `DİA ${baslangic} → ${bitis}`,
    toplam_satir: yeni.length,
    toplam_adet: yeni.filter((r) => !r.is_hizmet).reduce((s, r) => s + r.miktar, 0),
    toplam_tutar: toplamTutar,
    tr_tutar: trTutar,
    ihracat_tutar: toplamTutar - trTutar,
    durum: "aktif",
  });
  if (raporHata) throw new Error(`Rapor oluşturulamadı: ${raporHata.message}`);

  // ── Satırlar
  for (let i = 0; i < yeni.length; i += 200) {
    const { error } = await supabase
      .from("satis_satirlari")
      .insert(yeni.slice(i, i + 200).map((r) => ({ rapor_id: raporId, ...r })));
    if (error) {
      await supabase.from("satis_raporlari").delete().eq("rapor_id", raporId);
      throw new Error(`Satır yazılamadı: ${error.message}`);
    }
  }

  // ── Stok düşümü (Excel akışıyla birebir aynı mantık)
  const skuToplam = new Map<string, number>();
  for (const r of yeni) {
    if (r.is_hizmet) continue;
    skuToplam.set(r.sku, (skuToplam.get(r.sku) ?? 0) + r.miktar);
  }

  if (skuToplam.size > 0) {
    const hareketler = [...skuToplam].map(([sku, adet]) => ({
      sku,
      qty: -adet,
      source: "Satis",
      source_row_id: raporId,
      batch_id: raporId,
      tarih: raporTarihi,
    }));
    for (let i = 0; i < hareketler.length; i += 200) {
      await supabase.from("stock_movements").insert(hareketler.slice(i, i + 200));
    }

    for (const [sku, adet] of skuToplam) {
      const { data: urun } = await supabase
        .from("products")
        .select("stok_aktif")
        .eq("sku", sku)
        .maybeSingle();
      if (urun) {
        await supabase
          .from("products")
          .update({ stok_aktif: ((urun as { stok_aktif: number }).stok_aktif || 0) - adet })
          .eq("sku", sku);
      }
    }
  }

  return { ...bos, raporId, yazilan: yeni.length };
}


// ─── Günlük / ayar yazımı ───────────────────────────────────────
//
// Bu üç fonksiyon service_role istemcisini kullanıyor. Sebebi tip değil
// yetki: dia_sync_log'a yalnızca sunucu yazabilsin istiyoruz, kullanıcı
// eliyle sahte başarı kaydı oluşturulamasın. Çağıran taraf (server action)
// rol kontrolünü kendisi yapıyor.

export interface SyncKaydi {
  id: number;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  rapor_id: string | null;
  cekilen: number;
  yazilan: number;
  atlanan: number;
  durum: string;
  mesaj: string | null;
  sure_ms: number | null;
  created_at: string;
}

export async function diaLogYaz(kayit: {
  baslangic_tarihi: string;
  bitis_tarihi: string;
  rapor_id?: string | null;
  cekilen: number;
  yazilan: number;
  atlanan: number;
  durum: string;
  mesaj?: string | null;
  sure_ms?: number | null;
}): Promise<void> {
  try {
    await yonetimIstemcisi().from("dia_sync_log").insert({ tur: "satis", ...kayit });
  } catch {
    // Günlük yazımı asıl işi bozmamalı.
  }
}

export async function diaLogOku(limit = 30): Promise<SyncKaydi[]> {
  const { data } = await yonetimIstemcisi()
    .from("dia_sync_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as SyncKaydi[];
}

export async function diaAyarKaydet(
  ayar: DiaSatisAyarlari,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await yonetimIstemcisi()
    .from("app_settings")
    .upsert({ key: "dia_satis_ayarlari", value: ayar }, { onConflict: "key" });
  return error ? { success: false, error: error.message } : { success: true };
}

// ─── Günlük çalıştırma ──────────────────────────────────────────

/**
 * Cron'un çağırdığı sarmalayıcı. Bugünü değil, SON 3 GÜNÜ tarar:
 * DİA'ya geç girilen ya da düzeltilen faturalar da yakalansın diye.
 * Mükerrer elemesi zaten fatura no üzerinden yapıldığı için tekrar yazılmaz.
 */
export async function diaGunlukSatisSenkron(gunSayisi = 3) {
  const bitisD = new Date();
  const baslangicD = new Date(bitisD.getTime() - (gunSayisi - 1) * 86_400_000);
  const g = (d: Date) => d.toISOString().slice(0, 10);

  const baslangic = g(baslangicD);
  const bitis = g(bitisD);

  const baslangicZamani = Date.now();

  try {
    const sonuc = await diaSatisIsle(baslangic, bitis, { kaynak: "cron" });

    await diaLogYaz({
      baslangic_tarihi: baslangic,
      bitis_tarihi: bitis,
      rapor_id: sonuc.raporId,
      cekilen: sonuc.cekilen,
      yazilan: sonuc.yazilan,
      atlanan: sonuc.atlanan,
      durum: sonuc.eslesmeyenAlanlar.length > 0 ? "uyari" : "basarili",
      mesaj:
        sonuc.eslesmeyenAlanlar.length > 0
          ? `Eşleşmeyen alanlar: ${sonuc.eslesmeyenAlanlar.join(", ")}`
          : null,
      sure_ms: Date.now() - baslangicZamani,
    });

    return sonuc;
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : "Bilinmeyen hata";
    await diaLogYaz({
      baslangic_tarihi: baslangic,
      bitis_tarihi: bitis,
      cekilen: 0,
      yazilan: 0,
      atlanan: 0,
      durum: "hata",
      mesaj,
      sure_ms: Date.now() - baslangicZamani,
    });
    throw e;
  }
}
