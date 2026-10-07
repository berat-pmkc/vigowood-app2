/**
 * İş Talimatları — tipler. Veritabanı tipleri (types.ts) henüz bu tabloları içermediği için
 * satır tipleri burada elle tanımlıdır (görünüm kolonlarıyla birebir, bkz. 131_talimat_gorunumler.sql).
 */

export type TalimatIstasyon = "kesim" | "montaj" | "paketleme";
export type TalimatPlanDurum = "taslak" | "yayinda" | "pasif";
export type TalimatSatirDurum = "aktif" | "pasif" | "tamamlandi";
export type TalimatYayinDurum =
  | "bildirimsiz"
  | "beklemede"
  | "gonderildi"
  | "tamamlandi"
  | "durduruldu"
  | "geri_cekildi";
export type TalimatYayinHedef = "degisenler" | "herkes";
export type TalimatPasifKapsam = "satir" | "personel" | "liste";

/** Server action sonucu */
export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; code?: TalimatHataKodu };

/** RPC hata mesajı öneklerinden çıkarılan kod */
export type TalimatHataKodu = "ARDISIK_SKU" | "SIRA_DOLU" | "PLAN_PASIF" | "YETKI";

/** talimat_plan_ozet */
export interface TalimatPlan {
  plan_id: string;
  hafta_baslangic: string; // YYYY-MM-DD (Pazartesi)
  durum: TalimatPlanDurum;
  yayinlandi_at: string | null;
  pasif_at: string | null;
  pazartesi_bildirim_at: string | null;
  degisen_personeller: string[];
  kaynak_plan_id: string | null;
  olusturan: string | null;
  created_at: string;
  updated_at: string;
  guncel_bitis: string | null;
  guncel_mi: boolean;
  satir_sayisi: number;
  degisen_satir_sayisi: number;
  personel_sayisi: number;
}

/** talimat_satir_ilerleme (satır + üretim ilerlemesi) */
export interface TalimatSatir {
  satir_id: string;
  plan_id: string;
  personel_id: string;
  personel_adi: string | null;
  personel_istasyon: string | null;
  sira: number;
  istasyon: TalimatIstasyon | null;
  /** istasyon null ise türetilmiş: plaka varsa kesim, yoksa montaj */
  etkin_istasyon: TalimatIstasyon;
  sku: string | null;
  urun_adi: string | null;
  plaka_id: string | null;
  plaka_adi: string | null;
  istenen_miktar: number | null;
  not_text: string | null;
  talep_id: string | null;
  durum: TalimatSatirDurum;
  pasif_neden: string | null;
  pasif_baslangic: string | null;
  pasif_until: string | null;
  degisti: boolean;
  onay_bekliyor: boolean;
  /** degisti || onay_bekliyor — kırmızı gösterim */
  kirmizi: boolean;
  hafta_baslangic: string;
  plan_durum: TalimatPlanDurum;
  /** bugün için pasif mi (satır/personel/liste pasifleri dahil) */
  etkin_pasif: boolean;
  uretilen: number;
  /** istenen - uretilen (istenen yoksa null) */
  fark: number | null;
  tamamlandi_mi: boolean;
  etkin_durum: TalimatSatirDurum;
  /** yalnız montaj satırlarında: bitiş adımı montaj - paketleme (haftalık, tüm personel, yaklaşık) */
  paketlemeye_hazir: number | null;
  son_seans_at: string | null;
  hafta_seans_var: boolean;
  bugun_seans_var: boolean;
  toplam_stok: number;
  /** Sayaç sıfırlama anı (null = plan haftası başı); üretilen bu andan itibaren sayılır */
  sayac_baslangic?: string | null;
}

/** talimat_satir_katki */
export interface TalimatKatki {
  satir_id: string;
  personel_id: string | null;
  step_id: string;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean | null;
  qty: number;
  seans_sayisi: number;
}

/** talimat_yayin_ozet */
export interface TalimatYayin {
  yayin_id: string;
  plan_id: string;
  yayinlayan: string | null;
  bildirim_gonder: boolean;
  sesli: boolean;
  hedef: TalimatYayinHedef;
  gonderim_zamani: string;
  durum: TalimatYayinDurum;
  ilk_gonderim_at: string | null;
  durdurma_at: string | null;
  durduran: string | null;
  rapor_gonderildi_at: string | null;
  otomatik: boolean;
  satir_sayisi: number;
  personel_sayisi: number;
  snapshot: Array<Record<string, unknown>>;
  created_at: string;
  hedef_sayisi: number;
  onay_sayisi: number;
  onaylamayan_sayisi: number;
  onaylamayanlar: string[];
}

export interface TalimatYayinHedefDetay {
  personel_id: string;
  personel_adi: string | null;
  satir_ids: string[];
  son_bildirim_at: string | null;
  bildirim_sayisi: number;
  onay_zamani: string | null;
}

export interface TalimatAyarlari {
  pasif_gun_saat: { gun: number; saat: string };
  pazartesi_bildirim_saat: string;
  hatirlatma_dakika: number;
  rapor_dakika: number;
}

/** Çalışan (talimata eklenebilen personel) */
export interface TalimatPersonel {
  user_id: string;
  full_name: string;
  role: string;
  station: string | null;
}

/** Tablet bildirimi (notifications satırı, kind='talimat_degisiklik') */
export interface TalimatBildirim {
  notif_id: string;
  title: string;
  message: string | null;
  target_user: string | null;
  status: string;
  kind: string;
  sesli: boolean;
  yayin_id: string | null;
  created_at: string;
  geri_cekildi_at: string | null;
  payload: {
    yayin_id: string;
    plan_id: string;
    personel_id: string;
    personel_adi?: string;
    personel_istasyon?: string;
    satir_sayisi?: number;
    hatirlatma?: boolean;
    otomatik?: boolean;
    onaylamayanlar?: Array<{ personel_id: string; ad: string }>;
  } | null;
}

/** Tablet "İş Talimatları" ekranı verisi */
export interface TalimatTabletListe {
  personel_id: string;
  plan: TalimatPlan | null;
  /** Pasif olmayan satırlar, sıraya göre. Plan yoksa boş. */
  satirlar: TalimatSatir[];
  guncel: { guncel_mi: boolean; bitis: string | null };
  /** Personelin henüz onaylamadığı yayınlar (en yeni önce). Boşsa onay düğmesi gizlenir. */
  bekleyen_yayin_idler: string[];
}

/** Talimat satırına bağlı açık montaj/paketleme seansı (tablet) */
export interface TabletAcikSeans {
  session_id: string;
  tur: "montaj" | "paketleme";
  /** Bağlandığı talimat satırı */
  satir_id: string;
  sku: string | null;
  urun_adi: string | null;
  step_id: string | null;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean | null;
  start_time: string | null;
  durum: string;
  operator_name: string | null;
  workers: Array<{ id: string; name: string }> | null;
  duraklama_dk: number | null;
  duraklatma_baslangic: string | null;
  yardimci_sayisi: number | null;
  /** Ek seans (plan dışı): satir_id boş, personel_id dolu */
  ek_seans?: boolean;
  personel_id?: string | null;
}

/** Tüm çalışanların listesi (tablet "İş Talimatları" ekranı) */
export interface TalimatTabletTum {
  plan: TalimatPlan | null;
  /** Tüm personelin pasif olmayan satırları (personel, sıra) */
  satirlar: TalimatSatir[];
  guncel: { guncel_mi: boolean; bitis: string | null };
  /** personel_id -> onaylamadığı yayınlar (en yeni önce) */
  bekleyen: Record<string, string[]>;
  acik_seanslar: TabletAcikSeans[];
}

/** Ürün seçici öğesi: stok bilgisiyle */
export interface UrunStokSecenek {
  sku: string;
  urun_adi: string | null;
  toplam_stok: number;
  depo_stoklari: Array<{ depo_id: string | null; depo_adi: string | null; miktar: number }>;
}

export interface PlakaSecenek {
  plaka_id: string;
  plaka_adi: string | null;
}

export interface Depo {
  depo_id: string;
  ad: string;
  sira: number;
}

/** Planlayıcı satır filtreleri (sunucu tarafı) */
export interface TalimatSatirFiltre {
  personelId?: string;
  /** sku veya ürün adı içinde arar */
  arama?: string;
  istasyon?: TalimatIstasyon;
  /** yalnız 1. öncelik */
  sadeceOncelik1?: boolean;
  /** 1. öncelik + seansı başlamamış (seansKapsami ile birlikte) */
  oncelik1SeansBaslamamis?: boolean;
  /** 'bugun' (varsayılan) | 'hafta' */
  seansKapsami?: "bugun" | "hafta";
  sadeceDegisen?: boolean;
  /** bildirimli yayını onaylanmamış satırlar */
  sadeceOnaylamayan?: boolean;
  sadecePasif?: boolean;
  sadeceTamamlanan?: boolean;
  /** pasif satırları listeden çıkar (varsayılan: false, hepsi gelir) */
  pasifGizle?: boolean;
}

/** talimat_satir_kaydet girdisi (anahtar yoksa alan değişmez; null ise temizlenir) */
export interface SatirKaydetGirdi {
  satir_id?: string;
  plan_id?: string;
  personel_id?: string;
  sira?: number | null;
  /** yeni satırda dolu sıraya ekleme: true -> araya gir (diğerleri kayar) */
  kaydir?: boolean;
  istasyon?: TalimatIstasyon | null;
  sku?: string | null;
  plaka_id?: string | null;
  istenen_miktar?: number | null;
  not_text?: string | null;
  talep_id?: string | null;
  durum?: TalimatSatirDurum;
  pasif_neden?: string | null;
  pasif_baslangic?: string | null;
  pasif_until?: string | null;
}

export interface YayinlaGirdi {
  planId: string;
  bildirimGonder: boolean;
  /** ISO zaman; boş/null = hemen */
  gonderimZamani?: string | null;
  sesli?: boolean;
  hedef?: TalimatYayinHedef;
}

export interface YayinlaSonuc {
  yayin_id: string;
  personel_sayisi: number;
  satir_sayisi: number;
  bildirim_gonder: boolean;
  ilk_yayin: boolean;
  durum: TalimatYayinDurum;
}

export interface PasifGirdi {
  kapsam: TalimatPasifKapsam;
  planId: string;
  /** satir: satir_id'ler; personel: user_id'ler; liste: boş */
  ids?: string[];
  baslangic?: string | null;
  /** null = elle aktifleştirilene kadar */
  bitis?: string | null;
  neden?: string | null;
}

/** Montaj/paketleme "Seans Başlat" ön doldurma */
export interface SeansOnDoldurma {
  satir_id: string;
  personel_id: string;
  personel_adi: string | null;
  istasyon: TalimatIstasyon;
  sku: string | null;
  urun_adi: string | null;
  plaka_id: string | null;
  istenen_miktar: number | null;
  kalan: number | null;
  /** Seans başlarken gösterilecek not (boşsa hiçbir şey gösterilmez) */
  not_text: string | null;
}

/** Kesim satırı "Bitirdi" -> yeni kesim kaydı ön doldurma */
export interface KesimOnDoldurma {
  talimat_satir_id: string;
  personel_id: string;
  plaka_id: string | null;
  sku: string | null;
  /** Önerilen adet: kalan (yoksa istenen) */
  adet: number | null;
  not_text: string | null;
}
