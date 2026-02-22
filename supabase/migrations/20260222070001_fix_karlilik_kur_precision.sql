-- Fix karlilik_data.ortalama_kur precision
-- Summary rows (TOPLAM, KAR, MARJ) store aggregated values, not actual exchange rates
ALTER TABLE public.karlilik_data
  ALTER COLUMN ortalama_kur TYPE NUMERIC(14,4);
