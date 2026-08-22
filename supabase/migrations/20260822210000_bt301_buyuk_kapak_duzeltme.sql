-- =============================================================
-- BT301 KAPAK plakasının parça bağlantısı düzeltmesi
--
-- Önceki migration, BT201'in numaralandırmasını birebir kopyalayarak
-- KAPAK plakasını BT301-P01'e bağladı. Ancak BT301-P01 boşta bir kod
-- değil: "Tam Ürün Set" adıyla BT301'in montaj reçetesinde (ASM-0626)
-- kullanılıyor ve yarı mamül defterinde kaydı var. Yani PLK-340 her
-- kesimde "tam ürün seti" üretmiş gibi görünecekti — büyük kapak
-- yerine bitmiş set stoğu şişerdi.
--
-- BT201'de P14/P15 arkalık parçalarıydı; BT301'de arkalık olmadığı için
-- P14 boşta. Büyük kapak oraya alınıyor.
-- =============================================================

DO $$
BEGIN
  INSERT INTO all_parts (part_id, part_adi, part_type, hazir_eleman_aktif_stok,
                         hazir_eleman_kritik_stok, yari_mamul_stok)
  VALUES ('BT301-P14', 'BÜYÜK KAPAK', 'YARIMAMUL', 0, 0, 0)
  ON CONFLICT (part_id) DO NOTHING;

  UPDATE plaka_parts
  SET part_id = 'BT301-P14'
  WHERE plaka_id = 'PLK-340'
    AND part_id = 'BT301-P01'
    AND NOT EXISTS (SELECT 1 FROM plaka_parts x
                    WHERE x.plaka_id='PLK-340' AND x.part_id='BT301-P14');
END $$;
