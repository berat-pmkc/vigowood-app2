-- =============================================================
-- BT301 "ÖN ARKA KARIŞIK" plakası
--
-- Kesim listesinde "301-ön arka" diye geçen kesim, ön arka İÇ ve DIŞ
-- parçalarının aynı plakada yarı yarıya kesilmesi. Ayrı ayrı İÇ (PLK-342)
-- ve DIŞ (PLK-343) plakaları duruyor; bu üçüncü seçenek karışık kesim için.
--
-- Adetler: tek parça kesilen plakalarda 194'er çıkıyor; yarı yarıya
-- kesilince her birinden 97 çıkar. Süreler İÇ/DIŞ ile aynı.
-- =============================================================

DO $$
BEGIN
  INSERT INTO plakalar (plakalar_id, plaka_id, plaka_adi, sku, tipi, renk,
                        plaka_kategori, kesim_sureleri)
  VALUES ('PL-0920', 'PLK-359', 'ÖN ARKA KARIŞIK', ARRAY['BT301A'],
          '8mm MDF', 'Cambridge', 'MDF',
          jsonb_build_object('MAK-1', 90.0, 'MAK-2', 70.0, 'MAK-3', 60.0))
  ON CONFLICT (plaka_id) DO NOTHING;

  INSERT INTO plaka_parts (ppart_id, plaka_id, part_id, default_qty, sku)
  SELECT 'PPart5100', 'PLK-359', 'BT301-P06', 97, 'BT301A'
  WHERE NOT EXISTS (SELECT 1 FROM plaka_parts WHERE plaka_id='PLK-359' AND part_id='BT301-P06');

  INSERT INTO plaka_parts (ppart_id, plaka_id, part_id, default_qty, sku)
  SELECT 'PPart5101', 'PLK-359', 'BT301-P07', 97, 'BT301A'
  WHERE NOT EXISTS (SELECT 1 FROM plaka_parts WHERE plaka_id='PLK-359' AND part_id='BT301-P07');
END $$;
