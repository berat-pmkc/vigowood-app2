-- =============================================================
-- LS031 montaj adımlarının yeniden kurulması
--
-- DURUM: LS031'in tüm montajı tek bir "montaj" adımında (ASM-0215)
-- toplanmıştı; 29 satırlık reçetenin tamamı oradaydı. Adım bazlı süre,
-- darboğaz ve malzeme takibi yapılamıyordu.
--
-- YAPILAN: LS051 deseni referans alınarak 14 adıma bölündü. LS051 aynı
-- ailenin ürünü ve adım listesi birebir örtüşüyor (LS031'de MOUSEPAD
-- HAZIRLIK ve RAY TAKMA yok). Parçalar KOD ile değil AD ile eşleştirildi;
-- numaralar iki üründe kaymış durumda:
--
--   OLUK        LS051-P02 -> LS031-P01      KOL DAYAMA  LS051-P08 -> LS031-P06
--   ORTA        LS051-P03 -> LS031-P02      ARKALIK     LS051-P09 -> LS031-P07
--   ÖN ARKA     LS051-P04 -> LS031-P03      KAPAK       LS051-P10 -> LS031-P08
--   SAĞ YAN     LS051-P06 -> LS031-P04      ORTA DESTEK LS051-P12 -> LS031-P09
--   SOL YAN     LS051-P07 -> LS031-P05
--
-- Ürüne özel hazır elemanlar da LS051'deki rollerine göre yerleşti:
--   HP0059 "Sünger 35*4*3.5"        -> SÜNGERİ DESTEĞE YAPIŞTIRMA (LS051: HP0007)
--   HP0060 "LS031 Dikilmiş Kumas"   -> DÖŞEME HAZIRLIK            (LS051: LS051 Dikilmiş Kumas)
--   HP0061 "LS031 Sünger"           -> DÖŞEME HAZIRLIK            (LS051: HP0006)
--   HP0062 "LS031 İç Kutu"          -> PAKETLEME                  (LS051: HP0012)
--
-- MALZEME TOPLAMI KORUNDU: eski reçetedeki 29 malzeme satırının hepsi
-- birebir taşındı, miktarlar değişmedi. Yeni eklenen 13 satır yalnızca
-- adımlar arası ASM- bağlantıları (DAG); eskiden tek adım olduğu için
-- bunlara gerek yoktu.
--
-- DÜŞÜLENLER:
--   * ASM-0206 ve ASM-0208 referansları — assembly_steps'te KARŞILIĞI YOK,
--     eski bir yapıdan kalmış ölü referanslar. Taşınmadı.
--   * LS031-P10 "Kol Dayama Sünger" zaten reçetede değildi; eklenmedi ki
--     malzeme tüketimi değişmesin.
--
-- BELİRSİZ TEK KALEM: HP0002 eski reçetede 5 kez geçiyordu (x4, x4, x2,
-- x10, x4); LS051'de bu vida 4 adımda kullanılıyor. Fazladan olan "x2"
-- KASA BİRLEŞTİRME adımına konuldu. Yanlışsa BOM ekranından taşınabilir;
-- toplam tüketim her hâlükârde aynı.
-- =============================================================

DO $$
DECLARE
  v_qty NUMERIC;
BEGIN
  -- Yalnızca beklenen yapı yerindeyse çalış (tekrar çalıştırmaya karşı koruma)
  IF NOT EXISTS (SELECT 1 FROM assembly_steps WHERE step_id = 'ASM-0215' AND sku = 'LS031') THEN
    RAISE NOTICE 'LS031/ASM-0215 yok — migration atlandı';
    RETURN;
  END IF;

  -- ── 1) Eski adıma bağlı tamamlanmış seansı sil, stoğu geri ver ──
  -- Sıra önemli: stok iadesi ESKİ reçeteden hesaplanıyor, dolayısıyla
  -- reçete taşınmadan ÖNCE yapılmalı.
  FOR v_qty IN
    SELECT COALESCE(qty, 0) FROM montaj_sessions
    WHERE step_id = 'ASM-0215' AND durum = 'tamamlandi'
  LOOP
    UPDATE all_parts a
    SET hazir_eleman_aktif_stok = COALESCE(a.hazir_eleman_aktif_stok, 0) + i.toplam
    FROM (
      SELECT b.part_id, sum(b.qty_per) * v_qty AS toplam
      FROM step_bom b
      JOIN all_parts p ON p.part_id = b.part_id
      WHERE b.step_id = 'ASM-0215'
        AND b.part_id NOT LIKE 'ASM-%'
        AND p.part_type::text <> 'YARIMAMUL'
      GROUP BY b.part_id
    ) i
    WHERE a.part_id = i.part_id;
  END LOOP;

  DELETE FROM yari_mamul_stok
  WHERE source_id IN (SELECT session_id FROM montaj_sessions WHERE step_id IN ('ASM-0215','ASM-0216'));

  DELETE FROM montaj_sessions WHERE step_id IN ('ASM-0215','ASM-0216');

  -- ── 2) Yeni adımlar ────────────────────────────────────────
  INSERT INTO assembly_steps (step_id, sku, step_name, seq_no, is_final_step) VALUES
    ('ASM-0663','LS031','KASA PARÇASINA MENTEŞE TAKMA İŞLEMİ', 1, false),
    ('ASM-0664','LS031','İÇ APARATA MIKNATIS TAKMA İŞLEMİ',    2, false),
    ('ASM-0665','LS031','KASA BİRLEŞTİRME',                    3, false),
    ('ASM-0666','LS031','ARKALIK MONTAJ',                      5, false),
    ('ASM-0667','LS031','OLUK HAZIRLIK',                       7, false),
    ('ASM-0668','LS031','ORTA DESTEK PARÇASI HAZIRLIK',        9, false),
    ('ASM-0669','LS031','SÜNGERİ DESTEĞE YAPIŞTIRMA İŞLEMİ',  11, false),
    ('ASM-0670','LS031','KOL DESTEK DÖŞEME',                  12, false),
    ('ASM-0671','LS031','KOL DESTEK MONTAJ',                  13, false),
    ('ASM-0672','LS031','KASA-KAPAK BİRLEŞTİRME',             14, false),
    ('ASM-0673','LS031','DÖŞEME HAZIRLIK',                    15, false),
    ('ASM-0674','LS031','DÖŞEME',                             16, true),
    ('ASM-0675','LS031','PAKETLEME',                          17, false),
    ('ASM-0676','LS031','LOGO',                               18, false)
  ON CONFLICT (step_id) DO NOTHING;

  -- ── 3) Reçete ──────────────────────────────────────────────
  INSERT INTO step_bom (step_bom_id, step_id, part_id, qty_per) VALUES
    -- 1 KASA PARÇASINA MENTEŞE TAKMA
    ('SBOM-2196','ASM-0663','HP0001',2), ('SBOM-2197','ASM-0663','HP0002',4),
    ('SBOM-2198','ASM-0663','LS031-P03',1),
    -- 2 İÇ APARATA MIKNATIS TAKMA
    ('SBOM-2199','ASM-0664','HP0009',1), ('SBOM-2200','ASM-0664','HP0022',2),
    ('SBOM-2201','ASM-0664','LS031-P03',1),
    -- 3 KASA BİRLEŞTİRME
    ('SBOM-2202','ASM-0665','ASM-0663',1), ('SBOM-2203','ASM-0665','ASM-0664',1),
    ('SBOM-2204','ASM-0665','LS031-P02',1), ('SBOM-2205','ASM-0665','LS031-P04',1),
    ('SBOM-2206','ASM-0665','LS031-P05',1), ('SBOM-2207','ASM-0665','HP0002',2),
    -- 5 ARKALIK MONTAJ
    ('SBOM-2208','ASM-0666','ASM-0665',1), ('SBOM-2209','ASM-0666','HP0002',10),
    ('SBOM-2210','ASM-0666','LS031-P07',1),
    -- 7 OLUK HAZIRLIK
    ('SBOM-2211','ASM-0667','HP0014',2), ('SBOM-2212','ASM-0667','LS031-P01',1),
    -- 9 ORTA DESTEK PARÇASI HAZIRLIK
    ('SBOM-2213','ASM-0668','ASM-0676',1), ('SBOM-2214','ASM-0668','HP0001',2),
    ('SBOM-2215','ASM-0668','HP0002',4),
    -- 11 SÜNGERİ DESTEĞE YAPIŞTIRMA
    ('SBOM-2216','ASM-0669','HP0059',1), ('SBOM-2217','ASM-0669','LS031-P06',1),
    -- 12 KOL DESTEK DÖŞEME
    ('SBOM-2218','ASM-0670','ASM-0669',1), ('SBOM-2219','ASM-0670','HP0011',23),
    -- 13 KOL DESTEK MONTAJ
    ('SBOM-2220','ASM-0671','ASM-0670',1), ('SBOM-2221','ASM-0671','HP0005',3),
    -- 14 KASA-KAPAK BİRLEŞTİRME
    ('SBOM-2222','ASM-0672','ASM-0666',1), ('SBOM-2223','ASM-0672','ASM-0667',1),
    ('SBOM-2224','ASM-0672','ASM-0668',1), ('SBOM-2225','ASM-0672','ASM-0671',1),
    ('SBOM-2226','ASM-0672','HP0002',4),  ('SBOM-2227','ASM-0672','HP0003',3),
    ('SBOM-2228','ASM-0672','LS031-P08',1),
    -- 15 DÖŞEME HAZIRLIK
    ('SBOM-2229','ASM-0673','HP0060',1), ('SBOM-2230','ASM-0673','HP0061',1),
    -- 16 DÖŞEME
    ('SBOM-2231','ASM-0674','ASM-0672',1), ('SBOM-2232','ASM-0674','ASM-0673',1),
    ('SBOM-2233','ASM-0674','HP0011',55),
    -- 17 PAKETLEME
    ('SBOM-2234','ASM-0675','ASM-0674',1), ('SBOM-2235','ASM-0675','HP0013',0.9),
    ('SBOM-2236','ASM-0675','HP0062',1),
    -- 18 LOGO
    ('SBOM-2237','ASM-0676','LS031-P09',1)
  ON CONFLICT (step_bom_id) DO NOTHING;

  -- ── 4) Eski yapıyı kaldır ──────────────────────────────────
  -- step_bom FK'si NO ACTION; önce reçete satırları silinmeli.
  DELETE FROM step_bom WHERE step_id IN ('ASM-0215','ASM-0216');
  DELETE FROM assembly_steps WHERE step_id IN ('ASM-0215','ASM-0216');
END $$;
