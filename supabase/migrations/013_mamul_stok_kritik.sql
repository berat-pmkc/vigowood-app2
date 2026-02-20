-- Katman 15: Mamül Stok — kritik stok eşiği
-- products tablosuna mamul_stok_kritik kolonu ekle

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS mamul_stok_kritik INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.products.mamul_stok_kritik IS 'Mamül kritik stok eşiği — bu değerin altındaki stok "kritik" sayılır';

-- Aktif ürünlerde varsayılan kritik stok = 5
UPDATE public.products SET mamul_stok_kritik = 5 WHERE aktif_mi = true AND mamul_stok_kritik = 0;
