// VigoWood Platform Constants

export const APP_NAME = "VigoWood";
export const APP_DESCRIPTION = "Ahşap mobilya entegre iş yönetim platformu";

// Color palette — matches globals.css and CLAUDE.md
export const COLORS = {
  // Natural Color (Ana Tema)
  primary: "#cdbd9d",
  light: "#f0ede1",
  side: "#a99c7d",
  deep: "#5e5747",
  dark: "#474237",

  // Functional Color
  success: "#70c1aa",
  warning: "#f28a19",
  error: "#ee7683",
  info: "#3368b1",

  // Recycle Color (Üretim durumları)
  recycle1: "#e3ecd2",
  recycle2: "#b1d286",
  recycle3: "#8d9d70",
  recycle4: "#3caa35",

  // Ekstra
  deepNavy: "#0c1c2d",
  hotWalnuts: "#6f4c37",
  iceBlue: "#adb5be",
  black: "#000000",
} as const;

// User roles
export const USER_ROLES = [
  "Yönetici",
  "Endüstri Mühendisi",
  "E-Ticaret Müdürü",
  "Dış Ticaret Müdürü",
  "Üretim",
  "Hat",
  "Muhasebe",
  "Sevkiyat Sorumlusu",
  "Pazaryeri Sorumlusu",
  "Mimar",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

// Production flow stages
export const PRODUCTION_STAGES = [
  "Kesim",
  "Temizlik",
  "Montaj",
  "Paketleme",
  "Sevkiyat",
] as const;

export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

// Shared station accounts
export const STATION_EMAILS = [
  "kesim@vigowood.com",
  "temizlik@vigowood.com",
  "montaj@vigowood.com",
  "montaj2@vigowood.com",
  "montaj3@vigowood.com",
  "paketleme@vigowood.com",
  "kutu@vigowood.com",
] as const;

// Part types (matches part_type enum in DB)
export const PART_TYPES = [
  "YARIMAMUL",
  "HAZIR",
  "KUTU",
  "KARTON",
] as const;

export type PartType = (typeof PART_TYPES)[number];

export const PART_TYPE_LABELS: Record<PartType, string> = {
  YARIMAMUL: "Yarı Mamül",
  HAZIR: "Hazır Eleman",
  KUTU: "Kutu",
  KARTON: "Karton",
};

// Plaka kategorileri
export const PLAKA_KATEGORILERI = ["MDF", "KARTON"] as const;
export type PlakaKategori = (typeof PLAKA_KATEGORILERI)[number];

// Product categories (matches product_category enum in DB)
export const PRODUCT_CATEGORIES = [
  "AT EVİ",
  "TELEFON STANDI",
  "KİTAP OKUMA STANDI",
  "BASAMAK",
  "LAPTOP SEHPASI",
  "KABAK LİFİ",
  "KİTAPLIK",
  "MİNDER",
  "ORGANİZER",
  "TABLO",
] as const;

// Kesim makinesi IDs (matches kesim_makinesi table)
export const MAKINE_IDS = ["MAK-1", "MAK-2", "MAK-3", "KUTU"] as const;

export type MakineId = (typeof MAKINE_IDS)[number];

export const MAKINE_LABELS: Record<MakineId, string> = {
  "MAK-1": "300W Lazer",
  "MAK-2": "600W Lazer",
  "MAK-3": "600W Yeni Lazer",
  KUTU: "Kutu (BALA)",
};

// Sadece kesim bölümü makineleri (Kutu hariç)
export const KESIM_MAKINE_IDS = ["MAK-1", "MAK-2", "MAK-3"] as const;
export type KesimMakineId = (typeof KESIM_MAKINE_IDS)[number];

// Makine bölümleri
export const MAKINE_BOLUMLERI = ["Kesim", "Kutu-Koli"] as const;
export type MakineBolum = (typeof MAKINE_BOLUMLERI)[number];

export const MAKINE_BOLUM_LABELS: Record<MakineBolum, string> = {
  Kesim: "Kesim",
  "Kutu-Koli": "Kutu-Koli",
};

export const MAKINE_BOLUM_COLORS: Record<MakineBolum, { bg: string; text: string }> = {
  Kesim: { bg: "bg-blue-100", text: "text-blue-800" },
  "Kutu-Koli": { bg: "bg-amber-100", text: "text-amber-800" },
};

// Kesim durum sabitleri
export const CUT_STATUS = ["bekliyor", "kesiliyor", "tamamlandi"] as const;
export type CutStatus = (typeof CUT_STATUS)[number];

export const CUT_STATUS_LABELS: Record<CutStatus, string> = {
  bekliyor: "Bekliyor",
  kesiliyor: "Kesiliyor",
  tamamlandi: "Tamamlandı",
};

export const CUT_STATUS_COLORS: Record<CutStatus, { bg: string; text: string; border: string }> = {
  bekliyor: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  kesiliyor: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  tamamlandi: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
};

// Kesim kartı sol kenar renkleri
export const CUT_STATUS_BORDER_COLORS: Record<CutStatus, string> = {
  bekliyor: "border-l-amber-400",
  kesiliyor: "border-l-blue-500",
  tamamlandi: "border-l-emerald-500",
};

// Temizlik durum sabitleri
export const CLEAN_STATUS = ["bekliyor", "temizleniyor", "tamamlandi"] as const;
export type CleanStatus = (typeof CLEAN_STATUS)[number];

export const CLEAN_STATUS_LABELS: Record<CleanStatus, string> = {
  bekliyor: "Bekliyor",
  temizleniyor: "Temizleniyor",
  tamamlandi: "Tamamlandı",
};

export const CLEAN_STATUS_COLORS: Record<CleanStatus, { bg: string; text: string; border: string }> = {
  bekliyor: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  temizleniyor: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  tamamlandi: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
};

export const CLEAN_STATUS_BORDER_COLORS: Record<CleanStatus, string> = {
  bekliyor: "border-l-amber-400",
  temizleniyor: "border-l-blue-500",
  tamamlandi: "border-l-emerald-500",
};

// Montaj durum sabitleri
export const MONTAJ_STATUS = ["bekliyor", "montajda", "tamamlandi"] as const;
export type MontajStatus = (typeof MONTAJ_STATUS)[number];

export const MONTAJ_STATUS_LABELS: Record<MontajStatus, string> = {
  bekliyor: "Bekliyor",
  montajda: "Montajda",
  tamamlandi: "Tamamlandı",
};

export const MONTAJ_STATUS_COLORS: Record<MontajStatus, { bg: string; text: string; border: string }> = {
  bekliyor: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  montajda: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  tamamlandi: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
};

export const MONTAJ_STATUS_BORDER_COLORS: Record<MontajStatus, string> = {
  bekliyor: "border-l-amber-400",
  montajda: "border-l-blue-500",
  tamamlandi: "border-l-emerald-500",
};

// Montaj Seans durum sabitleri (yeni seans bazlı sistem)
export const MONTAJ_SESSION_STATUS = ["montajda", "tamamlandi"] as const;
export type MontajSessionStatus = (typeof MONTAJ_SESSION_STATUS)[number];

export const MONTAJ_SESSION_STATUS_LABELS: Record<MontajSessionStatus, string> = {
  montajda: "Montajda",
  tamamlandi: "Tamamlandı",
};

export const MONTAJ_SESSION_STATUS_COLORS: Record<MontajSessionStatus, { bg: string; text: string; border: string }> = {
  montajda: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  tamamlandi: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
};

export const MONTAJ_SESSION_BORDER_COLORS: Record<MontajSessionStatus, string> = {
  montajda: "border-l-blue-500",
  tamamlandi: "border-l-emerald-500",
};

// Paketleme durum sabitleri
export const PACK_STATUS = ["bekliyor", "paketlemede", "tamamlandi"] as const;
export type PackStatus = (typeof PACK_STATUS)[number];

export const PACK_STATUS_LABELS: Record<PackStatus, string> = {
  bekliyor: "Bekliyor",
  paketlemede: "Paketlemede",
  tamamlandi: "Tamamlandı",
};

export const PACK_STATUS_COLORS: Record<PackStatus, { bg: string; text: string; border: string }> = {
  bekliyor: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  paketlemede: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  tamamlandi: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
};

export const PACK_STATUS_BORDER_COLORS: Record<PackStatus, string> = {
  bekliyor: "border-l-amber-400",
  paketlemede: "border-l-blue-500",
  tamamlandi: "border-l-emerald-500",
};

// Kutu-Koli durum sabitleri
export const KUTU_STATUS = ["bekliyor", "uretimde", "tamamlandi"] as const;
export type KutuStatus = (typeof KUTU_STATUS)[number];

export const KUTU_STATUS_LABELS: Record<KutuStatus, string> = {
  bekliyor: "Bekliyor",
  uretimde: "Üretimde",
  tamamlandi: "Tamamlandı",
};

export const KUTU_STATUS_COLORS: Record<KutuStatus, { bg: string; text: string; border: string }> = {
  bekliyor: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  uretimde: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  tamamlandi: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
};

export const KUTU_STATUS_BORDER_COLORS: Record<KutuStatus, string> = {
  bekliyor: "border-l-amber-400",
  uretimde: "border-l-blue-500",
  tamamlandi: "border-l-emerald-500",
};

// Hazır Eleman parça tipleri (HAZIR + KUTU + KARTON)
export const HAZIR_ELEMAN_PART_TYPES: PartType[] = ["HAZIR", "KUTU", "KARTON"];

// İade durumları
export const IADE_DURUM = ["Kullanilabilir", "Kullanilamaz"] as const;
export type IadeDurum = (typeof IADE_DURUM)[number];

export const IADE_DURUM_LABELS: Record<IadeDurum, string> = {
  Kullanilabilir: "Kullanılabilir",
  Kullanilamaz: "Kullanılamaz",
};

export const IADE_DURUM_COLORS: Record<IadeDurum, { bg: string; text: string }> = {
  Kullanilabilir: { bg: "bg-emerald-100", text: "text-emerald-800" },
  Kullanilamaz: { bg: "bg-red-100", text: "text-red-800" },
};

// Stok erişim rolleri
export const STOCK_ACCESS_ROLES: UserRole[] = [
  "Yönetici",
  "Endüstri Mühendisi",
  "E-Ticaret Müdürü",
  "Dış Ticaret Müdürü",
  "Muhasebe",
];

// Üretim erişim rolleri
export const PRODUCTION_ACCESS_ROLES: UserRole[] = [
  "Yönetici",
  "Endüstri Mühendisi",
  "Hat",
  "Üretim",
];

// Sevkiyat durum sabitleri
export const SEVKIYAT_STATUS = ["bekliyor", "hazirlaniyor", "yolda", "teslim_edildi", "iptal_edildi"] as const;
export type SevkiyatStatus = (typeof SEVKIYAT_STATUS)[number];

export const SEVKIYAT_STATUS_LABELS: Record<SevkiyatStatus, string> = {
  bekliyor: "Bekliyor",
  hazirlaniyor: "Hazırlanıyor",
  yolda: "Yolda",
  teslim_edildi: "Teslim Edildi",
  iptal_edildi: "İptal Edildi",
};

export const SEVKIYAT_STATUS_COLORS: Record<SevkiyatStatus, { bg: string; text: string; border: string }> = {
  bekliyor: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  hazirlaniyor: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  yolda: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-300" },
  teslim_edildi: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
  iptal_edildi: { bg: "bg-red-50", text: "text-red-700", border: "border-red-300" },
};

export const SEVKIYAT_STATUS_BORDER_COLORS: Record<SevkiyatStatus, string> = {
  bekliyor: "border-l-amber-400",
  hazirlaniyor: "border-l-blue-500",
  yolda: "border-l-purple-500",
  teslim_edildi: "border-l-emerald-500",
  iptal_edildi: "border-l-red-500",
};

// Sevkiyat erişim rolleri
export const SEVKIYAT_ACCESS_ROLES: UserRole[] = [
  "Yönetici",
  "Endüstri Mühendisi",
  "Sevkiyat Sorumlusu",
  "E-Ticaret Müdürü",
  "Dış Ticaret Müdürü",
];

// Sevkiyat maliyet görüntüleme rolleri (sadece admin/mühendis)
export const SEVKIYAT_COST_ROLES: UserRole[] = [
  "Yönetici",
  "Endüstri Mühendisi",
];

/** @deprecated DB'den okunuyor (app_settings.sevkiyat_ulkeler). Fallback olarak kalıyor. */
export const SEVKIYAT_COUNTRIES = {
  DE: {
    code: "DE",
    name: "Almanya",
    nameEN: "Germany",
    currency: "EUR",
    currencySymbol: "\u20ac",
    port: "Muratbey",
    buyer: "HAS-MOB ORMAN URUNLERI SAN. VE TIC. LTD. STI.",
  },
  UK: {
    code: "UK",
    name: "\u0130ngiltere",
    nameEN: "United Kingdom",
    currency: "GBP",
    currencySymbol: "\u00a3",
    port: "Gemlik",
    buyer: "HAS-MOB ORMAN URUNLERI SAN. VE TIC. LTD. STI.",
  },
  USA: {
    code: "USA",
    name: "Amerika",
    nameEN: "United States",
    currency: "USD",
    currencySymbol: "$",
    port: "Gemlik",
    buyer: "HAS-MOB ORMAN URUNLERI SAN. VE TIC. LTD. STI.",
  },
} as const;

export type SevkiyatCountryCode = keyof typeof SEVKIYAT_COUNTRIES;

/** @deprecated DB'den okunuyor (app_settings.sevkiyat_ulkeler). Fallback olarak kalıyor. */
export const SEVKIYAT_COUNTRY_CODES = ["DE", "UK", "USA"] as const;

/** @deprecated DB'den okunuyor (app_settings.sevkiyat_palet_ayarlari). Fallback olarak kalıyor. */
export const PALET_BOYUTLARI = ["80x120", "100x120"] as const;
/** @deprecated DB'den okunuyor (app_settings.sevkiyat_palet_ayarlari). Fallback olarak kalıyor. */
export const PALET_WEIGHT_KG = 15;

/** @deprecated DB'den okunuyor (app_settings.sevkiyat_konteyner_tipleri). Fallback olarak kalıyor. */
export const KONTEYNER_TYPES = ["20ft", "40ft", "40ft HC"] as const;
export type KonteynerType = (typeof KONTEYNER_TYPES)[number];

/** @deprecated DB'den okunuyor (app_settings.sevkiyat_konteyner_tipleri). Fallback olarak kalıyor. */
export const KONTEYNER_TYPE_LABELS: Record<KonteynerType, string> = {
  "20ft": "20' Konteyner",
  "40ft": "40' Konteyner",
  "40ft HC": "40' HC Konteyner",
};

/** @deprecated DB'den okunuyor (app_settings.sevkiyat_arac_tipleri). Fallback olarak kalıyor. */
export const ARAC_TIPLERI = { konteyner: "Konteyner", tir: "Tır" } as const;
export type AracTipi = keyof typeof ARAC_TIPLERI;

/** @deprecated DB'den okunuyor (app_settings.sevkiyat_maliyet_ayarlari). Fallback olarak kalıyor. */
export const MALIYET_PARA_BIRIMLERI = ["USD", "EUR", "GBP", "TRY"] as const;
export type MaliyetParaBirimi = (typeof MALIYET_PARA_BIRIMLERI)[number];

/** @deprecated DB'den okunuyor (app_settings.sevkiyat_firma_tipleri). Fallback olarak kalıyor. */
export const FIRMA_TIPLERI = ["ihracatci", "alici", "banka", "imzalayan", "contact"] as const;
export type FirmaTipi = (typeof FIRMA_TIPLERI)[number];
/** @deprecated DB'den okunuyor (app_settings.sevkiyat_firma_tipleri). Fallback olarak kalıyor. */
export const FIRMA_TIPI_LABELS: Record<FirmaTipi, string> = {
  ihracatci: "İhracatçı",
  alici: "Alıcı",
  banka: "Banka",
  imzalayan: "İmzalayan",
  contact: "İletişim",
};

// ─── Satış Sabitleri ──────────────────────────────────────────
// @deprecated DB'den okunuyor (app_settings), fallback olarak kalıyor

/** @deprecated DB'den okunuyor (app_settings.satis_kanallari). Fallback olarak kalıyor. */
export const SALES_CHANNELS = [
  "TRENDYOL",
  "VIGOWOOD",
  "HEPSIBURADA",
  "AMAZON",
  "HAS-DE",
  "HAS-UK",
  "HAS-ABD",
  "N11",
  "TEMU",
  "PAZARAMA",
  "ÇİÇEKSEPETİ",
  "ETSY",
  "TOPTAN",
  "DIGER",
  "MAĞAZA",
  "FUAR",
] as const;

export type SalesChannel = (typeof SALES_CHANNELS)[number];

/** @deprecated DB'den okunuyor (app_settings.satis_kanallari). Fallback olarak kalıyor. */
export const SALES_CHANNEL_LABELS: Record<string, string> = {
  TRENDYOL: "Trendyol",
  VIGOWOOD: "VigoWood",
  HEPSIBURADA: "Hepsiburada",
  AMAZON: "Amazon",
  "HAS-DE": "HAS Almanya",
  "HAS-UK": "HAS İngiltere",
  "HAS-ABD": "HAS Amerika",
  N11: "N11",
  TEMU: "Temu",
  PAZARAMA: "Pazarama",
  ÇİÇEKSEPETİ: "Çiçek Sepeti",
  ETSY: "Etsy",
  TOPTAN: "Toptan",
  DIGER: "Diğer",
  MAĞAZA: "Mağaza",
  FUAR: "Fuar",
};

/** @deprecated DB'den okunuyor (app_settings.satis_kanallari ihracat flag). Fallback olarak kalıyor. */
export const EXPORT_CHANNELS = ["HAS-DE", "HAS-UK", "HAS-ABD"] as const;

/** @deprecated DB'den okunuyor (app_settings.hizmet_skulari). Fallback olarak kalıyor. */
export const SERVICE_SKUS = [
  "KARGO",
  "HIZMET",
  "YEDEK PARCA",
  "TS-M",
  "FIYAT FARKI",
  "DIS KUTU",
  "KOLI",
  "KUTU",
  "MONTAJ",
  "AMBALAJ",
] as const;

/** @deprecated DB'den okunuyor. isExportChannelFromSettings kullanın. Fallback olarak kalıyor. */
export function isExportChannel(channel: string): boolean {
  return channel.startsWith("HAS-");
}

/** @deprecated DB'den okunuyor. isServiceSkuFromSettings kullanın. Fallback olarak kalıyor. */
export function isServiceSku(sku: string): boolean {
  if (!sku) return false;
  const upper = sku.toUpperCase().trim();
  return SERVICE_SKUS.some((s) => upper === s || upper.startsWith(s + " "));
}

/** Satış erişim rolleri */
export const SATIS_ACCESS_ROLES: UserRole[] = [
  "Yönetici",
  "Endüstri Mühendisi",
  "E-Ticaret Müdürü",
  "Dış Ticaret Müdürü",
  "Muhasebe",
  "Pazaryeri Sorumlusu",
  "Mimar",
  "Sevkiyat Sorumlusu",
];

/** @deprecated DB'den okunuyor (app_settings.pazaryeri_secenekleri). Fallback olarak kalıyor. */
export const PAZARYERI_OPTIONS = [
  "vigowood.com",
  "Trendyol",
  "Hepsiburada",
  "Amazon",
  "N11",
  "Temu",
  "Pazarama",
  "Çiçek Sepeti",
  "Etsy",
] as const;

// ─── Muhasebe & Finans Sabitleri ────────────────────────────

/** Muhasebe erişim rolleri (Yönetici + Muhasebe + E-Ticaret Müdürü) */
export const FINANCE_ROLES: UserRole[] = [
  "Yönetici",
  "Muhasebe",
  "E-Ticaret Müdürü",
];

/** Ödeme türleri */
export const ODEME_TURLERI = [
  "PİYASA", "KREDİ", "KREDİ KARTI", "MAAŞ", "FAİZ",
  "SGK", "VERGİ", "HAMMADDE", "PERSONEL", "ELEKTRİK",
  "BANKA", "GENEL", "DİĞER",
] as const;

export type OdemeTuruConst = (typeof ODEME_TURLERI)[number];

export const ODEME_TURU_LABELS: Record<OdemeTuruConst, string> = {
  PİYASA: "Piyasa",
  KREDİ: "Kredi",
  "KREDİ KARTI": "Kredi Kartı",
  MAAŞ: "Maaş",
  FAİZ: "Faiz",
  SGK: "SGK",
  VERGİ: "Vergi",
  HAMMADDE: "Hammadde",
  PERSONEL: "Personel",
  ELEKTRİK: "Elektrik",
  BANKA: "Banka",
  GENEL: "Genel",
  DİĞER: "Diğer",
};

/** Ödeme kategori renkleri (CLAUDE.md'den) */
export const ODEME_TURU_COLORS: Record<OdemeTuruConst, { bg: string; text: string }> = {
  PİYASA: { bg: "#e8eaf6", text: "#283593" },
  KREDİ: { bg: "#fce4ec", text: "#b71c1c" },
  "KREDİ KARTI": { bg: "#fff3e0", text: "#e65100" },
  MAAŞ: { bg: "#e0f2f1", text: "#00695c" },
  FAİZ: { bg: "#fbe9e7", text: "#d84315" },
  SGK: { bg: "#f3e5f5", text: "#7b1fa2" },
  VERGİ: { bg: "#ffebee", text: "#c62828" },
  HAMMADDE: { bg: "#e1f5fe", text: "#0277bd" },
  PERSONEL: { bg: "#e8f5e9", text: "#2e7d32" },
  ELEKTRİK: { bg: "#fff9c4", text: "#f57f17" },
  BANKA: { bg: "#efebe9", text: "#4e342e" },
  GENEL: { bg: "#eceff1", text: "#546e7a" },
  DİĞER: { bg: "#f5f5f5", text: "#616161" },
};

/** Ödeme durumları */
export const ODEME_DURUMLARI = ["TAMAMLANDI", "BEKLİYOR"] as const;
export type OdemeDurumuConst = (typeof ODEME_DURUMLARI)[number];

export const ODEME_DURUM_COLORS: Record<OdemeDurumuConst, { bg: string; text: string }> = {
  TAMAMLANDI: { bg: "bg-emerald-100", text: "text-emerald-800" },
  BEKLİYOR: { bg: "bg-amber-100", text: "text-amber-800" },
};

/** Para birimleri */
export const PARA_BIRIMLERI = ["TL", "USD", "EUR"] as const;

/** Maliyet kategorileri (12 adet) */
export const MALIYET_KATEGORILERI = [
  "Personel & SGK Giderleri",
  "Üretim & Hammadde Giderleri",
  "Operasyon & Bakım Giderleri",
  "Enerji Giderleri",
  "Satış Giderleri",
  "Pazarlama Giderleri",
  "Vergi Giderleri",
  "Nakliye Giderleri",
  "Genel Yönetim Giderleri",
  "Faiz ve Komisyon Giderleri",
  "Faaliyet Dışı Giderler",
  "Yatırım Giderleri",
] as const;

// ─── Faaliyet Hesapları Sabitleri ────────────────────────────

/** Faaliyet markalar */
export const FAALIYET_MARKALAR = ["VIGO WOOD", "HAS-MOB"] as const;

/** Faaliyet kanalları */
export const FAALIYET_KANALLARI = ["YURTİÇİ", "İHRACAT"] as const;

/** Faaliyet türleri */
export const FAALIYET_TURLERI = ["FAALIYET", "FAALIYET_DISI"] as const;

/** Maliyet grupları */
export const MALIYET_GRUPLARI = ["VIGO_WOOD", "HAS_MOB", "ORTAK"] as const;

/** Ay etikletleri (Türkçe) */
export const AY_LABELS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
] as const;

/** Kalem türü → P&L satır tipi */
export const KALEM_TURLERI = [
  "GELIR", "GIDER", "TOPLAM", "KAR", "MARJ", "FD_GELIR", "FD_GIDER",
] as const;

/** Maliyet kategorileri → faaliyet türü mapping (ilk 9 FAALIYET, son 3 FAALIYET_DISI) */
export const MALIYET_KATEGORI_TURLERI: Record<string, "FAALIYET" | "FAALIYET_DISI"> = {
  "Personel & SGK Giderleri": "FAALIYET",
  "Üretim & Hammadde Giderleri": "FAALIYET",
  "Operasyon & Bakım Giderleri": "FAALIYET",
  "Enerji Giderleri": "FAALIYET",
  "Satış Giderleri": "FAALIYET",
  "Pazarlama Giderleri": "FAALIYET",
  "Vergi Giderleri": "FAALIYET",
  "Nakliye Giderleri": "FAALIYET",
  "Genel Yönetim Giderleri": "FAALIYET",
  "Faiz ve Komisyon Giderleri": "FAALIYET_DISI",
  "Faaliyet Dışı Giderler": "FAALIYET_DISI",
  "Yatırım Giderleri": "FAALIYET_DISI",
};

/** Nakit giriş kanalları (TL) */
export const NAKIT_GIRIS_KANALLARI_TL = [
  "vigowood.com", "Trendyol", "Hepsiburada", "Amazon",
  "Diğer Pazaryeri", "HAS-MOB", "Döviz Satışı", "Nakit Kredi",
] as const;

/** Nakit giriş kanalları (USD) */
export const NAKIT_GIRIS_KANALLARI_USD = [
  "Amazon Y.Dışı", "Diğer Y.Dışı",
] as const;

/** DB kolon → Türkçe etiket map'leri (nakit_girisler tablosu) */
export const NAKIT_GIRIS_LABELS: Record<string, string> = {
  vigowood_com: "vigowood.com",
  trendyol: "Trendyol",
  hepsiburada: "Hepsiburada",
  amazon: "Amazon",
  diger_pazaryeri: "Diğer Pazaryeri",
  has_mob: "HAS-MOB",
  doviz_satisi: "Döviz Satışı",
  nakit_kredi: "Nakit Kredi",
  toplam_tl: "TOPLAM TL",
  amazon_yurtdisi: "Amazon Y.Dışı ($)",
  diger_yurtdisi: "Diğer Y.Dışı ($)",
  toplam_yurtdisi: "Toplam Y.Dışı ($)",
};

/** TL giriş kolon isimleri (toplam hariç) */
export const NAKIT_GIRIS_TL_KOLONLAR = [
  "vigowood_com", "trendyol", "hepsiburada", "amazon",
  "diger_pazaryeri", "has_mob", "doviz_satisi", "nakit_kredi",
] as const;

/** USD giriş kolon isimleri (toplam hariç) */
export const NAKIT_GIRIS_USD_KOLONLAR = [
  "amazon_yurtdisi", "diger_yurtdisi",
] as const;

/** DB kolon → Türkçe etiket map'leri (nakit_cikislar TL) */
export const NAKIT_CIKIS_TL_LABELS: Record<string, string> = {
  maas: "Maaş",
  sgk: "SGK",
  hammadde: "Hammadde",
  akaryakit: "Akaryakıt",
  arac_bakim: "Araç Bakım",
  demirbas: "Demirbaş",
  elektrik: "Elektrik",
  su: "Su",
  pazaryeri: "Pazaryeri",
  telekom: "Telekom",
  makine_bakim: "Makine Bakım",
  nakliye: "Nakliye",
  vergi: "Vergi",
  mutfak: "Mutfak",
  hukuk: "Hukuk",
  muhasebe: "Muhasebe",
  kredi_karti: "Kredi Kartı",
  kredi_odemesi: "Kredi Ödemesi",
  masraf_komisyon: "Masraf/Komisyon",
  diger_giderler: "Diğer",
  faaliyet_disi_harcamalar: "Faaliyet Dışı",
  toplam_tl: "TOPLAM TL",
};

/** TL çıkış kolon isimleri (toplam hariç) */
export const NAKIT_CIKIS_TL_KOLONLAR = [
  "maas", "sgk", "hammadde", "akaryakit", "arac_bakim", "demirbas",
  "elektrik", "su", "pazaryeri", "telekom", "makine_bakim", "nakliye",
  "vergi", "mutfak", "hukuk", "muhasebe", "kredi_karti", "kredi_odemesi",
  "masraf_komisyon", "diger_giderler", "faaliyet_disi_harcamalar",
] as const;

/** DB kolon → Türkçe etiket map'leri (nakit_cikislar USD) */
export const NAKIT_CIKIS_USD_LABELS: Record<string, string> = {
  gumruk_usd: "Gümrük ($)",
  navlun_usd: "Navlun ($)",
  diger_usd: "Diğer ($)",
  doviz_bozdurma_usd: "Döviz Bozdurma ($)",
  toplam_yurtdisi_usd: "Toplam Y.Dışı ($)",
};

/** USD çıkış kolon isimleri (toplam hariç) */
export const NAKIT_CIKIS_USD_KOLONLAR = [
  "gumruk_usd", "navlun_usd", "diger_usd", "doviz_bozdurma_usd",
] as const;

// ─── Personel & Yoklama Sabitleri ────────────────────────────

/** Yoklama departmanları */
export const ATTENDANCE_DEPARTMENTS = [
  "Kesim",
  "Temizlik",
  "Montaj",
  "Paketleme",
  "Paketleme Hatti",
] as const;

export type AttendanceDepartment = (typeof ATTENDANCE_DEPARTMENTS)[number];

export const ATTENDANCE_DEPARTMENT_LABELS: Record<AttendanceDepartment, string> = {
  Kesim: "Kesim",
  Temizlik: "Temizlik",
  Montaj: "Montaj",
  Paketleme: "Paketleme",
  "Paketleme Hatti": "Paketleme Hattı",
};

export const ATTENDANCE_DEPARTMENT_COLORS: Record<AttendanceDepartment, { bg: string; text: string }> = {
  Kesim: { bg: "bg-blue-100", text: "text-blue-800" },
  Temizlik: { bg: "bg-emerald-100", text: "text-emerald-800" },
  Montaj: { bg: "bg-purple-100", text: "text-purple-800" },
  Paketleme: { bg: "bg-amber-100", text: "text-amber-800" },
  "Paketleme Hatti": { bg: "bg-orange-100", text: "text-orange-800" },
};

/** Personel erişim rolleri (Yönetici + Endüstri Mühendisi + Müdürler + Hat) */
export const PERSONEL_ACCESS_ROLES: UserRole[] = [
  "Yönetici",
  "Endüstri Mühendisi",
  "E-Ticaret Müdürü",
  "Dış Ticaret Müdürü",
  "Hat",
];

// Kullanıcı istasyonları (matches station enum in DB)
export const USER_STATIONS = [
  "Yönetim", "Ofis", "Kesim", "Temizlik", "Montaj", "Paketleme", "Kutu",
  "Kesim Hattı", "Temilik Hattı", "Montaj Hattı", "Paketleme Hattı", "Kutu Hattı",
] as const;

export type UserStation = (typeof USER_STATIONS)[number];

export const USER_STATION_LABELS: Record<UserStation, string> = {
  "Yönetim": "Yönetim",
  "Ofis": "Ofis",
  "Kesim": "Kesim",
  "Temizlik": "Temizlik",
  "Montaj": "Montaj",
  "Paketleme": "Paketleme",
  "Kutu": "Kutu",
  "Kesim Hattı": "Kesim Hattı",
  "Temilik Hattı": "Temizlik Hattı",
  "Montaj Hattı": "Montaj Hattı",
  "Paketleme Hattı": "Paketleme Hattı",
  "Kutu Hattı": "Kutu Hattı",
};

/** Check if an email belongs to a shared station account */
export function isStationEmail(email: string | undefined): boolean {
  if (!email) return false;
  return STATION_EMAILS.includes(email as (typeof STATION_EMAILS)[number]);
}

// ─── Kritik Stok Hesaplama Sabitleri ───────────────────────────
export const KRITIK_STOK_DEFAULT_GUN = 30;
export const KRITIK_STOK_DEFAULT_LOOKBACK_DAYS = 90;

// ─── Proforma Fatura Konfigürasyonu ────────────────────────────
/** @deprecated DB'den okunacak (sevkiyat_firmalar). Fallback olarak kalıyor. */

export const PROFORMA_CONFIG = {
  EXPORTER: {
    companyName: "HAS-MOB ORMAN ÜRÜNLERİ MOBİLYA SANAYİ VE TİCARET LİMİTED SİRKETİ",
    taxInfo: "Vergi No: TR4580342463 / Unye",
    address: "ÇATALPINAR MH. MERKEZ MÜCAVİR SK. NO:5 ÜNYE, ORDU",
    phone: "+90 452 324 7878",
    email: "info@hasmob.com.tr",
    web: "hasmob.com.tr",
  },
  BUYER_CONTACT: {
    phone: "+90 544 774 01 01",
    email: "sinan@vigowood.com",
    contact: "Sinan Colakoglu",
  },
  BANK_BY_COUNTRY: {
    DE: {
      beneficiary: "HAS-MOB ORMAN URUNLERI MOBILYA SANAYI TICARET LIMITED SIRKETI",
      bankName: "VAKIFBANK",
      branchName: "UNYE",
      swiftCode: "TVBATR2AXXX",
      currencyLabel: "EUR",
      iban: "TR780001500158048020763636",
    },
    UK: {
      beneficiary: "HAS-MOB ORMAN URUNLERI MOBILYA SANAYI TICARET LIMITED SIRKETI",
      bankName: "VAKIFBANK",
      branchName: "UNYE",
      swiftCode: "TVBATR2AXXX",
      currencyLabel: "GBP",
      iban: "TR950001500158048023394261",
    },
    USA: {
      beneficiary: "HAS-MOB ORMAN URUNLERI MOBILYA SANAYI TICARET LIMITED SIRKETI",
      bankName: "HALKBANK",
      branchName: "UNYE",
      swiftCode: "TVBATR2AXXX",
      currencyLabel: "USD",
      iban: "TR180001500158048023593333",
    },
  } as Record<string, { beneficiary: string; bankName: string; branchName: string; swiftCode: string; currencyLabel: string; iban: string }>,
  COUNTRY_FORMAT: {
    DE: { currencySymbol: "€", position: "after" as const, decimal: ",", thousand: "." },
    UK: { currencySymbol: "£", position: "before" as const, decimal: ".", thousand: "," },
    USA: { currencySymbol: "$", position: "before" as const, decimal: ".", thousand: "," },
  } as Record<string, { currencySymbol: string; position: "before" | "after"; decimal: string; thousand: string }>,
} as const;

// ─── Paket Listesi (Packing List) Konfigürasyonu ─────────────
/** @deprecated DB'den okunacak (sevkiyat_firmalar). Fallback olarak kalıyor. */

export const PACKING_LIST_CONFIG = {
  EXPORTER: {
    companyName: "HAS-MOB ORMAN ÜRÜNLERİ MOBİLYA SAN.TİC.LTD.ŞTİ",
    address1: "Çatalpınar Mah. Merkez Mücavir Sok. No: 5",
    address2: "52300 Ünye/Ordu VN: TR4580342463 / Unye",
    phone: "+90 (452) 324 78 78",
  },
  SIGNATORY: {
    placeOfIssue: "Ünye / Ordu",
    company: "HAS-MOB ORMAN ÜRÜNLERİ MOBİLYA SAN.TİC.LTD.ŞTİ",
    authorizedName: "HASAN ÇOLAKOĞLU",
  },
  CONTACT: {
    name: "Sinan Çolakoğlu",
    phone: "+90 544 774 01 01",
    email: "sinan@vigowood.com",
  },
  COUNTRY_DISPATCH: {
    DE: { name: "Germany", method: "Road Transport" },
    UK: { name: "United Kingdom", method: "Sea Freight" },
    USA: { name: "United States", method: "Sea Freight" },
  } as Record<string, { name: string; method: string }>,
  COUNTRY_BUYER: {
    DE: {
      name1: "HAS-MOB ORMAN URUNLERI",
      name2: "MOBILYA SANAYI VE TICARET LIMITED SIRKETI (Germany)",
      vat: "DE350448756",
      address: "Catalpinar Mah. 5\n52300 Ordu",
    },
    UK: {
      name1: "HAS-MOB ORMAN URUNLERI",
      name2: "MOBILYA SANAYI VE TICARET LIMITED SIRKETI",
      vat: "0368836738",
      address: "346 WINSTON HOUSE 2-4 DOLLIS PARK LONDON",
    },
    USA: {
      name1: "Hass Woodtech LLC",
      name2: "",
      vat: "",
      address: "8 THE GREEN STREET STE:4000, DOVER, DE 19901 DE, USA",
    },
  } as Record<string, { name1: string; name2: string; vat: string; address: string }>,
} as const;
