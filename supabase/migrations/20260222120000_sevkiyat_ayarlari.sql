-- Migration: Sevkiyat Ayarları → app_settings
-- Sevkiyat modülündeki hardcoded constant'ları DB'ye taşır.
-- ON CONFLICT (key) DO NOTHING → mevcut veriyi bozmaz.

INSERT INTO public.app_settings (key, value, description) VALUES

-- 1. Ülke konfigürasyonları
('sevkiyat_ulkeler', '[
  {"code":"DE","name":"Almanya","nameEN":"Germany","currency":"EUR","currencySymbol":"€","port":"Muratbey","buyer":"HAS-MOB ORMAN URUNLERI SAN. VE TIC. LTD. STI."},
  {"code":"UK","name":"İngiltere","nameEN":"United Kingdom","currency":"GBP","currencySymbol":"£","port":"Gemlik","buyer":"HAS-MOB ORMAN URUNLERI SAN. VE TIC. LTD. STI."},
  {"code":"USA","name":"Amerika","nameEN":"United States","currency":"USD","currencySymbol":"$","port":"Gemlik","buyer":"HAS-MOB ORMAN URUNLERI SAN. VE TIC. LTD. STI."}
]'::jsonb, 'Sevkiyat hedef ülkeleri (kod, isim, para birimi, liman, alıcı)'),

-- 2. Palet ayarları
('sevkiyat_palet_ayarlari', '{
  "boyutlar": ["80x120", "100x120"],
  "paletWeightKg": 15,
  "defaultYukseklik": 125
}'::jsonb, 'Palet boyutları, ağırlık ve varsayılan yükseklik'),

-- 3. Konteyner tipleri
('sevkiyat_konteyner_tipleri', '[
  {"type":"20ft","label":"20'' Konteyner"},
  {"type":"40ft","label":"40'' Konteyner"},
  {"type":"40ft HC","label":"40'' HC Konteyner"}
]'::jsonb, 'Konteyner tipleri ve etiketleri'),

-- 4. Araç tipleri
('sevkiyat_arac_tipleri', '[
  {"id":"konteyner","label":"Konteyner"},
  {"id":"tir","label":"Tır"}
]'::jsonb, 'Sevkiyat araç tipleri'),

-- 5. Maliyet ayarları
('sevkiyat_maliyet_ayarlari', '{
  "paraBirimleri": ["USD", "EUR", "GBP", "TRY"],
  "fields": [
    {"key":"navlun","label":"Navlun","defaultCurrency":"USD"},
    {"key":"ic_nakliye","label":"İç Nakliye","defaultCurrency":"TRY"},
    {"key":"ara_depo","label":"Ara Depo","defaultCurrency":"TRY"},
    {"key":"amazon_pickup","label":"Amazon Pickup","defaultCurrency":"USD"},
    {"key":"ydg","label":"YDG","defaultCurrency":"USD"},
    {"key":"tr_gumruk","label":"TR Gümrük","defaultCurrency":"TRY"},
    {"key":"diger","label":"Diğer","defaultCurrency":"TRY"}
  ],
  "desiCarpani": 333.33
}'::jsonb, 'Maliyet para birimleri, alanları ve desi çarpanı'),

-- 6. Firma tipleri
('sevkiyat_firma_tipleri', '[
  {"id":"ihracatci","label":"İhracatçı"},
  {"id":"alici","label":"Alıcı"},
  {"id":"banka","label":"Banka"},
  {"id":"imzalayan","label":"İmzalayan"},
  {"id":"contact","label":"İletişim"}
]'::jsonb, 'Sevkiyat firma profili tipleri'),

-- 7. Durum ayarları (etiket + renkler)
('sevkiyat_durum_ayarlari', '[
  {"id":"bekliyor","label":"Bekliyor","bg":"bg-amber-50","text":"text-amber-700","border":"border-amber-300","borderL":"border-l-amber-400"},
  {"id":"hazirlaniyor","label":"Hazırlanıyor","bg":"bg-blue-50","text":"text-blue-700","border":"border-blue-300","borderL":"border-l-blue-500"},
  {"id":"yolda","label":"Yolda","bg":"bg-purple-50","text":"text-purple-700","border":"border-purple-300","borderL":"border-l-purple-500"},
  {"id":"teslim_edildi","label":"Teslim Edildi","bg":"bg-emerald-50","text":"text-emerald-700","border":"border-emerald-300","borderL":"border-l-emerald-500"},
  {"id":"iptal_edildi","label":"İptal Edildi","bg":"bg-red-50","text":"text-red-700","border":"border-red-300","borderL":"border-l-red-500"}
]'::jsonb, 'Sevkiyat durum etiketleri ve renkleri'),

-- 8. Kur ayarları
('sevkiyat_kur_ayarlari', '{
  "currencies": ["USD", "EUR", "GBP", "PLN", "SEK"]
}'::jsonb, 'Döviz kuru takip edilen para birimleri')

ON CONFLICT (key) DO NOTHING;
