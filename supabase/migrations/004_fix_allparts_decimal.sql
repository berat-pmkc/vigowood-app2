-- VigoWood Platform — Fix: AllParts decimal stok alanları
-- hazir_eleman_aktif_stok ve yari_mamul_stok INTEGER → NUMERIC
-- 6 satırda decimal değer var (ör: -816.35), INTEGER kabul etmiyor

ALTER TABLE public.all_parts
  ALTER COLUMN hazir_eleman_aktif_stok TYPE NUMERIC USING hazir_eleman_aktif_stok::NUMERIC,
  ALTER COLUMN yari_mamul_stok TYPE NUMERIC USING yari_mamul_stok::NUMERIC;
