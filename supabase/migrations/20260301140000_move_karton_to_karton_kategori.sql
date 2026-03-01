-- Plakalar tablosunda renk='KARTON' olan MDF kayıtları → KARTON kategorisine taşı
-- 27 kayıt etkilenecek (PL-0144 ~ PL-0170)

UPDATE plakalar
SET plaka_kategori = 'KARTON'
WHERE renk ILIKE '%karton%'
  AND plaka_kategori = 'MDF';
