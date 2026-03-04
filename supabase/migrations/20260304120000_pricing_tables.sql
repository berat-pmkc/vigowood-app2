-- =============================================
-- Pazaryeri Fiyatlama Paneli — Faz 1: Tablolar
-- 7 tablo: marketplaces, shipping_providers, marketplace_shipping,
--          product_target_prices, product_box_dimensions,
--          marketplace_listings, pricing_snapshots
-- =============================================

-- 1. marketplaces (Pazaryeri Tanımları)
CREATE TABLE public.marketplaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  vergi_dahil BOOLEAN NOT NULL DEFAULT true,
  stopaj_orani DECIMAL(5,4) NOT NULL DEFAULT 0.01,
  hedef_fiyat_tipi TEXT NOT NULL DEFAULT 'perakende_min'
    CHECK (hedef_fiyat_tipi IN ('perakende_min','perakende_standart','toptan_min','toptan_standart')),
  ozel_ayarlar JSONB DEFAULT '{}',
  aktif BOOLEAN NOT NULL DEFAULT true,
  sira INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. shipping_providers (Kargo Firmaları + Desi Tabloları)
CREATE TABLE public.shipping_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  desi_fiyatlari JSONB NOT NULL DEFAULT '{}',
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. marketplace_shipping (Pazaryeri-Kargo Eşleştirmesi)
CREATE TABLE public.marketplace_shipping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  marketplace_id UUID NOT NULL REFERENCES public.marketplaces(id) ON DELETE CASCADE,
  shipping_provider_id UUID NOT NULL REFERENCES public.shipping_providers(id) ON DELETE CASCADE,
  varsayilan BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(marketplace_id, shipping_provider_id)
);

-- 4. product_target_prices (Merkezi Hedef Fiyatlar)
CREATE TABLE public.product_target_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE REFERENCES public.products(sku),
  perakende_min DECIMAL(10,2) NOT NULL DEFAULT 0,
  perakende_standart DECIMAL(10,2) NOT NULL DEFAULT 0,
  toptan_min DECIMAL(10,2) NOT NULL DEFAULT 0,
  toptan_standart DECIMAL(10,2) NOT NULL DEFAULT 0,
  perakende_min_kdv DECIMAL(10,2) NOT NULL DEFAULT 0,
  perakende_standart_kdv DECIMAL(10,2) NOT NULL DEFAULT 0,
  toptan_min_kdv DECIMAL(10,2) NOT NULL DEFAULT 0,
  toptan_standart_kdv DECIMAL(10,2) NOT NULL DEFAULT 0,
  gecerlilik_baslangic DATE DEFAULT CURRENT_DATE,
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. product_box_dimensions (Kutu Boyutları)
CREATE TABLE public.product_box_dimensions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE REFERENCES public.products(sku),
  en_cm DECIMAL(6,1) NOT NULL DEFAULT 0,
  boy_cm DECIMAL(6,1) NOT NULL DEFAULT 0,
  yukseklik_cm DECIMAL(6,1) NOT NULL DEFAULT 0,
  desi INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. marketplace_listings (ANA TABLO)
CREATE TABLE public.marketplace_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  marketplace_id UUID NOT NULL REFERENCES public.marketplaces(id),
  sku TEXT NOT NULL REFERENCES public.products(sku),
  listing_kodu TEXT NOT NULL,
  barkod TEXT,
  urun_adi TEXT,
  satis_fiyati DECIMAL(10,2) NOT NULL DEFAULT 0,
  komisyon_orani DECIMAL(5,4) NOT NULL DEFAULT 0,
  reklam_orani DECIMAL(5,4) NOT NULL DEFAULT 0,
  shipping_provider_id UUID REFERENCES public.shipping_providers(id),
  kargo_maliyeti DECIMAL(10,2) NOT NULL DEFAULT 0,
  ham_fiyat DECIMAL(10,2) NOT NULL DEFAULT 0,
  hedef_fiyat_kullanilan DECIMAL(10,2) NOT NULL DEFAULT 0,
  kar_marji DECIMAL(5,4) NOT NULL DEFAULT 0,
  oneri_fiyat_min DECIMAL(10,2) NOT NULL DEFAULT 0,
  oneri_fiyat_std DECIMAL(10,2) NOT NULL DEFAULT 0,
  ozel_maliyetler JSONB DEFAULT '{}',
  aktif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(marketplace_id, listing_kodu)
);

CREATE INDEX idx_ml_marketplace ON public.marketplace_listings(marketplace_id);
CREATE INDEX idx_ml_sku ON public.marketplace_listings(sku);

-- 7. pricing_snapshots (Fiyat Geçmişi)
CREATE TABLE public.pricing_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  donem_kodu TEXT NOT NULL,
  marketplace_id UUID NOT NULL REFERENCES public.marketplaces(id),
  sku TEXT NOT NULL REFERENCES public.products(sku),
  listing_kodu TEXT NOT NULL,
  satis_fiyati DECIMAL(10,2),
  komisyon_orani DECIMAL(5,4),
  reklam_orani DECIMAL(5,4),
  kargo_maliyeti DECIMAL(10,2),
  ham_fiyat DECIMAL(10,2),
  kar_marji DECIMAL(5,4),
  hedef_fiyat DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT REFERENCES public.users(user_id)
);

CREATE INDEX idx_ps_donem ON public.pricing_snapshots(donem_kodu);
CREATE INDEX idx_ps_marketplace ON public.pricing_snapshots(marketplace_id);

-- =============================================
-- Triggers: updated_at
-- =============================================

CREATE TRIGGER set_marketplaces_updated_at
  BEFORE UPDATE ON public.marketplaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_shipping_providers_updated_at
  BEFORE UPDATE ON public.shipping_providers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_product_target_prices_updated_at
  BEFORE UPDATE ON public.product_target_prices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_product_box_dimensions_updated_at
  BEFORE UPDATE ON public.product_box_dimensions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE public.marketplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_shipping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_target_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_box_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_snapshots ENABLE ROW LEVEL SECURITY;

-- Okuma: Tüm authenticated kullanıcılar
CREATE POLICY "Authenticated read marketplaces"
  ON public.marketplaces FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated read shipping_providers"
  ON public.shipping_providers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated read marketplace_shipping"
  ON public.marketplace_shipping FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated read product_target_prices"
  ON public.product_target_prices FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated read product_box_dimensions"
  ON public.product_box_dimensions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated read marketplace_listings"
  ON public.marketplace_listings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated read pricing_snapshots"
  ON public.pricing_snapshots FOR SELECT TO authenticated
  USING (true);

-- Yazma: Admin + E-Ticaret Müdürü (is_admin fonksiyonu zaten var)
CREATE POLICY "Admin manage marketplaces"
  ON public.marketplaces FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin manage shipping_providers"
  ON public.shipping_providers FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin manage marketplace_shipping"
  ON public.marketplace_shipping FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin manage product_target_prices"
  ON public.product_target_prices FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin manage product_box_dimensions"
  ON public.product_box_dimensions FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin manage marketplace_listings"
  ON public.marketplace_listings FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin manage pricing_snapshots"
  ON public.pricing_snapshots FOR ALL TO authenticated
  USING (public.is_admin());
