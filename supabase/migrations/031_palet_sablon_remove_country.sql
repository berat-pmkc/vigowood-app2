-- =============================================
-- 031: Palet Şablonları — Ülke bazlı → Palet boyutu bazlı
-- country_code ve urun_adi kaldırılıyor
-- UNIQUE key: (country_code, sku) → (palet_boyut, sku)
-- =============================================

-- 1) Duplicate (palet_boyut, sku) satırları temizle (country_code farklı olan kayıtlar)
-- Her (palet_boyut, sku) çifti için en düşük id'yi tut
DELETE FROM public.sevkiyat_palet_sablon
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.sevkiyat_palet_sablon
  GROUP BY palet_boyut, sku
);

-- 2) Eski UNIQUE constraint ve index'i kaldır
ALTER TABLE public.sevkiyat_palet_sablon
  DROP CONSTRAINT IF EXISTS sevkiyat_palet_sablon_country_code_sku_key;

DROP INDEX IF EXISTS idx_palet_sablon_country;

-- 3) country_code ve urun_adi kolonlarını kaldır
ALTER TABLE public.sevkiyat_palet_sablon
  DROP COLUMN IF EXISTS country_code,
  DROP COLUMN IF EXISTS urun_adi;

-- 4) Yeni UNIQUE constraint ekle
ALTER TABLE public.sevkiyat_palet_sablon
  ADD CONSTRAINT sevkiyat_palet_sablon_palet_boyut_sku_key UNIQUE (palet_boyut, sku);

-- 5) palet_boyut index'i ekle (hızlı filtre için)
CREATE INDEX IF NOT EXISTS idx_palet_sablon_palet_boyut
  ON public.sevkiyat_palet_sablon(palet_boyut);
