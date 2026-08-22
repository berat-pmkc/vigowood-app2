-- =============================================================
-- 14–21 Ağustos 2026 kesim kayıtları
--
-- Elle tutulan gün/makine listesinden yükleniyor. Her satır bir kesim
-- partisi: plakadan kaç adet kesildiği. Uygulamadaki createCutBatch ile
-- aynı işi yapar:
--   1. cut_batches      — parti kaydı (durum: tamamlandi)
--   2. cut_lines        — plaka_parts × plaka adedi
--   3. yari_mamul_stok  — her parça için IN hareketi
-- Bakiye kolonu 20260822230000'deki tetikleyiciyle kendiliğinden güncellenir.
--
-- MDF düşümü YAPILMIYOR: uygulama bunu all_parts.mdf_tipi/mdf_renk
-- eşleşmesiyle yapıyor, ancak hiçbir parçada bu alanlar dolu değil —
-- yani canlıda da bu adım hiçbir zaman çalışmıyor. Burada da atlandı ki
-- veri, ekrandan girilmiş kayıtlarla aynı davransın.
--
-- YÜKLENMEYEN 4 SATIR (plaka karşılığı belirsiz):
--   14.08 M2  3D-çıta       1
--   14.08 M3  Yaprak 3-3D   2
--   15.08 M3  3D-c-çıta     1
--   21.08 M1  Kos-40-pul    1   (yeni plaka açılması gerekiyor)
--
-- Operatör bilgisi listede yoktu; boş bırakıldı, plk_notu ile bu
-- yüklemeden geldiği işaretlendi.
-- =============================================================

DO $$
DECLARE
  r        RECORD;
  v_cut    INTEGER;
  v_line   INTEGER;
  v_yms    INTEGER;
  v_cutid  TEXT;
  v_sku    TEXT;
  v_ts     TIMESTAMPTZ;
  pp       RECORD;
BEGIN
  SELECT COALESCE(max((regexp_replace(cut_id,'\D','','g'))::bigint),0)+1
    INTO v_cut FROM cut_batches WHERE cut_id ~ '^KES-\d+$';
  SELECT COALESCE(max((regexp_replace(cut_line_id,'\D','','g'))::bigint),0)+1
    INTO v_line FROM cut_lines WHERE cut_line_id ~ '^K-\d+$';
  SELECT COALESCE(max((regexp_replace(yms_id,'\D','','g'))::bigint),0)+1
    INTO v_yms FROM yari_mamul_stok WHERE yms_id ~ '^YMS-\d+$';

  FOR r IN
    SELECT * FROM (VALUES
      ('2026-08-14','MAK-1','PLK-172', 4),  ('2026-08-14','MAK-1','PLK-207', 4),
      ('2026-08-14','MAK-1','PLK-142', 2),  ('2026-08-14','MAK-1','PLK-092',11),
      ('2026-08-14','MAK-2','PLK-202', 1),  ('2026-08-14','MAK-2','PLK-341', 1),
      ('2026-08-14','MAK-2','PLK-318', 1),  ('2026-08-14','MAK-2','PLK-037', 9),
      ('2026-08-14','MAK-3','PLK-202', 1),  ('2026-08-14','MAK-3','PLK-343', 2),
      ('2026-08-14','MAK-3','PLK-347', 1),  ('2026-08-14','MAK-3','PLK-029',12),

      ('2026-08-15','MAK-1','PLK-217', 2),  ('2026-08-15','MAK-1','PLK-172', 5),
      ('2026-08-15','MAK-2','PLK-292', 1),  ('2026-08-15','MAK-2','PLK-134', 1),
      ('2026-08-15','MAK-2','PLK-359', 1),  ('2026-08-15','MAK-2','PLK-341', 1),
      ('2026-08-15','MAK-2','PLK-122', 1),  ('2026-08-15','MAK-3','PLK-124', 1),
      ('2026-08-15','MAK-3','PLK-349', 1),  ('2026-08-15','MAK-3','PLK-037', 1),

      ('2026-08-17','MAK-1','PLK-172', 4),  ('2026-08-17','MAK-2','PLK-352', 1),
      ('2026-08-17','MAK-2','PLK-357', 3),  ('2026-08-17','MAK-3','PLK-348', 2),
      ('2026-08-17','MAK-3','PLK-253', 1),  ('2026-08-17','MAK-3','PLK-359', 2),

      ('2026-08-18','MAK-1','PLK-172', 1),  ('2026-08-18','MAK-1','PLK-243', 6),
      ('2026-08-18','MAK-2','PLK-349', 1),  ('2026-08-18','MAK-2','PLK-037',11),
      ('2026-08-18','MAK-3','PLK-349', 1),  ('2026-08-18','MAK-3','PLK-032',11),

      ('2026-08-19','MAK-1','PLK-218',14),  ('2026-08-19','MAK-1','PLK-243', 4),
      ('2026-08-19','MAK-1','PLK-318',10),  ('2026-08-19','MAK-2','PLK-328', 4),
      ('2026-08-19','MAK-2','PLK-035', 1),  ('2026-08-19','MAK-2','PLK-340', 4),
      ('2026-08-19','MAK-2','PLK-318',11),  ('2026-08-19','MAK-3','PLK-328', 2),
      ('2026-08-19','MAK-3','PLK-347', 1),  ('2026-08-19','MAK-3','PLK-340', 1),
      ('2026-08-19','MAK-3','PLK-320', 2),  ('2026-08-19','MAK-3','PLK-318',12),

      ('2026-08-20','MAK-1','PLK-130', 7),  ('2026-08-20','MAK-1','PLK-327', 1),
      ('2026-08-20','MAK-2','PLK-009', 9),  ('2026-08-20','MAK-2','PLK-327', 1),
      ('2026-08-20','MAK-2','PLK-130', 1),  ('2026-08-20','MAK-3','PLK-009',10),
      ('2026-08-20','MAK-3','PLK-320', 1),  ('2026-08-20','MAK-3','PLK-327', 1),
      ('2026-08-20','MAK-3','PLK-170', 1),

      ('2026-08-21','MAK-1','PLK-172', 1),  ('2026-08-21','MAK-3','PLK-122', 3)
    ) AS t(gun, makine, plaka, adet)
  LOOP
    -- Aynı yükleme iki kez çalışmasın
    IF EXISTS (SELECT 1 FROM cut_batches
               WHERE plk_notu = 'Ağustos listesi yüklemesi'
                 AND tarih::date = r.gun::date
                 AND makine_id = r.makine AND plaka_id = r.plaka AND adet = r.adet) THEN
      CONTINUE;
    END IF;

    SELECT sku[1] INTO v_sku FROM plakalar WHERE plaka_id = r.plaka;
    v_cutid := 'KES-' || v_cut::text;
    v_ts    := (r.gun || ' 12:00:00+03')::timestamptz;

    INSERT INTO cut_batches (cut_id, tarih, sku, plaka_id, makine_id, adet,
                             operator_id, plk_notu, durum, baslama_zamani, bitis_zamani)
    VALUES (v_cutid, v_ts, v_sku, r.plaka, r.makine, r.adet,
            NULL, 'Ağustos listesi yüklemesi', 'tamamlandi', v_ts, v_ts);
    v_cut := v_cut + 1;

    FOR pp IN
      SELECT p.part_id, p.default_qty, a.part_adi
      FROM plaka_parts p LEFT JOIN all_parts a ON a.part_id = p.part_id
      WHERE p.plaka_id = r.plaka
    LOOP
      INSERT INTO cut_lines (cut_line_id, cut_id, tarih, part_id, adet)
      VALUES ('K-' || v_line::text, v_cutid, v_ts, pp.part_id,
              COALESCE(pp.default_qty,0) * r.adet);
      v_line := v_line + 1;

      INSERT INTO yari_mamul_stok (yms_id, tarih, part_id, part_adi, sku, qty,
                                   direction, source, source_id)
      VALUES ('YMS-' || lpad(v_yms::text, 6, '0'), v_ts, pp.part_id, pp.part_adi,
              v_sku, COALESCE(pp.default_qty,0) * r.adet, 'IN', 'Kesim', v_cutid);
      v_yms := v_yms + 1;
    END LOOP;
  END LOOP;
END $$;
