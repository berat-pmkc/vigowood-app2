-- =============================================================
-- Yurtdışı depo stok sayımı — 2026_08
--
-- Kullanıcı yurtdışı deposunu fiziksel saydı (Excel), sonuç 31 üründe
-- stok. Bu miktarlar YURTDISI deposuna işleniyor.
--
-- MODEL: mamül depo bakiyeleri stock_movements.depo_id üzerinden
-- toplanıyor (urun_depo_stok view'i). Yani depoya stok koymak =
-- o depo_id ile bir hareket satırı eklemek. Ana depo (YURTICI) veya
-- products.stok_aktif'e DOKUNULMUYOR — bunlar fiziksel olarak yurtdışında,
-- ayrı bir depo bakiyesi.
--
-- Sayım niteliği: bu ilk yükleme, yani mevcut YURTDISI bakiyesi 0.
-- Bu yüzden fark = sayılan miktarın tamamı, tek IN hareketi olarak
-- giriliyor. İleride tekrar sayım yapılırsa fark (yeni - eski) yazılmalı.
--
-- Tekrar çalıştırmaya karşı korumalı: aynı batch_id varsa hiç eklenmez.
-- =============================================================

DO $$
DECLARE
  r        RECORD;
  v_no     BIGINT;
  v_batch  TEXT := 'YDS-SAYIM-2026_08';
  v_ts     TIMESTAMPTZ := '2026-08-24 12:00:00+03';
BEGIN
  IF EXISTS (SELECT 1 FROM stock_movements WHERE batch_id = v_batch) THEN
    RAISE NOTICE 'Yurtdışı 2026_08 sayımı zaten yüklü — atlandı';
    RETURN;
  END IF;

  SELECT COALESCE(max((regexp_replace(mov_id,'\D','','g'))::bigint),0)+1
    INTO v_no FROM stock_movements WHERE mov_id ~ '^SM-\d+$';

  FOR r IN
    SELECT * FROM (VALUES
      ('BT201',40),('KOSCEVİZ',636),('KOSMEŞE',636),('LS011',300),('LS014',96),
      ('LS016',102),('LS021',800),('LS023',228),('LS024',124),('LS025',24),
      ('LS051',516),('MKOS41',462),('T1-M',63),('T1-M-L',231),('T3-C-L',77),
      ('T3-M-L',42),('LS057',438),('LS018',48),('LS019',48),('MKOS45',318),
      ('T4-M',35),('T5-C',28),('T5-C-L',21),('T5-M-L',133),('T1-C-XL',5),
      ('T3-C-XL',28),('BT301A',138),('KD50C',77),('KD50M',48),('T4-M-XL',1),('T5-M-XL',1)
    ) AS t(sku, adet)
  LOOP
    INSERT INTO stock_movements (mov_id, tarih, sku, qty, source, source_row_id, batch_id, depo_id)
    VALUES ('SM-'||lpad(v_no::text,6,'0'), v_ts, r.sku, r.adet,
            'Sayım (Yurtdışı)', v_batch, v_batch, 'YURTDISI');
    v_no := v_no + 1;
  END LOOP;
END $$;
