-- Yarı mamül manuel birim fiyat seed'i
-- BT301-P01: reçete tek "TAM PROJE" paketi kullanıyor, plaka_parts'ta karşılığı yok.
-- MALZEME KULLANIM ÇALIŞMASI (manuel VBA) doğrulaması:
--   malzeme/adet 135.76 - HP payı 39.87 = MDF/adet 95.88
--   plaka 8mm Cambridge (HP0017=1493.33) / ~15.6 adet ile tutarlı (kesim geçmişi 15 plaka).
-- Motor artık P-parça için all_parts.birim_fiyat doluysa onu kullanıyor, boşsa plaka formülüne düşüyor.
UPDATE all_parts SET birim_fiyat = 95.88 WHERE part_id = 'BT301-P01' AND birim_fiyat IS NULL;
