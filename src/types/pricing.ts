// =============================================
// Pazaryeri Fiyatlama Paneli — TypeScript Tipleri
// =============================================

// --- Temel tablo tipleri ---

export interface Marketplace {
  id: string;
  code: string;
  name: string;
  vergi_dahil: boolean;
  stopaj_orani: number;
  hedef_fiyat_tipi: HedefFiyatTipi;
  ozel_ayarlar: Record<string, unknown>;
  aktif: boolean;
  sira: number;
  created_at: string;
  updated_at: string;
}

export type HedefFiyatTipi = 'perakende_min' | 'perakende_standart' | 'toptan_min' | 'toptan_standart';

export interface ShippingProvider {
  id: string;
  name: string;
  code: string;
  desi_fiyatlari: Record<string, number>; // {"1": 105, "2": 105, ...}
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceShipping {
  id: string;
  marketplace_id: string;
  shipping_provider_id: string;
  varsayilan: boolean;
  created_at: string;
}

export interface ProductTargetPrice {
  id: string;
  sku: string;
  perakende_min: number;
  perakende_standart: number;
  toptan_min: number;
  toptan_standart: number;
  perakende_min_kdv: number;
  perakende_standart_kdv: number;
  toptan_min_kdv: number;
  toptan_standart_kdv: number;
  gecerlilik_baslangic: string;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductBoxDimension {
  id: string;
  sku: string;
  en_cm: number;
  boy_cm: number;
  yukseklik_cm: number;
  desi: number;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceListing {
  id: string;
  marketplace_id: string;
  sku: string;
  listing_kodu: string;
  barkod: string | null;
  urun_adi: string | null;
  satis_fiyati: number;
  komisyon_orani: number;
  reklam_orani: number;
  shipping_provider_id: string | null;
  kargo_maliyeti: number;
  ham_fiyat: number;
  hedef_fiyat_kullanilan: number;
  kar_marji: number;
  oneri_fiyat_min: number;
  oneri_fiyat_std: number;
  ozel_maliyetler: Record<string, unknown>;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface PricingSnapshot {
  id: string;
  donem_kodu: string;
  marketplace_id: string;
  sku: string;
  listing_kodu: string;
  satis_fiyati: number | null;
  komisyon_orani: number | null;
  reklam_orani: number | null;
  kargo_maliyeti: number | null;
  ham_fiyat: number | null;
  kar_marji: number | null;
  hedef_fiyat: number | null;
  created_at: string;
  created_by: string | null;
}

// --- Yardımcı (join) tipler ---

export interface MarketplaceWithListings extends Marketplace {
  listings: MarketplaceListing[];
  shipping_providers: (ShippingProvider & { varsayilan: boolean })[];
}

export interface ListingWithCalculations extends MarketplaceListing {
  marketplace?: Marketplace;
  product_target_price?: ProductTargetPrice;
  product_box_dimension?: ProductBoxDimension;
  shipping_provider?: ShippingProvider;
  // Hesaplanmış alanlar
  vergi_tutari: number;
  stopaj_tutari: number;
  komisyon_bedeli: number;
  reklam_bedeli: number;
  net_gelir: number;
}

export interface MarketplaceSummary {
  marketplace: Marketplace;
  listing_count: number;
  aktif_listing_count: number;
  ortalama_komisyon: number;
  ortalama_kar_marji: number;
  toplam_satis_fiyati: number;
}

// --- Form tipleri ---

export type MarketplaceFormData = Omit<Marketplace, 'id' | 'created_at' | 'updated_at'>;

export type ListingFormData = Omit<MarketplaceListing, 'id' | 'created_at' | 'updated_at' | 'ham_fiyat' | 'kar_marji' | 'oneri_fiyat_min' | 'oneri_fiyat_std' | 'hedef_fiyat_kullanilan'>;

export type TargetPriceFormData = Omit<ProductTargetPrice, 'id' | 'created_at' | 'updated_at'>;

export type BoxDimensionFormData = Omit<ProductBoxDimension, 'id' | 'created_at' | 'updated_at'>;
