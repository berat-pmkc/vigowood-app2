-- Masterbox koli ölçüleri
--
-- Kaynak: 'ÜRÜN MASTERBOX' tablosu. Konteyner yükleme planlaması koli
-- bazında çalışacağı için koli içi adet de saklanıyor — seçilen koli
-- sayısından ürün adedi bu değerle hesaplanacak.
--
-- CSV'deki KOS ve BKOS aile kodu; yalnızca renk varyantlarına uygulandı.
-- KOSJESUS ve KOSRA (rahle) farklı ürünler, ölçüleri ayrıca girilmeli.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS koli_adedi INTEGER;

COMMENT ON COLUMN public.products.koli_adedi IS
  'Bir masterbox koliye giren ürün adedi';

UPDATE public.products p SET
  kutu_boy_cm       = v.boy,
  kutu_en_cm        = v.en,
  kutu_yukseklik_cm = v.yuk,
  koli_adedi        = v.kacli,
  updated_at        = now()
FROM (VALUES
  ('KOSANTİK',61,34,26,12),
  ('KOSCEVİZ',61,34,26,12),
  ('KOSERİK',61,34,26,12),
  ('KOSMEŞE',61,34,26,12),
  ('BKOSANTİK',59,44,31,11),
  ('BKOSCEVİZ',59,44,31,11),
  ('BKOSERİK',59,44,31,11),
  ('BKOSMEŞE',59,44,31,11),
  ('LS011',54,38,50,6),
  ('LS013',54,38,50,6),
  ('LS014',54,38,50,6),
  ('LS016',54,38,50,6),
  ('LS021',60,37,40.5,4),
  ('LS023',60,37,40.5,4),
  ('LS024',60,37,40.5,4),
  ('LS025',60,37,40.5,4),
  ('LS051',57,41,31,6),
  ('MKOS41',57,41,31,6),
  ('DYKOS',54,38,50,12),
  ('BT201',60,37,38,5),
  ('DK50M',46,46,18,1),
  ('DK50C',46,46,18,1),
  ('DK30M',46,46,13,1),
  ('DK30C',46,46,13,1),
  ('DK20M',46,46,13,1),
  ('DK20C',46,46,13,1),
  ('KD50M',45,45,18,1),
  ('KD50C',45,45,18,1),
  ('T1-C-L',57.5,43,39,7),
  ('T1-C',44,37.5,35,7),
  ('T1-M',44,37.5,35,7),
  ('T1-M-L',57.5,43,39,7),
  ('T2-C',44,37.5,35,7),
  ('T2-C-L',57.5,43,39,7),
  ('T2-M-L',57.5,43,39,7),
  ('T3-C',44,37.5,35,7),
  ('T3-C-L',57.5,43,39,7),
  ('T3-M',44,37.5,35,7),
  ('T3-M-L',57.5,43,39,7),
  ('T4-C',44,37.5,35,7),
  ('T4-M',44,37.5,35,7),
  ('T5-C',44,37.5,35,7),
  ('T5-M',44,37.5,35,7),
  ('T4-C-L',57.5,43,39,7),
  ('T4-M-L',57.5,43,39,7),
  ('T5-C-L',57.5,43,39,7),
  ('T5-M-L',57.5,43,39,7),
  ('T1-C-XL',72,54.5,21.5,4),
  ('T1-M-XL',72,54.5,21.5,4),
  ('T3-M-XL',72,54.5,21.5,4),
  ('T3-C-XL',72,54.5,21.5,4),
  ('T1-C-XXL',98,72,6,1),
  ('T1-M-XXL',98,72,6,1),
  ('T3-M-XXL',98,72,6,1),
  ('T3-C-XXL',98,72,6,1),
  ('T4-C-XXL',98,72,6,1),
  ('T4-M-XXL',98,72,6,1),
  ('T5-M-XXL',98,72,6,1),
  ('T5-C-XXL',98,72,6,1),
  ('T4-C-XL',72,54.5,21.5,4),
  ('T4-M-XL',72,54.5,21.5,4),
  ('T5-M-XL',72,54.5,21.5,4),
  ('T5-C-XL',72,54.5,21.5,4)
) AS v(sku, boy, en, yuk, kacli)
WHERE p.sku = v.sku;
