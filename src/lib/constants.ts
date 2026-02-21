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
export const MAKINE_IDS = ["BÜYÜK", "KÜÇÜK", "KUTU"] as const;

export type MakineId = (typeof MAKINE_IDS)[number];

export const MAKINE_LABELS: Record<MakineId, string> = {
  BÜYÜK: "Büyük Lazer (600W)",
  KÜÇÜK: "Küçük Lazer (300W)",
  KUTU: "Kutu (BALA)",
};

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

// Sevkiyat ülke konfigürasyonları
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

export const SEVKIYAT_COUNTRY_CODES = ["DE", "UK", "USA"] as const;

export const PALET_BOYUTLARI = ["80x120", "100x120"] as const;
export const PALET_WEIGHT_KG = 15;

// Konteyner tipleri
export const KONTEYNER_TYPES = ["20ft", "40ft", "40ft HC"] as const;
export type KonteynerType = (typeof KONTEYNER_TYPES)[number];

export const KONTEYNER_TYPE_LABELS: Record<KonteynerType, string> = {
  "20ft": "20' Konteyner",
  "40ft": "40' Konteyner",
  "40ft HC": "40' HC Konteyner",
};

// Araç tipleri
export const ARAC_TIPLERI = { konteyner: "Konteyner", tir: "Tır" } as const;
export type AracTipi = keyof typeof ARAC_TIPLERI;

// Maliyet para birimleri
export const MALIYET_PARA_BIRIMLERI = ["USD", "EUR", "GBP", "TRY"] as const;
export type MaliyetParaBirimi = (typeof MALIYET_PARA_BIRIMLERI)[number];

// Firma tipleri
export const FIRMA_TIPLERI = ["ihracatci", "alici", "banka", "imzalayan", "contact"] as const;
export type FirmaTipi = (typeof FIRMA_TIPLERI)[number];
export const FIRMA_TIPI_LABELS: Record<FirmaTipi, string> = {
  ihracatci: "İhracatçı",
  alici: "Alıcı",
  banka: "Banka",
  imzalayan: "İmzalayan",
  contact: "İletişim",
};

// ─── Satış Sabitleri ──────────────────────────────────────────

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

/** İhracat kanalları (HAS- prefix) */
export const EXPORT_CHANNELS = ["HAS-DE", "HAS-UK", "HAS-ABD"] as const;

/** Hizmet SKU'ları — stoktan düşülmez */
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

/** İhracat kanalı mı? */
export function isExportChannel(channel: string): boolean {
  return channel.startsWith("HAS-");
}

/** Hizmet SKU'su mu? (stoktan düşülmez) */
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

/** Pazaryeri seçenekleri (TR Pazarlama) */
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

/** Personel erişim rolleri (Yönetici + Endüstri Mühendisi + Hat) */
export const PERSONEL_ACCESS_ROLES: UserRole[] = [
  "Yönetici",
  "Endüstri Mühendisi",
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
