-- Varyant ürünlere aile kolisinin uygulanması.
--
-- Aynı ürünün renk/model varyantları aynı masterbox koliye giriyor.
-- CSV'de yalnızca aile temsilcisi vardı; varyantlar buradan tamamlanıyor.
--
-- Dayanaklar:
--   LS053-057    → LS051  (StepBOM'da LS051-P08/P09/P11 parçalarını paylaşıyorlar)
--   LS017-019    → LS011  (LS011-P04'ü paylaşıyorlar)
--   LS027-028    → LS021  (aynı model, farklı renk)
--   MKOS41C..45  → MKOS41 (MKOS-P02'yi paylaşıyorlar)
--   DYKOS01A/E/M → DYKOS  (aynı model, farklı renk)
--   DK50E        → DK50M  (renk varyantı)
--   KOSJESUS     → KOS    (aynı gövde, farklı gravür)
--   BT301A       → BT201  (aynı ürün tanımı: katlanır ayaklı ayarlanabilir sehpa)

UPDATE public.products p SET
  kutu_boy_cm       = k.kutu_boy_cm,
  kutu_en_cm        = k.kutu_en_cm,
  kutu_yukseklik_cm = k.kutu_yukseklik_cm,
  koli_adedi        = k.koli_adedi,
  updated_at        = now()
FROM (VALUES
  ('LS053','LS051'), ('LS054','LS051'), ('LS055','LS051'),
  ('LS056','LS051'), ('LS057','LS051'),
  ('LS017','LS011'), ('LS018','LS011'), ('LS019','LS011'),
  ('LS027','LS021'), ('LS028','LS021'),
  ('MKOS41C','MKOS41'), ('MKOS41N','MKOS41'), ('MKOS42C','MKOS41'),
  ('MKOS42N','MKOS41'), ('MKOS43','MKOS41'), ('MKOS44','MKOS41'),
  ('MKOS45','MKOS41'),
  ('DYKOS01A','DYKOS'), ('DYKOS01E','DYKOS'), ('DYKOS01M','DYKOS'),
  ('DK50E','DK50M'),
  ('KOSJESUS','KOSCEVİZ'),
  ('BT301A','BT201')
) AS v(hedef, kaynak)
JOIN public.products k ON k.sku = v.kaynak
WHERE p.sku = v.hedef
  AND k.kutu_boy_cm IS NOT NULL;
