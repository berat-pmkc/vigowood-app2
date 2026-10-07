/**
 * İş Talimatları + Talepler — sabitler (istemci/sunucu ortak, "server-only" değil).
 * SQL karşılıkları: talimat_yetki_planlayici() = is_admin_or_engineer(),
 * is_office_user(), has_production_access().
 */
import { ADMIN_ROLES, PRODUCTION_ACCESS_ROLES, type UserRole } from "@/lib/constants";

/** Haftalık planı düzenleyen / yayınlayan / talebi iş talimatına atayan roller */
export const TALIMAT_PLANNER_ROLES: UserRole[] = [...ADMIN_ROLES];

/** Talep açabilen ofis rolleri (SQL: is_office_user()) */
export const TALEP_CREATOR_ROLES: UserRole[] = [
  "Yönetici",
  "Endüstri Mühendisi",
  "E-Ticaret Müdürü",
  "Dış Ticaret Müdürü",
  "Muhasebe",
  "Sevkiyat Sorumlusu",
  "Pazaryeri Sorumlusu",
  "Mimar",
  "Üretim ve Planlama Sorumlusu",
];

/** İş talimatını okuyabilenler: üretim erişimi + ofis rolleri */
export const TALIMAT_VIEW_ROLES: UserRole[] = Array.from(
  new Set<UserRole>([...PRODUCTION_ACCESS_ROLES, ...TALEP_CREATOR_ROLES]),
);

/** Talimat listesine eklenebilen personel rolleri (users.role) */
export const TALIMAT_PERSONEL_ROLES: UserRole[] = ["Üretim", "Hat"];

/** Talimat bildirimlerinin notifications.kind değerleri */
export const TALIMAT_BILDIRIM_KIND = "talimat_degisiklik" as const;
export const TALIMAT_RAPOR_KIND = "talimat_rapor" as const;

/** Talebi açanın serbest düzenleme penceresi (dakika) */
export const TALEP_SERBEST_DAKIKA = 10;

/** Plan ayarlarının varsayılanı (app_settings key: 'talimat_ayarlari') */
export const TALIMAT_AYAR_KEY = "talimat_ayarlari";
export const TALIMAT_AYAR_VARSAYILAN = {
  /** gun: ISO (1=Pzt … 7=Paz), saat: "HH:MM" Europe/Istanbul */
  pasif_gun_saat: { gun: 6, saat: "17:30" },
  pazartesi_bildirim_saat: "07:55",
  hatirlatma_dakika: 10,
  rapor_dakika: 15,
} as const;

export const TALIMAT_ISTASYONLAR = [
  { value: "kesim", label: "Kesim" },
  { value: "montaj", label: "Montaj" },
  { value: "paketleme", label: "Paketleme" },
] as const;

export const TALIMAT_ISTASYON_LABEL: Record<string, string> = {
  kesim: "Kesim",
  montaj: "Montaj",
  paketleme: "Paketleme",
};

export const PLAN_DURUM_LABEL: Record<string, string> = {
  taslak: "Taslak",
  yayinda: "Yayında",
  pasif: "Pasif",
};

export const SATIR_DURUM_LABEL: Record<string, string> = {
  aktif: "Aktif",
  pasif: "Pasif",
  tamamlandi: "Tamamlandı",
};

export const YAYIN_DURUM_LABEL: Record<string, string> = {
  bildirimsiz: "Bildirimsiz yenileme",
  beklemede: "Gönderim bekliyor",
  gonderildi: "Gönderildi",
  tamamlandi: "Herkes onayladı",
  durduruldu: "Durduruldu",
  geri_cekildi: "Geri çekildi",
};

export const TALEP_DURUM_LABEL: Record<string, string> = {
  acik: "Açık",
  is_emri_verildi: "İş emri verildi",
  hazirlaniyor: "Hazırlanıyor",
  hazir: "Hazır",
  pasif: "İş pasif edildi",
  tamamlandi: "Tamamlandı",
  tamamlanmadi: "Tamamlanmadı",
  stokta_mevcut: "Stokta mevcut",
  geri_cekildi: "Geri çekildi",
};

/** Talep durum rozet renkleri (proje paleti) */
export const TALEP_DURUM_COLOR: Record<string, { bg: string; fg: string }> = {
  acik: { bg: "#f0ede1", fg: "#5e5747" },
  is_emri_verildi: { bg: "#dbe7f5", fg: "#3368b1" },
  hazirlaniyor: { bg: "#fde8cf", fg: "#b8650c" },
  hazir: { bg: "#d4eee5", fg: "#2f7d66" },
  pasif: { bg: "#eceff1", fg: "#546e7a" },
  tamamlandi: { bg: "#e3ecd2", fg: "#3caa35" },
  tamamlanmadi: { bg: "#fbdde1", fg: "#c0424f" },
  stokta_mevcut: { bg: "#e1f5fe", fg: "#0277bd" },
  geri_cekildi: { bg: "#f5f5f5", fg: "#616161" },
};

/** "Tamamlanan talepler" / "Tamamlanmayan talepler" geçmiş listeleri */
export const TALEP_KAPALI_TAMAMLANAN = ["tamamlandi", "stokta_mevcut"] as const;
export const TALEP_KAPALI_TAMAMLANMAYAN = ["tamamlanmadi", "geri_cekildi"] as const;
export const TALEP_ACIK_DURUMLAR = ["acik", "is_emri_verildi", "hazirlaniyor", "hazir", "pasif"] as const;

/** Miktar "+" hızlı seçenekleri: ilk sayfa 50..250, "daha fazla" 300..500 */
export const HIZLI_MIKTAR_SAYFALARI: readonly (readonly number[])[] = [
  [50, 100, 150, 200, 250],
  [300, 350, 400, 450, 500],
];

/** Sunucu eylemlerinin sonrasında yenilenecek yollar (UI paketleri yollarını buraya ekleyebilir) */
export const TALIMAT_REVALIDATE_PATHS = ["/ops/board", "/talepler", "/uretim"] as const;
