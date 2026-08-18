-- =============================================================
-- ÜRÜN GRUBU
--
-- Neden gerekli: mevcut kategori alanı analiz için fazla kaba.
-- "KİTAP OKUMA STANDI" içinde KOS, MKOS, BKOS ve DYKOS birlikte;
-- "KİTAPLIK" içinde KD50, DK, MK, MK50 birlikte. Grafiklerde tablolar
-- T1-C-XL / T5-M gibi tek tek görünüyor, model bazında toplanamıyor.
--
-- Kategori KALDIRILMIYOR — ikisi farklı seviye:
--   kategori   → satış/katalog seviyesi (KİTAPLIK)
--   urun_grubu → üretim/model seviyesi (KD50, MKOS)
--
-- ÖN DOLGU BİR KERELİK. Aşağıdaki desen SKU'dan renk ve boy ekini
-- soyarak makul bir başlangıç üretir; sonrasında alan admin ekranından
-- elle yönetilir. Desen uygulamaya GÖMÜLMÜYOR — yeni ürünlerde tahmin
-- yürütmek yerine alanın boş kalması, yanlış gruplanmasından iyidir.
-- =============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS urun_grubu TEXT;

COMMENT ON COLUMN public.products.urun_grubu IS
  'Üretim/model seviyesi grup (KD50, MKOS, TABLO). Analizlerde SKU yerine bunun üzerinden toplanır. Kategoriden daha ince.';

CREATE INDEX IF NOT EXISTS idx_products_urun_grubu ON public.products (urun_grubu);

-- ── Bir kerelik ön dolgu ─────────────────────────────────────
UPDATE public.products
SET urun_grubu = CASE
  -- Tüm tablo varyantları tek grup: T1-C-XL, T5-M-XXL ...
  WHEN sku ~ '^T[0-9]' THEN 'TABLO'
  -- Kitap okuma standı aileleri: renk eki soyulur (KOSCEVİZ -> KOS)
  WHEN sku ~ '^B?[A-Z]*KOS'
    THEN regexp_replace(sku, '(CEVİZ|MEŞE|ANTİK|ERİK|SİYAH|BEYAZ|[0-9]+)$', '')
  -- Model + renk harfi: KD50C/KD50M -> KD50, NS01A -> NS01
  WHEN sku ~ '^[A-Z]+[0-9]+' THEN regexp_replace(sku, '[CMAEP]$', '')
  ELSE sku
END
WHERE urun_grubu IS NULL;

-- Tek başına kalan gruplar anlamsız; onları da kendi SKU'suyla bırakıyoruz
-- ki analizde kaybolmasınlar (grup = SKU olur, zararsız).
