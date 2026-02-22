-- 032: Satış ayarları — app_settings tablosuna seed verisi
-- Mevcut constants.ts'deki hardcoded satış sabitleri DB'ye taşınıyor

INSERT INTO public.app_settings (key, value, description) VALUES
  (
    'satis_kanallari',
    '[
      {"id":"TRENDYOL","label":"Trendyol","ihracat":false},
      {"id":"VIGOWOOD","label":"VigoWood","ihracat":false},
      {"id":"HEPSIBURADA","label":"Hepsiburada","ihracat":false},
      {"id":"AMAZON","label":"Amazon","ihracat":false},
      {"id":"HAS-DE","label":"HAS Almanya","ihracat":true},
      {"id":"HAS-UK","label":"HAS İngiltere","ihracat":true},
      {"id":"HAS-ABD","label":"HAS Amerika","ihracat":true},
      {"id":"N11","label":"N11","ihracat":false},
      {"id":"TEMU","label":"Temu","ihracat":false},
      {"id":"PAZARAMA","label":"Pazarama","ihracat":false},
      {"id":"ÇİÇEKSEPETİ","label":"Çiçek Sepeti","ihracat":false},
      {"id":"ETSY","label":"Etsy","ihracat":false},
      {"id":"TOPTAN","label":"Toptan","ihracat":false},
      {"id":"DIGER","label":"Diğer","ihracat":false},
      {"id":"MAĞAZA","label":"Mağaza","ihracat":false},
      {"id":"FUAR","label":"Fuar","ihracat":false}
    ]'::jsonb,
    'Satış kanalları listesi — id, label, ihracat flag'
  ),
  (
    'hizmet_skulari',
    '["KARGO","HIZMET","YEDEK PARCA","TS-M","FIYAT FARKI","DIS KUTU","KOLI","KUTU","MONTAJ","AMBALAJ"]'::jsonb,
    'Stoktan düşülmeyen hizmet SKU ları'
  ),
  (
    'pazaryeri_secenekleri',
    '["vigowood.com","Trendyol","Hepsiburada","Amazon","N11","Temu","Pazarama","Çiçek Sepeti","Etsy"]'::jsonb,
    'TR Pazarlama formunda pazaryeri dropdown seçenekleri'
  ),
  (
    'satis_basari_esikleri',
    '{"warning":70,"success":100}'::jsonb,
    'Başarı oranı renk eşikleri (yüzde)'
  ),
  (
    'satis_varsayilan_donem',
    '"month"'::jsonb,
    'Satış dashboard varsayılan dönem filtresi'
  )
ON CONFLICT (key) DO NOTHING;
