-- ============================================================
-- Migration 016: Sevkiyat v2 — Lojistik, Fiyatlar, Ülke Bazlı ID
-- ============================================================

-- 1. sevkiyat tablosu — yeni kolonlar
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS shipment_number INTEGER;
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS sevkiyat_adi TEXT;
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS liman TEXT;
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS teslimat_tipi TEXT DEFAULT 'DAP';

CREATE INDEX IF NOT EXISTS idx_sevkiyat_country_code ON public.sevkiyat(country_code);

-- 2. sevkiyat_items tablosu — lojistik kolonlar
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS palet_boyut TEXT;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS palet_yukseklik DECIMAL;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS en DECIMAL;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS boy DECIMAL;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS yuk DECIMAL;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS koli_adedi INTEGER;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS palette_koli INTEGER;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS toplam_koli INTEGER;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS hacim DECIMAL;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS desi DECIMAL;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS koli_agirlik DECIMAL;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS agirlik DECIMAL;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS grup TEXT;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS palet_sayisi INTEGER;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS birim_fiyat DECIMAL;
ALTER TABLE public.sevkiyat_items ADD COLUMN IF NOT EXISTS toplam_fiyat DECIMAL;

-- 3. Yeni tablo: sevkiyat_fiyatlar
CREATE TABLE IF NOT EXISTS public.sevkiyat_fiyatlar (
  id SERIAL PRIMARY KEY,
  country_code TEXT NOT NULL,
  sku TEXT NOT NULL,
  urun_adi_en TEXT,
  gtip TEXT,
  birim_fiyat DECIMAL NOT NULL DEFAULT 0,
  kategori TEXT,
  package_qty INTEGER,
  asin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(country_code, sku)
);

CREATE INDEX IF NOT EXISTS idx_sevkiyat_fiyatlar_country ON public.sevkiyat_fiyatlar(country_code);
CREATE INDEX IF NOT EXISTS idx_sevkiyat_fiyatlar_sku ON public.sevkiyat_fiyatlar(sku);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER set_sevkiyat_fiyatlar_updated_at
  BEFORE UPDATE ON public.sevkiyat_fiyatlar
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. RLS: sevkiyat_fiyatlar
ALTER TABLE public.sevkiyat_fiyatlar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sevkiyat_fiyatlar"
  ON public.sevkiyat_fiyatlar
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert sevkiyat_fiyatlar"
  ON public.sevkiyat_fiyatlar
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_engineer());

CREATE POLICY "Admins can update sevkiyat_fiyatlar"
  ON public.sevkiyat_fiyatlar
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_engineer());

CREATE POLICY "Admins can delete sevkiyat_fiyatlar"
  ON public.sevkiyat_fiyatlar
  FOR DELETE
  TO authenticated
  USING (is_admin_or_engineer());
