-- Fix kdv_orani column precision to prevent overflow from footer/summary rows
ALTER TABLE public.satis_satirlari
  ALTER COLUMN kdv_orani TYPE DECIMAL(6,2);
