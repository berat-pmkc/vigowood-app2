-- Migration: gunluk_satis INTEGER → NUMERIC(8,2)
-- Günlük satış hızı artık WMA (Weighted Moving Average) ile hesaplanacak.
-- Decimal sonuç (ör. 7.10 adet/gün) saklanabilmesi için tip değişikliği.

ALTER TABLE public.products
  ALTER COLUMN gunluk_satis TYPE NUMERIC(8,2)
  USING gunluk_satis::NUMERIC(8,2);

-- Aktif ürünlerde günlük satış hızına göre hızlı sıralama için index
CREATE INDEX IF NOT EXISTS idx_products_gunluk_satis_desc
  ON public.products(gunluk_satis DESC NULLS LAST)
  WHERE aktif_mi = true;
