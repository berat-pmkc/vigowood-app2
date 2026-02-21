-- =====================================================
-- 020: Döviz kurları — PLN ve SEK kolonları
-- =====================================================

ALTER TABLE public.doviz_kurlari ADD COLUMN IF NOT EXISTS pln_try DECIMAL;
ALTER TABLE public.doviz_kurlari ADD COLUMN IF NOT EXISTS sek_try DECIMAL;
