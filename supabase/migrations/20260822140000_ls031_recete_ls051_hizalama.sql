-- =============================================================
-- LS031 reçetesinin LS051 ile hizalanması
--
-- LS031, LS051'in mousepad ve ray'siz hâli — aynı ürün. Reçete de aynı
-- olmalı. Önceki migration reçeteyi LS031'in eski tek-adımlı hâlinden
-- dağıtmıştı; bu, malzeme toplamını koruyordu ama LS051'in miktarlarını
-- tutturmuyordu. Artık LS051 referans alınıyor.
--
-- ÜRÜNE ÖZEL KALANLAR (bilinçli):
--   HP0059 "Sünger 35*4*3.5"      (LS051: HP0007)
--   HP0061 "LS031 Sünger"         (LS051: HP0006)
--   HP0062 "LS031 İç Kutu"        (LS051: HP0012)
--   HP0060 "LS031 Dikilmiş Kumas Gri" (LS051: HP0008)
-- Bunlar LS031 için ayrıca tanımlanmış parçalar; LS051'inkiler
-- kullanılsaydı yanlış stok düşerdi.
--
-- BU MIGRATION'DA DÜZELTİLENLER (hepsi LS051'e göre):
--   KASA BİRLEŞTİRME   : fazladan HP0002 x2 kaldırıldı (LS051'de yok)
--   ARKALIK MONTAJ     : HP0002 10 -> 12
--   KOL DESTEK DÖŞEME  : HP0011 23 -> 20
--   DÖŞEME             : HP0011 55 -> 50
--   KASA-KAPAK BİRLEŞ. : HP0076 x4 ve HP0081 x3 eklendi (eksikti)
--
-- NOT: LS051'de PAKETLEME adımında ayrıca HP0025 "dış kutu" x0.17 var.
-- LS031 için tanımlı bir dış kutu parçası bulunmadığından eklenmedi.
-- Dış kutuya giriyorsa önce parça açılmalı.
-- =============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM assembly_steps WHERE sku='LS031' AND step_id='ASM-0665') THEN
    RAISE NOTICE 'LS031 yeni adımları yok — migration atlandı';
    RETURN;
  END IF;

  -- KASA BİRLEŞTİRME: LS051'de bu adımda vida yok
  DELETE FROM step_bom WHERE step_id='ASM-0665' AND part_id='HP0002';

  -- ARKALIK MONTAJ
  UPDATE step_bom SET qty_per=12 WHERE step_id='ASM-0666' AND part_id='HP0002';

  -- KOL DESTEK DÖŞEME
  UPDATE step_bom SET qty_per=20 WHERE step_id='ASM-0670' AND part_id='HP0011';

  -- DÖŞEME
  UPDATE step_bom SET qty_per=50 WHERE step_id='ASM-0674' AND part_id='HP0011';

  -- KASA-KAPAK BİRLEŞTİRME: LS051'de olup LS031'de eksik olan vidalar
  INSERT INTO step_bom (step_bom_id, step_id, part_id, qty_per)
  SELECT 'SBOM-2238','ASM-0672','HP0076',4
  WHERE NOT EXISTS (SELECT 1 FROM step_bom WHERE step_id='ASM-0672' AND part_id='HP0076');

  INSERT INTO step_bom (step_bom_id, step_id, part_id, qty_per)
  SELECT 'SBOM-2239','ASM-0672','HP0081',3
  WHERE NOT EXISTS (SELECT 1 FROM step_bom WHERE step_id='ASM-0672' AND part_id='HP0081');
END $$;
