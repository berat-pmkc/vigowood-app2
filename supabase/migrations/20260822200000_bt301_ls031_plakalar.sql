-- =============================================================
-- BT301 ve LS031 için bileşen plakaları
--
-- BT301: BT201 ile aynı ürün; farkı ARKALIK parçası (ve o kesim
--   aşaması) olmaması ve rengin Ceviz değil CAMBRIDGE olması.
--   Geometri aynı olduğu için plaka başına parça adetleri (default_qty)
--   ve makine süreleri BT201'den birebir kopyalandı. BT201'in ARKALIK
--   plakası (PLK-130) bilerek alınmadı.
--
-- LS031: LS051 ile aynı ürün; mousepad ve ray yok. Gövde ölçüleri aynı
--   olduğundan LS051'in plaka başına adetleri ve süreleri kullanıldı.
--   LS051'in MAUSE, RAY+OLUK ve KEÇE plakaları alınmadı; onların yerine
--   yalnızca oluk veren "SADE OLUK" plakası açıldı.
--
-- Mevcut "TAM PROJE" plakaları (PLK-263 BT301A, PLK-145 LS031) DURUYOR.
-- Bunlar tek plakadan tüm seti çıkaran birleşik plakalar; bileşen
-- plakaları onların yerine değil, yanına ekleniyor.
--
-- DOĞRULANMASI GEREKEN TEK SAYI: LS031 SADE OLUK plakasının adedi.
-- LS051'de oluk, ray ile aynı plakada (RAY+OLUK, 497 oluk). Ray
-- çıkınca aynı plakadan daha çok oluk çıkması beklenir; 497 temkinli
-- bir başlangıç. İlk kesimden sonra gerçek adetle güncellenmeli.
-- =============================================================

DO $$
DECLARE
  v_plk  TEXT;
  v_pl   TEXT;
  v_no   INTEGER := 340;   -- PLK numarası
  v_pln  INTEGER := 900;   -- plakalar_id numarası
  v_pp   INTEGER := 5000;  -- ppart_id numarası
  r      RECORD;
BEGIN

-- ── 1) BT301 parçaları ────────────────────────────────────────
-- Bir kısmı önceki yüklemede yer tutucu adla açılmıştı; adları
-- BT201'deki karşılıklarıyla düzeltiliyor.
FOR r IN
  SELECT * FROM (VALUES
    ('BT301-P01','BÜYÜK KAPAK'), ('BT301-P02','KÜÇÜK KAPAK'),
    ('BT301-P03','ORTA DESTEK PARÇASI'), ('BT301-P04','OLUK'),
    ('BT301-P05','APARAT'), ('BT301-P06','ÖN ARKA İÇ'),
    ('BT301-P07','ÖN ARKA DIŞ'), ('BT301-P08','SAĞ'),
    ('BT301-P09','SOL'), ('BT301-P10','ORTA'),
    ('BT301-P11','ORTA EŞEK'), ('BT301-P12','AYAK'),
    ('BT301-P13','AYAK ARASI')
  ) AS t(pid, padi)
LOOP
  INSERT INTO all_parts (part_id, part_adi, part_type, hazir_eleman_aktif_stok,
                         hazir_eleman_kritik_stok, yari_mamul_stok)
  VALUES (r.pid, r.padi, 'YARIMAMUL', 0, 0, 0)
  ON CONFLICT (part_id) DO UPDATE
    SET part_adi = EXCLUDED.part_adi
    WHERE all_parts.part_adi LIKE '%Temmuz-Ağustos yüklemesinde açıldı%'
       OR all_parts.part_adi = all_parts.part_id;
END LOOP;

-- ── 2) BT301 plakaları (BT201'den, ARKALIK hariç) ─────────────
FOR r IN
  SELECT * FROM (VALUES
    ('KAPAK',               '8mm MDF',  42.0,  34.0,  24.0),
    ('ORTA DESTEK PARÇASI', '8mm MDF', 110.0,  70.0,  60.0),
    ('ÖN ARKA İÇ',          '8mm MDF',  90.0,  70.0,  60.0),
    ('ÖN ARKA DIŞ',         '8mm MDF',  90.0,  70.0,  60.0),
    ('SAĞ',                 '8mm MDF', 130.0, 106.0,  96.0),
    ('SOL',                 '8mm MDF', 135.0, 112.0, 102.0),
    ('ORTA',                '8mm MDF', 130.0, 106.0,  96.0),
    ('ORTA EŞEK',           '8mm MDF', 137.0, 120.0, 110.0),
    ('AYAK',                '8mm MDF', 110.0,  84.0,  74.0),
    ('AYAK ARASI',          '8mm MDF', 110.0,  84.0,  74.0)
  ) AS t(adi, tip, m1, m2, m3)
LOOP
  v_plk := 'PLK-' || lpad(v_no::text, 3, '0');
  v_pl  := 'PL-'  || lpad(v_pln::text, 4, '0');
  INSERT INTO plakalar (plakalar_id, plaka_id, plaka_adi, sku, tipi, renk,
                        plaka_kategori, kesim_sureleri)
  VALUES (v_pl, v_plk, r.adi, ARRAY['BT301A'], r.tip, 'Cambridge', 'MDF',
          jsonb_build_object('MAK-1', r.m1, 'MAK-2', r.m2, 'MAK-3', r.m3))
  ON CONFLICT (plaka_id) DO NOTHING;
  v_no := v_no + 1; v_pln := v_pln + 1;
END LOOP;

-- BT301 plaka → parça (BT201'in adetleriyle)
FOR r IN
  SELECT * FROM (VALUES
    ('KAPAK','BT301-P01',29),  ('KAPAK','BT301-P02',30),
    ('ORTA DESTEK PARÇASI','BT301-P03',198),
    ('ORTA DESTEK PARÇASI','BT301-P04',54),
    ('ORTA DESTEK PARÇASI','BT301-P05',88),
    ('ÖN ARKA İÇ','BT301-P06',194),
    ('ÖN ARKA DIŞ','BT301-P07',194),
    ('SAĞ','BT301-P08',320),
    ('SOL','BT301-P09',320),
    ('ORTA','BT301-P10',339),
    ('ORTA EŞEK','BT301-P05',210), ('ORTA EŞEK','BT301-P11',368),
    ('AYAK','BT301-P12',748),
    ('AYAK ARASI','BT301-P13',611)
  ) AS t(padi, pid, adet)
LOOP
  INSERT INTO plaka_parts (ppart_id, plaka_id, part_id, default_qty, sku)
  SELECT 'PPart'||v_pp, pl.plaka_id, r.pid, r.adet, 'BT301A'
  FROM plakalar pl
  WHERE pl.plaka_adi = r.padi AND pl.sku = ARRAY['BT301A'] AND pl.renk = 'Cambridge'
    AND NOT EXISTS (SELECT 1 FROM plaka_parts x
                    WHERE x.plaka_id = pl.plaka_id AND x.part_id = r.pid);
  v_pp := v_pp + 1;
END LOOP;

-- ── 3) LS031 plakaları (LS051'den; mousepad/ray/keçe hariç) ───
v_no := 350; v_pln := 910;
FOR r IN
  SELECT * FROM (VALUES
    ('SADE OLUK',     '8mm MDF', 'Ceviz', 160.0, 130.0, 120.0),
    ('ORTA',          '8mm MDF', 'Ceviz', 152.0, 137.0, 127.0),
    ('ÖN ARKA',       '8mm MDF', 'Ceviz', 160.0, 125.0, 115.0),
    ('SAĞ YAN',       '8mm MDF', 'Ceviz', 152.0, 137.0, 127.0),
    ('SOL YAN',       '8mm MDF', 'Ceviz', 152.0, 137.0, 127.0),
    ('YANLAR + ORTA', '8mm MDF', 'Ceviz', 170.0, 135.0, 125.0),
    ('KOL DAYAMA',    '5mm MDF', 'Ham',    50.0,  40.0,  30.0),
    ('KAPAK',         '8mm MDF', 'Ceviz',  50.0,  40.0,  30.0),
    ('ORTA DESTEK',   '8mm MDF', 'Ceviz',  50.0,  40.0,  30.0)
  ) AS t(adi, tip, rnk, m1, m2, m3)
LOOP
  v_plk := 'PLK-' || lpad(v_no::text, 3, '0');
  v_pl  := 'PL-'  || lpad(v_pln::text, 4, '0');
  INSERT INTO plakalar (plakalar_id, plaka_id, plaka_adi, sku, tipi, renk,
                        plaka_kategori, kesim_sureleri)
  VALUES (v_pl, v_plk, r.adi, ARRAY['LS031'], r.tip, r.rnk, 'MDF',
          jsonb_build_object('MAK-1', r.m1, 'MAK-2', r.m2, 'MAK-3', r.m3))
  ON CONFLICT (plaka_id) DO NOTHING;
  v_no := v_no + 1; v_pln := v_pln + 1;
END LOOP;

FOR r IN
  SELECT * FROM (VALUES
    ('SADE OLUK','LS031-P01',497),
    ('ORTA','LS031-P02',558),
    ('ÖN ARKA','LS031-P03',357), ('ÖN ARKA','LS031-P05',59),
    ('SAĞ YAN','LS031-P04',558),
    ('SOL YAN','LS031-P05',558),
    ('YANLAR + ORTA','LS031-P02',128),
    ('YANLAR + ORTA','LS031-P04',230),
    ('YANLAR + ORTA','LS031-P05',200),
    ('KOL DAYAMA','LS031-P06',656),
    ('KAPAK','LS031-P08',45), ('KAPAK','LS031-P09',26),
    ('ORTA DESTEK','LS031-P09',165)
  ) AS t(padi, pid, adet)
LOOP
  INSERT INTO plaka_parts (ppart_id, plaka_id, part_id, default_qty, sku)
  SELECT 'PPart'||v_pp, pl.plaka_id, r.pid, r.adet, 'LS031'
  FROM plakalar pl
  WHERE pl.plaka_adi = r.padi AND pl.sku = ARRAY['LS031']
    AND NOT EXISTS (SELECT 1 FROM plaka_parts x
                    WHERE x.plaka_id = pl.plaka_id AND x.part_id = r.pid);
  v_pp := v_pp + 1;
END LOOP;

END $$;
