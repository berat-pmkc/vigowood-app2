import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  KRITIK_STOK_DEFAULT_GUN,
  KRITIK_STOK_DEFAULT_LOOKBACK_DAYS,
  KRITIK_STOK_GUVENLIK_KATSAYISI,
  KRITIK_STOK_MAX_TEDARIK_SURESI_GUN,
  KRITIK_STOK_MIN_PAKETLEME_GUN_SAYISI,
  WMA_WEIGHT_7D,
  WMA_WEIGHT_30D,
  WMA_WEIGHT_90D,
} from "@/lib/constants";

/**
 * Kritik Stok Önerisi — Hesaplama Motoru
 * ---------------------------------------------------------------
 * Bu modül, `/api/cron/kritik-stok` içindeki günlük tüketim hızı (WMA; stock_movements çıkışları)
 * mantığıyla AYNI ağırlıkları kullanır, ayrıca gerçek üretim/paketleme
 * verisinden bir "tedarik süresi" sinyali türetir. Cron sadece
 * `mamul_stok_kritik` kolonunu günceller; bu modül ise stok/kritik-stok
 * sayfasında GÖSTERİLECEK önerinin aynı anda, canlı olarak hesaplanmasını
 * sağlar (sayfa her açıldığında güncel veriyle yeniden hesaplanır).
 *
 * YÖNTEM (özet):
 * 1) Günlük Satış Hızı = Ağırlıklı Hareketli Ortalama (WMA)
 *    hız = (son7gün_toplam/7 × %20) + (son30gün_toplam/30 × %50) + (son90gün_toplam/90 × %30)
 *    → Yakın geçmişe biraz, orta vadeye en çok ağırlık verir; ani tek günlük
 *      sıçramalardan aşırı etkilenmeyi önler.
 *
 * 2) Tedarik Süresi (gün) = SKU'nun son 90 günde GERÇEKTEN kaç günde bir
 *    paketlendiği (pack_events, durum=tamamlandi). Bir SKU 15 günde bir
 *    paketleniyorsa, o SKU için "tedarik süresi" ~15 gün kabul edilir
 *    (paketleme günleri arasındaki ortalama boşluk). Veri yetersizse
 *    (90 günde 2'den az farklı paketleme günü varsa) sistemin varsayılan
 *    tampon günü (Ayarlar > kritik_stok_gun, öntanımlı 30 gün) kullanılır.
 *    Aşırı seyrek üretilen ürünlerde tedarik süresi en fazla 30 gün ile
 *    sınırlandırılır (aksi halde tek seferlik büyük boşluklar öneriyi
 *    anlamsız şekilde şişirir).
 *
 * 3) Güvenlik Payı = ×1.3 (talep dalgalanmasına karşı %30 tampon)
 *
 * Önerilen Kritik Stok = YUKARI YUVARLA( Günlük Satış Hızı × Tedarik Süresi × 1.3 )
 *
 * Örnek: Bir ürün günde ortalama 4 adet satıyor, bu ürün ortalama 20 günde
 * bir paketleniyor → 4 × 20 × 1.3 ≈ 104 adet. Yani bir sonraki paketleme
 * partisi gelene kadar elde en az ~104 adet olması önerilir.
 */

export interface KritikStokOneri {
  sku: string;
  urun_adi: string | null;
  aktif_mi: boolean;
  /** Tüm depolar toplamı (urun_toplam_stok görünümü) */
  stok_toplam: number;
  /** Mevcut (manuel/cron ile ayarlı) kritik stok değeri */
  mamul_stok_kritik: number;
  /** Ağırlıklı hareketli ortalama ile hesaplanan günlük satış hızı */
  gunluk_satis_hizi: number;
  /** Son 90 günün toplam satış adedi */
  satis_90gun: number;
  /** Son 90 günde paketlenen toplam adet */
  paketlenen_90gun: number;
  /** Hesaplanan tedarik süresi (gün) */
  tedarik_suresi_gun: number;
  /** Tedarik süresi gerçek paketleme verisinden mi, yoksa varsayılandan mı geldi */
  tedarik_suresi_kaynak: "gercek" | "varsayilan";
  /** Nihai öneri: ceil(gunluk_satis_hizi * tedarik_suresi_gun * güvenlik_katsayısı) */
  onerilen_kritik_stok: number;
  /** Mevcut stok, mevcut kritik stok eşiğine göre durum */
  durum: "kritik" | "dusuk" | "saglikli";
}

function gunFarki(a: string, b: string): number {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.abs(msA - msB) / (1000 * 60 * 60 * 24);
}

/** Tüketim sayılmayan stok hareketi kaynakları (depo transferi, kalite ayrımı, fire) */
export const TUKETIM_DISI_KAYNAKLAR = ["Transfer", "Uygunsuz", "Fire", "Kontrol-Uygun"] as const;

/**
 * Mamül stok çıkışlarından (stock_movements, qty < 0) SKU bazlı günlük tüketim
 * hızını (WMA 7/30/90 gün) hesaplar. Transfer / Uygunsuz / Fire / Kontrol-Uygun
 * kaynaklı hareketler tüketim sayılmaz. Veri yoksa SKU haritada yer almaz.
 */
export async function fetchTuketimHizlari(
  supabase: SupabaseClient<Database>
): Promise<{ dailyRateMap: Map<string, number>; total90Map: Map<string, number> }> {
  const now = new Date();
  const iso = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };
  const cutoff90ISO = iso(KRITIK_STOK_DEFAULT_LOOKBACK_DAYS);
  const cutoff30ISO = iso(30);
  const cutoff7ISO = iso(7);
  const dislanan = new Set<string>(TUKETIM_DISI_KAYNAKLAR);

  const buckets = new Map<string, { sum7: number; sum30: number; sum90: number }>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("sku, qty, tarih, source")
      .lt("qty", 0)
      .not("sku", "is", null)
      .gte("tarih", cutoff90ISO)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Stok hareketleri okunamadı: ${error.message}`);
    for (const row of data ?? []) {
      if (!row.sku || !row.tarih) continue;
      if (row.source && dislanan.has(row.source)) continue;
      const qty = Math.abs(Number(row.qty) || 0);
      const bucket = buckets.get(row.sku) || { sum7: 0, sum30: 0, sum90: 0 };
      bucket.sum90 += qty;
      if (row.tarih >= cutoff30ISO) bucket.sum30 += qty;
      if (row.tarih >= cutoff7ISO) bucket.sum7 += qty;
      buckets.set(row.sku, bucket);
    }
    if (!data || data.length < PAGE) break;
  }

  const dailyRateMap = new Map<string, number>();
  const total90Map = new Map<string, number>();
  for (const [sku, b] of buckets) {
    const velocity =
      (b.sum7 / 7) * WMA_WEIGHT_7D + (b.sum30 / 30) * WMA_WEIGHT_30D + (b.sum90 / 90) * WMA_WEIGHT_90D;
    dailyRateMap.set(sku, Math.round(velocity * 100) / 100);
    total90Map.set(sku, b.sum90);
  }
  return { dailyRateMap, total90Map };
}

export async function computeKritikStokOnerileri(
  supabase: SupabaseClient<Database>
): Promise<KritikStokOneri[]> {
  const now = new Date();
  const lookback = KRITIK_STOK_DEFAULT_LOOKBACK_DAYS;
  const cutoff90 = new Date(now);
  cutoff90.setDate(cutoff90.getDate() - lookback);
  const cutoff90ISO = cutoff90.toISOString().split("T")[0];

  // ---------- Varsayılan tampon gün ayarı ----------
  const { data: settingsData } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["kritik_stok_gun"]);

  const settingsMap = new Map<string, unknown>();
  for (const row of settingsData ?? []) settingsMap.set(row.key, row.value);
  const varsayilanTedarikGun = Number(settingsMap.get("kritik_stok_gun")) || KRITIK_STOK_DEFAULT_GUN;

  // ---------- Aktif ürünler ----------
  const { data: products } = await supabase
    .from("products")
    .select("sku, urun_adi, aktif_mi, mamul_stok_kritik")
    .eq("aktif_mi", true);

  // ---------- Toplam stok (tüm depolar) ----------
  const { data: stokData } = await supabase
    .from("urun_toplam_stok")
    .select("sku, miktar");
  const stokHaritasi = new Map<string, number>(
    ((stokData ?? []) as { sku: string | null; miktar: number | null }[])
      .filter((r): r is { sku: string; miktar: number | null } => !!r.sku)
      .map((r) => [r.sku, Number(r.miktar ?? 0)])
  );

  // ---------- Tüketim verisi (son 90 gün, stock_movements çıkışları) — WMA ----------
  const { dailyRateMap, total90Map: sales90Map } = await fetchTuketimHizlari(supabase);

  // ---------- Paketleme verisi (son 90 gün) — tedarik süresi sinyali ----------
  const { data: packData } = await supabase
    .from("pack_events")
    .select("sku, tarih, qty")
    .eq("durum", "tamamlandi")
    .gte("tarih", cutoff90ISO)
    .not("sku", "is", null);

  const packDatesMap = new Map<string, Set<string>>();
  const packQtyMap = new Map<string, number>();
  for (const row of packData ?? []) {
    if (!row.sku || !row.tarih) continue;
    const gunOnly = row.tarih.split("T")[0];
    const dateSet = packDatesMap.get(row.sku) || new Set<string>();
    dateSet.add(gunOnly);
    packDatesMap.set(row.sku, dateSet);
    packQtyMap.set(row.sku, (packQtyMap.get(row.sku) || 0) + Math.abs(Number(row.qty) || 0));
  }

  function tedarikSuresi(sku: string): { gun: number; kaynak: "gercek" | "varsayilan" } {
    const dateSet = packDatesMap.get(sku);
    if (!dateSet || dateSet.size < KRITIK_STOK_MIN_PAKETLEME_GUN_SAYISI) {
      return { gun: varsayilanTedarikGun, kaynak: "varsayilan" };
    }
    const sortedDates = Array.from(dateSet).sort();
    const ilk = sortedDates[0];
    const son = sortedDates[sortedDates.length - 1];
    const toplamAralikGun = gunFarki(ilk, son);
    // Ortalama boşluk = toplam aralık / (farklı gün sayısı - 1)
    const ortalamaBosluk = toplamAralikGun / (sortedDates.length - 1);
    const sinirli = Math.min(Math.max(ortalamaBosluk, 1), KRITIK_STOK_MAX_TEDARIK_SURESI_GUN);
    return { gun: Math.round(sinirli * 10) / 10, kaynak: "gercek" };
  }

  function durumHesapla(stok: number, kritik: number): "kritik" | "dusuk" | "saglikli" {
    if (kritik <= 0) return "saglikli";
    if (stok <= 0 || stok < kritik) return "kritik";
    if (stok <= kritik * 1.5) return "dusuk";
    return "saglikli";
  }

  const sonuc: KritikStokOneri[] = (products ?? []).map((p) => {
    const dailyRate = dailyRateMap.get(p.sku) || 0;
    const { gun: tedarikGun, kaynak } = tedarikSuresi(p.sku);
    const onerilen = Math.ceil(dailyRate * tedarikGun * KRITIK_STOK_GUVENLIK_KATSAYISI);
    const stok = stokHaritasi.get(p.sku) ?? 0;

    return {
      sku: p.sku,
      urun_adi: p.urun_adi,
      aktif_mi: p.aktif_mi,
      stok_toplam: stok,
      mamul_stok_kritik: p.mamul_stok_kritik,
      gunluk_satis_hizi: dailyRate,
      satis_90gun: sales90Map.get(p.sku) || 0,
      paketlenen_90gun: packQtyMap.get(p.sku) || 0,
      tedarik_suresi_gun: tedarikGun,
      tedarik_suresi_kaynak: kaynak,
      onerilen_kritik_stok: onerilen,
      durum: durumHesapla(stok, p.mamul_stok_kritik),
    };
  });

  return sonuc;
}
