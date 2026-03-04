-- Ürün kutu bilgileri kolonları
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS kutu_boy_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS kutu_en_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS kutu_yukseklik_cm NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS urun_agirlik_kg NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS kutu_agirlik_kg NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS desi NUMERIC(8,2);

-- Desi hesaplama: (boy * en * yükseklik) / 3000
COMMENT ON COLUMN products.desi IS 'Hacim/3000 = (boy*en*yukseklik)/3000';
