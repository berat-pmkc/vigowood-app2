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
export type TalimatPasifKapsam = "satir" | "personel" | "liste" | "hat";
/** Hat türü: montaj hatları (Montaj 1/2/3, Döşeme) son montaj aşamasını, paketleme hattı paketlemeyi sayar */
export type HatTur = "montaj" | "paketleme";

/** talimat_hatlar */
export interface TalimatHat {
  hat_id: string;
  ad: string;
  tur: HatTur;
  sira: number;
  aktif: boolean;
  created_at: string;
}

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
  /** Yayınlanmamış silme/sıra değişikliği olan hatlar (hat_id) */
  degisen_hatlar?: string[];
  kaynak_plan_id: string | null;
  olusturan: string | null;
  created_at: string;
  updated_at: string;
  guncel_bitis: string | null;
  guncel_mi: boolean;
  satir_sayisi: number;
  degisen_satir_sayisi: number;
  personel_sayisi: number;
  /** ürünlü satırı olan hat sayısı (boş hat satırları sayılmaz) */
  hat_sayisi?: number;
}

/** talimat_satir_ilerleme (satır + üretim ilerlemesi) */
export interface TalimatSatir {
  satir_id: string;
  plan_id: string;
  /** Hat satırlarında NULL (eski personel bazlı satırlarda dolu) */
  personel_id: string | null;
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
  /** Satır kapanışı (talimat_satir_kapat): 'tamamlandi' | 'tamamlanmadi' */
  kapanis?: "tamamlandi" | "tamamlanmadi" | null;
  kapanis_neden?: string | null;
  kapanis_at?: string | null;
  kapatan?: string | null;
  // ── Hat bazlı model (SQL 160) ──
  /** Hat satırı: hattın id'si (eski personel satırlarında null) */
  hat_id?: string | null;
  hat_adi?: string | null;
  hat_tur?: HatTur | null;
  hat_sira?: number | null;
  hat_aktif?: boolean | null;
  /** Şu an açık (montajda/paketlemede, bekletilenler dahil) seans sayısı — yalnız hat satırları */
  acik_seans_sayisi?: number | null;
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
export interface TalimatYayinOnaylamayanHat {
  hat_id: string;
  hat_adi: string;
}

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
  /** Yalnız eski personel hedefleri (user_id) */
  onaylamayanlar: string[];
  /** Hat hedefleri: hedef hat sayısı ve yayını henüz onaylamayan hatlar */
  hat_sayisi?: number;
  onaylamayan_hatlar?: TalimatYayinOnaylamayanHat[];
}

export interface TalimatYayinHedefDetay {
  /** Hat hedefinde null */
  personel_id: string | null;
  personel_adi: string | null;
  /** Hat hedefinde dolu */
  hat_id?: string | null;
  hat_adi?: string | null;
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
    /** Hat bildirimlerinde yok (target_user NULL, payload.hat_id dolu) */
    personel_id?: string;
    /** Hat bildirimi (kind='talimat_degisiklik', hat bazlı yayın) */
    hat_id?: string;
    hat_adi?: string;
    hat_tur?: HatTur;
    personel_adi?: string;
    personel_istasyon?: string;
    satir_sayisi?: number;
    hatirlatma?: boolean;
    otomatik?: boolean;
    onaylamayanlar?: Array<{ personel_id?: string; hat_id?: string; ad: string }>;
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
  /** Yalnız bu hattın satırları (hat bazlı model) */
  hatId?: string;
  /** true: yalnız hat satırları (hat_id dolu) — eski personel satırlarını gizler */
  sadeceHat?: boolean;
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
  /** Hat satırı: hat_id (yeni satırda hat_id VEYA eski personel satırı için personel_id gerekli) */
  hat_id?: string | null;
  /** Eski personel satırları; hat satırında yok sayılır */
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
  /** satir: satir_id'ler; personel: user_id'ler; hat: hat_id'ler; liste: boş */
  ids?: string[];
  baslangic?: string | null;
  /** null = elle aktifleştirilene kadar */
  bitis?: string | null;
  neden?: string | null;
}

/** Montaj/paketleme "Seans Başlat" ön doldurma */
export interface SeansOnDoldurma {
  satir_id: string;
  /** Hat satırında null */
  personel_id: string | null;
  personel_adi: string | null;
  /** Hat satırı: seans bu hatta açılır (montaj_sessions/pack_events.hat_id) */
  hat_id: string | null;
  hat_adi: string | null;
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
  personel_id: string | null;
  plaka_id: string | null;
  sku: string | null;
  /** Önerilen adet: kalan (yoksa istenen) */
  adet: number | null;
  not_text: string | null;
}

// ─── Hat bazlı model (H1) ───────────────────────────────────────

/** Talimat satırına / hattına bağlı açık montaj-paketleme seansı (hat tableti) */
export interface TabletHatSeans {
  session_id: string;
  tur: "montaj" | "paketleme";
  /** Bağlandığı hat satırı (talimat_satir_id veya aynı hat+sku); bağlanmayan seanslarda null */
  satir_id: string | null;
  hat_id: string | null;
  sku: string | null;
  urun_adi: string | null;
  step_id: string | null;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean | null;
  start_time: string | null;
  /** 'montajda' | 'paketlemede' (bekletilen de açık sayılır; bekletme: duraklatma_baslangic dolu) */
  durum: string;
  operator_id: string | null;
  operator_name: string | null;
  workers: Array<{ id: string; name: string }> | null;
  duraklama_dk: number | null;
  duraklatma_baslangic: string | null;
  yardimci_sayisi: number | null;
  ek_seans: boolean;
}

/** Bugünün hat bazlı ek seansı (ek_seanslar görünümü) */
export interface TabletHatEkSeans {
  kaynak: "montaj" | "paketleme";
  session_id: string;
  personel_id: string | null;
  personel_adi: string | null;
  sku: string | null;
  urun_adi: string | null;
  step_name: string | null;
  qty: number;
  durum: "acik" | "beklemede" | "tamamlandi";
  start_time: string;
  end_time: string | null;
  net_sure_dk: number | null;
}

export interface TabletHatSatir extends TalimatSatir {
  /** Bu satıra bağlı AÇIK seanslar (talimat_satir_id veya aynı hat+sku) */
  acik_seanslar: TabletHatSeans[];
}

/** Tablet: tek hat bölümü */
export interface TalimatTabletHat {
  hat: TalimatHat;
  /** Hat bugün plan düzeyinde pasif (talimat_pasifler kapsam='hat'): satırlar gösterilmez */
  pasif: boolean;
  /** Ürünlü, pasif olmayan, tamamlanmamış satırlar (sıra) */
  aktif: TabletHatSatir[];
  /** Tamamlananlar (etkin_durum='tamamlandi'), sıra */
  tamamlanan: TabletHatSatir[];
  /** Hattın hiçbir satırına bağlanmayan açık seansları (talimat dışı / ek seans) */
  diger_acik_seanslar: TabletHatSeans[];
  /** Bugünün ek seansları (açık + tamamlanan) */
  ek_seanslar: TabletHatEkSeans[];
  /** Bu hat için henüz onaylanmamış bildirimli yayınlar (en yeni önce) -> talimatOnaylaHat(bekleyen[0], hat_id) */
  bekleyen_yayin_idler: string[];
}

/** Tablet "İş Talimatları": hat bölümleri (aktif hatlar, hat sırasıyla) */
export interface TalimatTabletHatListe {
  plan: TalimatPlan | null;
  guncel: { guncel_mi: boolean; bitis: string | null };
  hatlar: TalimatTabletHat[];
}

/** Planlayıcı: hat grubu (Mavi Yaka) — satırlar hat içi sırayla */
export interface TalimatPlanHatGrubu {
  hat: TalimatHat;
  satirlar: TalimatSatir[];
  /** Hat bugün için plan düzeyinde pasif mi (talimat_pasifler kapsam='hat') */
  pasif: boolean;
}

// ─── Zamanlı pasif / aktif işlemleri (SQL 164) ──────────────────

export type ZamanliYayin = "yok" | "bildirimsiz" | "bildirimli";

export interface ZamanliIslem {
  islem_id: string;
  plan_id: string;
  kapsam: "satir" | "hat" | "liste";
  ids: string[];
  islem: "pasif" | "aktif";
  /** ISO zaman damgası */
  calisma_zamani: string;
  hedef_sira: number | null;
  pasif_neden: string | null;
  pasif_bitis: string | null;
  yayin: ZamanliYayin;
  sesli: boolean;
  durum: "bekliyor" | "yapildi" | "iptal" | "hata";
  hata: string | null;
  created_at: string;
}

export interface ZamanliIslemGirdi {
  planId: string;
  kapsam: "satir" | "hat" | "liste";
  ids?: string[];
  islem: "pasif" | "aktif";
  /** YYYY-MM-DD (İstanbul); boş = hemen */
  tarih?: string | null;
  /** HH:MM (İstanbul) */
  saat?: string | null;
  /** aktif satır: hattın aktif satırları arasındaki görünen konum; boş = aktiflerin sonu */
  hedefSira?: number | null;
  neden?: string | null;
  bitis?: string | null;
  yayin?: ZamanliYayin;
  sesli?: boolean;
}
