-- =============================================
-- Kutu Boyutları → Products tablosuna taşıma
-- product_box_dimensions'dan products'a COALESCE ile kopyala
-- =============================================

-- 1. Ensure products has box dimension columns (they already exist per CLAUDE.md)
-- kutu_boy_cm, kutu_en_cm, kutu_yukseklik_cm, desi are already in products

-- 2. Copy from product_box_dimensions to products where products columns are null/0
UPDATE public.products p SET
  kutu_en_cm = COALESCE(NULLIF(p.kutu_en_cm, 0), bd.en_cm),
  kutu_boy_cm = COALESCE(NULLIF(p.kutu_boy_cm, 0), bd.boy_cm),
  kutu_yukseklik_cm = COALESCE(NULLIF(p.kutu_yukseklik_cm, 0), bd.yukseklik_cm),
  desi = COALESCE(NULLIF(p.desi, 0), bd.desi)
FROM public.product_box_dimensions bd
WHERE p.sku = bd.sku;
