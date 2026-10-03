-- =============================================================
-- Satış ve Pazaryeri modülleri kaldırıldı.
-- users.allowed_modules (TEXT[]) içinden 'satis' ve 'pazaryeri'
-- anahtarlarını temizle. NULL (= rol varsayılanları) olduğu gibi kalır.
-- =============================================================

UPDATE public.users
SET allowed_modules = array_remove(array_remove(allowed_modules, 'satis'), 'pazaryeri')
WHERE allowed_modules IS NOT NULL
  AND (allowed_modules @> ARRAY['satis'] OR allowed_modules @> ARRAY['pazaryeri']);
