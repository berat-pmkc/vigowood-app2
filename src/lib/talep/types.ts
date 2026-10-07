/** Talepler (üretim talepleri) — tipler (bkz. talep_durum görünümü, 131_talimat_gorunumler.sql) */

export type TalepDurum =
  | "acik"
  | "is_emri_verildi"
  | "hazirlaniyor"
  | "hazir"
  | "pasif"
  | "tamamlandi"
  | "tamamlanmadi"
  | "stokta_mevcut"
  | "geri_cekildi";

export type TalepKapanis = "tamamlandi" | "tamamlanmadi" | "stokta_mevcut" | "geri_cekildi";

/** talep_durum satırı */
export interface Talep {
  talep_id: string;
  talep_no: number;
  sku: string;
  urun_adi: string | null;
  hedef_depo_id: string | null;
  depo_adi: string | null;
  istenen_miktar: number | null;
  termin_tarihi: string | null;
  aciklama: string | null;
  olusturan: string;
  olusturan_adi: string | null;
  created_at: string;
  updated_at: string;
  kapanis: TalepKapanis | null;
  kapanis_neden: string | null;
  kapanis_at: string | null;
  kapatan: string | null;
  durum: TalepDurum;
  bagli_satir_sayisi: number;
  atanan_personeller: string[];
  uretilen: number;
  kalan: number | null;
  serbest_duzenleme_bitis: string;
  /** Açılıştan sonraki ilk 10 dakika içinde mi (şu an, sorgu anında) */
  serbest_mi: boolean;
  toplam_stok: number;
  /** hedef depo seçiliyse o depodaki stok */
  depo_stok: number | null;
  /** Kapalı talep kullanıcı tarafından "Kaldır"ıldığında dolar (geçmiş sekmelerine geçer) */
  kaldirildi_at: string | null;
}

export interface TalepRevizyon {
  rev_id: number;
  talep_id: string;
  yapan: string | null;
  yapan_adi?: string | null;
  islem: "guncelle" | "geri_cek" | "kapat" | "stokta_mevcut" | "yeniden_ac";
  degisiklikler: Record<string, { eski: unknown; yeni: unknown }>;
  neden: string | null;
  created_at: string;
}

export interface TalepOlusturGirdi {
  sku: string;
  hedefDepoId?: string | null;
  istenenMiktar?: number | null;
  /** YYYY-MM-DD */
  terminTarihi?: string | null;
  aciklama?: string | null;
}

export interface TalepGuncelleGirdi {
  talepId: string;
  sku?: string;
  hedefDepoId?: string | null;
  istenenMiktar?: number | null;
  terminTarihi?: string | null;
  aciklama?: string | null;
  /** Planlayıcıysa: bağlı satırların planı bildirimli yayınlanır */
  bildirimGonder?: boolean;
}

export interface TalepGuncelleSonuc {
  degisti: boolean;
  serbest: boolean;
  etkilenen_satir: number;
  yayin_idler: string[];
}

export interface TalepTalimataAtaGirdi {
  talepId: string;
  personelId: string;
  /** boş = ilk boş sıra (listenin sonu) */
  sira?: number | null;
  /** boş = talebin istenen miktarı */
  miktar?: number | null;
  istasyon?: "kesim" | "montaj" | "paketleme" | null;
  plakaId?: string | null;
  /** dolu sıraya araya girerek ekle */
  kaydir?: boolean;
  planId?: string | null;
}

export interface TalepFiltre {
  /** ör. ["acik","hazirlaniyor"] */
  durumlar?: TalepDurum[];
  sku?: string;
  olusturan?: string;
  depoId?: string;
  /** YYYY-MM-DD, created_at aralığı (dahil) */
  baslangic?: string;
  bitis?: string;
  /** sku / ürün adı / açıklama arama */
  arama?: string;
  /** true: yalnız kapalılar, false: yalnız açıklar */
  kapali?: boolean;
  /** true: kaldırılmamışlar (açık talepler + kapalı ama henüz "Kaldır"ılmamışlar = aktif liste) */
  kaldirilmamis?: boolean;
  /** varsayılan: yeni önce */
  sirala?: "yeni" | "eski";
  limit?: number;
  offset?: number;
}

export interface TalepStokUyarisi {
  /** toplam veya hedef depo stoğu istenen miktardan büyük/eşit */
  uyari: boolean;
  toplam_stok: number;
  depo_stok: number | null;
  istenen: number | null;
}
