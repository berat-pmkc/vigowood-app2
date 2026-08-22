-- =============================================================
-- LS031 reçetesindeki iki eksik
--
-- 1) DIŞ KUTU
--    Diğer bütün LS ürünlerinde iç + dış kutu ikilisi var
--    (LS011 x0.17, LS021 x0.25, LS051 x0.17), LS031'de yalnızca iç
--    kutu tanımlıydı. 6'lı koli kabul edildi -> x0.17, LS051 ile aynı.
--
-- 2) KOL DAYAMA SÜNGERİ
--    LS031-P10 "LS031 Kol Dayama Sünger" tanımlıydı ama reçetede
--    kullanılmıyordu. Kesim listesinde "31-Sünger" olarak kesildiği
--    (PLK-218 "Sünger Kol Dayama", LS031) görülüyor; yani üretiliyor
--    ama tüketilmiyordu — yarı mamül stoğu sürekli birikirdi.
--    SÜNGERİ DESTEĞE YAPIŞTIRMA adımında satın alınan HP0059'un yerine
--    geçiyor.
-- =============================================================

DO $$
BEGIN
  -- ── 1) Dış kutu parçası
  INSERT INTO all_parts (part_id, part_adi, part_type, hazir_eleman_aktif_stok,
                         hazir_eleman_kritik_stok, yari_mamul_stok)
  SELECT 'HP0125', 'LS031 Dış Kutu', 'KUTU', 0, 0, 0
  WHERE NOT EXISTS (SELECT 1 FROM all_parts WHERE part_id='HP0125');

  INSERT INTO step_bom (step_bom_id, step_id, part_id, qty_per)
  SELECT 'SBOM-2240', 'ASM-0675', 'HP0125', 0.17
  WHERE EXISTS (SELECT 1 FROM assembly_steps WHERE step_id='ASM-0675' AND sku='LS031')
    AND NOT EXISTS (SELECT 1 FROM step_bom WHERE step_id='ASM-0675' AND part_id='HP0125');

  -- ── 2) Kesilen sünger, satın alınanın yerine
  UPDATE step_bom
  SET part_id = 'LS031-P10'
  WHERE step_id = 'ASM-0669'
    AND part_id = 'HP0059'
    AND NOT EXISTS (SELECT 1 FROM step_bom WHERE step_id='ASM-0669' AND part_id='LS031-P10');
END $$;
