-- =============================================
-- Hedef Fiyat Sadeleştirme
-- ESKİ: perakende_min, perakende_standart, toptan_min, toptan_standart + 4 KDV
-- YENİ: hedef_fiyat, toptan_hedef_fiyat + 2 KDV
-- marketplaces.hedef_fiyat_tipi: 4 seçenek → 2 seçenek
-- marketplace_listings: oneri_fiyat_min → kaldır, oneri_fiyat_std → oneri_fiyat
-- =============================================

-- 1. product_target_prices: Add new columns
ALTER TABLE public.product_target_prices
  ADD COLUMN IF NOT EXISTS hedef_fiyat DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toptan_hedef_fiyat DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hedef_fiyat_kdv DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toptan_hedef_fiyat_kdv DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 2. Migrate data: perakende_standart → hedef_fiyat, toptan_standart → toptan_hedef_fiyat
UPDATE public.product_target_prices SET
  hedef_fiyat = perakende_standart,
  toptan_hedef_fiyat = toptan_standart,
  hedef_fiyat_kdv = perakende_standart_kdv,
  toptan_hedef_fiyat_kdv = toptan_standart_kdv;

-- 3. Drop old columns
ALTER TABLE public.product_target_prices
  DROP COLUMN IF EXISTS perakende_min,
  DROP COLUMN IF EXISTS perakende_standart,
  DROP COLUMN IF EXISTS toptan_min,
  DROP COLUMN IF EXISTS toptan_standart,
  DROP COLUMN IF EXISTS perakende_min_kdv,
  DROP COLUMN IF EXISTS perakende_standart_kdv,
  DROP COLUMN IF EXISTS toptan_min_kdv,
  DROP COLUMN IF EXISTS toptan_standart_kdv;

-- 4. marketplaces: Update hedef_fiyat_tipi CHECK constraint
ALTER TABLE public.marketplaces DROP CONSTRAINT IF EXISTS marketplaces_hedef_fiyat_tipi_check;
-- Migrate old values to new
UPDATE public.marketplaces SET hedef_fiyat_tipi = 'perakende'
  WHERE hedef_fiyat_tipi IN ('perakende_min', 'perakende_standart');
UPDATE public.marketplaces SET hedef_fiyat_tipi = 'toptan'
  WHERE hedef_fiyat_tipi IN ('toptan_min', 'toptan_standart');
ALTER TABLE public.marketplaces
  ADD CONSTRAINT marketplaces_hedef_fiyat_tipi_check
  CHECK (hedef_fiyat_tipi IN ('perakende', 'toptan'));

-- 5. marketplace_listings: Rename oneri_fiyat_std → oneri_fiyat, drop oneri_fiyat_min
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS oneri_fiyat DECIMAL(10,2) NOT NULL DEFAULT 0;
UPDATE public.marketplace_listings SET oneri_fiyat = oneri_fiyat_std;
ALTER TABLE public.marketplace_listings
  DROP COLUMN IF EXISTS oneri_fiyat_min,
  DROP COLUMN IF EXISTS oneri_fiyat_std;
